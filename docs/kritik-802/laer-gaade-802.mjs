// Ordre 802: Laer skak trin 1 og 2 fra "Jeg er ny", og en gaade med forkert traek, som en elev. Frisk profil pr. scenarie.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const ud = 'outputs/kritik-802';
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); const fejl = []; p.on('pageerror', (e) => fejl.push(String(e)));
  await p.goto(url); await p.waitForTimeout(700);
  const tryk = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(350); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const geo = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)} "${e.innerText.trim().replace(/\s+/g, ' ').slice(0, 90)}"`; }, s);
  await tryk('#fane-laer'); await tryk('#segment-laer-niveau .segment-knap[data-value="ny"]');
  await tryk(felt('e2')); await tryk(felt('e4')); await p.waitForTimeout(500);
  console.log(tag, 'TRIN1 efter e4: titel', await geo('#laer-titel'), '| tekst', await geo('#laer-tekst'), '| videre', await geo('#knap-laer-videre'));
  await tryk('#knap-laer-videre'); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  console.log(tag, 'TRIN2: titel', await geo('#laer-titel'), '| tekst', await geo('#laer-tekst'), '| braet', await geo('#braet'), '| status', await geo('#laer-status'));
  await p.screenshot({ path: `${ud}/${tag}-E-laer-trin2-kongen.png` });
  // gaade: forkert traek
  await tryk('#fane-gaader'); await p.evaluate(() => scrollTo(0, 0));
  const fra = await p.evaluate(() => { const f = [...document.querySelectorAll('#braet .felt')].filter((x) => x.querySelector('img,svg,.brik,[data-brik]')); return f.map((x) => x.dataset.square).slice(0, 2); });
  await tryk(felt(fra[0])); await tryk(felt(fra[1])); await p.waitForTimeout(700); await p.evaluate(() => scrollTo(0, 0));
  console.log(tag, 'GAADE efter forkert/tilfaeldigt traek: strimmel', await geo('#gaade-strimmel'), '| status', await geo('#status'), '| braet', await geo('#braet'));
  await p.screenshot({ path: `${ud}/${tag}-F-gaade-efter-traek.png` });
  console.log(tag, 'sidefejl:', fejl.length ? fejl.join(' | ') : 'ingen');
  await ctx.close();
}
await b.close();
