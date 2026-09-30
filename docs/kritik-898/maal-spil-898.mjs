// Ordre 898: Spil mod computeren efter e2-e4, braet og knaprakke paa main og ordre-890-grenen.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const b = await chromium.launch();
for (const [navn, rod] of [['main', process.argv[2]], ['b890', process.argv[3]]]) {
  const url = pathToFileURL(path.join(rod, 'skak.html')).href;
  for (const [w, h, touch] of [[320, 520, true], [360, 560, true], [390, 844, true], [1280, 800, false], [1280, 720, false], [1366, 768, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
    await p.goto(url); await p.waitForTimeout(600);
    const k = async (s) => { const e = p.locator(s).first(); await (touch ? e.tap({ timeout: 2500 }) : e.click({ timeout: 2500 })).catch(() => {}); await p.waitForTimeout(250); };
    await k('#fane-spil'); await k('button:has-text("Mod computeren")');
    await k('#braet .felt[data-square="e2"]'); await k('#braet .felt[data-square="e4"]'); await p.waitForTimeout(2500);
    await p.evaluate(() => scrollTo(0, 0));
    const m = await p.evaluate(() => { const r = document.querySelector('#braet').getBoundingClientRect(); const bf = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /Brikker og farver/.test(e.textContent)); const x = bf?.getBoundingClientRect(); return `braet ${Math.round(r.top)}-${Math.round(r.bottom)} (${Math.round(r.width)} px), felt ${Math.round(r.width / 8)} px, Brikker og farver ${x ? Math.round(x.top) + '-' + Math.round(x.bottom) : 'ikke fundet'}, vindue ${innerHeight}`; });
    console.log(navn, `${w}x${h}`, m);
    if ([360, 1280].includes(w) && h !== 720) await p.screenshot({ path: `outputs/kritik-898/${navn}-${w}x${h}-spil-computer.png` });
    await ctx.close();
  }
}
await b.close();
