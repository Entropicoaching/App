// Ordre 938: elevtur paa 360x560 og 390x844 (touch) og 1280x800 (mus). Frisk profil pr. scenarie. Syntetiske partier.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-938';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const VP = [[360, 560, true], [390, 844, true], [1280, 800, false]];
const b = await chromium.launch();
for (const [w, h, touch] of VP) {
  const tag = `${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); p.on('pageerror', e => console.log(tag, 'PAGEERROR', e.message)); await p.goto(url); await p.waitForTimeout(800); return { ctx, p }; };
  const tryk = async (p, sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(300); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const maal = (p) => p.evaluate(() => { const q = document.querySelector('#braet').getBoundingClientRect(); return { braetTop: Math.round(q.top), braetB: Math.round(q.bottom), braetW: Math.round(q.width), vh: innerHeight, sideH: document.documentElement.scrollHeight, status: document.querySelector('#status')?.textContent.trim().slice(0, 60) }; });
  const skud = (p, n, full) => p.screenshot({ path: `${ud}/${tag}-${n}.png`, fullPage: !!full });
  // E: foerste skaerm
  { const { ctx, p } = await ny(); console.log(tag, 'E0', JSON.stringify(await maal(p))); await skud(p, 'E0-foerste'); await ctx.close(); }
  // A: computer
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await skud(p, 'A0-spil-fane'); await tryk(p, '#knap-start-computer'); await skud(p, 'A1-computer-start');
    await tryk(p, felt('e2')); await skud(p, 'A2-valgt-e2'); await tryk(p, felt('e4')); await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0));
    console.log(tag, 'A3', JSON.stringify(await maal(p))); await skud(p, 'A3-efter-computer-traek');
    await tryk(p, '#knap-hint'); await p.evaluate(() => scrollTo(0, 0)); await skud(p, 'A4-hint'); await skud(p, 'A4b-hint-side', true); await ctx.close(); }
  // M: makker med ur
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-makker'); await skud(p, 'M1-makker-valg');
    const ur = p.locator('#segment-skakur .segment-knap[data-value="5+0"], #segment-skakur .segment-knap').nth(3); await ur.tap?.({ timeout: 2000 }).catch(() => {}); if (!touch) await ur.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300);
    await tryk(p, felt('d2')); await tryk(p, felt('d4')); await tryk(p, felt('d7')); await tryk(p, felt('d5')); await p.evaluate(() => scrollTo(0, 0));
    console.log(tag, 'M2', JSON.stringify(await maal(p))); await skud(p, 'M2-ur-efter-2-traek'); await skud(p, 'M2b-ur-side', true);
    console.log(tag, 'M-segment-ur synlig:', await p.locator('#segment-skakur').isVisible().catch(() => 'n/a'));
    await tryk(p, '#knap-spil-giv-op'); await tryk(p, '#knap-spil-giv-op-bekraeft'); await p.evaluate(() => scrollTo(0, 0)); await skud(p, 'M3-giv-op-slut'); await skud(p, 'M3b-giv-op-side', true);
    console.log(tag, 'M3 knapper:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /resultat|nyt|fortryd|gennemse/i.test(b.id + b.textContent)).map(b => `${b.id}:${b.textContent.trim().slice(0, 20)}@${Math.round(b.getBoundingClientRect().top)}`))));
    await ctx.close(); }
  // G: gaade
  { const { ctx, p } = await ny(); await tryk(p, '#fane-gaader'); await skud(p, 'G1-gaader'); console.log(tag, 'G1', JSON.stringify(await maal(p)));
    await tryk(p, '#knap-gaade-hint'); await skud(p, 'G2-gaade-hint'); await ctx.close(); }
  // L: Laer skak
  { const { ctx, p } = await ny(); await tryk(p, '#fane-laer'); await skud(p, 'L0-laer-fane'); await tryk(p, '#segment-laer-niveau .segment-knap[data-value="ny"]');
    const hop = [];
    for (let i = 0; i < 12; i++) {
      hop.push(await p.evaluate(() => ({ t: document.querySelector('#laer-titel')?.textContent.trim().slice(0, 24), top: Math.round(document.querySelector('#braet').getBoundingClientRect().top) })));
      if (i === 1) await skud(p, 'L1-laer-trin');
      const vid = p.locator('#knap-laer-videre'); if (await vid.isVisible().catch(() => false)) await tryk(p, '#knap-laer-videre'); else { await tryk(p, felt('e2')); await tryk(p, felt('e4')); await tryk(p, felt('e7')); await tryk(p, felt('e5')); }
    }
    console.log(tag, 'L', JSON.stringify(hop.map(x => x.top)), 'tops:', [...new Set(hop.map(x => x.top))].length); await p.evaluate(() => scrollTo(0, 0)); await skud(p, 'L2-laer-trin12'); await ctx.close(); }
  // H: hoved
  { const { ctx, p } = await ny(); console.log(tag, 'HOVED', JSON.stringify(await p.evaluate(() => { const hs = document.querySelector('header,.hoved,#hoved'); return hs ? Math.round(hs.getBoundingClientRect().height) : null; }))); await ctx.close(); }
}
await b.close();
