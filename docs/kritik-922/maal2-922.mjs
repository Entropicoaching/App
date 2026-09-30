import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h] of [[360, 560], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(600);
  const fane = await p.evaluate(() => [...document.querySelectorAll('[role=tab][aria-selected=true],.fane.aktiv,[aria-current=page]')].map(e => e.textContent.trim()));
  console.log(w, 'foerste fane:', JSON.stringify(fane), 'localStorage-noegler:', await p.evaluate(() => Object.keys(localStorage).length));
  const t = async (s) => { await p.locator(s).first().scrollIntoViewIfNeeded().catch(()=>{}); await p.locator(s).first().tap({ timeout: 3000 }).catch(() => console.log('kunne ikke', s)); await p.waitForTimeout(250); };
  const f = (x) => `#braet .felt[data-square="${x}"]`;
  await t('#fane-spil'); await t('#knap-start-makker');
  for (const m of ['f2','f3','e7','e5','g2','g4','d8','h4']) await t(f(m));
  const r = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e => /^Fortryd$/.test(e.textContent.trim())).map(e => { const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { id: e.id, y: Math.round(q.top + scrollY), synlig: cs.display !== 'none' && cs.visibility !== 'hidden' && q.height > 0 }; }));
  console.log(w, 'Fortryd-knapper efter skakmat i makker:', JSON.stringify(r), 'hoejde', await p.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close();
}
await b.close();
