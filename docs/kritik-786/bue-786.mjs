// Ordre 786: baenk i De tre loeft: lille, middel og stor bue, stangen paa brystet og lockout (samme fase).
import puppeteer from 'puppeteer-core';
const UD = 'outputs/kritik-786', H = 'http://127.0.0.1:8786';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const knap = (p, t) => p.evaluate(t => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === t).click(), t);
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  await p.goto(H + '/dist/tre-loeft/index.html', { waitUntil: 'load' }); await wait(500); await p.click('[data-loeft=baenk]');
  for (const bue of ['Lille', 'Middel', 'Stor']) for (const [n, st] of [['bryst', 'bryst'], ['lockout', 'lockout']]) {
    await knap(p, bue + ' bue'); await p.click(`[data-stilling=${st}]`); await wait(350);
    await (await p.$('[data-rolle=figurer]')).screenshot({ path: `${UD}/B786-${w}-${bue.toLowerCase()}-${n}.png` });
  }
  await p.close();
}
await b.close();
