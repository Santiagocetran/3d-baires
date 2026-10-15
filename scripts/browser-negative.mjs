import assert from 'node:assert/strict';
import {baseURL,reportRun,observe,fixture,screenshot} from './browser-helpers.mjs';
await reportRun(process.env.BROWSER_REPORT||'docs/browser-negative.json',async (browser,report)=>{
 const results=[];report.cases=results;
 for(const kind of ['http','html','corrupt','abort'].filter(kind=>!process.env.NEGATIVE_CASE||process.env.NEGATIVE_CASE===kind)){
  const page=await browser.newPage();report.current_evidence=await observe(page);let failedAfterPartial=false;
  await fixture(page,async(route,name)=>{if(name!=='pack1.bin.gz')return false;
   await page.waitForFunction(()=>window.__cityDiagnostics?.loadedBlocks===1,null,{timeout:30000});failedAfterPartial=true;
   if(kind==='abort')await route.abort('failed');
   else await route.fulfill({status:kind==='http'?503:200,contentType:kind==='html'?'text/html':'application/octet-stream',body:kind==='html'?'<!doctype html><html>Error</html>':Buffer.from([0,1,2,3])});return true;
  });
  await page.goto(baseURL);await page.waitForFunction(()=>['error','ready'].includes(window.__cityDiagnostics?.phase),null,{timeout:45000});
  const d=await page.evaluate(()=>window.__cityDiagnostics);assert.equal(d.phase,'error',`${kind}: partial failure must not become ready`);assert.equal(d.loadedBlocks,1);assert.ok(d.error);assert.ok(failedAfterPartial);
  if(kind==='http')await screenshot(page,'partial-error-before-navigation');await page.getByRole('button',{name:'Acercar',exact:true}).click();await page.waitForFunction(renders=>window.__cityDiagnostics?.renders>renders,d.renders,{timeout:10000});const after=await page.evaluate(()=>window.__cityDiagnostics);assert.equal(after.loadedBlocks,1);if(kind==='http')await screenshot(page,'partial-error-retained');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__cityDiagnostics.phase),'error');results.push({kind,phase:d.phase,loadedBlocks:d.loadedBlocks,error:d.error,renders_before_navigation:d.renders,renders_after_navigation:after.renders});await page.close();
 }
 for(const kind of ['worker-error','worker-messageerror','context-loss'].filter(kind=>!process.env.NEGATIVE_CASE||process.env.NEGATIVE_CASE===kind)){
  const page=await browser.newPage();report.current_evidence=await observe(page);
  if(kind.startsWith('worker'))await page.addInitScript(kind=>{
   const Native=window.Worker;window.Worker=class extends Native{
    constructor(url,options){super(url,options);this.isCity=String(url).includes('city.worker')}
    postMessage(message,transfer){if(this.isCity&&message.id===1){const timer=setInterval(()=>{if(window.__cityDiagnostics?.loadedBlocks===1){clearInterval(timer);this.dispatchEvent(kind==='worker-error'?new ErrorEvent('error',{message:'Injected worker error'}):new MessageEvent('messageerror'))}},10);return}super.postMessage(message,transfer)}
   };
  },kind);
  const m=await fixture(page);await page.goto(baseURL);
  if(kind==='context-loss'){await page.waitForFunction(()=>window.__cityDiagnostics?.phase==='ready');
   const supported=await page.evaluate(()=>{const canvas=document.querySelector('.maplibregl-canvas'),gl=canvas.getContext('webgl2'),extension=gl?.getExtension('WEBGL_lose_context');extension?.loseContext();return !!extension});assert.ok(supported,'SwiftShader must support real context loss');
  }
  await page.waitForFunction(()=>window.__cityDiagnostics?.phase==='error',null,{timeout:10000}).catch(async error=>{report.observed=await page.evaluate(()=>window.__cityDiagnostics);throw error});const d=await page.evaluate(()=>window.__cityDiagnostics);assert.ok(d.error);assert.equal(d.loadedBlocks,kind==='context-loss'?m.tiles.length:1);results.push({kind,event_injection:kind.startsWith('worker'),phase:d.phase,loadedBlocks:d.loadedBlocks,error:d.error});await page.close();
 }
 return {cases:results};
});
