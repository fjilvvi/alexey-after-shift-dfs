import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.GAME_URL || 'http://127.0.0.1:5173';
const out = new URL('../artifacts/visual/', import.meta.url).pathname;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
const failed = [];
const report = { passed: false, checks: [], speeches: [], walkFrames: [], errors, failedRequests: failed };
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));

const state = () => page.evaluate(() => window.__alexey);
const wait = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout });
const cdp = await page.context().newCDPSession(page);
const shot = async name => {
  await page.locator('canvas').screenshot({ path: out + name + '.png' });
};
const fastShot = async (name, box) => {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
  });
  await fs.writeFile(out + name + '.png', Buffer.from(data, 'base64'));
};
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

async function checkSpeech(expectedSpeaker, expectedName, fileName) {
  await wait(({ speaker, name }) => window.__alexey.speech?.speaker === speaker && window.__alexey.speech?.name === name, { speaker: expectedSpeaker, name: expectedName });
  const s = await state();
  const speech = s.speech;
  assert(speech, 'Speech panel exists');
  assert.equal(speech.name, expectedName);
  assert(speech.x >= 20 && speech.y >= 100 && speech.x + speech.w <= 1260 && speech.y + speech.h <= 596, 'Speech stays inside safe game bounds');
  const ownFace = expectedSpeaker === 'hero' ? s.heroFace : s.customerFace;
  const otherFace = expectedSpeaker === 'hero' ? s.customerFace : s.heroFace;
  assert.equal(overlap(speech, ownFace), 0, 'Speech does not cover speaker face');
  if (otherFace) assert.equal(overlap(speech, otherFace), 0, 'Speech does not cover the other character face');
  const nearestX = Math.max(speech.x, Math.min(speech.anchorX, speech.x + speech.w));
  const nearestY = Math.max(speech.y, Math.min(speech.anchorY, speech.y + speech.h));
  assert(Math.hypot(speech.anchorX - nearestX, speech.anchorY - nearestY) < 650, 'Speech remains visually attached to speaker');
  report.speeches.push({ name: expectedName, speaker: expectedSpeaker, placement: speech.placement, bounds: speech });
  if (fileName) await shot(fileName);
}

try {
  await page.goto(url);
  await wait(() => window.__alexey?.phase === 'title');
  await page.keyboard.press('Enter', { delay: 90 });
  await checkSpeech('hero', 'АЛЕКСЕЙ', 'dialog-alexey-intro');
  await wait(() => window.__alexey?.ready === true);
  await checkSpeech('customer', 'БЕГУН', 'dialog-customer-1');

  let walkKey = 'ArrowRight';
  await page.keyboard.down(walkKey);
  for (const frame of [1, 3, 5, 7]) {
    await wait(f => window.__alexey.walking && window.__alexey.walkFrame === f, frame);
    const s = await state();
    assert(Math.abs(s.heroFootY - 612) < 0.2, `Walking foot baseline stays at 612 in frame ${frame}`);
    report.walkFrames.push({ frame, heroX: s.heroX, footY: s.heroFootY });
    await shot(`walk-phase-${frame}`);
    if ((s.heroX > 900 && walkKey === 'ArrowRight') || (s.heroX < 380 && walkKey === 'ArrowLeft')) {
      await page.keyboard.up(walkKey);
      walkKey = walkKey === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(walkKey);
    }
  }
  await page.keyboard.up(walkKey);
  await wait(() => !window.__alexey.walking && window.__alexey.heroVelocity === 0);
  await shot('walk-idle-stop');
  report.checks.push('Four real walking phases preserve the ground baseline and return to idle');

  const customerNames = ['БЕГУН', 'НОВИЧОК', 'ВЕТЕРАН'];
  for (let i = 0; i < 3; i++) {
    await wait(() => window.__alexey.phase === 'shop' && window.__alexey.ready);
    if (i > 0) await checkSpeech('customer', customerNames[i], `dialog-customer-${i + 1}`);
    let s = await state();
    assert(Math.abs(s.customerFootY - 610) < 0.2, `Customer ${i + 1} shoes use the floor baseline`);
    assert.equal(s.customerShadowX, s.customerX, `Customer ${i + 1} shadow follows its ground position`);
    const key = s.customerX > s.heroX ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    await wait(() => Math.abs(window.__alexey.heroX - window.__alexey.customerX) < 210);
    await page.keyboard.up(key);
    await wait(() => window.__alexey.heroVelocity === 0);
    s = await state();
    assert(Math.abs(s.heroX - s.customerX) < 230, `Interaction range before serving customer ${i + 1}: ${Math.abs(s.heroX - s.customerX)}`);
    await page.keyboard.press('e', { delay: 90 });
    await wait(() => window.__alexey.phase === 'choice');
    await page.keyboard.press(String(i + 1), { delay: 90 });
    await checkSpeech('hero', 'АЛЕКСЕЙ');
    await checkSpeech('customer', customerNames[i], `dialog-customer-thanks-${i + 1}`);
    report.checks.push(`Customer ${i + 1}: request, Alexey reply and thanks are attached without face overlap`);
  }

  await wait(() => window.__alexey.phase === 'gymIntro');
  await page.keyboard.press('Enter', { delay: 90 });
  await wait(() => window.__alexey.phase === 'gym');
  await shot('gym-ready');
  const canvasBox = await page.locator('canvas').boundingBox();
  assert(canvasBox);
  const touchPoint = { x: canvasBox.x + 1060 * canvasBox.width / 1280, y: canvasBox.y + 645 * canvasBox.height / 720 };
  await wait(() => window.__alexey.needle >= 0.43 && window.__alexey.needle <= 0.45);
  await page.touchscreen.tap(touchPoint.x, touchPoint.y);
  await wait(() => window.__alexey.phase === 'lifting' && window.__alexey.reps === 1);
  await fastShot('gym-first-lift', canvasBox);
  assert.equal(await page.evaluate(() => window.__alexey.gymRepsText), '1 / 10');
  report.checks.push('Gym ready and lift poses render with visible floor contact');

  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  report.passed = true;
  await fs.writeFile(out + 'visual-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  await fs.writeFile(out + 'visual-report.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: out + 'failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
