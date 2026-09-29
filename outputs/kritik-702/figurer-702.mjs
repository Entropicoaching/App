// Ordre 702 (Bhishak): baenk og squat fra loeftmodellens main (git archive, kun laest), headless, 390 touch og 1280 mus, uden net.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const LM = process.env.LM; const UD = 'outputs/kritik-702';
const f = p => 'file:///' + LM + '/' + p;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const res = {};
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const r = res[w] = { fejl: [], net: [] };
  const ny = async () => { const p = await b.newPage();
    p.on('pageerror', e => r.fejl.push(String(e)));
    await p.setRequestInterception(true);
    p.on('request', q => { const u = q.url(); if (u.startsWith('file:') || u.startsWith('data:')) q.continue(); else { r.net.push(u); q.abort(); } });
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch }); return p; };
  // Baenk: de statiske figurer
  const p = await ny();
  await p.goto(f('dist/baenk-figurer/index.html'), { waitUntil: 'load' });
  await wait(300);
  await p.screenshot({ path: `${UD}/B702-${w}-baenk-side.png`, fullPage: true });
  for (const n of ['bue-lille', 'bue-middel', 'bue-stor', 'lockout', 'midt', 'bryst']) {
    await p.goto(f(`dist/baenk-figurer/baenk-${n}.svg`), { waitUntil: 'load' });
    await p.screenshot({ path: `${UD}/B702-${w}-${n}.png` });
  }
  // Tre loeft: squat
  await p.goto(f('dist/tre-loeft/index.html'), { waitUntil: 'load' }); await wait(500);
  const knapper = await p.evaluate(() => [...document.querySelectorAll('button')].map(x => (x.dataset.loeft || x.dataset.stang || x.dataset.stilling || x.dataset.valg || '') + '|' + x.textContent.trim().slice(0, 30)));
  r.knapper = knapper;
  await p.close();
  // Animationer
  for (const [side, id] of [['squat', 'squat-canvas'], ['baenk', 'bench-canvas']]) {
    const q = await ny(); await q.goto(f(`demo/${side}.html`), { waitUntil: 'load' }); await wait(800);
    await q.screenshot({ path: `${UD}/A702-${w}-${side}-side.png`, fullPage: true });
    const c = await q.$('#' + id); if (c) await c.screenshot({ path: `${UD}/A702-${w}-${side}-canvas.png` });
    await q.close();
  }
}
await b.close(); writeFileSync(`${UD}/maaling-702.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
