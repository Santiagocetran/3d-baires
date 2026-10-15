import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {baseURL,reportRun,observe,fixture,ready,clean,screenshot} from './browser-helpers.mjs';
await reportRun(process.env.BROWSER_REPORT||'docs/browser-design.json',async browser=>{
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const e=await observe(page),manifest=await fixture(page);
 await page.goto(`${baseURL}/?lng=-58.3817&lat=-34.6036&zoom=16&pitch=35&bearing=-18`);await ready(page,manifest,30000);
 const list=page.locator('.places-list');assert.equal(await list.locator(':scope > button').count(),13);
 await page.getByRole('button',{name:'⚽ Fútbol (8)',exact:true}).click();assert.equal(await list.locator(':scope > button').count(),8);
 assert.equal(await page.getByRole('button',{name:'Descubrir Teatro Colón',exact:true}).isVisible(),false);
 const stadiums=[['La Bombonera','Boca Juniors'],['El Monumental','River Plate'],['Pedro Bidegain','San Lorenzo'],['Tomás Adolfo Ducó','Huracán'],['José Amalfitani','Vélez Sarsfield'],['Diego Armando Maradona','Argentinos Juniors'],['Arquitecto Ricardo Etcheverri','Ferro Carril Oeste'],['Don León Kolbowski','Atlanta']];
 const points=JSON.parse(await readFile('data/stadium-points.json','utf8')).places;
 const ids=['bombonera','monumental','bidegain','duco','amalfitani','maradona','ferro','atlanta'];
 for(const [index,[name,club]] of stadiums.entries()){
  await list.getByRole('button',{name:new RegExp(name)}).click();const selected=page.getByRole('article',{name:`Lugar destacado: ${name}`,exact:true});await selected.waitFor();
  assert.equal(await selected.locator('.landmark-club').textContent(),club);
  await selected.locator('img').evaluate(img=>img.decode());await page.waitForTimeout(350);
  const q=new URL(page.url()).searchParams,point=points.find(p=>p.id===ids[index]);
  assert.ok(Math.abs(Number(q.get('lng'))-point.coordinates[0])<0.00001&&Math.abs(Number(q.get('lat'))-point.coordinates[1])<0.00001,`Camera for ${name} matches official point`);
  if(index===0){await screenshot(page,'bombonera-desktop');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Contraer panel',exact:true}).click();await screenshot(page,'bombonera-mobile');await page.getByRole('button',{name:'Explorar · abrir panel',exact:true}).click();await page.setViewportSize({width:1440,height:960})}
 }
 await page.getByRole('button',{name:'Todos',exact:true}).click();assert.equal(await list.locator(':scope > button').count(),13);
 for(const name of ['El Cabildo','Palacio Barolo']){await list.getByRole('button',{name:new RegExp(name)}).click();const c=page.getByRole('article',{name:`Lugar destacado: ${name}`,exact:true});await c.locator('img').evaluate(img=>img.decode())}
 await page.getByRole('button',{name:'Teatro Colón',exact:false}).filter({has:page.locator('img')}).click();
 await page.waitForFunction(()=>Number(new URL(location.href).searchParams.get('zoom'))>16.5);
 const marker=page.getByRole('button',{name:'Descubrir Teatro Colón',exact:true});
 const card=page.getByRole('article',{name:'Lugar destacado: Teatro Colón'});
 await card.waitFor();assert.ok(await card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
 await page.keyboard.press('Escape');assert.equal(await card.count(),0,'Escape closes a card opened from the list');
 await marker.hover();await card.waitFor();await card.hover({position:{x:100,y:100}});await page.waitForTimeout(250);assert.equal(await card.count(),1,'Card stays open when pointer enters it');
 await page.mouse.move(1400,900);await page.waitForTimeout(300);assert.equal(await card.count(),0,'Unpinned hover card dismisses');
 await marker.focus();await card.waitFor();await marker.press('Escape');assert.equal(await card.count(),0);
 await marker.click();await page.mouse.move(1400,900);await page.waitForTimeout(250);assert.equal(await card.count(),1,'Click pins a place');
 await screenshot(page,'landmark-desktop');
 const requests=e.geometry_requests.length;
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Contraer panel',exact:true}).click();
 const bounds=await card.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844);
 await screenshot(page,'landmark-mobile');
 await page.getByRole('button',{name:'Cerrar lugar destacado',exact:true}).click();
 await page.getByRole('button',{name:'Explorar · abrir panel',exact:true}).click();
 await page.setViewportSize({width:1440,height:960});
 await page.getByRole('button',{name:'Ver toda CABA',exact:true}).click();await page.waitForTimeout(500);await screenshot(page,'caba-mask');
 const paint=await page.evaluate(async()=>{return {canvas:document.querySelector('.maplibregl-canvas').getBoundingClientRect().toJSON(),camera:Object.fromEntries(new URL(location.href).searchParams)}});
 assert.equal(e.geometry_requests.length,requests);clean(e);
 // Pixel comparison exercises the actual shader, not a duplicate easing function.
 const [anchor]=JSON.parse(await readFile('data/processed/browser-fixture/selection.json','utf8'));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.clock.install({time:new Date('2026-10-15T12:00:00Z')});
 await page.goto(`${baseURL}/?lng=${anchor.lng}&lat=${anchor.lat}&zoom=18&pitch=45&bearing=0`);await ready(page,manifest,30000);await page.waitForTimeout(1600);
 const canvas=page.locator('.maplibregl-canvas'),rest=await canvas.screenshot();await writeFile('data/processed/browser-check/replay-rest.png',rest);
 await page.getByRole('button',{name:'Animar volúmenes',exact:true}).click();
 // Freeze the animation time before capturing: screenshot latency under software
 // WebGL must not silently move the sample past the end of the animation.
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 const moving=await canvas.screenshot();await writeFile('data/processed/browser-check/replay-moving.png',moving);assert.ok(!rest.equals(moving),'Replay must move visible geometry');
 await page.clock.runFor(1600);const settled=await canvas.screenshot();await writeFile('data/processed/browser-check/replay-settled.png',settled);assert.ok(rest.equals(settled),'Animation must settle at exactly the original geometry');
 const settledRenders=await page.evaluate(()=>window.__cityDiagnostics.renders);await page.clock.runFor(300);
 assert.equal(await page.evaluate(()=>window.__cityDiagnostics.renders),settledRenders,'Settled scene must stop requesting frames');clean(e);
 return {stadium_cards_verified:stadiums.map(([name,club])=>({name,club})),stadium_cameras_match_official_points:true,football_filter_count:8,total_places:13,new_cultural_photos_loaded:true,animation_changes_pixels:true,animation_exact_settle:true,animation_clock_controlled:true,idle_render_stops:true,hover_card:true,pointer_bridge:true,keyboard_escape:true,click_pin:true,mobile_bounds:true,local_photo_loaded:true,resident_geometry_requests:requests,mask_screenshot:'data/processed/browser-check/caba-mask.png',mask_projection:paint,...e};
});
