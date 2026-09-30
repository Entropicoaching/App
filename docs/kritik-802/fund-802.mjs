// Ordre 802: hint, giv op, lyd-tekster og skakur-valg som en elev; koeres mod en rod (argument 2) med et maerke (argument 3).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const m = process.argv[3];
const ud = 'outputs/kritik-802';
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${m}-${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700); return { ctx, p }; };
  const tryk = async (p, sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(350); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const geo = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); const v = getComputedStyle(e).display !== 'none' && q.height > 0; return v ? `${Math.round(q.top)}-${Math.round(q.bottom)} (vindue ${innerHeight}) tekst="${e.innerText.replace(/\s+/g, ' ').slice(0, 120)}"` : 'skjult'; }, s);
  // 1: computer, hint paa et tidspunkt uden fare
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-computer');
    await tryk(p, felt('e2')); await tryk(p, felt('e4')); await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0));
    await tryk(p, touch ? '#strimmel-hint' : '#knap-spil-hint'); await p.waitForTimeout(1500);
    console.log(tag, 'HINT status:', await geo(p, '#status'), '| besked:', await geo(p, '#spil-hint-besked'), '| braet', await geo(p, '#braet'), '| scrollY', await p.evaluate(() => Math.round(scrollY)));
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${ud}/${tag}-1-hint.png` });
    console.log(tag, 'LYD-tekster:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('label.lyd-toggle')].filter((l) => l.getBoundingClientRect().height > 0).map((l) => l.innerText.trim()))));
    // giv op
    await tryk(p, touch ? '#strimmel-giv-op' : '#knap-spil-giv-op'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${ud}/${tag}-2-giv-op-sporgsmaal.png` });
    await tryk(p, '#knap-spil-giv-op-bekraeft'); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    console.log(tag, 'GIVOP status:', await geo(p, '#status'), '| vendepunkter:', await geo(p, '#spil-vendepunkter'), '| nyt parti', await geo(p, '#slut-nyt-parti'), '| braet', await geo(p, '#braet'));
    await p.screenshot({ path: `${ud}/${tag}-3-efter-giv-op.png` });
    await p.screenshot({ path: `${ud}/${tag}-3b-efter-giv-op-hel.png`, fullPage: true });
    await ctx.close(); }
  // 2: makker med ur
  { const { ctx, p } = await ny(); await tryk(p, '#fane-spil'); await tryk(p, '#knap-start-makker');
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${ud}/${tag}-4-makker-start.png` });
    console.log(tag, 'MAKKER foer valg: braet', await geo(p, '#braet'), '| ur-valg', await geo(p, '#segment-skakur'), '| fold', await geo(p, '#spil-valg-fold'));
    const aaben = await p.evaluate(() => document.querySelector('#spil-valg-fold')?.open);
    if (aaben === false) await tryk(p, '#spil-valg-fold summary');
    await p.screenshot({ path: `${ud}/${tag}-5-makker-fold-aaben.png` });
    console.log(tag, 'MAKKER fold aaben: braet', await geo(p, '#braet'), '| ur-valg', await geo(p, '#segment-skakur'), '| scrollY', await p.evaluate(() => Math.round(scrollY)));
    const kn = await p.evaluate(() => [...document.querySelectorAll('#segment-skakur .segment-knap')].map((k) => { const q = k.getBoundingClientRect(); return `${k.innerText.trim()}:${Math.round(q.width)}x${Math.round(q.height)}${k.scrollWidth > k.clientWidth + 1 ? '!afskaaret' : ''}`; }));
    console.log(tag, 'UR-knapper', kn.join(' '));
    await tryk(p, '#segment-skakur .segment-knap:has-text("5+0")');
    await p.evaluate(() => scrollTo(0, 0)); await tryk(p, felt('e2')); await tryk(p, felt('e4')); await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: `${ud}/${tag}-6-makker-med-ur.png` });
    console.log(tag, 'MAKKER med ur: braet', await geo(p, '#braet'), '| ur', await geo(p, touch ? '#ur-strimmel-hvid' : '#ur-hvid'));
    await ctx.close(); }
}
await b.close();
