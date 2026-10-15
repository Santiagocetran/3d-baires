"""Small real-data fixture for browser interaction tests; never used by the product."""
import gzip,json,sys
from pathlib import Path
import numpy as np
from meshpack import ROOT,pack_tile,ORIGIN,COS,PROJECT,OX,OY,TILE
import math
out=ROOT/'data/processed/browser-fixture';out.mkdir(exist_ok=True)
index=[];max_row=0
# Reproducible selection from audited original NDJSON, independent of temporary pipeline files.
groups={(0,0):[],(-1,0):[]}
for line in (ROOT/'data/processed/volumes.ndjson').open():
    f=json.loads(line);g=f['geometry'];first=g['coordinates'][0][0][0] if g['type']=='MultiPolygon' else g['coordinates'][0][0]
    x,y=PROJECT.transform(*first[:2]);key=(math.floor((x-OX)*COS/TILE),math.floor(-(y-OY)*COS/TILE))
    if key in groups and len(groups[key])<400:groups[key].append(f)
    if all(len(rows)==400 for rows in groups.values()):break
for k,((tx,tz),rows) in enumerate(groups.items()):
    blob,attrs,stats=pack_tile(rows,np.array([tx,tz])*600)
    name=f'pack{k}.bin.gz';(out/name).write_bytes(gzip.compress(blob,mtime=0))
    (out/f'attrs{k}.json.gz').write_bytes(gzip.compress(json.dumps(attrs).encode(),mtime=0))
    max_row=max(max_row,max(p['source_row'] for p in attrs))
    index.append({'id':str(k),'origin':[tx*600,tz*600],'n':len(rows),'pack':name,'offset':0,'length':len(blob),'attrs':f'attrs{k}.json.gz'})
config={'origin':ORIGIN,'cos_origin':COS,'max_source_row':max_row,'source_records':sum(t['n'] for t in index),'tiles':index,'packs':[{'file':t['pack'],'bytes':(out/t['pack']).stat().st_size} for t in index]}
(out/'city.json').write_text(json.dumps(config))
print('Real fixture ready',config['source_records'])
