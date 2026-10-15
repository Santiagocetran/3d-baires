// Persistent meshes, attribute textures, shader entrance and GPU picking adapted from
// alexbarakov/amsterdam-by-building web/app.js (MIT). See licenses/ and docs/amsterdam-architecture.md.
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {type CustomLayerInterface,type Map as MapInstance,type MapMouseEvent} from 'maplibre-gl';
import {validateMeshIdentity,type MeshData} from './city-mesh';
export type Building=Record<string,string|number|null>;
import {validateConfig,type CityConfig} from './city-config';
import {loadPayload} from './city-transport';
export type {CityConfig} from './city-config';
export type CityDiagnostics={phase:'loading'|'ready'|'error'|'disposed';expectedBlocks:number;loadedBlocks:number;expectedVolumes:number;loadedVolumes:number;expectedPacks:number;validatedPacks:string[];loadedBlockIds:string[];requestAttempts:number;bufferBytes:number;retainedPackBytes:number;renders:number;error:string|null};
type Callbacks={progress:(loaded:number,total:number)=>void;select:(building:Building)=>void;error:(message:string)=>void;diagnostics?:(value:CityDiagnostics)=>void;selectionState?:(value:{phase:'idle'|'loading'|'ready'|'error';error?:string})=>void};
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
    // Seed is computed once per volume in the worker, never per vertex/frame.
    float seed=a.z;
    float arrive=uReduced>0.5?1.0:clamp((uNow-uBorn-seed*0.16)/1.1,0.0,1.0);
    float fly=1.0-arrive;
    // Short vertical settling avoids the old 500m flight and excessive overlap.
    // Visual effect only: final heights and unknown flat footprints are unchanged.
    if(a.x>=0.0)p.y+=(28.0+seed*36.0)*fly*fly*fly;
    p.y*=uAltitude;
    vec3 c=a.x<0.0?vec3(0.49,0.57,0.65):a.x<10.0?vec3(1.0,0.79,0.24):a.x<20.0?vec3(1.0,0.57,0.27):a.x<40.0?vec3(0.97,0.32,0.38):a.x<80.0?vec3(0.84,0.29,0.58):vec3(0.48,0.32,0.84);
    if(uMode>0.5)c=vec3(0.682,0.722,0.725);
    if(a.y==uSelected)c=vec3(0.15,0.85,1.0);
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
export function createResidentCity(config:CityConfig,callbacks:Callbacks){
  const packSizes=validateConfig(config);
  const diagnostics:CityDiagnostics={phase:'loading',expectedBlocks:config.tiles.length,loadedBlocks:0,expectedVolumes:config.source_records,loadedVolumes:0,expectedPacks:config.packs.length,validatedPacks:[],loadedBlockIds:[],requestAttempts:0,bufferBytes:0,retainedPackBytes:0,renders:0,error:null};
  const snapshot=():CityDiagnostics=>({...diagnostics,validatedPacks:[...diagnostics.validatedPacks],loadedBlockIds:[...diagnostics.loadedBlockIds]});
  const emit=()=>callbacks.diagnostics?.(snapshot());
  const assignments=new Map<Worker,number>();
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
  let renderFatal=false;
  let queuedPick:MapMouseEvent|undefined;
  const packs=new Map<string,Promise<ArrayBuffer>>();
  const remaining=new Map(config.packs.map(p=>[p.file,config.tiles.filter(t=>t.pack===p.file).length]));
  function fail(e:unknown,fatal=false){renderFatal ||= fatal;if(diagnostics.phase==='error'||disposed)return;diagnostics.phase='error';diagnostics.error=e instanceof Error?e.message:String(e);abort.abort();pool.forEach(w=>w.terminate());packs.clear();diagnostics.retainedPackBytes=0;selectionVersion++;emit();callbacks.error(diagnostics.error)}
  const progress=()=>{callbacks.progress(loaded,config.tiles.length);emit()};
  const attempt=()=>{diagnostics.requestAttempts++;emit()};
  // One material per pass, rather than two ShaderMaterial instances per block.
  function makeMaterial(pick:boolean){
    return new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{...uniforms,uAttr:{value:null},uBorn:{value:0},uAltitude:{value:1}},
      vertexShader:vertex,fragmentShader:fragment,defines:pick?{PICK:1}:{},side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false});
  }
  const drawMaterial=makeMaterial(false),pickMaterial=makeMaterial(true);
  function addTile(m:MeshData,id:number){
    const t=config.tiles[id];
    if(!t||diagnostics.loadedBlockIds.includes(t.id))throw new Error('Respuesta worker incompatible con bloque');
    validateMeshIdentity(m,t.n,config.max_source_row,t.origin);
    for(const gid of m.gids)if(rowToTile[gid])throw new Error('Identidad de volumen duplicada');
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(m.pos,3));g.setAttribute('bld',new THREE.BufferAttribute(m.bld,1));g.setIndex(new THREE.BufferAttribute(m.idx,1));
    // Full geometry always resident. Frustum culling only skips drawing, never evicts it.
    // Bounds were accumulated during triangulation in the worker: no full vertex
    // scan on the UI thread. Altitude correction is applied below.
    g.boundingSphere=new THREE.Sphere(new THREE.Vector3(...m.bounds.center),m.bounds.radius);
    const data=new Float32Array(WIDTH*Math.ceil(m.nB/WIDTH)*4);data.set(m.attr);
    const tex=new THREE.DataTexture(data,WIDTH,Math.ceil(m.nB/WIDTH),THREE.RGBAFormat,THREE.FloatType);tex.needsUpdate=true;
    const born={value:-1};
    const lat=new maplibregl.MercatorCoordinate(origin.x,origin.y+(m.origin[1]+300)*scale).toLngLat().lat;
    const altitude=maplibregl.MercatorCoordinate.fromLngLat([config.origin[0],lat]).meterInMercatorCoordinateUnits()/scale;
    g.boundingSphere.center.y*=altitude;g.boundingSphere.radius*=Math.max(1,altitude);
    const restRadius=g.boundingSphere.radius;
    const mesh=new THREE.Mesh(g,drawMaterial);
    mesh.position.set(m.origin[0],0,m.origin[1]);
    mesh.userData={draw:drawMaterial,pick:pickMaterial,tex,born,restRadius};
    mesh.onBeforeRender=(_renderer,_scene,_camera,_geometry,material)=>{
      // Start on the first actual draw; offscreen blocks don't consume animation time.
      if(born.value<0){born.value=uniforms.uNow.value;animateUntil=Math.max(animateUntil,born.value+1.3)}
      const mat=material as THREE.ShaderMaterial;
      mat.uniforms.uAttr.value=tex;mat.uniforms.uBorn.value=born.value;mat.uniforms.uAltitude.value=altitude;
      mat.uniformsNeedUpdate=true;
    };
    for(const gid of m.gids)rowToTile[gid]=id+1;
    scene.add(mesh);meshes.push(mesh);
    diagnostics.loadedBlocks++;diagnostics.loadedVolumes+=m.nB;diagnostics.loadedBlockIds.push(t.id);diagnostics.bufferBytes+=m.pos.byteLength+m.bld.byteLength+m.idx.byteLength+data.byteLength;map.triggerRepaint();
  }
  async function next(worker:Worker){
    if(disposed||diagnostics.phase==='error')return;
    const id=nextIndex++,t=config.tiles[id];if(!t){worker.terminate();return}
    try{
      if(!packs.has(t.pack))packs.set(t.pack,loadPayload(`/data/city/${t.pack}`,abort.signal,packSizes.get(t.pack)!,attempt,packSizes.get(t.pack)!).then(buf=>{if(abort.signal.aborted)throw new Error('Carga cancelada');diagnostics.validatedPacks.push(t.pack);diagnostics.retainedPackBytes+=buf.byteLength;emit();return buf}));
      const pack=await packs.get(t.pack)!;
      if(disposed||abort.signal.aborted)return;
      const buf=pack.slice(t.offset,t.offset+t.length);
      if(buf.byteLength!==t.length)throw new Error(`Paquete truncado: ${t.pack}`);
      const left=remaining.get(t.pack)!-1;remaining.set(t.pack,left);if(left===0){packs.delete(t.pack);diagnostics.retainedPackBytes-=pack.byteLength;}
      assignments.set(worker,id);worker.postMessage({buf,id},[buf]);
    }catch(e){fail(e)}
  }
  async function showBuilding(gid:number){
    const version=++selectionVersion;
    if(gid<0||!rowToTile[gid]){uniforms.uSelected.value=-1;map.triggerRepaint();callbacks.selectionState?.({phase:'idle'});return;}
    callbacks.selectionState?.({phase:'loading'});
    uniforms.uSelected.value=gid;map.triggerRepaint();
    const tileIndex=rowToTile[gid]-1;
    try{
      let attrs=attrsCache.get(tileIndex);
      if(!attrs){
        const buffer=await loadPayload(`/data/city/${config.tiles[tileIndex].attrs}`,abort.signal,32e6,attempt);
        attrs=JSON.parse(new TextDecoder().decode(buffer)) as Building[];
        if(!Array.isArray(attrs)||attrs.length!==config.tiles[tileIndex].n||attrs.some(a=>!a||typeof a!=='object'||!Number.isInteger(a.source_row)||rowToTile[Number(a.source_row)]!==tileIndex+1)||new Set(attrs.map(a=>a.source_row)).size!==attrs.length)throw new Error('Atributos inválidos');
        if(attrsCache.size>=8)attrsCache.delete(attrsCache.keys().next().value!);
        attrsCache.set(tileIndex,attrs);
      }
      const building=attrs.find(p=>p.source_row===gid);
      if(!building)throw new Error(`No se encontraron atributos para ${gid}`);
      if(!disposed&&version===selectionVersion){callbacks.select(building);callbacks.selectionState?.({phase:'ready'})}
    }catch(e){if(!disposed&&version===selectionVersion)callbacks.selectionState?.({phase:'error',error:e instanceof Error?e.message:String(e)})}
  }
  function pick(e:MapMouseEvent){
    const {width:w,height:h}=map.getCanvas().getBoundingClientRect();
    // Crop the composed MapLibre projection to the clicked CSS pixel, as Amsterdam's 1px GPU picking.
    const crop=new THREE.Matrix4().set(w,0,0,w-2*e.point.x-1, 0,h,0,-h+2*e.point.y+1, 0,0,1,0, 0,0,0,1);
    camera.projectionMatrix.copy(crop.multiply(fullMatrix));
    for(const mesh of meshes)mesh.material=mesh.userData.pick;
    try{renderer.setRenderTarget(pickTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,camera);
    renderer.readRenderTargetPixels(pickTarget,0,0,1,1,pickPixel);
    }finally{renderer.setRenderTarget(null);camera.projectionMatrix.copy(fullMatrix);
    for(const mesh of meshes)mesh.material=mesh.userData.draw;renderer.resetState();}
    void showBuilding(pickPixel[0]+256*pickPixel[1]+65536*pickPixel[2]-1);
  }
  const onContextLost=()=>fail('Se perdió el contexto WebGL. Recargá para reintentar.',true);
  const onClick=(e:MapMouseEvent)=>{queuedPick=e;map.triggerRepaint()};
  const onMotion=()=>{uniforms.uReduced.value=media.matches?1:0;map.triggerRepaint()};
  const layer:CustomLayerInterface={id:'resident-city',type:'custom',renderingMode:'3d',
    onAdd(m,gl){
      map=m;
      try{renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl as WebGL2RenderingContext});
      renderer.autoClear=false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
      renderer.debug.onShaderError=()=>fail('No se pudo compilar el renderizador 3D. Revisá el soporte WebGL2.',true);
      m.getCanvas().addEventListener('webglcontextlost',onContextLost,true);
      map.on('click',onClick);media.addEventListener('change',onMotion);progress();
      for(let i=0;i<Math.min(2,navigator.hardwareConcurrency||2);i++){
        const worker=new Worker(new URL('./city.worker.ts',import.meta.url),{type:'module'});pool.push(worker);
        worker.onmessage=({data}:{data:MeshData&{id:number;error?:string}})=>{
          if(disposed||diagnostics.phase==='error')return;
          try{if(data.id!==assignments.get(worker))throw new Error('Respuesta worker sin asignación válida');assignments.delete(worker);if(data.error)throw new Error(data.error);addTile(data,data.id);loaded++;progress();void next(worker)}catch(e){fail(e)}
        };
        worker.onerror=()=>fail('Falló la preparación de una malla 3D. Recargá para reintentar.');
        worker.addEventListener('messageerror',()=>fail('Respuesta worker ilegible'));
        void next(worker);
      }}catch(e){fail(e,!renderer)}
    },
    render(_gl,args){
      if(disposed||renderFatal||!renderer)return;
      try{uniforms.uNow.value=performance.now()/1000;
      fullMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(model);camera.projectionMatrix.copy(fullMatrix);
      renderer.resetState();
      renderer.setViewport(0,0,map.getCanvas().width,map.getCanvas().height);
      if(queuedPick&&diagnostics.phase!=='error'){const e=queuedPick;queuedPick=undefined;pick(e);renderer.resetState()}
      for(const mesh of meshes)mesh.geometry.boundingSphere!.radius=mesh.userData.restRadius+(uniforms.uReduced.value===0&&(mesh.userData.born.value<0||uniforms.uNow.value-mesh.userData.born.value<1.3)?80:0);
      renderer.render(scene,camera);
      if(renderFatal)return;
      diagnostics.renders++;if(diagnostics.phase==='loading'&&loaded===config.tiles.length&&diagnostics.loadedVolumes===config.source_records&&diagnostics.validatedPacks.length===config.packs.length){diagnostics.phase='ready';emit();}
      if(uniforms.uNow.value<animateUntil&&uniforms.uReduced.value===0)map.triggerRepaint();
      }catch(e){fail(e,true)}
    },
    onRemove(){
      disposed=true;if(diagnostics.phase!=='error')diagnostics.phase='disposed';diagnostics.retainedPackBytes=0;emit();abort.abort();selectionVersion++;pool.forEach(w=>w.terminate());packs.clear();attrsCache.clear();
      map.getCanvas().removeEventListener('webglcontextlost',onContextLost,true);map.off('click',onClick);media.removeEventListener('change',onMotion);
      for(const mesh of meshes){mesh.geometry.dispose();mesh.userData.tex.dispose()}
      drawMaterial.dispose();pickMaterial.dispose();scene.clear();pickTarget.dispose();renderer?.dispose();
    }
  };
  return {layer,getDiagnostics:snapshot,setMode(mode:'height'|'year'){uniforms.uMode.value=mode==='year'?1:0;map?.triggerRepaint()},
    clearSelection(){selectionVersion++;callbacks.selectionState?.({phase:'idle'});uniforms.uSelected.value=-1;map?.triggerRepaint()},
    replay(){const now=performance.now()/1000;for(const mesh of meshes)mesh.userData.born.value=now;animateUntil=now+1.4;map.triggerRepaint()}};
}
