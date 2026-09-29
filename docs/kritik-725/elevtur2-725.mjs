// Ordre 725, del 2: makker med ur, Spil-knapper, Laer skak fra "Jeg er ny", gaade med forkert traek. Frisk profil pr. scenarie.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-725';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const VP = [[360, 560, true], [390, 844, true], [1280, 800, false]];
const ut = [];
const b = await chromium.launch();
for (const [w, h, touch] of VP) {
  const tag = `${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700); return { ctx, p }; };
  const R = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: Math.round(q.top), b: Math.round(q.bottom), synlig: cs.display !== 'none' && cs.visibility !== 'hidden' && q.height > 0, iVindue: q.top >= 0 && q.bottom <= innerHeight }; }, s);
  const log = async (p, navn, sels) => { const o = { tag, navn }; for (const s of sels) o[s] = await R(p, s); ut.push(o); console.log(JSON.stringify(o)); await p.waitForTimeout(300); await p.screenshot({ path: `${ud}/${tag}-${navn}.png` }); };
  const tryk = async (p, sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch((x) => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(300); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  // A: makker med ur
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil');
    await tryk(p, '#knap-start-makker');
    await log(p, 'A1-makker-efter-valg', ['#braet', '#segment-skakur', '#spil-valg-fold', '#ur-strimmel', '#spil-strimmel', '#strimmel-fortryd', '#strimmel-giv-op']);
    if (await p.locator('#spil-valg-fold').count()) { const open = await p.evaluate(() => document.querySelector('#spil-valg-fold')?.open); if (!open) await tryk(p, '#spil-valg-resume'); }
    await tryk(p, '#segment-skakur .segment-knap:has-text("5+0")');
    await log(p, 'A2-ur-5-0', ['#braet', '#segment-skakur', '#ur-strimmel', '#ur-strimmel-hvid', '#spil-strimmel']);
    await p.evaluate(() => scrollTo(0, 0));
    await tryk(p, felt('e2')); await tryk(p, felt('e4')); await tryk(p, felt('e7')); await tryk(p, felt('e5'));
    await p.evaluate(() => scrollTo(0, 0));
    await log(p, 'A3-efter-2-traek', ['#braet', '#ur-strimmel', '#ur-strimmel-hvid', '#ur-strimmel-sort', '#spil-strimmel', '#strimmel-fortryd', '#strimmel-giv-op']);
    await tryk(p, '#strimmel-giv-op'); await p.waitForTimeout(600);
    await log(p, 'A4-giv-op', ['#braet', '#slut-strimmel', '#slut-nyt-parti', '#slut-raad']);
    await ctx.close(); }
  // B: computer, tre traek, knapraekken
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-computer');
    await tryk(p, felt('d2')); await tryk(p, felt('d4')); await p.waitForTimeout(2500);
    await p.evaluate(() => scrollTo(0, 0));
    await log(p, 'B1-computer-traek', ['#braet', '#spil-strimmel', '#strimmel-fortryd', '#strimmel-hint', '#strimmel-giv-op', '#spil-valg-fold']);
    await tryk(p, '#strimmel-hint'); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0));
    await log(p, 'B2-hint', ['#braet', '#status']);
    await ctx.close(); }
  // C: Laer skak fra "Jeg er ny"
  { const { ctx, p } = await ny(); await tryk(p, '#fane-laer');
    await tryk(p, '#segment-laer-niveau .segment-knap[data-value="ny"]'); await p.waitForTimeout(500);
    await log(p, 'C1-laer-ny', ['#braet', '#laer-titel', '#laer-tekst', '#knap-laer-videre', '#laer-trin-oeverst']);
    await ctx.close(); }
  // D: gaade, forkert traek
  { const { ctx, p } = await ny(); await tryk(p, '#fane-gaader');
    const fens = await p.evaluate(() => [...document.querySelectorAll('#braet .felt')].filter((f) => f.querySelector('img,svg,.brik,[data-brik]') || f.textContent.trim()).length);
    await log(p, 'D1-gaade', ['#braet', '#gaade-strimmel', '#gaade-strimmel-hint', '#gaade-tur-tekst', '#knap-storm-genvej']);
    console.log(tag, 'felter med brik', fens);
    await ctx.close(); }
}
writeFileSync(`${ud}/maal2-725.json`, JSON.stringify(ut, null, 1));
await b.close();
