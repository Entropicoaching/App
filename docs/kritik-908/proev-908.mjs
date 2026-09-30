// Ordre 908: Giv op paa 1280 (knap i sidepanelet), Fortryd i resultatboks, Laer skak 12 trin (Videre) paa 320/360/1280.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const ud = 'outputs/kritik-908';
const b = await chromium.launch();
for (const [w, h, touch] of [[320, 520, true], [360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ny = async () => { const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(600); return { ctx, p }; };
  const mk = (p) => async (s) => { const e = p.locator(s).first(); await e.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'fejl', s)); await p.waitForTimeout(300); };
  // Giv op mod computer, saa Fortryd i resultat
  { const { ctx, p } = await ny(); const k = mk(p);
    await k('#fane-spil'); await k('#knap-start-computer');
    for (const f of ['e2', 'e4']) await k(`#braet .felt[data-square="${f}"]`);
    await p.waitForTimeout(2500);
    const knapper = await p.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.offsetParent && /Giv op/.test(x.textContent)).map(x => x.id));
    console.log(tag, 'giv-op-knapper', JSON.stringify(knapper));
    await k(touch ? '#strimmel-giv-op' : 'button:visible:has-text("Giv op")'); await k('button:visible:has-text("Ja, giv op")'); await p.waitForTimeout(800); await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: `${ud}/${tag}-M1-giv-op-resultat.png` });
    const r = await p.evaluate(() => ({ side: document.documentElement.scrollHeight, knapper: [...document.querySelectorAll('button')].filter(x => x.offsetParent && /Nyt parti|Fortryd|Gennemse/.test(x.textContent)).map(x => x.textContent.trim() + '@' + Math.round(x.getBoundingClientRect().top)) }));
    console.log(tag, 'efter giv op', JSON.stringify(r));
    await ctx.close(); }
  // Laer skak, Jeg er ny, tryk Videre 12 gange
  { const { ctx, p } = await ny(); const k = mk(p);
    await k('#fane-laer'); await k('#segment-laer-niveau .segment-knap[data-value="ny"]'); await p.waitForTimeout(500);
    for (let i = 1; i <= 14; i++) {
      const t = await p.evaluate(() => { const q = document.querySelector('#braet').getBoundingClientRect(); const v = document.querySelector('#knap-laer-videre'); return { titel: document.querySelector('#laer-titel')?.innerText, bt: Math.round(q.top), bb: Math.round(q.bottom), videre: v && !v.hidden && v.offsetParent ? Math.round(v.getBoundingClientRect().top) : 'skjult' }; });
      console.log(tag, 'laer', i, JSON.stringify(t));
      if (i === 3 || i === 10) await p.screenshot({ path: `${ud}/${tag}-N${i}-laer.png` });
      if (t.videre === 'skjult') { await p.evaluate(() => document.querySelector('#knap-laer-spring-over')?.click()); await p.waitForTimeout(300); } else await k('#knap-laer-videre');
      await p.evaluate(() => scrollTo(0, 0));
    }
    await ctx.close(); }
}
await b.close();
