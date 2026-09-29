// Ordre 716: proeve af kontroller paa loeftmodellens demosider (kun 127.0.0.1:8716).
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
for (const u of ['demo/doedloeft.html', 'demo/squat.html', 'demo/baenk.html', 'dist/tre-loeft/index.html']) {
  const p = await b.newPage(); const f = [];
  p.on('pageerror', e => f.push(String(e)));
  await p.goto('http://127.0.0.1:8716/' + u, { waitUntil: 'load' });
  const bs = await p.$$eval('button, input[type=range]', els => els.map(e => (e.id || '') + '|' + (e.dataset ? JSON.stringify(e.dataset) : '') + '|' + (e.textContent || '').trim().slice(0, 25)));
  console.log(u, f, bs.join('\n  '));
  await p.close();
}
await b.close();
