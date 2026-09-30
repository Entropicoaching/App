// Ordre 829: gaade-hint (tryk paa knappen) og Giv op paa 1280 (mus). Frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const rod = process.argv[2];
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(rod, 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, touch] of [[360, 560, true], [1280, 800, false]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700);
  await p.locator('#fane-gaader').tap?.call ? 0 : 0;
  await (touch ? p.locator('#fane-gaader').tap() : p.locator('#fane-gaader').click()); await p.waitForTimeout(500);
  const knap = p.getByRole('button', { name: 'Vis et hint' }).locator('visible=true').first();
  console.log(tag, 'hint-knapper synlige', await p.getByRole('button', { name: 'Vis et hint' }).locator('visible=true').count());
  await (touch ? knap.tap({ timeout: 4000 }) : knap.click({ timeout: 4000 })).catch(() => console.log(tag, 'hint kunne ikke trykkes'));
  await p.waitForTimeout(500);
  console.log(tag, 'status efter hint:', await p.locator('#status').innerText().catch(() => '?'));
  await p.screenshot({ path: `outputs/kritik-829/${tag}-H1-gaade-hint-trykket.png` });
  await (touch ? p.locator('#fane-spil').tap() : p.locator('#fane-spil').click()); await p.waitForTimeout(400);
  await (touch ? p.locator('#knap-start-computer').tap() : p.locator('#knap-start-computer').click()); await p.waitForTimeout(400);
  const g = p.getByRole('button', { name: 'Giv op' }).locator('visible=true');
  console.log(tag, 'Giv op synlige', await g.count());
  await (touch ? g.first().tap() : g.first().click()).catch(() => console.log(tag, 'Giv op fejlede'));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `outputs/kritik-829/${tag}-H2-giv-op-dialog.png` });
  const ja = p.getByRole('button', { name: /Ja, giv op/ }).locator('visible=true');
  await (touch ? ja.first().tap() : ja.first().click()).catch(() => console.log(tag, 'Ja fejlede'));
  await p.waitForTimeout(1500);
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `outputs/kritik-829/${tag}-H3-efter-giv-op-top.png` });
  console.log(tag, 'sidehoejde', await p.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close();
}
await b.close();
