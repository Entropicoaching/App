// Ordre 852: maaler raekken under braettet paa 1280 x 800 efter d4 mod computeren.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto(pathToFileURL(path.join(process.argv[2], 'skak.html')).href); await p.waitForTimeout(600);
await p.click('#fane-spil'); await p.click('#knap-start-computer');
await p.click('#braet .felt[data-square="d2"]'); await p.click('#braet .felt[data-square="d4"]'); await p.waitForTimeout(2500);
console.log(await p.evaluate(() => { const r = [...document.querySelectorAll('button')].filter((e) => e.getBoundingClientRect().top > 690 && e.offsetParent).map((e) => `${e.textContent.trim()}@${Math.round(e.getBoundingClientRect().top)}-${Math.round(e.getBoundingClientRect().bottom)} x${Math.round(e.getBoundingClientRect().left)}-${Math.round(e.getBoundingClientRect().right)}`); return JSON.stringify({ sidehoejde: document.documentElement.scrollHeight, knapper: r, klip: document.documentElement.scrollWidth > innerWidth }); }));
await b.close();
