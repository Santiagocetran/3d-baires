"""Package audited NDJSON for the browser without repeating the citywide audit."""
import json
from pathlib import Path
from shapely.geometry import shape
ROOT=Path(__file__).resolve().parents[1]
OBSERVATION='Hasta 2021 (catálogo); fecha individual desconocida'

def round_coordinates(value):
    if isinstance(value,list):return [round_coordinates(v) for v in value]
    return round(value,7)

def run():
    audit_path=ROOT/'docs/audit-results.json'
    audit=json.loads(audit_path.read_text())
    selected=[];fallback=0
    needles=['"barrio":'+json.dumps(name,ensure_ascii=False) for name in audit['neighbourhoods'] if name.upper() in audit['browser_scope']]
    with (ROOT/'data/processed/volumes.ndjson').open() as f:
        for line in f:
            if not any(needle in line for needle in needles):continue
            feature=json.loads(line)
            if feature['properties']['barrio'].upper() not in audit['browser_scope']:continue
            original=feature['geometry']['coordinates']
            feature['geometry']['coordinates']=round_coordinates(original)
            g=shape(feature['geometry'])
            if not g.is_valid or g.is_empty:
                feature['geometry']['coordinates']=original
                fallback+=1
            # Shared snapshot is in summary.json and the UI; original properties stay in NDJSON.
            feature['properties'].pop('observation',None)
            feature['properties'].pop('smp_join_key',None)
            selected.append(feature)
    assert len(selected)==audit['browser_count']
    payload=json.dumps({'type':'FeatureCollection','features':selected},ensure_ascii=False,separators=(',',':'))
    size=len(payload.encode())
    if size>25_000_000:raise ValueError(f'{size} bytes: generate vector tiles; do not raise the budget silently')
    public=ROOT/'public/data';public.mkdir(parents=True,exist_ok=True)
    temporary=public/'buildings.geojson.part';temporary.write_text(payload);temporary.replace(public/'buildings.geojson')
    audit.setdefault('browser_unpacked_bytes',audit['browser_bytes'])
    audit['browser_bytes']=size
    audit['browser_packaging']={'coordinate_decimal_places':7,'invalid_rounding_fallbacks':fallback,'shared_observation':OBSERVATION,'full_precision_retained':'data/processed/volumes.ndjson'}
    audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
    (public/'summary.json').write_text(json.dumps({**{k:audit[k] for k in ('browser_count','browser_bytes','browser_scope','generated_at')},'observation':OBSERVATION},ensure_ascii=False)+'\n')
    neighbourhoods=json.loads((ROOT/'data/raw/barrios.geojson').read_text())
    scope={'type':'FeatureCollection','features':[f for f in neighbourhoods['features'] if f['properties']['nombre'].upper() in audit['browser_scope']]}
    (public/'scope.geojson').write_text(json.dumps(scope,ensure_ascii=False,separators=(',',':')))
    from history import run as history
    history()
    print(f'Published {len(selected):,} volumes, {size:,} bytes; {fallback} rounding fallbacks')

if __name__=='__main__':run()
