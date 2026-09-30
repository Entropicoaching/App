// Ordre 841: Laer skak "Jeg er ny", trin 7-12 loest paa touch/mus. FASE=foer|efter node outputs/821/laer-821.mjs [--skaermbilleder]
import { createRequire } from 'node:module'; const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const her = path.resolve('outputs/kritik-841');
const fase = process.env.FASE ?? 'efter';
const url = pathToFileURL(process.env.SKAK ?? path.join(her, 'x')).href;
const sb = process.argv.includes('--skaermbilleder');
const SK = [{ w: 320, h: 520, m: true }, { w: 360, h: 560, m: true }, { w: 390, h: 844, m: true }, { w: 1280, h: 800, m: false }];
const RUTER = [
  [['e2', 'e4'], ['e4', 'e5'], ['e5', 'e6']],
  [['e4', 'd5']],
  [['d4', 'b5']],
  [['e1', 'e8']],
  [['h4', 'e7']],
  [['e1', 'g1']],
];
const fejl = [];
const browser = await chromium.launch();
for (const b of SK) {
  const hv = `${b.w}x${b.h}`;
  const ctx = await browser.newContext({ viewport: { width: b.w, height: b.h }, isMobile: b.m, hasTouch: b.m, deviceScaleFactor: b.m ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fejl.push(`${hv}: ${e.message}`));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) fejl.push('net: ' + r.url()); });
  const tryk = async (q) => { const l = page.locator(q); if (b.m) await l.tap(); else await l.click(); };
  await page.goto(url); await page.waitForSelector('#braet .felt');
  await tryk('#fane-laer'); await page.waitForTimeout(400);
  await tryk('#segment-laer-niveau .segment-knap[data-value="ny"]'); await page.waitForTimeout(500);
  const maal = (navn) => page.evaluate((n) => {
    const r = (q) => { const e = document.querySelector(q); if (!e || !e.checkVisibility()) return 'skjult'; const x = e.getBoundingClientRect(); return `${Math.round(x.top + scrollY)}-${Math.round(x.bottom + scrollY)}`; };
    const t = (q) => { const e = document.querySelector(q); return e && e.checkVisibility() ? e.innerText.trim().slice(0, 60) : 'skjult'; };
    return { n, trin: t('#laer-trin-taeller'), braet: r('#braet'), besked: t('#laer-besked'), videre: r('#knap-laer-videre'), vh: innerHeight, sw: document.documentElement.scrollWidth };
  }, navn);
  const skriv = async (navn) => { const m = await maal(navn); console.log(`${hv} ${JSON.stringify(m)}`); if (m.sw > b.w) fejl.push(`${hv}: sidescroll ved ${navn}`); return m; };
  for (let i = 0; i < 6; i++) { await tryk('#knap-laer-spring-over'); await page.waitForTimeout(350); }
  for (let i = 0; i < RUTER.length; i++) {
    const nr = i + 7;
    const s = await skriv(`trin${nr}-start`);
    const bt = parseInt(s.braet.split('-')[1], 10);
    if (sb && (nr === 7 || nr === 10)) await page.screenshot({ path: path.join(her, `laer-${fase}-trin${nr}-${hv}-start.png`), fullPage: true });
    for (const [fra, til] of RUTER[i]) { await tryk(`#braet [data-square="${fra}"]`); await tryk(`#braet [data-square="${til}"]`); await page.waitForTimeout(400); }
    await page.waitForTimeout(400);
    const m = await skriv(`trin${nr}-loest`);
    if (m.videre === 'skjult') fejl.push(`${hv}: trin ${nr} loest, men Videre mangler`);
    const braetNed = parseInt(m.braet.split('-')[1], 10);
    if (braetNed > m.vh) fejl.push(`${hv}: trin ${nr} braettets bund ${braetNed} under kanten ${m.vh}`);
    if (m.videre !== 'skjult') { const v = parseInt(m.videre.split('-')[1], 10); if (v > m.vh) fejl.push(`${hv}: trin ${nr} Videre-bund ${v} under kanten ${m.vh}`); }
    if (sb && (nr === 7 || nr === 10)) await page.screenshot({ path: path.join(her, `laer-${fase}-trin${nr}-${hv}.png`), fullPage: true });
    if (m.videre !== 'skjult') { await tryk('#knap-laer-videre'); await page.waitForTimeout(400); }
  }
  await skriv('efter-trin12');
  await ctx.close();
}
await browser.close();
if (fejl.length) { console.log(fejl.join('\n')); process.exit(1); }
