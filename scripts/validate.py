"""Validate generated delivery against the audit and real source-derived geometry."""
import json
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]

def run():
    data=json.loads((ROOT/'public/data/buildings.geojson').read_text())
    audit=json.loads((ROOT/'docs/audit-results.json').read_text())
    scope=json.loads((ROOT/'public/data/scope.geojson').read_text())
    stories=json.loads((ROOT/'public/data/stories.json').read_text())
    assert len(data['features'])==audit['browser_count']>0
    area=unary_union([shape(f['geometry']) for f in scope['features']])
    seen=set()
    for f in data['features']:
        g=shape(f['geometry']);p=f['properties']
        assert g.is_valid and not g.is_empty and area.covers(g.representative_point())
        assert f['id'] not in seen; seen.add(f['id'])
        assert p['construction_year'] is None
        if p['height_status']=='valid': assert isinstance(p['height'],(float,int)) and 0<p['height']<=350
        assert p['smp']==p['smp'].strip()
    for s in stories:
        assert s['source'].startswith('https://turismo.buenosaires.gob.ar/')
        for d in s['dates']: assert d['source'] and d['type'] and 1500<d['year']<2027
        if 'coordinates' in s:
            assert area.covers(Point(s['coordinates']))
            assert s['location_method']=='exact_official_address_to_unique_parcel'
        if s['construction_year']:
            assert any(d['type']=='construcción' and d['year']==s['construction_year'] for d in s['dates'])
    assert sum(audit['height_status'].values())==audit['counts']['records']
    print(f"Validated {len(seen):,} volumes, {len(stories)} sourced stories, scope, heights and date semantics.")

if __name__=='__main__':run()
