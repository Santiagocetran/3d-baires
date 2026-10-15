"""Persistent-city binary packs, adapted from Amsterdam s03_tiles (MIT).
CBA1: little endian; header 5*u32 (magic,nB,nP,nR,nV), 2*f32 origin.
Then gid[u32,nB], height[f32,nB], partStart[u32,nB+1],
ringStart[u32,nP+1], vertStart[u32,nR+1], xz[f32,2*nV].
Each part is ONE Polygon, first ring exterior and remaining rings holes.
No geometry clipping, no density or zoom exclusions. Original attrs separate.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import time
import sys
import numpy as np
import shapely
from shapely.geometry import shape
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1]
MAGIC=0x31414243
ORIGIN=(-58.378,-34.617)
COS=math.cos(math.radians(ORIGIN[1]))
TILE=600.0
PROJECT=Transformer.from_crs(4326,3857,always_xy=True)
OX,OY=PROJECT.transform(*ORIGIN)

def local(coords):
    x,y=PROJECT.transform(coords[:,0],coords[:,1])
    return np.column_stack(((x-OX)*COS,-(y-OY)*COS))

def pack_tile(rows, origin):
    geometries=np.array([shape(f['geometry']) for f in rows],dtype=object)
    projected=shapely.transform(geometries,local)
    simplified=shapely.simplify(projected,0.25,preserve_topology=True)
    if not all(shapely.is_valid(simplified)) or any(shapely.is_empty(simplified)):
        raise ValueError('Invalid simplified geometry; do not repair silently')
    gids=[];heights=[];parts=[0];rings=[0];vertices=[0];xz=[];props=[]
    input_vertices=int(sum(shapely.get_num_coordinates(projected)))
    for f,geom in zip(rows,simplified):
        p=f['properties'];gids.append(p['source_row'])
        heights.append(p['height'] if p['height_status']=='valid' else float('nan'))
        props.append({k:v for k,v in p.items() if k not in ('observation','smp_join_key')})
        for poly in geom.geoms if geom.geom_type=='MultiPolygon' else [geom]:
            packed=[]
            for ring in [poly.exterior,*poly.interiors]:
                coords=(np.asarray(ring.coords)[:-1,:2]-origin).astype('<f4')
                xz.append(coords);vertices.append(vertices[-1]+len(coords));packed.append(coords)
            check=shapely.Polygon(packed[0],packed[1:])
            if check.is_empty or not check.is_valid: raise ValueError(f'Float32 topology changed for {p["source_row"]}')
            rings.append(len(vertices)-1)
        parts.append(len(rings)-1)
    v=np.concatenate(xz)
    if len(rows)>65535: raise ValueError('Block exceeds uint16 building index')
    buf=struct.pack('<5I2f',MAGIC,len(rows),len(rings)-1,len(vertices)-1,len(v),*origin)
    for values,dtype in [(gids,'<u4'),(heights,'<f4'),(parts,'<u4'),(rings,'<u4'),(vertices,'<u4'),(v,'<f4')]:
        buf+=np.asarray(values,dtype=dtype).tobytes()
    return buf,props,{'records':len(rows),'vertices':len(v),'input_coordinates':input_vertices,'parts':len(rings)-1,'rings':len(vertices)-1}

def run():
    start=time.monotonic()
    work=ROOT/'data/processed/meshpack-work'
    resume='--resume' in sys.argv
    source=ROOT/'data/processed/volumes.ndjson'
    source_hash=hashlib.file_digest(source.open('rb'),'sha256').hexdigest()
    if work.exists() and not resume:shutil.rmtree(work)
    work.mkdir(exist_ok=True)
    handles={};count=0
    if resume:
        checkpoint=json.loads((work/'checkpoint.json').read_text())
        assert checkpoint['source_sha256']==source_hash, 'Input changed: cannot resume'
        count=checkpoint['records']
        handles={tuple(map(int,p.stem.split('_'))):None for p in work.glob('*.ndjson')}
    else:
        with source.open() as stream:
            for line in stream:
                f=json.loads(line);geometry=f['geometry']
                first=geometry['coordinates'][0][0][0] if geometry['type']=='MultiPolygon' else geometry['coordinates'][0][0]
                x,y=PROJECT.transform(*first[:2]);key=(math.floor((x-OX)*COS/TILE),math.floor(-(y-OY)*COS/TILE))
                if key not in handles:handles[key]=(work/f'{key[0]}_{key[1]}.ndjson').open('w')
                handles[key].write(line);count+=1
                if count%200000==0:print('Grouped',count,flush=True)
        for h in handles.values():h.close()
        (work/'checkpoint.json').write_text(json.dumps({'source_sha256':source_hash,'records':count}))
    target=ROOT/'public/data/city';staging=work/'city';staging.mkdir(exist_ok=True);(staging/'attrs').mkdir(exist_ok=True)
    cache=work/'cache';cache.mkdir(exist_ok=True)
    index=[];totals={'records':0,'vertices':0,'input_coordinates':0,'parts':0,'rings':0};max_row=0
    keys=sorted(handles,key=lambda k:((k[0]+0.5)**2+(k[1]+0.5)**2,k))
    pack=bytearray();pack_index=0;packs=[];pack_members=[]
    def flush_pack():
        nonlocal pack,pack_index,pack_members
        if not pack:return
        name=f'pack-{pack_index}.bin.gz';compressed=gzip.compress(bytes(pack),mtime=0)
        (staging/name).write_bytes(compressed)
        packs.append({'file':name,'bytes':len(compressed),'uncompressed_bytes':len(pack),'sha256':hashlib.sha256(compressed).hexdigest()})
        for entry in pack_members:entry['pack']=name
        pack=bytearray();pack_members=[];pack_index+=1
    for idx,key in enumerate(keys):
        rows=[json.loads(l) for l in (work/f'{key[0]}_{key[1]}.ndjson').open()]
        origin=np.array(key)*TILE
        cached=cache/f'{key[0]}_{key[1]}'
        if cached.with_suffix('.bin').exists() and cached.with_suffix('.json').exists():
            blob=cached.with_suffix('.bin').read_bytes()
            stats=json.loads(cached.with_suffix('.json').read_text())
            attrs=[{k:v for k,v in f['properties'].items() if k not in ('observation','smp_join_key')} for f in rows]
        else:
            blob,attrs,stats=pack_tile(rows,origin)
            cached.with_suffix('.bin').write_bytes(blob)
            cached.with_suffix('.json').write_text(json.dumps(stats))
        if len(pack)+len(blob)>8_000_000:flush_pack()
        name=f'{key[0]}_{key[1]}'
        entry={'id':name,'origin':origin.tolist(),'n':len(rows),'offset':len(pack),'length':len(blob),'attrs':f'attrs/{name}.json.gz'}
        index.append(entry);pack_members.append(entry);pack.extend(blob)
        (staging/entry['attrs']).write_bytes(gzip.compress(json.dumps(attrs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
        max_row=max(max_row,max(p['source_row'] for p in attrs))
        for k,v in stats.items():totals[k]+=v
        if idx%40==0:print('Packed',idx+1,'/',len(keys),flush=True)
    flush_pack()
    assert totals['records']==count
    audit=json.loads((ROOT/'docs/audit-results.json').read_text());assert count==audit['counts']['records']
    config={'format':'CBA1','origin':ORIGIN,'tile_size_m':TILE,'cos_origin':COS,'max_source_row':max_row,
            'tiles':index,'packs':packs,'stats':totals,'source_records':count,'simplification_m':0.25,
            'coordinate_encoding':'Float32 local metres; no clipping; topology checked after encoding',
            'observation':'Hasta 2021; fecha individual desconocida'}
    (staging/'city.json').write_text(json.dumps(config,ensure_ascii=False,separators=(',',':')))
    if target.exists():shutil.rmtree(target)
    staging.rename(target)
    scope=ROOT/'public/data/caba-scope.geojson';scope.write_bytes((ROOT/'data/raw/barrios.geojson').read_bytes())
    report={**totals,'blocks':len(index),'packs':len(packs),'geometry_download_bytes':sum(p['bytes'] for p in packs),
            'geometry_uncompressed_bytes':sum(p['uncompressed_bytes'] for p in packs),
            'attrs_download_bytes':sum(p.stat().st_size for p in (target/'attrs').glob('*')),
            'max_block_bytes':max(t['length'] for t in index),'max_block_records':max(t['n'] for t in index),
            'source_sha256':source_hash,
            'simplification_m':0.25,'records_excluded':0,'encoded_topology_failures':0,
            'successful_run_seconds':round(time.monotonic()-start,1),'resumed':resume}
    (ROOT/'docs/resident-city.json').write_text(json.dumps(report,indent=2)+'\n')
    shutil.rmtree(work)
    print(json.dumps(report,indent=2),flush=True)
if __name__=='__main__':run()
