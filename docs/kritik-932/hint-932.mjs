// Ordre 932: hint efter 1. e4 e5 og 1. d4 d5 (klik paa knappen med teksten Hint / Vis et hint), frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-932';
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800);
  const k = async (s) => { const e = p.locator(s).first(); await (touch ? e.tap({ timeout: 3000 }) : e.click({ timeout: 3000 })).catch(() => console.log(tag, 'fejl', s)); await p.waitForTimeout(400); };
  await k('#fane-spil'); await k('#knap-start-computer');
  await k('#braet .felt[data-square="e2"]'); await k('#braet .felt[data-square="e4"]'); await p.waitForTimeout(2500);
  const sync = await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /hint/i.test(x.textContent) && x.offsetParent).map((x) => x.id + ':' + x.textContent.trim()));
  console.log(tag, 'hintknapper', JSON.stringify(sync));
  await k('button:visible:has-text("hint")'); await p.waitForTimeout(600); await p.evaluate(() => scrollTo(0, 0));
  const r = await p.evaluate(() => ({ status: document.querySelector('#status')?.textContent.trim(), markeret: [...document.querySelectorAll('#braet .felt')].filter((f) => /hint|tip|foreslaa|raad/i.test(f.className)).map((f) => f.dataset.square + ':' + f.className) }));
  console.log(tag, JSON.stringify(r));
  await p.screenshot({ path: `${ud}/${tag}-H1-hint-efter-e4.png` });
  await ctx.close();
}
await b.close();

