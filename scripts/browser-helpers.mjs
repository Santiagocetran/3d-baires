import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export const baseURL=process.env.BROWSER_BASE_URL||'http://127.0.0.1:5173';
export const launch=()=>chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
export async function reportRun(file,task){
 const report={status:'running',started_at:new Date().toISOString(),base_url:baseURL,software_webgl:true,hardware_fps_measured:false,basemap:'Teselas OSM sustituidas por PNG neutro local; conectividad externa no evaluada'};
 await mkdir('docs',{recursive:true}); const save=()=>writeFile(file,JSON.stringify(report,null,2)+'\n'); await save();
 let browser;
 try{browser=await launch();Object.assign(report,await task(browser,report));report.status='passed'}
 catch(error){report.status='failed';report.error=error.stack||String(error);process.exitCode=1}
 finally{report.finished_at=new Date().toISOString();await save();await browser?.close().catch(()=>{});console.log(JSON.stringify({report:file,status:report.status,load_ms:report.load_ms,error:report.error},null,2))}
}
export async function observe(page){
 const evidence={errors:[],request_failures:[],optional_basemap_failures:[],geometry_requests:[]};
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'){const location=m.location().url;if(location.startsWith('https://tile.openstreetmap.org/'))return;evidence.errors.push(`${m.text()} (${location})`)}});
 page.on('request',r=>{if(/\/data\/city\/.*(?:pack.*\.bin\.gz|\.bin(?:\.gz)?)(?:\?|$)/.test(r.url()))evidence.geometry_requests.push(r.url())});
 page.on('requestfailed',r=>{const detail={url:r.url(),error:r.failure()?.errorText};(r.url().startsWith('https://tile.openstreetmap.org/')?evidence.optional_basemap_failures:evidence.request_failures).push(detail)});
 page.on('response',r=>{if(r.status()>=400&&!r.url().startsWith('https://tile.openstreetmap.org/'))evidence.errors.push(`HTTP ${r.status()} ${r.url()}`)});
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN48ebZfwAJNAO6uZMS8QAAAABJRU5ErkJggg==','base64')}));
 return evidence;
}
export async function fixture(page,override){
 const dir='data/processed/browser-fixture';
 await page.route('**/data/city/**',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);if(override&&await override(route,name))return;const body=await readFile(`${dir}/${name}`);await route.fulfill({body,contentType:name==='city.json'?'application/json':'application/octet-stream'})});
 return JSON.parse(await readFile(`${dir}/city.json`,'utf8'));
}
export async function ready(page,manifest,timeout=600000){
 await page.waitForFunction(()=>['ready','error','disposed'].includes(window.__cityDiagnostics?.phase),null,{timeout});
 const d=await page.evaluate(()=>window.__cityDiagnostics);assert.equal(d.phase,'ready',JSON.stringify(d));
 validate(d,manifest);return d;
}
export function validate(d,m){
 assert.equal(d.error,null);assert.equal(d.loadedBlocks,m.tiles.length);assert.equal(d.expectedBlocks,m.tiles.length);
 const n=m.tiles.reduce((s,t)=>s+t.n,0);assert.equal(d.loadedVolumes,n);assert.equal(d.expectedVolumes,n);
 assert.equal(d.expectedPacks,m.packs.length);assert.deepEqual([...d.validatedPacks].sort(),m.packs.map(p=>p.file).sort());
 assert.deepEqual([...d.loadedBlockIds].sort(),m.tiles.map(t=>String(t.id)).sort());assert.ok(d.renders>0,'Ready requires a subsequent successful geometry render');assert.ok(d.bufferBytes>0);
}
export function clean(e){assert.deepEqual(e.errors,[]);assert.deepEqual(e.request_failures,[])}
export async function screenshot(page,name){await mkdir('data/processed/browser-check',{recursive:true});await page.screenshot({path:`data/processed/browser-check/${name}.png`,timeout:60000})}
export function scopeBounds(scope){
 const points=[];const visit=value=>{if(!Array.isArray(value))return;if(typeof value[0]==='number')points.push(value);else value.forEach(visit)};
 for(const feature of scope.features)visit(feature.geometry.coordinates);
 assert.ok(points.length);const bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const [lng,lat] of points){bounds[0]=Math.min(bounds[0],lng);bounds[1]=Math.min(bounds[1],lat);bounds[2]=Math.max(bounds[2],lng);bounds[3]=Math.max(bounds[3],lat)}return bounds;
}
export async function overviewFit(page,bounds){
 const camera=Object.fromEntries(new URL(page.url()).searchParams),box=await page.locator('.maplibregl-canvas').boundingBox();
 assert.ok(box);assert.equal(Number(camera.pitch),0);assert.equal(Number(camera.bearing),0);
 const mercator=(lng,lat)=>[(lng+180)/360,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2],center=mercator(Number(camera.lng),Number(camera.lat)),scale=512*2**Number(camera.zoom);
 const corners=[[bounds[0],bounds[1]],[bounds[2],bounds[3]]].map(([lng,lat])=>{const point=mercator(lng,lat);return [box.width/2+(point[0]-center[0])*scale,box.height/2+(point[1]-center[1])*scale]});
 // Query values round zoom to 0.01 and coordinates to 1e-6; allow four CSS pixels.
 for(const [x,y] of corners)assert.ok(x>=-4&&x<=box.width+4&&y>=-4&&y<=box.height+4,`Scope corner outside canvas: ${JSON.stringify({camera,box,corners,bounds})}`);
 const westSouth=mercator(bounds[0],bounds[1]),eastNorth=mercator(bounds[2],bounds[3]);
 const expected_fit_zoom=Math.log2(Math.min((box.width-70)/(512*(eastNorth[0]-westSouth[0])),(box.height-70)/(512*(westSouth[1]-eastNorth[1]))));
 assert.ok(Math.abs(Number(camera.zoom)-expected_fit_zoom)<=0.02,`Camera must match actual scope fit with 35px padding: ${JSON.stringify({camera,expected_fit_zoom})}`);
 return {camera,bounds,canvas_css:{width:box.width,height:box.height},corners_css:corners,expected_fit_zoom,tolerance_css_pixels:4};
}
