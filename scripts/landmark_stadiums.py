"""Normaliza puntos oficiales de estadios seleccionados; conserva el recurso crudo."""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/vicejefatura-de-gobierno/estadios/estadios.geojson'
SELECTED = {103:'bombonera',114:'monumental',115:'bidegain',56:'duco',119:'amalfitani',16:'maradona',140:'ferro',55:'atlanta'}

def stadium_points(collection):
    if collection.get('type') != 'FeatureCollection' or collection.get('crs',{}).get('properties',{}).get('name') != 'urn:ogc:def:crs:EPSG::9498':
        raise ValueError('Se esperaba FeatureCollection EPSG:9498; revisar esquema/CRS')
    transform = Transformer.from_crs(9498,4326,always_xy=True)
    found = {}
    for feature in collection['features']:
        props=feature['properties'];original_id=props['id']
        if original_id not in SELECTED:
            continue
        if original_id in found:
            raise ValueError('ID de estadio duplicado')
        geometry=feature['geometry'];xy=geometry.get('coordinates')
        if geometry.get('type')!='Point' or not isinstance(xy,list) or len(xy)!=2 or not all(isinstance(x,(float,int)) and math.isfinite(x) for x in xy):
            raise ValueError('Se esperaba Point finito en metros')
        lng,lat=transform.transform(*xy)
        if not (-58.54<lng<-58.31 and -34.72<lat<-34.52):
            raise ValueError('Estadio fuera del rango de CABA: revisar ejes/CRS')
        for field in ['nam','aso','dir','bar']:
            if not isinstance(props.get(field),str) or not props[field]:
                raise ValueError('Campo de estadio faltante: '+field)
        found[original_id]={'id':SELECTED[original_id],'source_id':original_id,'source_name':props['nam'],'source_club':props['aso'],'source_address':props['dir'],'source_neighbourhood':props['bar'],'original_coordinates':xy,'coordinates':[lng,lat]}
    if set(found)!=set(SELECTED):
        raise ValueError('Faltan estadios seleccionados')
    return [found[i] for i in SELECTED]

def main():
    raw_path=ROOT/'data/raw/landmark-estadios.geojson'
    retrieved_at=None
    manifest_path=ROOT/'data/stadium-points.json'
    if not raw_path.exists():
        raw_path.parent.mkdir(parents=True,exist_ok=True)
        # Exclusive creation: never overwrite a previously retrieved raw resource.
        raw=subprocess.check_output(['curl','--fail','--location','--silent','--show-error',URL])
        stadium_points(json.loads(raw))
        with raw_path.open('xb') as output:output.write(raw)
        retrieved_at=datetime.now(timezone.utc).isoformat()
    raw=raw_path.read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if retrieved_at is None and manifest_path.exists():
        previous=json.loads(manifest_path.read_text())
        if previous.get('sha256')==digest:retrieved_at=previous.get('retrieved_at')
    output={'source':URL,'catalogue_url':'https://data.buenosaires.gob.ar/dataset/estadios','resource_id':'05949d0c-c768-43cf-941a-38db746a8579','retrieved_at':retrieved_at,'catalogue_updated_at':'2026-06-18','observation_date':None,'license':'CC-BY-2.5-AR','license_url':'https://creativecommons.org/licenses/by/2.5/ar/','sha256':digest,'source_crs':'EPSG:9498','output_crs':'EPSG:4326','transformation':'pyproj Transformer.from_crs(9498,4326,always_xy=True); puntos de referencia, sin asociación a volúmenes','places':stadium_points(json.loads(raw))}
    (ROOT/'data/stadium-points.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(output["places"])} estadios, EPSG:9498 → EPSG:4326')

if __name__=='__main__':main()
