export async function loadPayload(url:string,signal:AbortSignal,limit:number,onAttempt=()=>{},exact?:number):Promise<ArrayBuffer>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   onAttempt();const r=await fetch(url,{signal});
   if(!r.ok){const e=new Error(`${url}: HTTP ${r.status}`);if(r.status!==408&&r.status!==429&&r.status<500)throw Object.assign(e,{permanent:true});throw e}
   if(!r.body)throw Object.assign(new Error(`${url}: respuesta vacía`),{permanent:true});
   async function read(stream:ReadableStream<Uint8Array>,max:number){const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error(`${url}: tamaño excedido`);chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length}return all}
   let bytes=await read(r.body,limit+65536);
   if(bytes[0]===31&&bytes[1]===139)bytes=await read(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),limit);
   if(bytes.length>limit||(exact!==undefined&&bytes.length!==exact))throw new Error(`${url}: tamaño de contenido inválido`);
   if(!bytes.length||bytes[0]===60)throw new Error(`${url}: contenido inesperado`);
   return bytes.buffer as ArrayBuffer;
  }catch(e){if(signal.aborted)throw signal.reason??e;if((e as {permanent?:boolean}).permanent||attempt===2)throw new Error(`No se pudo cargar ${url}: ${e instanceof Error?e.message:String(e)}`);await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},150*(attempt+1));signal.addEventListener('abort',abort,{once:true})})}
 }
 throw new Error('Carga interrumpida');
}
