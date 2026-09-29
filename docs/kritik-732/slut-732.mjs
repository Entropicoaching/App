// Ordre 732: ur-valg (scroll efter tryk) og partiets slut med Giv op paa 360x560 og 1280x800.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-732';
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(700);
  const t = async (s) => { const e = p.locator(s).first(); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'ikke tryk', s)); await p.waitForTimeout(300); };
  const R = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)} (scrollY ${Math.round(scrollY)}, sidehoej ${document.documentElement.scrollHeight})`; }, s);
  await t('#fane-spil'); await t('#knap-start-makker');
  console.log(tag, 'braet foer ur', await R('#braet'), 'urvalg', await R('#segment-skakur'));
  await t('#segment-skakur .segment-knap:has-text("5+0")');
  console.log(tag, 'efter tryk 5+0: braet', await R('#braet'), 'urvalg', await R('#segment-skakur'));
  await p.screenshot({ path: `${ud}/${tag}-S1-efter-ur-tryk.png` });
  await p.evaluate(() => scrollTo(0, 0));
  await t('#braet .felt[data-square="e2"]'); await t('#braet .felt[data-square="e4"]');
  await t('#strimmel-giv-op'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${ud}/${tag}-S2-giv-op-spoerg.png` });
  await t('text=Ja, giv op'); await p.waitForTimeout(800);
  console.log(tag, 'slut: braet', await R('#braet'));
  await p.screenshot({ path: `${ud}/${tag}-S3-partiet-slut.png` });
  const fold = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => /Tre steder/.test(e.textContent) && e.children.length < 3 && e.offsetParent).map((e) => { const q = e.getBoundingClientRect(); return `${e.tagName} ${Math.round(q.top)}-${Math.round(q.bottom)}`; }).slice(0, 2));
  console.log(tag, 'vendepunkter', JSON.stringify(fold), 'knap nyt parti', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter((e) => /nyt parti/i.test(e.textContent) && e.offsetParent).map((e) => { const q = e.getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)}`; }))));
  await ctx.close();
}
await b.close();
