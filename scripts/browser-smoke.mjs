import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const executablePath=process.env.CHROMIUM_PATH;
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_FAILED'))errors.push(m.text())});
await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
await page.route('**/data/city/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);
  requests.push(name);
  const body=await readFile(`data/processed/browser-fixture/${name}`);
  await route.fulfill({body,contentType:name==='city.json'?'application/json':'application/octet-stream'});
});
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>!document.querySelector('nav button')?.hasAttribute('disabled'));
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('.error').count(),0,await page.locator('.error').allTextContents());
  assert.equal(errors.length,0,errors.join('\n'));
  await mkdir('data/processed/browser-check',{recursive:true});
  await page.screenshot({path:'data/processed/browser-check/desktop.png'});
  // Find a selectable real volume, without assuming screen coordinates of any identifier.
  let selected=false;
  for(let y=280;y<760&&!selected;y+=35)for(let x=450;x<1190&&!selected;x+=35){
    await page.mouse.click(x,y);await page.waitForTimeout(30);
    selected=await page.locator('.detail').count()>0;
  }
  assert.ok(selected,'GPU picking must select a real source volume');
  const selectedText=await page.locator('.detail').innerText();
  assert.ok(selectedText.includes('SMP'));
  const packsBefore=requests.filter(n=>n.startsWith('pack')).length;
  await page.getByRole('button',{name:'Alejar',exact:true}).click({clickCount:4,delay:100});
  await page.waitForTimeout(1500);
  await page.mouse.move(900,450);await page.mouse.down();await page.mouse.move(650,550,{steps:12});await page.mouse.up();
  await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.waitForTimeout(2200);
  assert.equal(requests.filter(n=>n.startsWith('pack')).length,packsBefore,'Moving/zooming must not reload geometry');
  await page.getByRole('button',{name:'Antigüedad',exact:true}).click();
  await page.getByRole('button',{name:'Animar volúmenes',exact:true}).click();await page.waitForTimeout(1800);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Alturas',exact:true}).click();
  await page.waitForTimeout(800);
  await page.screenshot({path:'data/processed/browser-check/mobile.png'});
  assert.equal(errors.length,0,errors.join('\n'));
  const result={fixture:'800 real central-CABA source volumes',shader_errors:errors,geometry_pack_requests:packsBefore,geometry_requests_after_navigation:requests.filter(n=>n.startsWith('pack')).length,gpu_picking:true,mobile_resize:true,reduced_motion:true,selectedText};
  await writeFile('docs/browser-smoke.json',JSON.stringify(result,null,2)+'\n');
  console.log(result);
}catch(e){await page.screenshot({path:'/tmp/3d-baires-browser-failure.png'});console.log('ERRORS',errors,await page.locator('body').innerText());throw e}finally{await browser.close()}
