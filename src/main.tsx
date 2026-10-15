import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import maplibregl, {type Map as MapInstance} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import {createResidentCity,type CityConfig} from './resident-city';

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
  const [status,setStatus]=useState('Cargando datos locales…'), [error,setError]=useState(''), [baseError,setBaseError]=useState('');
  const [selection,setSelection]=useState<Building|null>(null);
  const [mode,setMode]=useState<'height'|'year'>('height'), [ready,setReady]=useState(false), [base,setBase]=useState(true);
  const [count,setCount]=useState<number|null>(null);
  const city=useRef<ReturnType<typeof createResidentCity>|null>(null);
  const [neighbourhoods,setNeighbourhoods]=useState<{name:string;center:[number,number]}[]>([]);
  const replay=useRef<()=>void>(()=>{});
  useEffect(()=>{
    const controller=new AbortController();
    let instance:MapInstance|undefined;

    (async()=>{
      try{
        const [summary,scope] = await Promise.all([
          readJSON<CityConfig>('/data/city/city.json',controller.signal),
          readJSON<FeatureCollection>('/data/caba-scope.geojson',controller.signal),
        ]);
        if(controller.signal.aborted)return;
        setCount(summary.source_records);
        setNeighbourhoods(scope.features.map(f=>{
          const points:number[][]=[];
          function visit(v:unknown):void{if(!Array.isArray(v))return;if(typeof v[0]==='number')points.push(v as number[]);else v.forEach(visit)}
          if(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')visit(f.geometry.coordinates);
          return {name:String(f.properties?.nombre),center:[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2] as [number,number]};
        }).sort((a,b)=>a.name.localeCompare(b.name,'es')));
        instance = new maplibregl.Map({container:container.current!,center:[-58.378,-34.617],zoom:15.1,pitch:52,bearing:-18,
          locale:{'NavigationControl.ZoomIn':'Acercar','NavigationControl.ZoomOut':'Alejar','NavigationControl.ResetBearing':'Orientar al norte','AttributionControl.ToggleAttribution':'Mostrar atribuciones'},
          maxBounds:[[-58.54,-34.72],[-58.31,-34.52]], maxPitch:70,
          style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,
            attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}},layers:[
            {id:'background',type:'background',paint:{'background-color':'#e8ece6'}},
            {id:'basemap',type:'raster',source:'osm',paint:{'raster-saturation':-0.85,'raster-opacity':0.65}}]},
          attributionControl:false});
        map.current=instance;

        instance.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
        instance.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'GCBA · Tejido Urbano / Parcelas · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0 (recursos)</a> · <a href="https://github.com/alexbarakov/amsterdam-by-building">Motor adaptado de Amsterdam · MIT</a>'}),'bottom-right');
        instance.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
        instance.on('error',e=>{if(('sourceId' in e && e.sourceId==='osm') || e.error.message.includes('tile.openstreetmap.org'))setBaseError('Mapa base sin conexión. Los volúmenes locales siguen disponibles.');else setError('Error del mapa: '+e.error.message)});
        instance.once('style.load',()=>{
          const m=instance!;
          m.addSource('scope',{type:'geojson',data:scope});
          m.addLayer({id:'scope',type:'line',source:'scope',paint:{'line-color':'#617f7e','line-width':2,'line-dasharray':[3,2]}});
          city.current=createResidentCity(summary,{
            progress:(loaded,total)=>setStatus(loaded<total?`Preparando ciudad 3D · ${Math.round(100*loaded/total)}% · ${loaded}/${total} bloques`:''),
            select:setSelection,
            error:setError,
          });
          m.addLayer(city.current.layer);
          replay.current=()=>city.current?.replay();
          setReady(true);
        });
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
    })();
    return()=>{controller.abort();instance?.remove();map.current=null;city.current=null};
  },[]);
  useEffect(()=>{if(ready)city.current?.setMode(mode);},[mode,ready]);
  useEffect(()=>{if(ready)map.current?.setLayoutProperty('basemap','visibility',base?'visible':'none');},[base,ready]);
  return <main>
    <div ref={container} className="map" aria-label="Mapa 3D de Capital Federal"/>
    <aside className="panel">
      <header><span className="eyebrow">ATLAS URBANO · CABA</span><h1>3d-baires<span>↗</span></h1><p>Buenos Aires, volumen por volumen.</p></header>
      <div className="scope"><span className="dot"/> CAPITAL FEDERAL · 48 BARRIOS</div>
      <p className="note">Ciudad 3D persistente · {count===null?'Preparando datos':`${count.toLocaleString('es-AR')} registros de origen`}. No es un censo de edificios.</p>
      <label className="neighbourhood">Explorar un barrio<select disabled={!ready} defaultValue="" onChange={e=>{const n=neighbourhoods.find(n=>n.name===e.target.value);if(n)map.current?.flyTo({center:n.center,zoom:15,pitch:52})}}><option value="" disabled>Elegí entre los 48 barrios</option>{neighbourhoods.map(n=><option key={n.name}>{n.name}</option>)}</select></label>
      <nav aria-label="Capas del mapa">{([['height','Alturas'],['year','Antigüedad']] as const).map(([id,label])=><button key={id} disabled={!ready} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</nav>
      <section className="legend" aria-label="Leyenda">{mode==='year'?<><h2>Antigüedad · datos pendientes</h2><p>Gris: antigüedad desconocida. Tejido Urbano no contiene años de construcción. Todavía no hay fechas verificadas vinculadas a estos volúmenes; el mapa de calor necesita esa fuente.</p></>:<><h2>Altura publicada <span>metros</span></h2><div className="swatches">{[['#dce8cf','0–10'],['#a9c9a4','10–20'],['#6caa9c','20–40'],['#39878b','40–80'],['#245b73','80+']].map(([c,t])=><div key={t}><i style={{background:c}}/>{t}</div>)}</div><p>Gris y plano: altura ausente, cero o a revisar.</p></>}</section>
      {error?<section role="alert" className="message error"><h2>No se pudo cargar el mapa</h2><p>{error}</p><button onClick={()=>location.reload()}>Reintentar</button></section>:status?<p role="status" className="message">{status}</p>:null}
      {baseError&&base&&<p role="status" className="message">{baseError}</p>}
      {selection?<article className="detail"><button className="close" aria-label="Cerrar selección" onClick={()=>{setSelection(null);city.current?.clearSelection()}}>×</button><span className="eyebrow">VOLUMEN · {unknown(selection.source_id)}</span><h2>{selection.height_status==='valid'?`${selection.height} m`:'Altura no validada'}</h2><dl>{[['Valor original',selection.height_raw],['Estado de altura',heightLabels[String(selection.height_status)]],['Tipo',selection.tipo],['Parcela (SMP)',selection.smp],['Direcciones de parcela',selection.addresses],['Observación de direcciones','Desconocida; catastro descargado en 2026'],['Coincidencia',matchLabels[String(selection.address_status)] || 'Desconocida'],['Barrio',selection.barrio],['Origen',selection.origen],['Fuente del registro',selection.fuente],['Observación','Hasta 2021 (catálogo); fecha individual desconocida'],['Construcción',selection.construction_year]].map(([k,v])=><React.Fragment key={String(k)}><dt>{k}</dt><dd>{unknown(v)}</dd></React.Fragment>)}</dl><p className="note">Una parcela puede contener varios volúmenes y accesos. Las direcciones no identifican necesariamente este volumen.</p><a href="https://data.buenosaires.gob.ar/dataset/tejido-urbano" target="_blank" rel="noreferrer">Tejido Urbano · GCBA ↗</a></article>
      :<section className="intro"><span>↖</span><h2>Explorá la ciudad en 3D.</h2><p>La ciudad se prepara una vez y permanece cargada al moverte o cambiar el zoom. Elegí un volumen para consultar sus datos.</p></section>}
      <footer><p><strong>Una fotografía del pasado.</strong> Tejido contiene datos hasta 2021; no representa necesariamente la ciudad actual. La actualización del catálogo no renueva el relevamiento.</p><label><input type="checkbox" checked={base} onChange={e=>setBase(e.target.checked)}/> Mapa base OSM · requiere internet</label><p>Arrastrá para moverte. Rueda o +/− para acercar. Botón derecho para girar e inclinar.</p><div className="camera"><button disabled={!ready} onClick={()=>replay.current()}>Animar volúmenes</button><button disabled={!ready} onClick={()=>map.current?.easeTo({pitch:0,bearing:0})}>Vista 2D</button><button disabled={!ready} onClick={()=>map.current?.easeTo({pitch:52,bearing:-18})}>Vista 3D</button><button disabled={!ready} onClick={()=>map.current?.flyTo({center:[-58.378,-34.617],zoom:15.1})}>Inicio</button></div></footer>
    </aside>
    <div className="map-title">BUENOS AIRES <span>34°36′ S · 58°23′ O</span></div>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
