import {readFile} from 'node:fs/promises';
// Exact whole-city completion gate; SwiftShader does not measure hardware FPS.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {baseURL,reportRun,observe,ready,validate,clean,screenshot,fixture,scopeBounds,overviewFit} from './browser-helpers.mjs';
await reportRun(process.env.BROWSER_REPORT||'docs/browser-city.json',async (browser,report)=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),evidence=await observe(page);
 Object.assign(report,{evidence,scenario:process.env.CITY_FIXTURE_FAILURE?'fallo HTTP después de un bloque real':'ciudad completa'});
 if(process.env.CITY_FIXTURE_FAILURE)await fixture(page,async(route,name)=>{if(name!=='pack1.bin.gz')return false;await page.waitForFunction(()=>window.__cityDiagnostics?.loadedBlocks===1);await route.fulfill({status:503,body:'Injected partial load failure'});return true});
 const scopeResponse=await page.request.get(`${baseURL}/data/caba-scope.geojson`);assert.ok(scopeResponse.ok());const bounds=scopeBounds(await scopeResponse.json());report.scope_bounds=bounds;
 const response=await page.request.get(`${baseURL}/data/city/city.json`);assert.ok(response.ok());const manifestText=process.env.CITY_FIXTURE_FAILURE?await readFile('data/processed/browser-fixture/city.json','utf8'):await response.text(),manifest=JSON.parse(manifestText);report.manifest_sha256=createHash('sha256').update(manifestText).digest('hex');report.manifest_expected={blocks:manifest.tiles.length,volumes:manifest.tiles.reduce((n,t)=>n+t.n,0),packs:manifest.packs.length}; const record=async()=>{report.observed=await page.evaluate(()=>window.__cityDiagnostics).catch(()=>null);report.observed_camera=Object.fromEntries(new URL(page.url()).searchParams)};
 page.on('crash',()=>{report.observed_error='page crashed'});

 try{
 const start=Date.now();await page.goto(baseURL);const before=await ready(page,manifest,Number(process.env.CITY_TIMEOUT_MS)||600000).catch(async error=>{await record();throw error}),load_ms=Date.now()-start;
 clean(evidence);await screenshot(page,'full-city');const requests=evidence.geometry_requests.length;
 for(const name of ['Palermo','Villa Lugano','Belgrano','Monserrat']){await page.locator('select').selectOption({label:name});await page.waitForTimeout(1800);validate(await page.evaluate(()=>window.__cityDiagnostics),manifest)}
 const overviewStart=await page.evaluate(()=>window.__cityDiagnostics.renders);
 await page.getByRole('button',{name:'Ver toda CABA',exact:true}).click({timeout:60000});
 await page.waitForFunction(renders=>{const q=new URL(location.href).searchParams,d=window.__cityDiagnostics;return q.has('zoom')&&Number(q.get('zoom'))<=13&&Number(q.get('pitch'))===0&&Number(q.get('bearing'))===0&&d?.phase==='ready'&&d.renders>renders},overviewStart,{timeout:60000});
 const overview_camera=Object.fromEntries(new URL(page.url()).searchParams);report.overview_camera=overview_camera;const overview_fit=await overviewFit(page,bounds);report.overview_fit=overview_fit;
 const after=await page.evaluate(()=>window.__cityDiagnostics);validate(after,manifest);assert.ok(after.renders>before.renders);assert.equal(after.bufferBytes,before.bufferBytes);assert.equal(after.retainedPackBytes,before.retainedPackBytes);assert.equal(evidence.geometry_requests.length,requests,'Navigation must not fetch more geometry');clean(evidence);await screenshot(page,'city-overview');
 return {full_city:true,load_ms,manifest_expected:{blocks:manifest.tiles.length,volumes:manifest.tiles.reduce((n,t)=>n+t.n,0),packs:manifest.packs.length},before,after,overview_camera,overview_fit,...evidence};
 }finally{await record()}
});
