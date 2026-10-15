// Whole-city resident loading and request continuity check. Software WebGL is not a hardware FPS benchmark.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:800}});
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_FAILED'))errors.push(m.text())});
page.on('request',r=>{if(/pack-.*\.bin\.gz/.test(r.url()))requests.push(r.url())});
await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
const start=Date.now();
try{
 await page.goto('http://127.0.0.1:5173');
 await page.waitForFunction(()=>!document.querySelector('nav button')?.hasAttribute('disabled'));
 for(let i=0;i<120;i++){
  const text=await page.locator('body').innerText();
  const progress=text.match(/Preparando ciudad 3D[^\n]*/)?.[0];
  if(!progress)break;
  console.log(progress);
  assert.equal(await page.locator('.error').count(),0,text);
  await page.waitForTimeout(5000);
 }
 assert.ok(!(await page.locator('body').innerText()).includes('Preparando ciudad 3D'),'Whole city must finish');
 assert.equal(errors.length,0,errors.join('\n'));
 const loadMs=Date.now()-start,before=requests.length;
 await page.waitForTimeout(1500);
 await mkdir('data/processed/browser-check',{recursive:true});
 await page.screenshot({path:'data/processed/browser-check/full-city.png',timeout:60000});
 for(const name of ['Palermo','Villa Lugano','Belgrano','Monserrat']){
  const select=page.locator('select');
  const options=await select.locator('option').allTextContents();
  const label=options.find(o=>o.toLowerCase()===name.toLowerCase());assert.ok(label);
  await select.selectOption({label});await page.waitForTimeout(1800);
 }
 await page.getByRole('button',{name:'Alejar',exact:true}).click({clickCount:4,delay:100});await page.waitForTimeout(2000);
 await page.screenshot({path:'data/processed/browser-check/city-overview.png',timeout:60000});
 assert.equal(requests.length,before);
 assert.equal(errors.length,0,errors.join('\n'));
 const report={full_city:true,software_webgl:true,load_ms:loadMs,geometry_pack_requests:before,geometry_requests_after_neighbourhoods_and_zoom:requests.length,shader_or_page_errors:errors,hardware_fps_measured:false};
 await writeFile('docs/browser-city.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{await browser.close()}
