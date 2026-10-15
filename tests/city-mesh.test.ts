import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMesh,validateMeshIdentity} from '../src/city-mesh';
// Independent fixture: one volume, polygon with a hole, plus disjoint polygon.
function fixture(height=12){
  const rings=[[[0,0],[10,0],[10,10],[0,10]],[[3,3],[3,7],[7,7],[7,3]],[[20,0],[22,0],[22,2],[20,2]]];
  const arrays=[new Uint32Array([42]),new Float32Array([height]),new Uint32Array([0,2]),new Uint32Array([0,2,3]),new Uint32Array([0,4,8,12]),new Float32Array(rings.flat(2))];
  const buf=new ArrayBuffer(28+arrays.reduce((sum,a)=>sum+a.byteLength,0));
  const h=new DataView(buf);[0x31414243,1,2,3,12].forEach((v,i)=>h.setUint32(i*4,v,true));h.setFloat32(20,600,true);h.setFloat32(24,-1200,true);
  let offset=28;for(const a of arrays){new Uint8Array(buf,offset,a.byteLength).set(new Uint8Array(a.buffer));offset+=a.byteLength}
  return buf;
}
test('roofs preserve holes and disconnected parts; walls and roof share vertices',()=>{
  const m=buildMesh(fixture());assert.equal(m.pos.length/3,24);assert.equal(m.gids[0],42);assert.equal(m.attr[0],12);assert.deepEqual(m.origin,[600,-1200]);
  let roofArea=0;
  for(let i=0;i<m.idx.length;i+=3){
    const tri=Array.from(m.idx.slice(i,i+3),j=>Array.from(m.pos.slice(j*3,j*3+3)));
    if(tri.every(p=>p[1]===12)){
      const [a,b,c]=tri;roofArea+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2;
    }
  }
  assert.equal(roofArea,100-16+4);
  assert.ok([...m.idx].every(i=>i<m.pos.length/3));
});
test('unknown height stays unknown in attributes and only produces a flat roof',()=>{
  const m=buildMesh(fixture(NaN));assert.equal(m.attr[0],-1);
  for(let i=1;i<m.pos.length;i+=3)assert.equal(m.pos[i],0);
  assert.ok(m.idx.length<buildMesh(fixture()).idx.length);
});
test('bad format and unvalidated heights fail instead of fabricating geometry',()=>{
  const buf=fixture();new DataView(buf).setUint32(0,0,true);assert.throws(()=>buildMesh(buf),/CBA1/);
  assert.throws(()=>buildMesh(fixture(830)),/Altura/);
  assert.throws(()=>buildMesh(fixture().slice(0,100)));
});
test('rejects nonmonotone indices, infinity heights and nonfinite coordinates before triangulation',()=>{
 assert.throws(()=>buildMesh(fixture(Infinity)),/Altura/);
 const bad=fixture();new DataView(bad).setUint32(40,3,true);assert.throws(()=>buildMesh(bad),/índices|Índices/);
 const coords=fixture();new DataView(coords).setFloat32(coords.byteLength-4,Infinity,true);assert.throws(()=>buildMesh(coords),/Coordenada/);
 const huge=fixture();new DataView(huge).setUint32(16,0xffffffff,true);assert.throws(()=>buildMesh(huge));
});

test('worker texture identity must match source IDs and expected block',()=>{
 const m=buildMesh(fixture());validateMeshIdentity(m,1,42,[600,-1200]);
 assert.throws(()=>validateMeshIdentity(m,2,42,[600,-1200]));
 assert.throws(()=>validateMeshIdentity(m,1,41,[600,-1200]));
 assert.throws(()=>validateMeshIdentity(m,1,42,[0,-1200]));
 m.attr[1]=41;assert.throws(()=>validateMeshIdentity(m,1,42,[600,-1200]),/Identidad/);
});
