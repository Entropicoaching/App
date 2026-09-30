// Ordre 758: Marcs laeseside, kun laest (file:), 390 og 1280.
import puppeteer from 'puppeteer-core';
const F = 'file:///C:/Users/Entropi/Desktop/Til%20Marc/LAES-MODELLER-3.html', UD = 'outputs/kritik-758';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
for (const [w, h, t] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage(); const fejl = [], net = [];
  p.on('pageerror', e => fejl.push(String(e))); await p.setRequestInterception(true);
  p.on('request', q => { const u = q.url(); (u.startsWith('file:') || u.startsWith('data:')) ? q.continue() : (net.push(u), q.abort()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: t, hasTouch: t });
  await p.goto(F, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 800));
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, imgs: document.images.length, h2: [...document.querySelectorAll('h1,h2')].map(x => x.textContent.trim().slice(0, 70)).slice(0, 14), tekst: document.body.innerText.slice(0, 900) }));
  console.log(w, JSON.stringify({ ...m, fejl, net: net.length }));
  await p.screenshot({ path: `${UD}/L758-${w}-top.png` }); await p.close();
}
await b.close();
