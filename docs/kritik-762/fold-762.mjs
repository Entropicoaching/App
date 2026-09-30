// Ordre 762: aabn valgfolden paa 360 x 560 og 390 x 844 og maal, hvad eleven ser (braet, ur-valg).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h] of [[360, 560], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(700);
  await p.locator('#fane-spil').tap(); await p.locator('#knap-start-makker').tap(); await p.waitForTimeout(300);
  await p.locator('#spil-valg-fold summary').first().tap(); await p.waitForTimeout(600);
  const m = await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)}`; }; return { braet: r('#braet'), ur: r('#segment-skakur'), sumry: r('#spil-valg-fold summary'), scrollY: Math.round(scrollY) }; });
  console.log(w + 'x' + h, JSON.stringify(m));
  await p.screenshot({ path: `outputs/kritik-762/${w}x${h}-F1-fold-aaben.png` });
  await ctx.close();
}
await b.close();
