// Ordre 716: squat, baenk og doedloeft fra lokal server (127.0.0.1:8716) paa 390 touch og 1280 mus, ingen net ud.
import puppeteer from 'puppeteer-core';
const UD = 'outputs/kritik-716';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const wait = ms => new Promise(r => setTimeout(r, ms)); const res = {};
async function side(w, h, touch, url) {
  const p = await b.newPage(); const fejl = [], net = [];
  p.on('pageerror', e => fejl.push(String(e))); p.on('console', m => { if (m.type() === 'error') fejl.push(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith('http://127.0.0.1:8716') || u.startsWith('data:')) r.continue(); else { net.push(u); r.abort(); } });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto('http://127.0.0.1:8716/' + url, { waitUntil: 'load' });
  return { p, fejl, net };
}
const shot = async (p, sel, f) => { const e = await p.$(sel); if (e) { await e.evaluate(x => x.scrollIntoView({ block: 'center' })); await wait(150); await e.screenshot({ path: f }); } else console.log('mangler', sel); };
const klik = async (p, sel) => { const e = await p.$(sel); if (e) { await e.evaluate(x => x.click()); } else console.log('mangler', sel); };
for (const [w, h, t] of [[390, 844, true], [1280, 900, false]]) {
  // SQUAT animation
  let { p, fejl, net } = await side(w, h, t, 'demo/squat.html');
  for (const bar of ['lowbar', 'highbar']) { await klik(p, '#bar-' + bar); for (let i = 0; i < 4; i++) { await wait(650); await shot(p, '#squat-canvas', `${UD}/sq-${w}-${bar}-t${i}.png`); } }
  res[w + 'squat'] = { fejl, net }; await p.close();
  // SQUAT statiske figurer (side og forfra)
  ({ p, fejl, net } = await side(w, h, t, 'dist/tre-loeft/index.html'));
  await klik(p, '[data-loeft=squat]');
  for (const st of ['lowbar', 'highbar']) for (const stil of ['bund', 'lockout']) { await klik(p, `[data-stang=${st}]`); await klik(p, `[data-stilling=${stil}]`); await wait(400); await shot(p, '[data-rolle=figurer]', `${UD}/sqf-${w}-${st}-${stil}.png`); }
  await klik(p, '[data-loeft=baenk]'); await wait(300);
  const ks = await p.$$eval('[data-rolle=valg] button, [data-rolle=stillinger] button', e => e.map(x => x.textContent.trim() + '|' + JSON.stringify(x.dataset)));
  console.log(w, 'baenk-valg', ks.join(' ; '));
  res[w + 'tre'] = { fejl, net }; await p.close();
  // BAENK animation og buer
  ({ p, fejl, net } = await side(w, h, t, 'demo/baenk.html'));
  for (const bue of ['lille', 'middel', 'stor']) { await klik(p, `[data-bue=${bue}]`); for (let i = 0; i < 4; i++) { await wait(600); await shot(p, '#bench-canvas', `${UD}/bk-${w}-${bue}-t${i}.png`); } }
  await shot(p, '#bue-canvas', `${UD}/bk-${w}-tre-buer.png`);
  res[w + 'baenk'] = { fejl, net }; await p.close();
  // DOEDLOEFT animation: konventionel, sumo smal/mellem/bred
  ({ p, fejl, net } = await side(w, h, t, 'demo/doedloeft.html'));
  const cfg = [['konv', 'konventionel', null]];
  await klik(p, '[data-stil=sumo]');
  const rng = await p.$eval('#standbredde-slider', s => [+s.min, +s.max]);
  cfg.push(['sumo-smal', 'sumo', rng[0]], ['sumo-mellem', 'sumo', (rng[0] + rng[1]) / 2], ['sumo-bred', 'sumo', rng[1]]);
  console.log(w, 'standbredde', rng);
  for (const [n, stil, v] of cfg) {
    await klik(p, `[data-stil=${stil}]`);
    if (v !== null) await p.$eval('#standbredde-slider', (s, v) => { s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    for (let i = 0; i < 3; i++) { await wait(700); await shot(p, '#deadlift-canvas', `${UD}/dl-${w}-${n}-t${i}.png`); }
  }
  res[w + 'dl'] = { fejl, net }; await p.close();
  // DOEDLOEFT statiske
  ({ p, fejl, net } = await side(w, h, t, 'dist/doedloeft-figurer/index.html'));
  await wait(400);
  await (await p.$('body')).screenshot({ path: `${UD}/dlf-${w}.png` });
  res[w + 'dlf'] = { fejl, net }; await p.close();
  ({ p, fejl, net } = await side(w, h, t, 'dist/baenk-figurer/index.html'));
  await wait(400); await (await p.$('body')).screenshot({ path: `${UD}/bkf-${w}.png` });
  res[w + 'bkf'] = { fejl, net }; await p.close();
}
await b.close(); console.log(JSON.stringify(res));
