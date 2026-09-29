// Ordre 702: squat low bar/high bar, bund/sticking/lockout, De tre loeft (kun laest), 390 touch og 1280 mus, uden net.
import puppeteer from 'puppeteer-core';
const LM = process.env.LM, UD = 'outputs/kritik-702';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms)); const res = {};
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage(); const fejl = [], net = [];
  p.on('pageerror', e => fejl.push(String(e)));
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith('file:') || u.startsWith('data:')) r.continue(); else { net.push(u); r.abort(); } });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto('file:///' + LM + '/dist/tre-loeft/index.html', { waitUntil: 'load' });
  await p.click('[data-loeft=squat]');
  for (const st of ['lowbar', 'highbar']) for (const stil of ['bund', 'lockout']) {
    await p.click('[data-stang=' + st + ']'); await p.click('[data-stilling=' + stil + ']'); await wait(500);
    const fig = await p.$('[data-rolle=figurer]');
    await fig.screenshot({ path: `${UD}/S702-${w}-${st}-${stil}.png` });
  }
  res[w] = { fejl, net }; await p.close();
}
await b.close(); console.log(JSON.stringify(res));
