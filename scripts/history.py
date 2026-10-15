"""Locate stories by exact street+door -> unique current parcel, never nearest building."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
import ijson
from shapely.geometry import shape, mapping
from core import canonical_smp

ROOT=Path(__file__).resolve().parents[1]

def run():
    stories=json.loads((ROOT/'data/stories.json').read_text())
    candidates=defaultdict(set)
    with (ROOT/'data/raw/frentes.csv').open(encoding='utf-8-sig') as f:
        for p in csv.DictReader(f):
            for s in stories:
                if p['frente']==s['street'] and str(s['number']) in re.split(r'[. ,;/]+', p['num_dom']):
                    candidates[s['id']].add(p['smp'])
    requested=set().union(*candidates.values())
    parcels=defaultdict(list)
    with (ROOT/'data/raw/parcelas.geojson').open('rb') as f:
        for feature in ijson.items(f,'features.item',use_float=True):
            p=feature['properties']
            key=canonical_smp(p.get('smp'))
            if key in requested:
                parcels[key].append(feature)
    buildings=json.loads((ROOT/'public/data/buildings.geojson').read_text())
    by_smp=defaultdict(list)
    for b in buildings['features']:
        by_smp[canonical_smp(b['properties']['smp'])].append(b)
    results=[]
    for s in stories:
        keys=sorted(candidates[s['id']])
        s['parcel_candidates']=keys
        if len(keys)==1 and len(parcels[keys[0]])==1:
            p=parcels[keys[0]][0]
            geom=shape(p['geometry'])
            point=geom.representative_point()
            if not (-59<point.x<-57 and -36<point.y<-33):
                raise ValueError('History requires geographic parcel CRS; review transformation')
            s['smp']=keys[0]
            s['coordinates']=[point.x,point.y]
            s['location_method']='exact_official_address_to_unique_parcel'
            s['location_note']='Dirección oficial vinculada a una parcela única. Marcador dentro de esa parcela; no identifica un volumen individual.'
            s['candidate_volume_ids']=[b['properties']['source_id'] for b in by_smp[keys[0]] if geom.covers(shape(b['geometry']).representative_point())]
            # The verified construction year applies to the historical place, not every roof volume.
        else:
            s['location_method']='unresolved'
            s['location_note']='Sin coincidencia única en el catastro actual. Se conserva el relato sin marcador ni año asignado a volúmenes.'
        results.append(s)
    (ROOT/'public/data/stories.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'docs/history-matches.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(results)} stories; {sum("coordinates" in s for s in results)} uniquely matched parcels')

if __name__=='__main__': run()
