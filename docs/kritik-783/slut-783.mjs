// Ordre 783: giv op mod computeren paa 360 x 560 - hvad ser eleven bagefter?
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(600);
  const t = (s) => (touch ? p.locator(s).first().tap() : p.locator(s).first().click());
  await t('#fane-spil'); await t('#knap-start-computer').catch(() => {});
  await t('#braet .felt[data-square="e2"]'); await t('#braet .felt[data-square="e4"]'); await p.waitForTimeout(2500);
  await p.locator('#knap-spil-giv-op').scrollIntoViewIfNeeded(); await p.locator('#knap-spil-giv-op').click({ force: true }).catch(async () => t('#strimmel-giv-op'));
  await p.waitForTimeout(400);
  const ja = p.getByRole('button', { name: /Ja, giv op/ }); await (touch ? ja.tap() : ja.click()); await p.waitForTimeout(1500);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const R = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'mangler'; const q = e.getBoundingClientRect(); return getComputedStyle(e).display === 'none' || !q.height ? 'skjult' : `${Math.round(q.top)}-${Math.round(q.bottom)}`; }, s);
  console.log(`${w}x${h}`, 'status:', await p.evaluate(() => document.querySelector('#status')?.innerText), '| braet', await R('#braet'), '| slut-strimmel', await R('#slut-strimmel'), '| nyt parti', await R('#slut-nyt-parti'), '| gennemse', await R('#slut-gennemse'), '| vendepunkter', await R('#spil-vendepunkter'));
  await p.screenshot({ path: `outputs/kritik-783/${w}x${h}-H1-efter-giv-op.png` });
  await ctx.close();
}
await b.close();
