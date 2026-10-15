// Adapted from alexbarakov/amsterdam-by-building, web/worker.js (MIT).
// See licenses/amsterdam-by-building-MIT.txt. CABA keeps volume identity and unknown heights.
import {ShapeUtils,Vector2} from 'three';
export type MeshData={pos:Float32Array;bld:Uint16Array;idx:Uint16Array|Uint32Array;attr:Float32Array;gids:Uint32Array;origin:[number,number];nB:number;bounds:{center:[number,number,number];radius:number}};
export function buildMesh(buf:ArrayBuffer):MeshData{
  const h=new DataView(buf);
  if(h.byteLength<28||h.getUint32(0,true)!==0x31414243)throw new Error('Formato CBA1 inválido');
  const nB=h.getUint32(4,true),nP=h.getUint32(8,true),nR=h.getUint32(12,true),nV=h.getUint32(16,true);
  if(nB<1||nB>65535||nP<nB||nR<nP||nV<3*nR||28+8*nB+4*(nB+nP+nR+3)+8*nV!==buf.byteLength||buf.byteLength>128e6)throw new Error('Índices de volumen fuera de rango');
  const origin:[number,number]=[h.getFloat32(20,true),h.getFloat32(24,true)];
  let offset=28;
  function u32(n:number){const a=new Uint32Array(buf,offset,n);offset+=4*n;return a}
  function f32(n:number){const a=new Float32Array(buf,offset,n);offset+=4*n;return a}
  const gids=u32(nB),height=f32(nB),parts=u32(nB+1),rings=u32(nP+1),verts=u32(nR+1),xz=f32(2*nV);
  if(offset!==buf.byteLength||parts[0]!==0||parts[nB]!==nP||rings[0]!==0||rings[nP]!==nR||verts[0]!==0||verts[nR]!==nV)throw new Error('Bloque truncado o índices inválidos');
  if(!origin.every(Number.isFinite))throw new Error('Origen no finito');
  for(const list of [parts,rings,verts])for(let i=1;i<list.length;i++)if(list[i]<=list[i-1])throw new Error('Índices no monótonos');
  const seen=new Set<number>();for(let b=0;b<nB;b++){if(gids[b]>16777213||seen.has(gids[b]))throw new Error('Identidad de volumen inválida');seen.add(gids[b]);if(!Number.isNaN(height[b])&&(!Number.isFinite(height[b])||height[b]<0||height[b]>350))throw new Error('Altura inválida')}
  for(let r=0;r<nR;r++)if(verts[r+1]-verts[r]<3)throw new Error('Anillo degenerado');
  for(const value of xz)if(!Number.isFinite(value))throw new Error('Coordenada no finita');
  const pos=new Float32Array(nV*6),bld=new Uint16Array(nV*2),indices=new Uint32Array(nV*12);
  let v=0,k=0;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=0;
  for(let b=0;b<nB;b++){
    const top=Number.isFinite(height[b])?height[b]:0;
    maxY=Math.max(maxY,top);
    if(top<0||top>350)throw new Error('Altura no validada en malla');
    for(let p=parts[b];p<parts[b+1];p++){
      const contours:Vector2[][]=[],roofIndices:number[]=[];
      for(let r=rings[p];r<rings[p+1];r++){
        const start=verts[r],end=verts[r+1],n=end-start,base=v;
        if(n<3)throw new Error('Anillo degenerado');
        const contour:Vector2[]=[];
        for(let i=0;i<n;i++){
          const x=xz[2*(start+i)],z=xz[2*(start+i)+1];
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
          pos.set([x,0,z,x,top,z],v*3);bld[v]=bld[v+1]=b;
          roofIndices.push(v+1);contour.push(new Vector2(x,z));v+=2;
          if(top>0){const a=base+2*i,c=base+2*((i+1)%n);indices.set([a,c,c+1,a,c+1,a+1],k);k+=6}
        }
        contours.push(contour);
      }
      for(const tri of ShapeUtils.triangulateShape(contours[0],contours.slice(1))){
        indices.set(tri.map(i=>roofIndices[i]),k);k+=3;
      }
    }
  }
  const attr=new Float32Array(nB*4);
  for(let b=0;b<nB;b++)attr.set([Number.isFinite(height[b])?height[b]:-1,gids[b],((gids[b]*2654435761)>>>0)/4294967296,0],b*4);
  return {pos,bld,idx:v<=65535?new Uint16Array(indices.subarray(0,k)):indices.slice(0,k),attr,gids:gids.slice(),origin,nB,bounds:{center:[(minX+maxX)/2,maxY/2,(minZ+maxZ)/2],radius:Math.hypot(maxX-minX,maxY,maxZ-minZ)/2}};
}
// Validate the transferred identity channel before incorporating a worker result.
export function validateMeshIdentity(m:MeshData,n:number,maxRow:number,origin:[number,number]){
 if(!(m.pos instanceof Float32Array)||!(m.bld instanceof Uint16Array)||!(m.idx instanceof Uint16Array||m.idx instanceof Uint32Array)||!(m.attr instanceof Float32Array)||!(m.gids instanceof Uint32Array)||m.nB!==n||m.gids.length!==n||m.attr.length!==n*4||m.pos.length!==m.bld.length*3||m.idx.length%3||m.origin.some((v,i)=>v!==origin[i]))throw new Error('Buffers worker incompatibles con bloque');
 if(!m.bounds||!m.bounds.center.every(Number.isFinite)||!Number.isFinite(m.bounds.radius)||m.bounds.radius<0)throw new Error("Límites worker inválidos");
 const ids=new Set<number>();for(let b=0;b<n;b++){const gid=m.gids[b];if(gid>maxRow||ids.has(gid)||m.attr[b*4+1]!==gid)throw new Error('Identidad de textura incompatible con volumen');ids.add(gid)}
}
