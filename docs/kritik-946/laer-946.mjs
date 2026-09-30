// Ordre 946: Laer skak-lektion trin for trin (nyt niveau). Stjernetrin loeses ved at flytte den ene brik til stjernerne.
import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-946';
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`; const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(800);
  const tryk = async (sel) => { const e = p.locator(sel).first(); await (touch ? e.tap({ timeout: 2500 }) : e.click({ timeout: 2500 })).catch(() => {}); await p.waitForTimeout(250); };
  await tryk('#fane-laer'); await tryk('#segment-laer-niveau .segment-knap[data-value="ny"]');
  const log = [];
  for (let i = 0; i < 14; i++) {
    const s = await p.evaluate(() => ({ t: document.querySelector('#laer-titel')?.textContent.trim().slice(0, 22), top: Math.round(document.querySelector('#braet').getBoundingClientRect().top), bot: Math.round(document.querySelector('#braet').getBoundingClientRect().bottom), vid: !!document.querySelector('#knap-laer-videre')?.offsetParent, stj: [...document.querySelectorAll('#braet .stjerne-mark')].map(e => e.closest('.felt').dataset.square), fra: [...document.querySelectorAll('#braet .felt')].filter(f => f.querySelector('img,svg,.brik,[class*=piece]') && !f.querySelector('.stjerne-mark')).map(f => f.dataset.square) }));
    log.push(s); if (i === 2 || i === 6) await p.screenshot({ path: `${ud}/${tag}-L-trin${i + 1}.png` });
    if (s.vid) await tryk('#knap-laer-videre');
    else if (s.stj.length && s.fra.length === 1) { let cur = s.fra[0]; for (const st of [...s.stj].sort((a, b) => a[1] - b[1])) { await tryk(`#braet .felt[data-square="${cur}"]`); await tryk(`#braet .felt[data-square="${st}"]`); cur = st; } }
    else if (i === 0) { await tryk('#braet .felt[data-square="e2"]'); await tryk('#braet .felt[data-square="e4"]'); }
    else { console.log(tag, 'faldt fast ved trin', i + 1, JSON.stringify(s)); break; }
  }
  console.log(tag, 'trin:', log.map(x => `${x.t}@${x.top}`).join(' | '));
  console.log(tag, 'distinkte braet-top:', JSON.stringify([...new Set(log.map(x => x.top))]), 'nederste kant:', Math.max(...log.map(x => x.bot)), 'vindue', h);
  await ctx.close();
}
await b.close();
