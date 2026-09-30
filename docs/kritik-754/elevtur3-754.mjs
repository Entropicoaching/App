// Ordre 754, del 3: forkert traek i en gaade (lukker 707-fundet) + Laer skak trin 1 og 2 med touch.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-754';
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(700);
  const tryk = async (sel) => { const e = p.locator(sel).first(); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'ikke tryk', sel)); await p.waitForTimeout(300); };
  const rect = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)}`; }, s);
  await tryk('#fane-gaader');
  // find et forkert traek: proev alle egne brikker mod alle felter til status skifter til fejl
  const felter = await p.evaluate(() => [...document.querySelectorAll('#braet .felt')].map((f) => f.dataset.square));
  const foer = await p.evaluate(() => document.querySelector('#status')?.innerText);
  let gjort = false;
  for (const fra of felter) { if (gjort) break;
    await tryk(`#braet .felt[data-square="${fra}"]`);
    const mal = await p.evaluate(() => [...document.querySelectorAll('#braet .felt')].filter((f) => /mulig|legal|maal|target|hint/i.test(f.className) || f.querySelector('[class*="mulig"],[class*="prik"]')).map((f) => f.dataset.square));
    if (mal.length) { await tryk(`#braet .felt[data-square="${mal[0]}"]`); await p.waitForTimeout(900); gjort = true; console.log(tag, 'proevede', fra, mal[0]); }
  }
  await p.evaluate(() => scrollTo(0, 0));
  console.log(tag, 'status foer/efter', JSON.stringify(foer), JSON.stringify(await p.evaluate(() => document.querySelector('#status')?.innerText)));
  console.log(tag, 'braet', await rect('#braet'), 'strimmel', await rect('#gaade-strimmel'), 'hint', await rect('#gaade-strimmel-hint'), 'fortryd', await rect('#gaade-strimmel-fortryd'));
  await p.screenshot({ path: `${ud}/${tag}-E1-gaade-efter-traek.png` });
  // Laer: ny, trin 1
  await tryk('#fane-laer'); await tryk('#segment-laer-niveau .segment-knap[data-value="ny"]'); await p.waitForTimeout(500);
  console.log(tag, 'laer braet', await rect('#braet'), 'tekst', await rect('#laer-tekst'), 'titel', await rect('#laer-titel'), 'besked', await rect('#laer-besked'));
  await p.screenshot({ path: `${ud}/${tag}-E2-laer-trin1.png` });
  console.log(tag, 'laertekst', JSON.stringify(await p.evaluate(() => [document.querySelector('#laer-titel')?.innerText, document.querySelector('#laer-tekst')?.innerText])));
  await ctx.close();
}
await b.close();
