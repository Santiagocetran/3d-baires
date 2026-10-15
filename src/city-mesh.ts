// Adapted from alexbarakov/amsterdam-by-building, web/worker.js (MIT).
// See licenses/amsterdam-by-building-MIT.txt. CABA keeps volume identity and unknown heights.
import {ShapeUtils,Vector2} from 'three';
export type MeshData={pos:Float32Array;bld:Uint16Array;idx:Uint16Array|Uint32Array;attr:Float32Array;gids:Uint32Array;origin:[number,number];nB:number};
export function buildMesh(buf:ArrayBuffer):MeshData{
  const h=new DataView(buf);
  if(h.byteLength<28||h.getUint32(0,true)!==0x31414243)throw new Error('Formato CBA1 inválido');
  const nB=h.getUint32(4,true),nP=h.getUint32(8,true),nR=h.getUint32(12,true),nV=h.getUint32(16,true);
  if(nB>65535)throw new Error('Índices de volumen fuera de rango');
  const origin:[number,number]=[h.getFloat32(20,true),h.getFloat32(24,true)];
  let offset=28;
  function u32(n:number){const a=new Uint32Array(buf,offset,n);offset+=4*n;return a}
  function f32(n:number){const a=new Float32Array(buf,offset,n);offset+=4*n;return a}
  const gids=u32(nB),height=f32(nB),parts=u32(nB+1),rings=u32(nP+1),verts=u32(nR+1),xz=f32(2*nV);
  if(offset!==buf.byteLength||parts[0]!==0||parts[nB]!==nP||rings[0]!==0||rings[nP]!==nR||verts[0]!==0||verts[nR]!==nV)throw new Error('Bloque truncado o índices inválidos');
  const pos=new Float32Array(nV*6),bld=new Uint16Array(nV*2),indices=new Uint32Array(nV*12);
  let v=0,k=0;
  for(let b=0;b<nB;b++){
    const top=Number.isFinite(height[b])?height[b]:0;
    if(top<0||top>350)throw new Error('Altura no validada en malla');
    for(let p=parts[b];p<parts[b+1];p++){
      const contours:Vector2[][]=[],roofIndices:number[]=[];
      for(let r=rings[p];r<rings[p+1];r++){
        const start=verts[r],end=verts[r+1],n=end-start,base=v;
        if(n<3)throw new Error('Anillo degenerado');
        const contour:Vector2[]=[];
        for(let i=0;i<n;i++){
          const x=xz[2*(start+i)],z=xz[2*(start+i)+1];
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
  for(let b=0;b<nB;b++)attr.set([Number.isFinite(height[b])?height[b]:-1,gids[b],0,0],b*4);
  return {pos,bld,idx:v<=65535?new Uint16Array(indices.subarray(0,k)):indices.slice(0,k),attr,gids:gids.slice(),origin,nB};
}
