// Ordre 777, del 2: Laer skak (flere trin), gaade (forkert traek, hint), hint mod computeren, gennemse efter mat. Frisk profil pr. scenarie.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-777';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const VP = [[360, 560, true], [390, 844, true], [1280, 800, false]];
const b = await chromium.launch();
for (const [w, h, touch] of VP) {
  const tag = `${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); const fejl = []; p.on('pageerror', (e) => fejl.push(e.message)); p.fejl = fejl; await p.goto(url); await p.waitForTimeout(700); return { ctx, p }; };
  const tryk = async (p, sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(350); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const tekst = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 220) : 'mangler'; }, s);
  const R = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); const v = getComputedStyle(e).display !== 'none' && q.height > 0; return v ? `${Math.round(q.top)}-${Math.round(q.bottom)}` : 'skjult'; }, s);
  // E: Laer skak, Jeg er ny, tryk igennem trin
  { const { ctx, p } = await ny(); await tryk(p, '#fane-laer'); await tryk(p, '#segment-laer-niveau .segment-knap[data-value="ny"]');
    console.log(tag, 'E1', await tekst(p, '#laer-trin-oeverst'));
    await tryk(p, felt('e4')); await p.waitForTimeout(600);
    console.log(tag, 'E2 efter tryk paa e4:', await tekst(p, '#laer-trin-oeverst'), '| videre', await R(p, '#knap-laer-videre'), '| braet', await R(p, '#braet'));
    await p.screenshot({ path: `${ud}/${tag}-E2-laer-efter-e4.png` });
    if (await p.locator('#knap-laer-videre:visible').count()) { await tryk(p, '#knap-laer-videre'); await p.waitForTimeout(500); }
    console.log(tag, 'E3', await tekst(p, '#laer-trin-oeverst'), '| braet', await R(p, '#braet'), '| videre', await R(p, '#knap-laer-videre'));
    await p.screenshot({ path: `${ud}/${tag}-E3-laer-trin2.png` });
    for (let i = 0; i < 3; i++) { if (await p.locator('#knap-laer-videre:visible').count()) { await tryk(p, '#knap-laer-videre'); await p.waitForTimeout(400); } }
    console.log(tag, 'E4', await tekst(p, '#laer-trin-oeverst'), '| braet', await R(p, '#braet'));
    await p.screenshot({ path: `${ud}/${tag}-E4-laer-trin5.png` });
    console.log(tag, 'sidefejl', p.fejl.join(';') || 'ingen'); await ctx.close(); }
  // F: gaade, forkert traek (kongen), hint, spring over
  { const { ctx, p } = await ny(); await tryk(p, '#fane-gaader');
    console.log(tag, 'F1', await tekst(p, '#gaade-tur-tekst'), '|', await tekst(p, '#status'));
    const sel = touch ? '#gaade-strimmel-hint' : '#knap-gaade-hint';
    // forkert traek: flyt en tilfaeldig hvid brik til et tilfaeldigt felt
    const fra = await p.evaluate(() => { const f = [...document.querySelectorAll('#braet .felt')].find((x) => x.querySelector('img,svg')); return f ? f.dataset.square : null; });
    console.log(tag, 'foerste felt med brik', fra);
    await tryk(p, sel); await p.waitForTimeout(500);
    console.log(tag, 'F2 efter hint:', await tekst(p, '#status'), '|', await tekst(p, '#gaade-besked'));
    await p.screenshot({ path: `${ud}/${tag}-F2-gaade-hint.png` });
    await tryk(p, sel); await p.waitForTimeout(500);
    console.log(tag, 'F3 efter 2. hint:', await tekst(p, '#status'));
    await p.screenshot({ path: `${ud}/${tag}-F3-gaade-hint2.png` });
    console.log(tag, 'sidefejl', p.fejl.join(';') || 'ingen'); await ctx.close(); }
  // G: computer, hint; parti til mat (skolemat) mod niveau 1 er ikke sikkert - kun hint + giv op + gennemse
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-computer');
    await tryk(p, felt('e2')); await tryk(p, felt('e4')); await p.waitForTimeout(2500);
    await p.evaluate(() => scrollTo(0, 0));
    console.log(tag, 'G1', await tekst(p, '#status'));
    await tryk(p, touch ? '#strimmel-hint' : '#knap-hint'); await p.waitForTimeout(1800);
    console.log(tag, 'G2 efter hint:', await tekst(p, '#status'), '|', await tekst(p, '#spil-besked'));
    await p.screenshot({ path: `${ud}/${tag}-G2-computer-hint.png` });
    await tryk(p, touch ? '#strimmel-giv-op' : '#knap-spil-giv-op'); await p.waitForTimeout(800);
    await p.screenshot({ path: `${ud}/${tag}-G3-giv-op-1.png` });
    console.log(tag, 'G3', await tekst(p, '#status'), '| slut', await R(p, '#slut-strimmel'), await R(p, '#slut-nyt-parti'), await R(p, '#slut-gennemse'));
    await tryk(p, touch ? '#strimmel-giv-op' : '#knap-spil-giv-op'); await p.waitForTimeout(800);
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${ud}/${tag}-G4-giv-op-2.png` });
    console.log(tag, 'G4', await tekst(p, '#status'), '| slut', await R(p, '#slut-strimmel'), await R(p, '#slut-nyt-parti'), await R(p, '#slut-gennemse'), '| braet', await R(p, '#braet'));
    console.log(tag, 'sidefejl', p.fejl.join(';') || 'ingen'); await ctx.close(); }
}
await b.close();

