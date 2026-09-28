// Ordre 653: LAES-MODELLER.html (kun laest) i headless Chrome, 390 touch og 1280 mus, uden net.
// Skaermbilleder af hele siden og af hver figur forstoerret, plus tal: sidelaens, JS-fejl, net.
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const UD = 'outputs/kritik-653';
const url = pathToFileURL('C:/Users/Entropi/Desktop/LAES-MODELLER.html').href;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const res = {};
for (const [b, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const page = await browser.newPage();
  const fejl = [], net = [];
  page.on('pageerror', e => fejl.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') fejl.push(m.text()); });
  await page.setRequestInterception(true);
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) { net.push(r.url()); r.abort(); } else r.continue(); });
  await page.setViewport({ width: b, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await page.goto(url, { waitUntil: 'load' });
  const m = await page.evaluate(() => ({
    sidelaens: document.documentElement.scrollWidth - innerWidth,
    hoejde: document.documentElement.scrollHeight,
    figurer: [...document.querySelectorAll('.par img')].map(i => ({ alt: i.alt, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), ok: i.complete && i.naturalWidth > 0 })),
  }));
  res[b] = { ...m, fejl, net };
  await page.screenshot({ path: `${UD}/F653-side-${b}.png`, fullPage: true });
  const par = await page.$$('.par');
  for (let i = 0; i < par.length; i++) await par[i].screenshot({ path: `${UD}/F653-${b}-par${i + 1}.png` });
  await page.close();
}
// Hver "nu"-figur alene og stor (som Marc ser den paa 1280 med zoom)
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'load' });
const n = await page.$$eval('.par img', a => a.length);
for (let i = 0; i < n; i++) {
  await page.evaluate(i => { const im = document.querySelectorAll('.par img')[i]; document.body.innerHTML = ''; document.body.style.background = '#141410'; im.style.width = '860px'; document.body.appendChild(im); }, i).catch(() => {});
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(i => { const im = document.querySelectorAll('.par img')[i].cloneNode(); document.body.innerHTML = ''; im.style.width = '860px'; im.style.display = 'block'; document.body.appendChild(im); }, i);
  const el = await page.$('img');
  await el.screenshot({ path: `${UD}/F653-stor-${String(i + 1).padStart(2, '0')}.png` });
}
await browser.close();
writeFileSync(`${UD}/maaling-653.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
