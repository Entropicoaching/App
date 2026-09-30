// Ordre 754: makker-parti med ur spillet til mat (skolemat), maal af synlige knapper undervejs og efter.
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
  const fejl = []; p.on('pageerror', (e) => fejl.push(String(e)));
  await p.goto(url); await p.waitForTimeout(700);
  const t = async (s) => { const e = p.locator(s).first(); await (touch ? e.tap({ timeout: 4000 }) : e.click({ timeout: 4000 })).catch(() => console.log(tag, 'ikke tryk', s)); await p.waitForTimeout(250); };
  const knapper = (re) => p.evaluate((re) => [...document.querySelectorAll('button')].filter((e) => new RegExp(re, 'i').test(e.textContent) && e.offsetParent).map((e) => { const q = e.getBoundingClientRect(); return `${e.textContent.trim().slice(0, 24)} ${Math.round(q.top)}-${Math.round(q.bottom)} h${Math.round(q.height)}${q.top >= 0 && q.bottom <= innerHeight ? ' inde' : ' UDE'}`; }), re);
  const br = () => p.evaluate(() => { const q = document.querySelector('#braet').getBoundingClientRect(); return `${Math.round(q.top)}-${Math.round(q.bottom)} (${Math.round(q.width)} px)`; });
  await t('#fane-spil'); await t('#knap-start-makker');
  await t('#segment-skakur .segment-knap:has-text("5+0")');
  await p.evaluate(() => scrollTo(0, 0));
  const traek = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'];
  for (const m of traek) { await t(`#braet .felt[data-square="${m.slice(0, 2)}"]`); await t(`#braet .felt[data-square="${m.slice(2)}"]`); }
  console.log(tag, 'foer matt: braet', await br(), 'knapper', JSON.stringify(await knapper('fortryd|giv op|hint|start forfra')));
  await p.screenshot({ path: `${ud}/${tag}-M1-foer-mat.png` });
  await t('#braet .felt[data-square="h5"]'); await t('#braet .felt[data-square="f7"]'); await p.waitForTimeout(900);
  console.log(tag, 'efter matt: braet', await br(), 'status', JSON.stringify(await p.evaluate(() => document.querySelector('#status')?.innerText)), 'scrollY', await p.evaluate(() => Math.round(scrollY)), 'sidehoej', await p.evaluate(() => document.documentElement.scrollHeight));
  console.log(tag, 'knapper efter', JSON.stringify(await knapper('nyt parti|gennemse|tren|del|vendte')));
  const fold = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => /Tre steder/.test(e.textContent) && e.children.length < 3 && e.offsetParent).map((e) => { const q = e.getBoundingClientRect(); return `${e.tagName} ${Math.round(q.top)}-${Math.round(q.bottom)}`; }).slice(0, 2));
  console.log(tag, 'vendepunkter', JSON.stringify(fold), 'sidescroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: `${ud}/${tag}-M2-efter-mat.png` });
  if (fejl.length) console.log(tag, 'sidefejl', fejl);
  await ctx.close();
}
await b.close();
