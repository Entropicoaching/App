// Ordre 863: 1280 x 800 med knapper efter tekst (sidepanelet), Laer skak trin 20 og 23 efter loesning paa 320/360, gaade med forkert og rigtigt traek.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-863';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
const f = (x) => `#braet .felt[data-square="${x}"]`;
const mk = async (w, h, touch) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700); return { ctx, p }; };
const tryk = async (p, touch, sel, t) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {}); await (touch ? e.tap({ timeout: 3500 }) : e.click({ timeout: 3500 })).catch(() => console.log('kunne ikke trykke', sel)); await p.waitForTimeout(t || 300); };
const knapper = (p, lo) => p.evaluate((lo) => [...document.querySelectorAll('button')].filter((e) => e.offsetParent && e.getBoundingClientRect().top > lo && e.getBoundingClientRect().top < 900).map((e) => `${e.textContent.trim().slice(0, 24)}@${Math.round(e.getBoundingClientRect().top)}-${Math.round(e.getBoundingClientRect().bottom)}`).slice(0, 14), lo);
// 1280: makker med ur, computer, hint, giv op
{ const { ctx, p } = await mk(1280, 800, false);
  await tryk(p, false, '#fane-spil');
  await tryk(p, false, 'button:has-text("Mod en makker")'); await tryk(p, false, '#segment-skakur .segment-knap:has-text("5+0")');
  await tryk(p, false, f('e2')); await tryk(p, false, f('e4')); await tryk(p, false, f('e7')); await tryk(p, false, f('e5'));
  await p.screenshot({ path: `${ud}/1280x800-H1-makker-ur.png` });
  console.log('1280 makker knapper', JSON.stringify(await knapper(p, 100)));
  await tryk(p, false, 'button:has-text("Mod computeren")'); await tryk(p, false, 'button:has-text("Start forfra")', 600);
  await tryk(p, false, f('e2')); await tryk(p, false, f('e4'), 2500);
  await tryk(p, false, 'button:has-text("Vis et hint")', 600);
  await p.screenshot({ path: `${ud}/1280x800-H2-computer-hint.png` });
  console.log('1280 computer', JSON.stringify(await knapper(p, 100)), 'sidehoejde', await p.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close(); }
// Laer skak trin 20 (rokade) og 23 paa 320 og 360
for (const [w, h] of [[320, 520], [360, 560]]) {
  for (const [idx, loes] of [[19, [['g1', 'f3']]], [22, [['a1', 'c1']]]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
    await p.addInitScript(([i]) => { try { localStorage.setItem('skak-laer-fremgang-v1', JSON.stringify({ trinIndeks: i, niveau: 'ny' })); } catch {} }, [idx]);
    await p.goto(url); await p.waitForTimeout(600); await tryk(p, true, '#fane-laer', 600);
    const m = () => p.evaluate(() => { const r = (q) => { const e = document.querySelector(q); if (!e || !e.checkVisibility()) return 'skjult'; const x = e.getBoundingClientRect(); return `${Math.round(x.top)}-${Math.round(x.bottom)}`; }; return { braet: r('#braet'), videre: r('#knap-laer-videre'), besked: document.querySelector('#laer-besked')?.innerText.slice(0, 50), vh: innerHeight }; });
    console.log(`${w}x${h} trin${idx + 1} start`, JSON.stringify(await m()));
    await p.screenshot({ path: `${ud}/${w}x${h}-I${idx + 1}-laer-start.png` });
    for (const [a, c] of loes) { await tryk(p, true, f(a)); await tryk(p, true, f(c), 400); }
    await p.waitForTimeout(600); await p.evaluate(() => scrollTo(0, 0));
    console.log(`${w}x${h} trin${idx + 1} loest`, JSON.stringify(await m()));
    await p.screenshot({ path: `${ud}/${w}x${h}-I${idx + 1}-laer-loest.png` });
    await ctx.close(); }
}
// Gaade paa 360: forkert traek (fra en tilfaeldig brik) og hint
{ const { ctx, p } = await mk(360, 560, true); await tryk(p, true, '#fane-gaader', 600);
  console.log('gaade tekst', await p.evaluate(() => document.querySelector('#status')?.innerText));
  await tryk(p, true, '#gaade-strimmel-hint', 600); await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${ud}/360x560-J1-gaade-hint.png` });
  console.log('gaade hint', await p.evaluate(() => document.querySelector('#status')?.innerText), JSON.stringify(await knapper(p, 100)));
  await ctx.close(); }
await b.close();

