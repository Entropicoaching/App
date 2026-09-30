// Ordre 808: laengere parti mod computeren (8 halvtraek) og Giv op, forhaandstraek-felt, gaade-tur. Rod = argument 2.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const ud = 'outputs/kritik-808';
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700);
  const tryk = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'kunne ikke trykke', sel)); await p.waitForTimeout(300); };
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const geo = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); const v = getComputedStyle(e).display !== 'none' && q.height > 0; return v ? `${Math.round(q.top)}-${Math.round(q.bottom)} (vindue ${innerHeight}) "${e.innerText.replace(/\s+/g, ' ').slice(0, 110)}"` : 'skjult'; }, s);
  await tryk('#fane-spil');
  console.log(tag, 'forhaand afkrydset:', await p.evaluate(() => document.querySelector('#forhaand, [name=forhaand]')?.checked));
  await p.screenshot({ path: `${ud}/${tag}-L0-spil-start.png` });
  await tryk('#knap-start-computer');
  for (const [a, c] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4'], ['b1', 'c3']]) { await p.evaluate(() => scrollTo(0, 0)); await tryk(felt(a)); await tryk(felt(c)); await p.waitForTimeout(2200); }
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${ud}/${tag}-L1-efter-4-traek.png` });
  console.log(tag, 'efter 4 traek: braet', await geo('#braet'), '| status', await geo('#status'));
  await tryk(touch ? '#strimmel-giv-op' : '#knap-spil-giv-op'); await p.waitForTimeout(400);
  await tryk('#knap-spil-giv-op-bekraeft'); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.screenshot({ path: `${ud}/${tag}-L2-giv-op-langt.png` });
  await p.screenshot({ path: `${ud}/${tag}-L2b-giv-op-langt-hel.png`, fullPage: true });
  console.log(tag, 'GIVOP langt: braet', await geo('#braet'), '| vendepunkter', await geo('#spil-vendepunkter'), '| nyt parti', await geo('#slut-nyt-parti'), '| sporgsmaal', await geo('#spil-vendepunkter-overskrift'));
  console.log(tag, 'synlige knapper:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter((k) => { const q = k.getBoundingClientRect(); return q.height > 0 && getComputedStyle(k).visibility !== 'hidden'; }).map((k) => `${k.innerText.trim().slice(0, 22)}@${Math.round(k.getBoundingClientRect().top)}`).slice(0, 25))));
  console.log(tag, 'sidescroll:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await ctx.close();
}
await b.close();
