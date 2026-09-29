// Ordre 725: elevtur (11-aarig) paa skak.html hentet med git archive. Kun laesning, syntetisk, headless.
// Brug: node docs/kritik-725/elevtur-725.mjs <skak-mappe>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-725';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const VP = [[360, 560, true], [390, 844, true], [1280, 800, false]];
const maal = [];
const b = await chromium.launch();
for (const [w, h, touch] of VP) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const fejl = []; p.on('pageerror', (e) => fejl.push(String(e))); p.on('console', (m) => m.type() === 'error' && fejl.push(m.text()));
  const tag = `${w}x${h}`;
  const snap = async (navn, note = '') => {
    await p.waitForTimeout(350);
    const m = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width) }; };
      return { braet: r('#braet'), hscroll: document.documentElement.scrollWidth > innerWidth, scrollY: Math.round(scrollY), status: document.querySelector('#status')?.innerText?.slice(0, 120) };
    });
    maal.push({ tag, navn, note, ...m });
    await p.screenshot({ path: `${ud}/${tag}-${navn}.png` });
    console.log(tag, navn, JSON.stringify(m));
  };
  const tryk = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded().catch(() => {}); await (touch ? e.tap() : e.click()); await p.waitForTimeout(250); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  await p.goto(url); await p.waitForTimeout(800);
  await snap('00-foerste');
  await tryk('#fane-spil'); await snap('01-spil');
  await tryk('#knap-start-computer').catch((e) => console.log('start-computer', e.message.slice(0, 80))); await snap('02-computer-start');
  await tryk(felt('e2')); await snap('03-e2-valgt');
  await tryk(felt('e4')); await p.waitForTimeout(2500); await snap('04-efter-e4-og-svar');
  await p.evaluate(() => scrollTo(0, 99999)); await snap('05-bund-af-siden');
  // makker med ur
  await p.goto(url); await p.waitForTimeout(500);
  await tryk('#fane-spil');
  await tryk('#knap-start-makker').catch((e) => console.log('start-makker', e.message.slice(0, 80))); await snap('10-makker-start');
  const ur = p.locator('#segment-skakur .segment-knap');
  console.log(tag, 'urvalg', await ur.allInnerTexts());
  await snap('11-makker-ur-valg');
  // gaade
  await p.goto(url); await p.waitForTimeout(500);
  await tryk('#fane-gaader'); await snap('20-gaade');
  await tryk(felt('e2')).catch(() => {}); await snap('21-gaade-tryk');
  // laer skak
  await p.goto(url); await p.waitForTimeout(500);
  await tryk('#fane-laer'); await snap('30-laer');
  const knapper = await p.locator('#fane-laer ~ * , #laer-niveau-valg .segment-knap').allInnerTexts().catch(() => []);
  console.log(tag, 'laer-niveau', knapper.slice(0, 6));
  console.log(tag, 'fejl', fejl.slice(0, 3));
  await ctx.close();
}
writeFileSync(`${ud}/maal-725.json`, JSON.stringify(maal, null, 1));
await b.close();
