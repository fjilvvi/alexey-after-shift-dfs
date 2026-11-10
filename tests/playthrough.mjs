import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5173';
const out=new URL('../artifacts/',import.meta.url).pathname;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],failed=[],report={url,desktop:{},mobile:{},gymTiming:{cycles:[],missRecoveryMs:[],successRecoveryMs:[]},checks:[]};
function observe(p){p.on('pageerror',e=>errors.push(String(e)));p.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});}
async function state(p){return p.evaluate(()=>window.__alexey);}
async function wait(p,fn,timeout=30000){await p.waitForFunction(fn,{},{timeout});}
async function point(p,x,y){const b=await p.locator('canvas').boundingBox();assert(b);return{x:b.x+x*b.width/1280,y:b.y+y*b.height/720};}
async function click(p,x,y,touch=false){const pt=await point(p,x,y);await (touch?p.touchscreen.tap(pt.x,pt.y):p.mouse.click(pt.x,pt.y));}
async function screenshot(p,name){await p.screenshot({path:out+name+'.png',fullPage:true});}
async function measureCycle(p){
 return p.evaluate(()=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Needle cycle measurement timed out')),12000);
  let started=false,start=0,last=window.__alexey.needle;
  function tick(now){
   const s=window.__alexey;
   if(s.phase!=='gym'){clearTimeout(timeout);reject(new Error('Left gym during cycle measurement'));return;}
   const n=s.needle;
   if(last>.85&&n<.15){
    if(!started){started=true;start=now;}
    else{clearTimeout(timeout);resolve({measuredMs:now-start,configuredMs:s.cycleMs});return;}
   }
   last=n;requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
 }));
}
async function armRecoveryMeasurement(p){
 await p.evaluate(()=>{
  window.__qaRecoveryMs=null;let start;
  function tick(now){
   const phase=window.__alexey?.phase;
   if(phase==='lifting'&&start===undefined)start=now;
   else if(start!==undefined&&phase!=='lifting'){window.__qaRecoveryMs=now-start;return;}
   requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
 });
}
async function recoveryMs(p){await wait(p,()=>window.__qaRecoveryMs!==null,5000);return p.evaluate(()=>window.__qaRecoveryMs);}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1,hasTouch:true});observe(page);
 await page.goto(url);await wait(page,()=>window.__alexey?.phase==='title');await screenshot(page,'01-title');
 await page.keyboard.press('Enter',{delay:90});await wait(page,()=>window.__alexey?.ready===true);
 await page.keyboard.press('p',{delay:90});await wait(page,()=>window.__alexey.paused);const paused=await state(page);await page.waitForTimeout(450);assert.equal((await state(page)).elapsed,paused.elapsed);await page.keyboard.press('p',{delay:90});await wait(page,()=>!window.__alexey.paused);report.checks.push('Pause/resume freezes gameplay');
 for(let i=0;i<3;i++){
  await wait(page,()=>window.__alexey.phase==='shop'&&window.__alexey.ready,20000);
  let s=await state(page);const key=s.customerX>s.heroX?'ArrowRight':'ArrowLeft';await page.keyboard.down(key);await wait(page,()=>Math.abs(window.__alexey.heroX-window.__alexey.customerX)<215);await page.keyboard.up(key);
  if(i===0)await screenshot(page,'02-shop');await page.keyboard.press('e',{delay:90});await wait(page,()=>window.__alexey.phase==='choice');if(i===0){await screenshot(page,'03-product-choice');await page.keyboard.press('2',{delay:90});assert.equal((await state(page)).phase,'choice');assert.equal((await state(page)).shopMistakes,1);report.checks.push('Wrong product remains recoverable');}
  await page.keyboard.press(String(i+1),{delay:90});await wait(page,()=>window.__alexey.phase==='feedback');assert.equal((await state(page)).completed,i+1);console.log(`Served customer ${i+1}/3`);
  if(i<2)await wait(page,()=>window.__alexey.phase==='shop'&&window.__alexey.ready,20000);
 }
 await wait(page,()=>window.__alexey.phase==='transition',15000);await screenshot(page,'04-shift-ended');await wait(page,()=>window.__alexey.phase==='gymIntro',15000);await screenshot(page,'05-gym-instructions');await page.keyboard.press('Enter',{delay:90});await wait(page,()=>window.__alexey.phase==='gym');
 await screenshot(page,'06-gym-timing');await armRecoveryMeasurement(page);await page.keyboard.press('Space',{delay:90});await wait(page,()=>window.__alexey.phase==='lifting');assert.equal((await state(page)).misses,1);await wait(page,()=>window.__alexey.phase==='gym');const missRecovery=await recoveryMs(page);assert(Math.abs(missRecovery-600)<260,`Miss recovery ${missRecovery.toFixed(1)} ms is near 600 ms`);report.gymTiming.missRecoveryMs.push(missRecovery);report.checks.push('Miss is recoverable in about 600 ms and does not count as repetition');
 for(let i=0;i<10;i++){
  if(i===4){await page.setViewportSize({width:844,height:390});await screenshot(page,'14-mobile-gym');} if(i===6)await page.setViewportSize({width:1440,height:1100});
  if([0,3,6,9].includes(i)){
   const cycle=await measureCycle(page);const expected=[2600,2300,2000,1800][[0,3,6,9].indexOf(i)];
   assert.equal(cycle.configuredMs,expected);assert(Math.abs(cycle.measuredMs-expected)<260,`Cycle for rep ${i+1}: ${cycle.measuredMs.toFixed(1)} ms, expected ${expected} ms`);
   report.gymTiming.cycles.push({repetition:i+1,...cycle});console.log(`Cycle rep ${i+1}: ${cycle.measuredMs.toFixed(1)} ms`);
  }
  const touchPoint=i===4||i===5?await point(page,1060,645):undefined;await armRecoveryMeasurement(page);await wait(page,()=>window.__alexey.phase==='gym'&&window.__alexey.needle>=.43&&window.__alexey.needle<=.45,15000);if(touchPoint)await page.touchscreen.tap(touchPoint.x,touchPoint.y);else await page.keyboard.press('Space',{delay:90});await wait(page,()=>window.__alexey.phase==='lifting');assert.equal((await state(page)).reps,i+1);if(i===0)await screenshot(page,'07-gym-lift');const successRecovery=await recoveryMs(page);assert(Math.abs(successRecovery-800)<280,`Success recovery ${successRecovery.toFixed(1)} ms is near 800 ms`);report.gymTiming.successRecoveryMs.push(successRecovery);console.log(`Successful repetition ${i+1}/10; recovery ${successRecovery.toFixed(1)} ms`);
 }
 report.checks.push('Measured needle cycles: 2600 / 2300 / 2000 / 1800 ms; successful lifts recover in about 800 ms');
 await wait(page,()=>window.__alexey.phase==='win',10000);await page.waitForTimeout(1300);await screenshot(page,'08-victory');report.desktop=await state(page);assert.equal(report.desktop.power,1000);report.checks.push('Full passage: 3 customers, 10 reps, 1000 strength, victory');report.checks.push('Gym touch button succeeds twice in phone landscape viewport');
 if(process.env.WIN_SMOKE){await page.screenshot({path:out+'15-final-victory.png',fullPage:true});await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);await screenshot(page,'16-final-victory-mobile');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await fs.writeFile(out+'final-win-report.json',JSON.stringify({passed:true,state:report.desktop,errors,failedRequests:failed},null,2));await browser.close();process.exit(0);}
 await click(page,640,675);await wait(page,()=>window.__alexey?.phase==='title');report.checks.push('Replay resets game');
 const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});observe(mobile);await mobile.goto(url);await wait(mobile,()=>window.__alexey?.phase==='title');await screenshot(mobile,'09-mobile-landscape-title');
 await click(mobile,264,535,true);await wait(mobile,()=>window.__alexey?.ready===true);const original=await state(mobile);
 // Tap floor requests movement on a touchscreen.
 await click(mobile,900,603,true);await mobile.waitForFunction(x=>window.__alexey.heroX>x+200,original.heroX);await click(mobile,1085,675,true);await wait(mobile,()=>window.__alexey.phase==='choice');await click(mobile,400,450,true);await wait(mobile,()=>window.__alexey.completed===1);report.checks.push('Mobile taps move hero, interact and select product');
 await screenshot(mobile,'10-mobile-landscape-play');
 await mobile.setViewportSize({width:390,height:844}); const sound=mobile.locator('#sound');const before=await mobile.evaluate(()=>localStorage.getItem('alexey-audio-muted'));await sound.tap({force:true});assert.notEqual(await mobile.evaluate(()=>localStorage.getItem('alexey-audio-muted')),before);report.checks.push('Mute toggles by touch');
 await mobile.setViewportSize({width:390,height:844});await screenshot(mobile,'11-mobile-portrait');const mobileBox=await mobile.locator('canvas').boundingBox();assert(mobileBox.width<=390);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);report.mobile={...(await state(mobile)),canvas:mobileBox,portraitNoHorizontalOverflow:true};
 await mobile.close();await page.close();
 report.errors=errors;report.failedRequests=failed;assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);report.passed=true;await fs.writeFile(out+'qa-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){report.passed=false;report.error=String(e);report.errors=errors;report.failedRequests=failed;await fs.writeFile(out+'qa-report.json',JSON.stringify(report,null,2));for(const [i,p] of browser.contexts().flatMap(c=>c.pages()).entries()){try{await p.screenshot({path:out+`failure-${i}.png`,fullPage:true});console.log('Failure state',await state(p));}catch{}}throw e;}finally{await browser.close();}
