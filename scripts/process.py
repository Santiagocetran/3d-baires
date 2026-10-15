"""Audit every volume; publish a bounded, unsimplified neighbourhood extract."""
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from core import parse_height, smp_key, match_address, canonical_smp, frontage_numbers


def run():
    import ijson
    from shapely.geometry import shape, mapping
    from shapely.ops import transform
    from shapely import normalize
    from shapely.strtree import STRtree
    from pyproj import CRS, Transformer
    raw = ROOT / 'data/raw'
    processed = ROOT / 'data/processed'
    public = ROOT / 'public/data'
    processed.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'data/downloads.json').read_text())
    from acquire import sha
    for name in ('tejido', 'parcelas', 'frentes', 'barrios'):
        record = manifest[name]
        if record.get('status') != 'downloaded' or sha(ROOT / record['path']) != record['sha256']:
            raise ValueError(f'{name}: missing or altered download')

    crs_report = {}
    def features(name):
        path = raw / f'{name}.geojson'
        with path.open('rb') as f:
            declared = next(ijson.items(f, 'crs'), None)
        crs_name = declared['properties']['name'] if declared else 'EPSG:4326'
        source_crs = CRS.from_user_input(crs_name)
        converter = Transformer.from_crs(source_crs, 'EPSG:4326', always_xy=True)
        needs_transform = not source_crs.equals(CRS.from_epsg(4326), ignore_axis_order=True)
        crs_report[name] = {'declared': declared, 'used': source_crs.to_string(),
                            'output': 'EPSG:4326', 'axis_order': 'longitude,latitude',
                            'absent_crs_policy': 'RFC 7946; geographic bounds validated'}
        with path.open('rb') as f:
            for feature in ijson.items(f, 'features.item', use_float=True):
                props = {k.lower(): v for k, v in feature.get('properties', {}).items()}
                geometry = shape(feature['geometry']) if feature.get('geometry') else None
                if geometry is not None and not geometry.is_empty:
                    if needs_transform:
                        geometry = transform(converter.transform, geometry)
                    a, b, c, d = geometry.bounds
                    if not (-59 < a <= c < -57 and -36 < b <= d < -33):
                        raise ValueError(f'{name}: geometry outside broad Buenos Aires bounds; review CRS')
                yield props, geometry

    neighbourhoods = [(p.get('nombre') or p.get('barrio'), g) for p, g in features('barrios')]
    if not neighbourhoods or any(not name or g is None or not g.is_valid for name, g in neighbourhoods):
        raise ValueError('Neighbourhood schema/geometries need review')
    tree = STRtree([g for _, g in neighbourhoods])
    selected_names = {'SAN TELMO', 'MONSERRAT'}
    if not selected_names.issubset({str(n).upper() for n, _ in neighbourhoods}):
        raise ValueError('Expected neighbourhoods absent')
    parcel_counts, parcel_shapes = Counter(), defaultdict(list)
    original_parcel_counts = Counter()
    parcel_quality = Counter()
    for p, g in features('parcelas'):
        original_parcel_counts[smp_key(p.get('smp'))] += 1
        key = canonical_smp(p.get('smp'))
        parcel_quality['records'] += 1
        if not key:
            parcel_quality['missing_smp'] += 1
        else:
            parcel_counts[key] += 1
            if g is not None and not g.is_empty and g.is_valid:
                parcel_shapes[key].append(g)
        if g is None or g.is_empty:
            parcel_quality['empty_geometry'] += 1
        elif not g.is_valid:
            parcel_quality['invalid_geometry'] += 1
    addresses = defaultdict(set)
    frontage_quality = Counter()
    with (raw / 'frentes.csv').open(encoding='utf-8-sig', newline='') as f:
        sample = f.read(8192)
        f.seek(0)
        reader = csv.DictReader(f, dialect=csv.Sniffer().sniff(sample, delimiters=',;\t'))
        for row in reader:
            p = {k.lower(): v for k, v in row.items() if k}
            if not {'smp', 'frente', 'num_dom'}.issubset(p):
                raise ValueError('Frentes schema changed; expected smp, frente, num_dom')
            frontage_quality['records'] += 1
            key = canonical_smp(p['smp'])
            street, number = p['frente'].strip(), p['num_dom'].strip()
            numbers = frontage_numbers(number)
            if key and street and numbers:
                addresses[key].update(f'{street} {door}' for door in numbers)
            else:
                frontage_quality['missing_identity_or_address'] += 1
    print(f'Parcels: {parcel_quality}; frontages: {frontage_quality}', flush=True)
    stats = Counter()
    types, fields, heights = Counter(), defaultdict(Counter), Counter()
    ids, geometry_hashes, volumes_per_parcel = Counter(), Counter(), Counter()
    coverage = {n: Counter() for n, _ in neighbourhoods}
    joins = Counter()
    bounds = [float('inf'), float('inf'), float('-inf'), float('-inf')]
    selected = []
    numeric_sum, numeric_count = 0, 0
    numeric_min, numeric_max = None, None
    unparseable_examples = Counter()
    with (processed / 'volumes.ndjson').open('w') as output:
        for index, (p, g) in enumerate(features('tejido')):
            stats['records'] += 1
            if index % 100000 == 0: print(f'Auditing volume {index:,}', flush=True)
            for k, v in p.items():
                fields[k][type(v).__name__] += 1
            if not {'id', 'smp', 'altura'}.issubset(p):
                raise ValueError('Tejido schema changed; expected id, smp, altura')
            source_id = str(p['id']) if p['id'] is not None else None
            if source_id:
                ids[source_id] += 1
            else:
                stats['missing_id'] += 1
            smp = smp_key(p['smp'])
            if smp:
                volumes_per_parcel[smp] += 1
            else:
                stats['missing_smp'] += 1
            height, status = parse_height(p['altura'])
            heights[status] += 1
            if status == 'unparseable': unparseable_examples[str(p['altura'])] += 1
            if height is not None:
                numeric_min = height if numeric_min is None else min(height, numeric_min)
                numeric_max = height if numeric_max is None else max(height, numeric_max)
            if status == 'valid':
                numeric_sum += height
                numeric_count += 1
            if original_parcel_counts.get(smp):
                joins['raw_smp_match_records'] += 1
            key = canonical_smp(smp)
            join_status, values = match_address(key, parcel_counts, addresses)
            joins[join_status] += 1
            if g is None or g.is_empty:
                stats['empty_geometry'] += 1
                continue
            types[g.geom_type] += 1
            a, b, c, d = g.bounds
            bounds = [min(bounds[0], a), min(bounds[1], b), max(bounds[2], c), max(bounds[3], d)]
            if not g.is_valid:
                stats['invalid_geometry'] += 1
                continue
            if g.geom_type not in ('Polygon', 'MultiPolygon'):
                stats['non_polygon'] += 1
                continue
            geometry_hashes[hashlib.sha256(normalize(g).wkb).hexdigest()] += 1
            point = g.representative_point()
            hits = tree.query(point, predicate='intersects').tolist()
            if len(hits) != 1:
                stats['neighbourhood_unmatched_or_ambiguous'] += 1
                continue
            neighbourhood = neighbourhoods[hits[0]][0]
            coverage[neighbourhood]['volumes'] += 1
            coverage[neighbourhood][status] += 1
            if parcel_counts.get(key) == 1:
                matches = parcel_shapes.get(key, [])
                if not matches or not matches[0].covers(point):
                    joins['exact_smp_but_spatial_conflict'] += 1
                    join_status = 'spatial_conflict'
            feature = {'type': 'Feature', 'id': index,
                       'properties': {'source_id': source_id, 'source_row': index, 'smp': smp, 'smp_join_key': key,
                                      'height': height, 'height_raw': p['altura'], 'height_status': status,
                                      'tipo': p.get('tipo'), 'origen': p.get('origen'), 'fuente': p.get('fuente'),
                                      'barrio': neighbourhood, 'address_status': join_status,
                                      'addresses': ' · '.join(values), 'construction_year': None,
                                      'observation': 'Hasta 2021 (catálogo); fecha individual desconocida'},
                       'geometry': mapping(g)}
            output.write(json.dumps(feature, ensure_ascii=False, separators=(',', ':')) + '\n')
            if str(neighbourhood).upper() in selected_names:
                selected.append(feature)
    payload = json.dumps({'type': 'FeatureCollection', 'features': selected}, ensure_ascii=False, separators=(',', ':'))
    audit = {'generated_at': datetime.now(timezone.utc).isoformat(), 'sources': manifest,
             'counts': dict(stats), 'geometry_types': dict(types), 'bounds_wgs84': bounds,
             'crs': crs_report, 'field_types': dict(fields), 'height_status': dict(heights),
             'height_range_all_parsed': [numeric_min, numeric_max],
             'unparseable_examples': dict(unparseable_examples.most_common(30)),
             'mean_valid_height': numeric_sum / numeric_count if numeric_count else None,
             'duplicate_id_excess': sum(n - 1 for n in ids.values() if n > 1),
             'duplicate_valid_polygon_geometry_excess': sum(n - 1 for n in geometry_hashes.values() if n > 1),
             'parcels_with_multiple_volumes': sum(n > 1 for n in volumes_per_parcel.values()),
             'parcel_quality': dict(parcel_quality), 'frontage_quality': dict(frontage_quality),
             'duplicate_parcel_smp_keys': sum(n > 1 for n in parcel_counts.values()),
             'joins': dict(joins), 'neighbourhoods': coverage, 'browser_count': len(selected),
             'browser_bytes': len(payload.encode()), 'browser_scope': sorted(selected_names),
             'date_like_fields': [k for k in fields if any(x in k for x in ('fecha', 'anio', 'ano', 'year', 'date'))],
             'limitations': ['Representative-point spatial assignment is not a completeness measure.',
                             'Exact cadastral joins do not establish building identity.',
                             'No individual construction years verified.']}
    (ROOT / 'docs/audit-results.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    from publish import run as publish
    publish()
    audit = json.loads((ROOT / 'docs/audit-results.json').read_text())
    print(json.dumps({k: audit[k] for k in ('counts', 'height_status', 'browser_count', 'browser_bytes')}, indent=2))

if __name__ == '__main__':
    run()
