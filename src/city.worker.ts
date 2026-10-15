import {buildMesh} from './city-mesh';
self.onmessage=({data}:{data:{buf:ArrayBuffer;id:number}})=>{
  try{
    const m=buildMesh(data.buf);
    self.postMessage({id:data.id,...m},{transfer:[m.pos.buffer,m.bld.buffer,m.idx.buffer,m.attr.buffer,m.gids.buffer]});
  }catch(error){self.postMessage({id:data.id,error:error instanceof Error?error.message:String(error)})}
};
