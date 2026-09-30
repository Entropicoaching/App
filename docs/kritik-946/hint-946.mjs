// Ordre 946: hint efter 1. e4 e5 og en gaade-fejl/-hint, 360 og 1280.
import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-946';
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`; const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800);
  const tryk = async (sel) => { const e = p.locator(sel).first(); await (touch ? e.tap({ timeout: 2500 }) : e.click({ timeout: 2500 })).catch(() => console.log(tag, 'kunne ikke', sel)); await p.waitForTimeout(300); };
  await tryk('#fane-spil'); await tryk('#knap-start-computer'); await tryk('#braet .felt[data-square="e2"]'); await tryk('#braet .felt[data-square="e4"]'); await p.waitForTimeout(2500);
  await tryk('#knap-spil-hint'); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  console.log(tag, 'hint:', await p.evaluate(() => ({ status: document.querySelector('#status')?.textContent.trim(), marker: [...document.querySelectorAll('#braet .felt.hint-fra,#braet .felt.hint-til')].map(f => f.dataset.square), tekst: [...document.querySelectorAll('[id*=hint]')].filter(e => e.offsetParent && e.textContent.trim().length > 6).map(e => e.id + ':' + e.textContent.trim().slice(0, 70)) })));
  await p.screenshot({ path: `${ud}/${tag}-H1-hint-efter-e4.png` });
  await ctx.close();
}
await b.close();
