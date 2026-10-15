import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {buildMesh} from '../src/city-mesh';
import type {CityConfig} from '../src/resident-city';
const root='public/data/city/';
const config=JSON.parse(await readFile(root+'city.json','utf8')) as CityConfig;
const seen=new Uint8Array(config.max_source_row+1);
let records=0,triangles=0,meshBytes=0,vertices=0,unknown=0,samples=0;
for(const pack of config.packs){
 const bytes=gunzipSync(await readFile(root+pack.file));
 for(const tile of config.tiles.filter(t=>t.pack===pack.file)){
  const buf=Uint8Array.from(bytes.subarray(tile.offset,tile.offset+tile.length)).buffer;
  const m=buildMesh(buf);assert.equal(m.nB,tile.n);assert.deepEqual(m.origin,tile.origin);
  for(const id of m.gids){assert.equal(seen[id],0);seen[id]=1;records++}
  for(let i=0;i<m.nB;i++)if(m.attr[i*4]<0)unknown++;
  assert.ok(m.pos.every(Number.isFinite));
  assert.ok(m.idx.every(v=>v<m.pos.length/3));
  triangles+=m.idx.length/3;vertices+=m.pos.length/3;
  meshBytes+=m.pos.byteLength+m.bld.byteLength+m.idx.byteLength+256*Math.ceil(m.nB/256)*16;
  const attrs=JSON.parse(gunzipSync(await readFile(root+tile.attrs)).toString());
  for(const i of [0,m.nB-1]){
   assert.equal(m.gids[i],attrs[i].source_row);
   if(attrs[i].height_status==='valid')assert.ok(Math.abs(m.attr[i*4]-attrs[i].height)<0.0001);
   else assert.equal(m.attr[i*4],-1);
   assert.equal(attrs[i].construction_year,null);samples++;
  }
 }
}
assert.equal(records,config.source_records);assert.equal(unknown,1);
const report={records,unique_source_rows:seen.reduce((a,b)=>a+b,0),triangles,vertices,typed_mesh_and_texture_bytes:meshBytes,unknown_height_flat:unknown,attribute_samples:samples,
 note:'Buffer storage estimate, not measured browser/GPU memory. Three.js retains CPU arrays and also uploads GPU buffers.'};
await writeFile('docs/resident-validation.json',JSON.stringify(report,null,2)+'\n');console.log(report);
