// Ordre 922: forste indlaesning, giv op-resultat, ur der loeber ud, laer-lektion med forkert klik. Frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-922';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  await p.clock.install();
  await p.goto(url); await p.waitForTimeout(600);
  await p.screenshot({ path: `${ud}/${tag}-E0-foerste-skaerm.png` });
  const tryk = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.clock.runFor(300); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  await tryk('#fane-spil'); await tryk('#knap-start-makker');
  await tryk('#segment-skakur .segment-knap:has-text("3+0")');
  await tryk(felt('f2')); await tryk(felt('f3')); await tryk(felt('e7')); await tryk(felt('e5')); await tryk(felt('g2')); await tryk(felt('g4')); await tryk(felt('d8')); await tryk(felt('h4'));
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${ud}/${tag}-E1-skakmat-makker.png` });
  console.log(tag, 'status:', await p.locator('#status').innerText().catch(() => '?'));
  await p.screenshot({ path: `${ud}/${tag}-E1b-side.png`, fullPage: true });
  await tryk('#fane-spil'); 
  // ur der loeber ud: nyt parti
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const q = await c2.newPage(); await q.clock.install(); await q.goto(url); await q.waitForTimeout(500);
  const t2 = async (sel) => { const e = q.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await q.clock.runFor(300); };
  await t2('#fane-spil'); await t2('#knap-start-makker'); await t2('#segment-skakur .segment-knap:has-text("3+0")');
  await t2(felt('e2')); await t2(felt('e4'));
  await q.clock.runFor(200000); await q.waitForTimeout(400);
  await q.evaluate(() => scrollTo(0, 0));
  await q.screenshot({ path: `${ud}/${tag}-F1-tid-ude.png` });
  await q.screenshot({ path: `${ud}/${tag}-F1b-tid-ude-side.png`, fullPage: true });
  console.log(tag, 'tid ude status:', await q.locator('#status').innerText().catch(() => '?'));
  await c2.close();
}
await b.close();
