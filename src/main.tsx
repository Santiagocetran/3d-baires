import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import type {Map as MapInstance} from 'maplibre-gl';
import maplibreWorkerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerURL);
import type {Feature,Polygon,FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import {createResidentCity,type CityConfig,type CityDiagnostics} from './resident-city';
import {cameraURL,readCamera} from './camera-url';
import boundaryURL from './assets/caba-boundary.geojson?url';
import {exteriorMask} from './map-scope';
import {landmarks,type Landmark} from './landmarks';
declare global {interface Window {readonly __cityDiagnostics:CityDiagnostics|undefined}}

type Building = Record<string, string | number | null>;
const heightLabels:Record<string,string>={valid:'Positiva y dentro del rango de revisión',missing:'Desconocida',zero:'Cero publicado; sin extrusión',negative:'Negativa: revisar',implausible:'Mayor de 350 m: revisar',unparseable:'No se pudo interpretar'};
const matchLabels:Record<string,string> = {parcel_unmatched:'Sin parcela coincidente',parcel_ambiguous:'Varias parcelas: ambiguo',address_missing:'Dirección desconocida',parcel_address_single:'Un acceso de parcela; no identidad de volumen',parcel_address_multiple:'Varios accesos de parcela',spatial_conflict:'SMP coincide, posición incompatible: revisar'};
const unknown = (v:unknown) => v === null || v === undefined || v === '' ? 'Desconocido' : String(v);
async function readJSON<T>(url:string, signal:AbortSignal):Promise<T> {
  const response = await fetch(url,{signal});
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`No se pudo leer ${url}. Ejecutá la preparación de datos y recargá.`);
  return response.json();
}
function App(){
  const container = useRef<HTMLDivElement>(null), map = useRef<MapInstance|null>(null);
  const [placeFilter,setPlaceFilter]=useState<'all'|'football'>('all');
  const placeFilterRef=useRef<'all'|'football'>('all');
  const placeMarkers=useRef<{button:HTMLButtonElement;football:boolean}[]>([]);
  const [landmark,setLandmark]=useState<Landmark|null>(null);
  const landmarkCard=useRef<HTMLElement>(null);
  const landmarkPinned=useRef(false),landmarkTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const keepLandmark=()=>clearTimeout(landmarkTimer.current);
  const openLandmark=(place:Landmark,pin=false)=>{keepLandmark();if(landmarkPinned.current&&!pin)return;landmarkPinned.current=pin;setLandmark(place)};
  const leaveLandmark=()=>{keepLandmark();landmarkTimer.current=setTimeout(()=>{if(!landmarkPinned.current&&!landmarkCard.current?.matches(':hover')&&!landmarkCard.current?.contains(document.activeElement))setLandmark(null)},180)};
  const closeLandmark=()=>{keepLandmark();landmarkPinned.current=false;setLandmark(null)};
  useEffect(()=>{
    if(!landmark)return;
    const onEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')closeLandmark()};
    window.addEventListener('keydown',onEscape);
    return()=>window.removeEventListener('keydown',onEscape);
  },[landmark]);
  const initialCamera=useRef(readCamera(location.search));
  const [diagnostics,setDiagnostics]=useState<CityDiagnostics|null>(null);
  const [selectionStatus,setSelectionStatus]=useState<{phase:string;error?:string}>({phase:'idle'});
  const [expanded,setExpanded]=useState(true),[linkFeedback,setLinkFeedback]=useState(''),[fallbackLink,setFallbackLink]=useState('');
  const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [status,setStatus]=useState('Cargando datos locales…'), [error,setError]=useState(''), [baseError,setBaseError]=useState('');
  const [selection,setSelection]=useState<Building|null>(null);
  const [mode,setMode]=useState<'height'|'year'>(initialCamera.current.mode), [ready,setReady]=useState(false), [base,setBase]=useState(true);
  const [count,setCount]=useState<number|null>(null);
  const city=useRef<ReturnType<typeof createResidentCity>|null>(null);
  const [neighbourhoods,setNeighbourhoods]=useState<{name:string;center:[number,number]}[]>([]);
  const replay=useRef<()=>void>(()=>{});
  const scopeBounds=useRef<[[number,number],[number,number]]>([[-58.54,-34.72],[-58.31,-34.52]]);
  useEffect(()=>{
    const controller=new AbortController();
    let instance:MapInstance|undefined;

    (async()=>{
      try{
        const [summary,scope,boundary] = await Promise.all([
          readJSON<CityConfig>('/data/city/city.json',controller.signal),
          readJSON<FeatureCollection>('/data/caba-scope.geojson',controller.signal),
          readJSON<Feature<Polygon>>(boundaryURL,controller.signal),
        ]);
        if(controller.signal.aborted)return;
        setCount(summary.source_records);
        const scopePoints:number[][]=[];
        const collectScope=(value:unknown):void=>{if(!Array.isArray(value))return;if(typeof value[0]==='number'&&typeof value[1]==='number'&&Number.isFinite(value[0])&&Number.isFinite(value[1]))scopePoints.push(value as number[]);else value.forEach(collectScope)};
        for(const feature of scope.features)if(feature.geometry.type==='Polygon'||feature.geometry.type==='MultiPolygon')collectScope(feature.geometry.coordinates);
        if(scopePoints.length){let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;for(const [lng,lat] of scopePoints){west=Math.min(west,lng);south=Math.min(south,lat);east=Math.max(east,lng);north=Math.max(north,lat)}scopeBounds.current=[[west,south],[east,north]];}
        setNeighbourhoods(scope.features.map(f=>{
          const points:number[][]=[];
          function visit(v:unknown):void{if(!Array.isArray(v))return;if(typeof v[0]==='number')points.push(v as number[]);else v.forEach(visit)}
          if(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')visit(f.geometry.coordinates);
          return {name:String(f.properties?.nombre),center:[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2] as [number,number]};
        }).sort((a,b)=>a.name.localeCompare(b.name,'es')));
        instance = new maplibregl.Map({container:container.current!,center:[initialCamera.current.lng,initialCamera.current.lat],zoom:initialCamera.current.zoom,pitch:initialCamera.current.pitch,bearing:initialCamera.current.bearing,minZoom:9,maxZoom:20,
          locale:{'NavigationControl.ZoomIn':'Acercar','NavigationControl.ZoomOut':'Alejar','NavigationControl.ResetBearing':'Orientar al norte','AttributionControl.ToggleAttribution':'Mostrar atribuciones'},
          maxBounds:[[-58.54,-34.72],[-58.31,-34.52]], maxPitch:70,
          style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,
            attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}},layers:[
            {id:'background',type:'background',paint:{'background-color':'#abd9ed'}},
            {id:'basemap',type:'raster',source:'osm',paint:{'raster-saturation':0.24,'raster-opacity':1,'raster-contrast':0.04,'raster-fade-duration':0}}]},
          attributionControl:false});
        map.current=instance;
        Object.defineProperty(window,'__cityDiagnostics',{configurable:true,get:()=>city.current?.getDiagnostics()});
        const updateURL=()=>{const m=map.current;if(!m)return;const center=m.getCenter();history.replaceState(null,'',cameraURL(location.href,{lng:center.lng,lat:center.lat,zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing(),mode:initialCamera.current.mode}));};
        instance.on('moveend',updateURL);

        instance.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
        instance.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'GCBA · Tejido Urbano / Parcelas · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0 (recursos)</a> · Estadios GCBA · <a href="https://creativecommons.org/licenses/by/2.5/ar/">CC BY 2.5 AR</a> · <a href="https://github.com/alexbarakov/amsterdam-by-building">Motor adaptado de Amsterdam · MIT</a>'}),'bottom-right');
        instance.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
        instance.on('error',e=>{if(('sourceId' in e && e.sourceId==='osm') || e.error.message.includes('tile.openstreetmap.org'))setBaseError('Mapa base sin conexión. Los volúmenes locales siguen disponibles.');else setError('Error del mapa: '+e.error.message)});
        instance.once('style.load',()=>{
          try{
          const m=instance!;
          m.addSource('scope',{type:'geojson',data:scope});
          m.addLayer({id:'scope',type:'line',source:'scope',paint:{'line-color':'#336998','line-width':0.65,'line-opacity':0.35}});
          city.current=createResidentCity(summary,{
            progress:(loaded,total)=>setStatus(`Preparando ciudad 3D · ${Math.round(100*loaded/total)}% · ${loaded}/${total} bloques`),
            diagnostics:d=>{setDiagnostics(d);if(d.phase==='ready')setStatus('Ciudad 3D lista');else if(d.phase==='error')setStatus('');},
            selectionState:state=>{setSelectionStatus(state);if(state.phase==='loading'||state.phase==='idle')setSelection(null);},
            select:setSelection,
            error:setError,
          });
          m.addLayer(city.current.layer);
          m.addSource('city-exterior',{type:'geojson',data:exteriorMask(boundary)});
          m.addLayer({id:'city-exterior',type:'fill',source:'city-exterior',paint:{'fill-color':'#abd9ed','fill-opacity':1,'fill-antialias':false}});
          m.addSource('city-boundary',{type:'geojson',data:{...boundary,geometry:{type:'Polygon',coordinates:[boundary.geometry.coordinates[0]]}}});
          m.addLayer({id:'city-boundary',type:'line',source:'city-boundary',paint:{'line-color':'#3a83b0','line-width':1.5,'line-opacity':0.7}});
          for(const place of landmarks){
            const button=document.createElement('button');button.className=place.club?'landmark-marker stadium-marker':'landmark-marker';
            placeMarkers.current.push({button,football:!!place.club});
            button.type='button';button.setAttribute('aria-label',`Descubrir ${place.name}`);
            const symbol=document.createElement('span');symbol.textContent=place.club?'⚽':'✦';symbol.setAttribute('aria-hidden','true');button.append(symbol);
            const label=document.createElement('span');label.className='landmark-label';label.textContent=place.name;button.append(label);
            button.addEventListener('pointerenter',()=>{if(matchMedia('(hover: hover) and (pointer: fine)').matches)openLandmark(place)});
            button.addEventListener('pointerleave',leaveLandmark);
            button.addEventListener('focus',()=>openLandmark(place));button.addEventListener('blur',leaveLandmark);
            button.addEventListener('click',e=>{e.stopPropagation();openLandmark(place,true)});
            button.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLandmark();button.blur()}});
            new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(place.coordinates).addTo(m);
          }
          const updatePlaces=()=>{for(const {button,football} of placeMarkers.current){button.style.display=m.getZoom()<14||(placeFilterRef.current==='football'&&!football)?'none':'';const label=button.querySelector<HTMLElement>('.landmark-label');if(label)label.style.visibility=m.getZoom()<15.5?'hidden':''}};
          m.on('zoom',updatePlaces);updatePlaces();
          replay.current=()=>city.current?.replay();
          setReady(true);
          }catch(e){setStatus('');setError(e instanceof Error?e.message:String(e));}
        });
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
    })();
    return()=>{clearTimeout(landmarkTimer.current);controller.abort();instance?.remove();map.current=null;city.current=null;placeMarkers.current=[];delete (window as {__cityDiagnostics?:CityDiagnostics}).__cityDiagnostics};
  },[]);
  useEffect(()=>{
    placeFilterRef.current=placeFilter;
    for(const {button,football} of placeMarkers.current)button.style.display=(map.current?.getZoom()??0)<14||(placeFilter==='football'&&!football)?'none':'';
    if(placeFilter==='football'&&landmark&&!landmark.club)closeLandmark();
  },[placeFilter]);
  useEffect(()=>{initialCamera.current.mode=mode;if(ready){city.current?.setMode(mode);const m=map.current;if(m){const c=m.getCenter();history.replaceState(null,'',cameraURL(location.href,{lng:c.lng,lat:c.lat,zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing(),mode}));}}},[mode,ready]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>map.current?.resize());return()=>cancelAnimationFrame(frame)},[expanded]);
  useEffect(()=>{const observer=new ResizeObserver(()=>map.current?.resize());if(container.current)observer.observe(container.current);return()=>observer.disconnect()},[]);
  async function copyLink(){const link=location.href;try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(link);setFallbackLink('');setLinkFeedback('Enlace copiado.')}catch{setFallbackLink(link);setLinkFeedback('Copiá el enlace del campo siguiente.')}}
  useEffect(()=>{if(ready)map.current?.setLayoutProperty('basemap','visibility',base?'visible':'none');},[base,ready]);
  return <main className={expanded?'panel-expanded':'panel-collapsed'}>
    <div ref={container} className="map" aria-label="Mapa 3D de Capital Federal"/>
    <aside className="panel">
      <button className="panel-toggle" aria-expanded={expanded} aria-controls="panel-content" onClick={()=>setExpanded(v=>!v)}>{expanded?'Contraer panel':'Explorar · abrir panel'}</button>
      <div id="panel-content" className="panel-content">
      <header><span className="eyebrow">Un atlas para explorar</span><h1>Buenos<br/>Aires<span>3D</span></h1><p>Otra forma de mirar la ciudad.</p></header>
      <div className="scope"><span className="dot"/> Capital Federal · 48 barrios</div>
      <p className="note">Ciudad 3D persistente · {count===null?'Preparando datos':`${count.toLocaleString('es-AR')} registros de origen`}. No es un censo de edificios.</p>
      <label className="neighbourhood">Explorar un barrio<select disabled={!ready} defaultValue="" onChange={e=>{const n=neighbourhoods.find(n=>n.name===e.target.value);if(n)map.current?.flyTo({center:n.center,zoom:15,pitch:52,duration:reducedMotion()?0:1000})}}><option value="" disabled>Elegí entre los 48 barrios</option>{neighbourhoods.map(n=><option key={n.name}>{n.name}</option>)}</select></label>
      <button className="overview" disabled={!ready} onClick={()=>map.current?.fitBounds(scopeBounds.current,{padding:35,pitch:0,bearing:0,duration:reducedMotion()?0:1000})}>Ver toda CABA</button>
      <nav aria-label="Capas del mapa">{([['height','Alturas'],['year','Antigüedad']] as const).map(([id,label])=><button key={id} disabled={!ready} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</nav>
      <section className="legend" aria-label="Leyenda">{mode==='year'?<><h2>Antigüedad · datos pendientes</h2><p>Gris: antigüedad desconocida. Tejido Urbano no contiene años de construcción. Todavía no hay fechas verificadas vinculadas a estos volúmenes; el mapa de calor necesita esa fuente.</p></>:<><h2>Altura publicada <span>metros</span></h2><div className="swatches">{[['#ffca3d','0–10'],['#ff9145','10–20'],['#f75261','20–40'],['#d64a94','40–80'],['#7a52d6','80+']].map(([c,t])=><div key={t}><i style={{background:c}}/>{t}</div>)}</div><p>Gris y plano: altura ausente, cero o a revisar.</p></>}</section>
      {error?<section role="alert" className="message error"><h2>No se pudo cargar el mapa</h2><p>{error}</p><button onClick={()=>location.reload()}>Reintentar</button></section>:status?<p role="status" className="message" data-city-phase={diagnostics?.phase??'loading'}>{status}{diagnostics&&<small>{diagnostics.loadedBlocks}/{diagnostics.expectedBlocks} bloques · {diagnostics.loadedVolumes.toLocaleString('es-AR')} / {diagnostics.expectedVolumes.toLocaleString('es-AR')} volúmenes · {diagnostics.validatedPacks.length}/{diagnostics.expectedPacks} paquetes validados</small>}</p>:null}
      {baseError&&base&&<p role="status" className="message">{baseError}</p>}
      {selectionStatus.phase==='loading'&&<p role="status" className="message">Cargando datos del volumen…</p>}
      {selectionStatus.phase==='error'&&<p role="alert" className="message error">{selectionStatus.error||'No se pudieron cargar los datos del volumen. Podés seleccionar otro volumen.'}</p>}
      {selection?<article className="detail"><button className="close" aria-label="Cerrar selección" onClick={()=>{setSelection(null);city.current?.clearSelection()}}>×</button><span className="eyebrow">VOLUMEN · {unknown(selection.source_id)}</span><h2>{selection.height_status==='valid'?`${selection.height} m`:'Altura no validada'}</h2><dl>{[['Valor original',selection.height_raw],['Estado de altura',heightLabels[String(selection.height_status)]],['Tipo',selection.tipo],['Parcela (SMP)',selection.smp],['Direcciones de parcela',selection.addresses],['Observación de direcciones','Desconocida; catastro descargado en 2026'],['Coincidencia',matchLabels[String(selection.address_status)] || 'Desconocida'],['Barrio',selection.barrio],['Origen',selection.origen],['Fuente del registro',selection.fuente],['Observación','Hasta 2021 (catálogo); fecha individual desconocida'],['Construcción',selection.construction_year]].map(([k,v])=><React.Fragment key={String(k)}><dt>{k}</dt><dd>{unknown(v)}</dd></React.Fragment>)}</dl><p className="note">Una parcela puede contener varios volúmenes y accesos. Las direcciones no identifican necesariamente este volumen.</p><a href="https://data.buenosaires.gob.ar/dataset/tejido-urbano" target="_blank" rel="noreferrer">Tejido Urbano · GCBA ↗</a></article>
      :<section className="intro"><h2>Cada volumen, otra perspectiva.</h2><p>Elegí un volumen para consultar su altura y sus datos. Buscá los símbolos ✦ para descubrir lugares destacados.</p></section>}
      <section className="places" aria-label="Lugares destacados"><h2>Lugares para descubrir <span>{landmarks.length}</span></h2><div className="place-filters" role="group" aria-label="Filtrar lugares"><button aria-pressed={placeFilter==='all'} onClick={()=>setPlaceFilter('all')}>Todos</button><button aria-pressed={placeFilter==='football'} onClick={()=>setPlaceFilter('football')}>⚽ Fútbol ({landmarks.filter(p=>p.club).length})</button></div><div className="places-list">{landmarks.filter(p=>placeFilter==='all'||p.club).map(place=><button key={place.id} onClick={()=>{openLandmark(place,true);map.current?.flyTo({center:place.coordinates,zoom:16.8,pitch:52,duration:reducedMotion()?0:1000})}}><img src={place.image} alt="" loading="lazy"/><span>{place.name}<small>{place.club??place.category}</small></span><span aria-hidden="true">↗</span></button>)}</div></section>
      <footer><p><strong>Una fotografía del pasado.</strong> Tejido contiene datos hasta 2021; no representa necesariamente la ciudad actual. La actualización del catálogo no renueva el relevamiento.</p><label><input type="checkbox" checked={base} onChange={e=>setBase(e.target.checked)}/> Mapa base OSM · requiere internet</label><p>Arrastrá para moverte. Rueda o +/− para acercar. Botón derecho para girar e inclinar.</p><div className="camera"><button disabled={!ready} onClick={()=>{if(!reducedMotion())replay.current()}}>Animar volúmenes</button><button disabled={!ready} onClick={()=>map.current?.easeTo({pitch:0,bearing:0,duration:reducedMotion()?0:500})}>Vista 2D</button><button disabled={!ready} onClick={()=>map.current?.easeTo({pitch:52,bearing:-18,duration:reducedMotion()?0:500})}>Vista 3D</button><button disabled={!ready} onClick={()=>map.current?.flyTo({center:[-58.378,-34.617],zoom:15.1,duration:reducedMotion()?0:1000})}>Inicio</button></div><button className="copy-link" onClick={copyLink}>Copiar enlace de esta vista</button><p role="status">{linkFeedback}</p>{fallbackLink&&<label>Enlace para compartir<input className="link-field" aria-label="Enlace para compartir" readOnly value={fallbackLink} onFocus={e=>e.target.select()}/></label>}</footer>
      </div>
    </aside>
    <div className="map-title">La ciudad en otra dimensión<span>Buenos Aires · Argentina</span></div>
    {landmark&&<article ref={landmarkCard} className="landmark-card" aria-label={`Lugar destacado: ${landmark.name}`} onPointerOver={keepLandmark} onPointerEnter={keepLandmark} onPointerLeave={leaveLandmark} onFocusCapture={keepLandmark} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))leaveLandmark()}} onKeyDown={e=>{if(e.key==='Escape')closeLandmark()}}>
      <div className="landmark-photo"><img src={landmark.image} alt={`Vista de ${landmark.name}`}/><span>{landmark.category}</span><button className="landmark-close" aria-label="Cerrar lugar destacado" onClick={closeLandmark}>×</button></div>
      <div className="landmark-body"><h2>{landmark.name}</h2>{landmark.club&&<p className="landmark-club">{landmark.club}</p>}<p className="landmark-address">{landmark.address}</p><p>{landmark.summary}</p><a href={landmark.source} target="_blank" rel="noreferrer">{landmark.sourceLabel??'Conocer el lugar en Turismo BA'} ↗</a><small className="place-identity">Punto de interés; sin vinculación catastral a un volumen.</small><small className="photo-credit">Foto: <a href={landmark.photoSource} target="_blank" rel="noreferrer">{landmark.photoCredit}</a> · <a href={landmark.photoLicenseURL} target="_blank" rel="noreferrer">{landmark.photoLicense}</a> · recorte visual</small></div>
    </article>}
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
