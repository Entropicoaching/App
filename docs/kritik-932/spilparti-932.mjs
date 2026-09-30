// Ordre 932: staar "Spil et parti" paa foerste skaerm? Frisk profil, main (arg 2) .
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
for (const [w, h, t] of [[320, 520, true], [360, 560, true], [390, 844, true], [1280, 800, false]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, isMobile: t }); const p = await c.newPage(); await p.goto(url); await p.waitForTimeout(800);
  const r = await p.evaluate(() => [...document.querySelectorAll('button,a')].filter((x) => /spil et parti/i.test(x.textContent)).map((x) => { const q = x.getBoundingClientRect(); return { id: x.id, top: Math.round(q.top), bottom: Math.round(q.bottom), synlig: x.offsetParent !== null && q.height > 0, vindue: innerHeight }; }));
  console.log(w, h, JSON.stringify(r));
}
await b.close();
