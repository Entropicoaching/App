// Ordre 702: animationerne (squat og baenk) fra lokal server paa loeftmodellens uddrag, kun 127.0.0.1, 1280 mus og 390 touch.
import puppeteer from 'puppeteer-core';
const UD = 'outputs/kritik-702';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms)); const res = {};
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) for (const [n, id] of [['squat', 'squat-canvas'], ['baenk', 'bench-canvas']]) {
  const p = await b.newPage(); const fejl = [], net = [];
  p.on('pageerror', e => fejl.push(String(e))); p.on('console', m => { if (m.type() === 'error') fejl.push(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith('http://127.0.0.1:8702') || u.startsWith('data:')) r.continue(); else { net.push(u); r.abort(); } });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto(`http://127.0.0.1:8702/demo/${n}.html`, { waitUntil: 'load' });
  const c = await p.$('#' + id);
  for (let i = 0; i < 4; i++) { await wait(700); if (c) await c.screenshot({ path: `${UD}/A702-${w}-${n}-t${i}.png` }); }
  res[w + n] = { fejl, net }; await p.close();
}
await b.close(); console.log(JSON.stringify(res, null, 1));
