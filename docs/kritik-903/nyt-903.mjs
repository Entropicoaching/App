import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const ud = 'outputs/kritik-903';
const b = await chromium.launch();
for (const [w, h, touch] of [[320, 520, true], [360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(600);
  const k = async (s) => { const e = p.locator(s).first(); await e.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'fejl', s)); await p.waitForTimeout(300); };
  await k('#fane-spil'); await k('#knap-start-computer');
  for (const f of ['e2', 'e4', 'g1', 'f3']) { await k(`#braet .felt[data-square="${f}"]`); if (f === 'e4') await p.waitForTimeout(2500); }
  await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${ud}/${tag}-K1-efter-4-klik.png` });
  await k('#strimmel-giv-op, button:has-text("Giv op")');
  await k('button:has-text("Ja, giv op")'); await p.waitForTimeout(800); await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${ud}/${tag}-K2-efter-giv-op.png` });
  const hh = await p.evaluate(() => ({ side: document.documentElement.scrollHeight, nyt: [...document.querySelectorAll('button')].filter(x => /Nyt parti/.test(x.textContent) && x.offsetParent).map(x => Math.round(x.getBoundingClientRect().top)) }));
  console.log(tag, JSON.stringify(hh));
  await ctx.close();
}
// gaader: sort foerst paa 320 og 360 (op til 12 forsoeg)
for (const [w, h] of [[320, 520], [360, 560]]) {
  for (let i = 0; i < 12; i++) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
    await p.goto(url); await p.waitForTimeout(500); await p.locator('#fane-gaader').first().tap().catch(() => {}); await p.waitForTimeout(500);
    const t = await p.evaluate(() => document.body.innerText);
    if (/vendt|sort tr/i.test(t)) { await p.screenshot({ path: `${ud}/${w}x${h}-K3-gaade-sort.png` }); console.log(w, 'sort-foerst fundet i forsoeg', i, (t.match(/[^\n]*(vendt|Sort tr)[^\n]*/i) || [''])[0]); await ctx.close(); break; }
    await ctx.close();
  }
}
await b.close();
