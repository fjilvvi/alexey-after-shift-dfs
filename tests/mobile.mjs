import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
const out=new URL('../artifacts/',import.meta.url).pathname;await fs.mkdir(out,{recursive:true});
async function pt(x,y){const b=await page.locator('canvas').boundingBox();return{x:b.x+x*b.width/1280,y:b.y+y*b.height/720};}
async function tap(x,y){const p=await pt(x,y);await page.touchscreen.tap(p.x,p.y);}
try{
await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__alexey?.phase==='title');await tap(260,535);await page.waitForFunction(()=>window.__alexey?.ready);const old=await page.evaluate(()=>window.__alexey.heroX);
const cdp=await context.newCDPSession(page),p=await pt(177,664);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await page.waitForTimeout(720);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});let s=await page.evaluate(()=>window.__alexey);assert(s.heroX>old+170,`Touch hold moved ${s.heroX-old}`);assert(Math.abs(s.heroX-s.customerX)<235);
const before=await page.evaluate(()=>localStorage.getItem('alexey-audio-muted'));await tap(845,55);const after=await page.evaluate(()=>localStorage.getItem('alexey-audio-muted'));assert.notEqual(before,after);
await tap(1230,55);await page.waitForFunction(()=>window.__alexey.paused);const paused=await page.evaluate(()=>window.__alexey.elapsed);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__alexey.elapsed),paused);await tap(640,450);await page.waitForFunction(()=>!window.__alexey.paused);
await tap(1085,675);await page.waitForFunction(()=>window.__alexey.phase==='choice');await tap(400,450);await page.waitForFunction(()=>window.__alexey.completed===1);await page.screenshot({path:out+'12-touch-controls.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:out+'13-portrait-controls.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
const report={passed:true,checks:['landscape right-button touch hold moves hero','landscape sound toggle persists mute','touch pause/resume freezes simulation','touch interaction and product choice serves customer','portrait has no horizontal overflow'],state:await page.evaluate(()=>window.__alexey),errors};await fs.writeFile(out+'mobile-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
