// Ordre 869: Giv op efter flere traek (bekraeft dialogen), Laer skak trin 1 loest, gaade loest. 360x560 touch, 1280x800 mus.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-869';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700);
  const tryk = async (sel, t) => { const e = typeof sel === 'string' ? p.locator(sel).first() : sel; await e.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(t || 300); };
  const f = (x) => `#braet .felt[data-square="${x}"]`;
  await tryk('#fane-spil'); await tryk('#knap-start-computer');
  for (const [a, c] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4'], ['b1', 'c3']]) { await tryk(f(a)); await tryk(f(c), 2200); }
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${ud}/${tag}-E1-foer-giv-op.png` });
  await tryk('button:has-text("Giv op")'); await tryk('button:has-text("Ja, giv op")', 1500);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${ud}/${tag}-E2-efter-giv-op-top.png` });
  const hoej = await p.evaluate(() => document.documentElement.scrollHeight); console.log(tag, 'sidehoejde efter giv op', hoej);
  await p.screenshot({ path: `${ud}/${tag}-E3-efter-giv-op-hel.png`, fullPage: true });
  const tekst = await p.evaluate(() => document.body.innerText.match(/Du (tabte|stoppede|gav)[^\n]*|Ingen store fejl[^\n]*|Vil du se[^\n]*/g));
  console.log(tag, JSON.stringify(tekst));
  // Laer skak trin 1
  await tryk('#fane-laer'); await tryk('#segment-laer-niveau .segment-knap[data-value="ny"]', 500);
  const t1 = await p.locator('#laer-tekst').innerText(); console.log(tag, 'trin1', t1);
  const m = t1.match(/[a-h][1-8]/); if (m) await tryk(f(m[0]), 600);
  await p.screenshot({ path: `${ud}/${tag}-F1-laer-trin1-loest.png` });
  const knap = await p.evaluate(() => { const e = document.querySelector('#knap-laer-videre'); if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), vis: q.height > 0 }; }); console.log(tag, 'videre', JSON.stringify(knap));
  // gaade
  await tryk('#fane-gaader'); await p.waitForTimeout(500);
  await tryk('button:has-text("Vis et hint"), #gaade-strimmel-hint', 500);
  await p.screenshot({ path: `${ud}/${tag}-G1-gaade-hint.png` });
  console.log(tag, 'gaade', (await p.evaluate(() => document.querySelector('#status')?.innerText)));
  await ctx.close();
}
await b.close();

