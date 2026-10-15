// Persistent meshes, attribute textures, shader entrance and GPU picking adapted from
// alexbarakov/amsterdam-by-building web/app.js (MIT). See licenses/ and docs/amsterdam-architecture.md.
import * as THREE from 'three';
import maplibregl,{type CustomLayerInterface,type Map as MapInstance,type MapMouseEvent} from 'maplibre-gl';
import type {MeshData} from './city-mesh';
export type Building=Record<string,string|number|null>;
type Tile={id:string;origin:[number,number];n:number;pack:string;offset:number;length:number;attrs:string};
export type CityConfig={origin:[number,number];cos_origin:number;max_source_row:number;source_records:number;tiles:Tile[];packs:{file:string;bytes:number}[]};
type Callbacks={progress:(loaded:number,total:number)=>void;select:(building:Building)=>void;error:(message:string)=>void};
const WIDTH=256;
const vertex=/*glsl*/`
  in float bld;
  uniform sampler2D uAttr;
  uniform float uNow,uBorn,uReduced,uMode,uSelected,uAltitude;
  out vec3 vColor;
  out vec3 vWorld;
  flat out float vGid;
  void main(){
    int i=int(bld+0.5);
    vec4 a=texelFetch(uAttr,ivec2(i%256,i/256),0);
    vGid=a.y;
    vec3 p=position;
    float seed=fract(sin(a.y*12.9898)*43758.5453);
    float arrive=uReduced>0.5?1.0:clamp((uNow-uBorn)/0.9-seed*0.35,0.0,1.0);
    float fly=1.0-arrive;
    float e=fly*fly*fly;
    float angle=seed*6.2831853;
    // Visual entrance only. Final height is the published accepted height, unknown stays flat.
    if(a.x>=0.0){
      p.xz+=vec2(cos(angle),sin(angle))*(180.0+160.0*fract(seed*7.13))*e;
      p.y+=(260.0+240.0*fract(seed*3.71))*e;
    }
    p.y*=uAltitude;
    vec3 c=a.x<0.0?vec3(0.533,0.580,0.584):a.x<10.0?vec3(0.863,0.910,0.812):a.x<20.0?vec3(0.663,0.788,0.643):a.x<40.0?vec3(0.424,0.667,0.612):a.x<80.0?vec3(0.224,0.529,0.545):vec3(0.141,0.357,0.451);
    if(uMode>0.5)c=vec3(0.682,0.722,0.725);
    if(a.y==uSelected)c=vec3(0.90,0.42,0.21);
    vColor=c;
    vec4 w=modelMatrix*vec4(p,1.0);
    vWorld=w.xyz;
    gl_Position=projectionMatrix*viewMatrix*w;
  }
`;
const fragment=/*glsl*/`
  precision highp float;
  in vec3 vColor;
  in vec3 vWorld;
  flat in float vGid;
  out vec4 outColor;
  void main(){
    #ifdef PICK
      float id=vGid+1.0;
      outColor=vec4(mod(id,256.0),mod(floor(id/256.0),256.0),floor(id/65536.0),255.0)/255.0;
    #else
      vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      float sun=max(dot(n,normalize(vec3(-0.55,0.55,0.62))),0.0);
      float light=abs(n.y)>0.9?1.04:0.68+0.32*sun;
      outColor=vec4(vColor*light,1.0);
    #endif
  }
`;
async function unzip(url:string,signal:AbortSignal){
  const r=await fetch(url,{signal});
  if(!r.ok)throw new Error(`No se pudo cargar ${url}: HTTP ${r.status}`);
  if(!r.body)throw new Error('Respuesta vacía');
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
export function createResidentCity(config:CityConfig,callbacks:Callbacks){
  const abort=new AbortController(),scene=new THREE.Scene(),camera=new THREE.Camera();
  const uniforms={uNow:{value:0},uReduced:{value:matchMedia('(prefers-reduced-motion: reduce)').matches?1:0},uMode:{value:0},uSelected:{value:-1}};
  const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];
  const pool:Worker[]=[];
  const rowToTile=new Uint32Array(config.max_source_row+1);
  const attrsCache=new Map<number,Building[]>();
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const origin=maplibregl.MercatorCoordinate.fromLngLat(config.origin);
  // XY uses EPSG:3857 (WGS84 semi-major radius), not MapLibre’s mean-earth altitude radius.
  const scale=1/(2*Math.PI*6378137*config.cos_origin);
  const model=new THREE.Matrix4().set(scale,0,0,origin.x, 0,0,scale,origin.y, 0,scale,0,0, 0,0,0,1);
  const fullMatrix=new THREE.Matrix4();
  const pickTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const pickPixel=new Uint8Array(4);
  let renderer:THREE.WebGLRenderer,map:MapInstance,loaded=0,nextIndex=0,animateUntil=0,disposed=false,selectionVersion=0;
  let queuedPick:MapMouseEvent|undefined;
  const packs=new Map<string,Promise<ArrayBuffer>>();
  const remaining=new Map(config.packs.map(p=>[p.file,config.tiles.filter(t=>t.pack===p.file).length]));
  const progress=()=>callbacks.progress(loaded,config.tiles.length);
  function makeMaterial(tex:THREE.DataTexture,pick:boolean,born:{value:number},altitude:number){
    return new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{...uniforms,uAttr:{value:tex},uBorn:born,uAltitude:{value:altitude}},
      vertexShader:vertex,fragmentShader:fragment,defines:pick?{PICK:1}:{},side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false});
  }
  function addTile(m:MeshData,id:number){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(m.pos,3));g.setAttribute('bld',new THREE.BufferAttribute(m.bld,1));g.setIndex(new THREE.BufferAttribute(m.idx,1));
    // Full geometry always resident. Frustum culling only skips drawing, never evicts it.
    g.computeBoundingSphere();g.boundingSphere!.radius+=650;
    const data=new Float32Array(WIDTH*Math.ceil(m.nB/WIDTH)*4);data.set(m.attr);
    const tex=new THREE.DataTexture(data,WIDTH,Math.ceil(m.nB/WIDTH),THREE.RGBAFormat,THREE.FloatType);tex.needsUpdate=true;
    const born={value:performance.now()/1000};animateUntil=Math.max(animateUntil,born.value+1.4);
    const lat=new maplibregl.MercatorCoordinate(origin.x,origin.y+(m.origin[1]+300)*scale).toLngLat().lat;
    const altitude=maplibregl.MercatorCoordinate.fromLngLat([config.origin[0],lat]).meterInMercatorCoordinateUnits()/scale;
    const mesh=new THREE.Mesh(g,makeMaterial(tex,false,born,altitude));
    mesh.position.set(m.origin[0],0,m.origin[1]);
    mesh.userData={draw:mesh.material,pick:makeMaterial(tex,true,born,altitude),tex,born};
    for(const gid of m.gids)rowToTile[gid]=id+1;
    scene.add(mesh);meshes.push(mesh);map.triggerRepaint();
  }
  async function next(worker:Worker){
    if(disposed)return;
    const id=nextIndex++,t=config.tiles[id];if(!t){worker.terminate();return}
    try{
      if(!packs.has(t.pack))packs.set(t.pack,unzip(`/data/city/${t.pack}`,abort.signal));
      const pack=await packs.get(t.pack)!;
      if(disposed)return;
      const buf=pack.slice(t.offset,t.offset+t.length);
      if(buf.byteLength!==t.length)throw new Error(`Paquete truncado: ${t.pack}`);
      const left=remaining.get(t.pack)!-1;remaining.set(t.pack,left);if(left===0)packs.delete(t.pack);
      worker.postMessage({buf,id},[buf]);
    }catch(e){if(!disposed)callbacks.error(e instanceof Error?e.message:String(e))}
  }
  async function showBuilding(gid:number){
    const version=++selectionVersion;
    if(gid<0||!rowToTile[gid])return;
    uniforms.uSelected.value=gid;map.triggerRepaint();
    const tileIndex=rowToTile[gid]-1;
    try{
      let attrs=attrsCache.get(tileIndex);
      if(!attrs){
        const buffer=await unzip(`/data/city/${config.tiles[tileIndex].attrs}`,abort.signal);
        attrs=JSON.parse(new TextDecoder().decode(buffer)) as Building[];
        if(attrsCache.size>=8)attrsCache.delete(attrsCache.keys().next().value!);
        attrsCache.set(tileIndex,attrs);
      }
      const building=attrs.find(p=>p.source_row===gid);
      if(!building)throw new Error(`No se encontraron atributos para ${gid}`);
      if(!disposed&&version===selectionVersion)callbacks.select(building);
    }catch(e){if(!disposed)callbacks.error(e instanceof Error?e.message:String(e))}
  }
  function pick(e:MapMouseEvent){
    const {width:w,height:h}=map.getCanvas().getBoundingClientRect();
    // Crop the composed MapLibre projection to the clicked CSS pixel, as Amsterdam's 1px GPU picking.
    const crop=new THREE.Matrix4().set(w,0,0,w-2*e.point.x-1, 0,h,0,-h+2*e.point.y+1, 0,0,1,0, 0,0,0,1);
    camera.projectionMatrix.copy(crop.multiply(fullMatrix));
    for(const mesh of meshes)mesh.material=mesh.userData.pick;
    renderer.setRenderTarget(pickTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,camera);
    renderer.readRenderTargetPixels(pickTarget,0,0,1,1,pickPixel);
    renderer.setRenderTarget(null);camera.projectionMatrix.copy(fullMatrix);
    for(const mesh of meshes)mesh.material=mesh.userData.draw;
    void showBuilding(pickPixel[0]+256*pickPixel[1]+65536*pickPixel[2]-1);
  }
  const onClick=(e:MapMouseEvent)=>{queuedPick=e;map.triggerRepaint()};
  const onMotion=()=>{uniforms.uReduced.value=media.matches?1:0;map.triggerRepaint()};
  const layer:CustomLayerInterface={id:'resident-city',type:'custom',renderingMode:'3d',
    onAdd(m,gl){
      map=m;
      renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl as WebGL2RenderingContext});
      renderer.autoClear=false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
      renderer.debug.onShaderError=()=>callbacks.error('No se pudo compilar el renderizador 3D. Revisá el soporte WebGL2.');
      map.on('click',onClick);media.addEventListener('change',onMotion);progress();
      for(let i=0;i<Math.min(2,navigator.hardwareConcurrency||2);i++){
        const worker=new Worker(new URL('./city.worker.ts',import.meta.url),{type:'module'});pool.push(worker);
        worker.onmessage=({data}:{data:MeshData&{id:number;error?:string}})=>{
          if(disposed)return;
          if(data.error){callbacks.error(data.error);return}
          addTile(data,data.id);loaded++;progress();void next(worker);
        };
        worker.onerror=()=>callbacks.error('Falló la preparación de una malla 3D. Recargá para reintentar.');
        void next(worker);
      }
    },
    render(_gl,args){
      uniforms.uNow.value=performance.now()/1000;
      fullMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(model);camera.projectionMatrix.copy(fullMatrix);
      renderer.resetState();
      renderer.setViewport(0,0,map.getCanvas().width,map.getCanvas().height);
      if(queuedPick){const e=queuedPick;queuedPick=undefined;pick(e);renderer.resetState()}
      renderer.render(scene,camera);
      if(uniforms.uNow.value<animateUntil&&uniforms.uReduced.value===0)map.triggerRepaint();
    },
    onRemove(){
      disposed=true;abort.abort();selectionVersion++;pool.forEach(w=>w.terminate());packs.clear();attrsCache.clear();
      map.off('click',onClick);media.removeEventListener('change',onMotion);
      for(const mesh of meshes){mesh.geometry.dispose();mesh.userData.draw.dispose();mesh.userData.pick.dispose();mesh.userData.tex.dispose()}
      scene.clear();pickTarget.dispose();renderer.dispose();
    }
  };
  return {layer,setMode(mode:'height'|'year'){uniforms.uMode.value=mode==='year'?1:0;map?.triggerRepaint()},
    clearSelection(){selectionVersion++;uniforms.uSelected.value=-1;map?.triggerRepaint()},
    replay(){const now=performance.now()/1000;for(const mesh of meshes)mesh.userData.born.value=now;animateUntil=now+1.4;map.triggerRepaint()}};
}
