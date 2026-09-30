// Ordre 796: gaade paa 360 x 560, forkert traek (taarnet c5-c2), som en elev.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 560 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(700);
await p.locator('#fane-gaader').tap(); await p.waitForTimeout(500);
const felt = (f) => `#braet .felt[data-square="${f}"]`;
await p.locator(felt('c5')).tap(); await p.locator(felt('c2')).tap(); await p.waitForTimeout(1200); await p.evaluate(() => scrollTo(0, 0));
console.log(await p.evaluate(() => ['#status', '#gaade-strimmel', '#braet'].map((s) => { const e = document.querySelector(s); const q = e.getBoundingClientRect(); return `${s} ${Math.round(q.top)}-${Math.round(q.bottom)} "${e.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)}"`; }).join('\n')));
await p.screenshot({ path: 'outputs/kritik-796/360x560-G-gaade-forkert-traek.png' });
await b.close();
