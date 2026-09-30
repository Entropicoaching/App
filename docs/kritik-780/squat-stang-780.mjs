// Ordre 780: squat low bar / high bar i De tre loeft (side og forfra hvis findes), bund og lockout.
import puppeteer from 'puppeteer-core';
const UD = 'outputs/kritik-780', H = 'http://127.0.0.1:8780';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto(H + '/dist/tre-loeft/index.html', { waitUntil: 'load' }); await wait(500); await p.click('[data-loeft=squat]');
  for (const [n, tx] of [['lowbar', 'Low bar'], ['highbar', 'High bar']]) for (const st of ['bund', 'sticking', 'lockout']) {
    await p.evaluate(t => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === t).click(), tx);
    await p.click(`[data-stilling=${st}]`); await wait(400);
    await (await p.$('[data-rolle=figurer]')).screenshot({ path: `${UD}/S780-${w}-${n}-${st}.png` });
  }
  await p.close();
}
await b.close();


