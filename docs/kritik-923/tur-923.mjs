// Ordre 923: loeftfigurerne som de staar nu (squat, baenk, doedloeft), 390 touch og 1280 mus, kun 127.0.0.1, syntetiske kroppe.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const UD = 'outputs/kritik-923', H = 'http://127.0.0.1:9001';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms)); const res = {};
const klik = (p, tekst, sel = 'button') => p.evaluate((t, s) => { const x = [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(t)); if (x) x.click(); return !!x; }, tekst, sel);
for (const [w, h, touch] of [[390, 844, true], [1280, 923, false]]) {
  const r = res[w] = { fejl: [], net: [], knapper: {} };
  const ny = async () => { const p = await b.newPage();
    p.on('pageerror', e => r.fejl.push(String(e))); p.on('console', m => { if (m.type() === 'error') r.fejl.push(m.text()); });
    await p.setRequestInterception(true);
    p.on('request', q => { const u = q.url(); if (u.startsWith(H) || u.startsWith('data:')) q.continue(); else { r.net.push(u); q.abort(); } });
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch }); return p; };
  // De tre loeft (stille figurer, side og forfra hvor de findes)
  const t = await ny(); await t.goto(H + '/dist/tre-loeft/index.html', { waitUntil: 'load' }); await wait(500);
  r.knapper.tre = await t.evaluate(() => [...document.querySelectorAll('button')].map(x => (x.dataset.loeft || x.dataset.stilling || '') + '|' + x.textContent.trim().slice(0, 25)));
  for (const l of ['squat', 'baenk', 'doedloeft']) {
    if (!(await t.$(`[data-loeft=${l}]`))) continue;
    await t.click(`[data-loeft=${l}]`); await wait(300);
    const sts = await t.evaluate(() => [...document.querySelectorAll('[data-stilling]')].map(x => x.dataset.stilling));
    r.knapper[l] = sts;
    for (const st of sts) { await t.click(`[data-stilling="${st}"]`); await wait(300); const f = await t.$('[data-rolle=figurer]'); if (f) await f.screenshot({ path: `${UD}/T923-${w}-${l}-${st}.png` }); }
  }
  await t.close();
  // Squat-animation: low bar og high bar, fire tidspunkter
  const s = await ny(); await s.goto(H + '/demo/squat.html', { waitUntil: 'load' }); await wait(800);
  for (const bar of ['lowbar', 'highbar']) { await s.click('#bar-' + bar); for (let i = 0; i < 5; i++) { await wait(650); const c = await s.$('#squat-canvas'); await c.screenshot({ path: `${UD}/A923-${w}-squat-${bar}-t${i}.png` }); } }
  await s.close();
  // Baenk-animation: tre buer
  const q = await ny(); await q.goto(H + '/demo/baenk.html', { waitUntil: 'load' }); await wait(800);
  for (const [n, tx] of [['lille', 'Lille'], ['middel', 'Middel'], ['stor', 'Stor']]) { await klik(q, tx); for (let i = 0; i < 4; i++) { await wait(700); const c = await q.$('#bench-canvas'); await c.screenshot({ path: `${UD}/A923-${w}-baenk-${n}-t${i}.png` }); } }
  const bc = await q.$('#bue-canvas'); if (bc) await bc.screenshot({ path: `${UD}/A923-${w}-baenk-tre-buer.png` });
  await q.close();
  // Doedloeft-animation: konventionel, sumo bred/smal
  const d = await ny(); await d.goto(H + '/demo/doedloeft.html', { waitUntil: 'load' }); await wait(800);
  r.knapper.dl = await d.evaluate(() => { const s = document.getElementById('standbredde-slider'); return [s.min, s.max, s.value, getComputedStyle(document.getElementById('standbredde-group')).display]; });
  const skydSt = async v => d.evaluate(v => { const s = document.getElementById('standbredde-slider'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  for (const [n, st, v] of [['konventionel', 'Konventionel', null], ['semi', 'Sumo', 49], ['sumo-smal', 'Sumo', 65.6], ['sumo-bred', 'Sumo', 82]]) {
    await klik(d, st, '#stil-row button'); if (v) await skydSt(v);
    for (let i = 0; i < 5; i++) { await wait(600); const c = await d.$('#deadlift-canvas'); await c.screenshot({ path: `${UD}/A923-${w}-dl-${n}-t${i}.png` }); }
  }
  await d.close();
}
await b.close(); writeFileSync(`${UD}/maaling-923.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));












