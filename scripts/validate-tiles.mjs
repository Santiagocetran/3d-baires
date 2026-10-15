/** Check actual MVT delivery and compare sampled properties to audited NDJSON. */
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
const root=new URL('../',import.meta.url);
const summary=JSON.parse(await readFile(new URL('public/data/caba-summary.json',root)));
const unique=new Set(), samples=new Map();
let fragments=0,empty=0;
for(const x of await readdir(new URL('public/data/caba-tiles/15/',root))){
  for(const name of await readdir(new URL(`public/data/caba-tiles/15/${x}/`,root))){
    const path=new URL(`public/data/caba-tiles/15/${x}/${name}`,root);
    const tile=new VectorTile(new Pbf(await readFile(path)));
    const layer=tile.layers.volumes;
    if(!layer){empty++;continue}
    for(let i=0;i<layer.length;i++){
      const f=layer.feature(i),p=f.properties;
      assert.equal(f.type,3);
      assert.equal(f.id,p.source_row);
      assert.ok(!('construction_year' in p)); // Null omitted in MVT, never converted to a year.
      assert.ok(p.source_id && p.height_status);
      if(p.height_status==='valid')assert.ok(p.height>0 && p.height<=350);
      else assert.equal(p.height_status,'implausible');
      unique.add(f.id);fragments++;
      if(i===0)samples.set(f.id,{properties:p, geometry:f.toGeoJSON(Number(x),Number(name.split('.')[0]),15).geometry});
    }
  }
}
const sampleCount=samples.size;
for await(const line of createInterface({input:createReadStream(new URL('data/processed/volumes.ndjson',root))})){
  const f=JSON.parse(line),sample=samples.get(f.id);
  if(!sample)continue;
  const p=sample.properties;
  function points(coords){return typeof coords[0]==='number'?[coords]:coords.flatMap(points)}
  const original=points(f.geometry.coordinates), decoded=points(sample.geometry.coordinates);
  const west=Math.min(...original.map(p=>p[0])),east=Math.max(...original.map(p=>p[0]));
  const south=Math.min(...original.map(p=>p[1])),north=Math.max(...original.map(p=>p[1]));
  for(const [lon,lat] of decoded)assert.ok(lon>=west-0.00002&&lon<=east+0.00002&&lat>=south-0.00002&&lat<=north+0.00002);
  for(const key of ['source_id','source_row','height','height_raw','height_status','smp','barrio','address_status']){
    if(f.properties[key]===null)assert.ok(!(key in p));
    else assert.equal(p[key],f.properties[key]);
  }
  samples.delete(f.id);
}
assert.equal(samples.size,0);
assert.ok(unique.size>1_000_000 && unique.size<=summary.source_records);
const result={zoom:15,unique_source_rows:unique.size,source_records:summary.source_records,
  records_not_represented_at_z15:summary.source_records-unique.size,fragments,empty_tiles:empty,
  sampled_source_property_and_coordinate_matches:sampleCount};
await writeFile(new URL('docs/tile-validation.json',root),JSON.stringify(result,null,2)+'\n');
console.log(result);
