// Ordre 932: foerste skaerm, hint, gaade-side, Laer skak-trin (braettets hop), 1280 sidepanel. Frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-932';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const VP = [[360, 560, true], [390, 844, true], [1280, 800, false]];
const b = await chromium.launch();
for (const [w, h, touch] of VP) {
  const tag = `${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800); return { ctx, p }; };
  const tryk = async (p, sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(300); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const top = (p) => p.evaluate(() => { const e = document.querySelector('#braet'); const q = e.getBoundingClientRect(); const f = document.querySelector('.fane[aria-selected="true"], .fane.aktiv'); return { braetTop: Math.round(q.top), braetB: Math.round(q.bottom), sideH: document.documentElement.scrollHeight, fane: f?.id }; });
  // E: foerste skaerm
  { const { ctx, p } = await ny();
    console.log(tag, 'E0', JSON.stringify(await top(p)));
    await p.screenshot({ path: `${ud}/${tag}-E0-foerste-skaerm.png` });
    await p.screenshot({ path: `${ud}/${tag}-E0b-foerste-side.png`, fullPage: true });
    await ctx.close(); }
  // G: gaade side, hele siden
  { const { ctx, p } = await ny(); await tryk(p, '#fane-gaader');
    await p.screenshot({ path: `${ud}/${tag}-G1-gaader.png` });
    await p.screenshot({ path: `${ud}/${tag}-G1b-gaader-side.png`, fullPage: true });
    await ctx.close(); }
  // B: computer, hint flere gange
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-computer');
    await tryk(p, felt('e2')); await tryk(p, felt('e4')); await p.waitForTimeout(2500);
    await tryk(p, '#knap-hint').catch(() => {}); await tryk(p, '#strimmel-hint'); await p.waitForTimeout(600); await p.evaluate(() => scrollTo(0, 0));
    console.log(tag, 'B3', JSON.stringify(await top(p)), await p.evaluate(() => document.querySelector('#status')?.textContent.trim()));
    await p.screenshot({ path: `${ud}/${tag}-B3-hint-e4.png` });
    await p.screenshot({ path: `${ud}/${tag}-B3b-hint-side.png`, fullPage: true });
    await ctx.close(); }
  // M: makker med ur, 1280 sidepanel
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-makker');
    await tryk(p, felt('d2')); await tryk(p, felt('d4')); await tryk(p, felt('d7')); await tryk(p, felt('d5')); await p.evaluate(() => scrollTo(0, 0));
    console.log(tag, 'M1', JSON.stringify(await top(p)));
    await p.screenshot({ path: `${ud}/${tag}-M1-makker.png` });
    await ctx.close(); }
  // L: Laer skak, hop af braettet trin for trin
  { const { ctx, p } = await ny(); await tryk(p, '#fane-laer'); await tryk(p, '#segment-laer-niveau .segment-knap[data-value="ny"]');
    const hop = [];
    for (let i = 0; i < 8; i++) {
      hop.push(await p.evaluate(() => ({ t: document.querySelector('#laer-titel')?.textContent.trim().slice(0, 30), top: Math.round(document.querySelector('#braet').getBoundingClientRect().top) })));
      const vid = p.locator('#knap-laer-videre'); if (await vid.isVisible().catch(() => false)) await tryk(p, '#knap-laer-videre'); else { await tryk(p, felt('e2')); await tryk(p, felt('e4')); await tryk(p, felt('e7')); await tryk(p, felt('e5')); }
    }
    console.log(tag, 'L', JSON.stringify(hop));
    await p.screenshot({ path: `${ud}/${tag}-L2-laer-senere.png` });
    await ctx.close(); }
}
await b.close();

