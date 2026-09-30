// Ordre 898: gaade hvor sort traekker (bladrer til den), 1280 sidepanel, 890-grenen vs main paa braetstoerrelse.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const ud = 'outputs/kritik-898';
const b = await chromium.launch();
for (const [navn, rod] of [['main', process.argv[2]], ['b890', process.argv[3]]]) {
  const url = pathToFileURL(path.join(rod, 'skak.html')).href;
  for (const [w, h, touch] of [[320, 520, true], [360, 560, true], [390, 844, true], [1280, 800, false], [1280, 720, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
    await p.goto(url); await p.waitForTimeout(600);
    await p.locator('#fane-gaader').first().click({ timeout: 3000 }).catch(() => console.log('ingen gaadefane'));
    await p.waitForTimeout(500);
    let fundet = false;
    for (let i = 0; i < 25 && !fundet; i++) {
      const t = await p.evaluate(() => (document.querySelector('#gaade-tur-tekst')?.innerText || '') + ' | ' + (document.querySelector('#status')?.innerText || '') + ' | ' + (document.body.innerText.match(/vendt[^\n]{0,60}/i)?.[0] || ''));
      if (/sort/i.test(t) && /(tr[aæ]kker|vendt|du er sort)/i.test(t)) { fundet = true; console.log(navn, w, 'sort-gaade efter', i, JSON.stringify(t)); break; }
      const nxt = p.locator('button:has-text("Ny gaade"), button:has-text("Næste gaade"), button:has-text("Spring over"), #knap-gaade-ny').first();
      if (!(await nxt.count())) { console.log(navn, w, 'ingen knap til naeste; tekst', t); break; }
      await nxt.click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(300);
    }
    await p.evaluate(() => scrollTo(0, 0));
    const br = await p.evaluate(() => { const r = document.querySelector('#braet').getBoundingClientRect(); return `${Math.round(r.top)}-${Math.round(r.bottom)} (${Math.round(r.width)} px)`; });
    console.log(navn, `${w}x${h}`, 'braet', br, 'sortgaade', fundet);
    await p.screenshot({ path: `${ud}/${navn}-${w}x${h}-gaade${fundet ? '-sort' : ''}.png` });
    await ctx.close();
  }
}
await b.close();
