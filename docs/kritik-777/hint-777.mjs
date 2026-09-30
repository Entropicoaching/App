// Ordre 777: giver Hint mod computeren et synligt tegn? 360 x 560, touch, frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 560 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(600);
await p.locator('#fane-spil').tap(); await p.locator('#knap-start-computer').first().tap().catch(()=>{});
await p.locator('#braet .felt[data-square="e2"]').tap(); await p.locator('#braet .felt[data-square="e4"]').tap(); await p.waitForTimeout(2500);
const snap = () => p.evaluate(() => ({ status: document.querySelector('#status')?.innerText, klasser: [...document.querySelectorAll('#braet .felt')].filter((f) => f.className.includes('hint')).map((f) => f.dataset.square + ':' + f.className).join(' '), pile: document.querySelectorAll('#braet svg line, #braet svg path, #braet [class*=hint], #braet [class*=pil]').length }));
console.log('foer', JSON.stringify(await snap()));
console.log('disabled', await p.evaluate(() => [document.querySelector('#strimmel-hint').disabled, document.querySelector('#knap-spil-hint').disabled, document.querySelector('#knap-spil-hint').hidden]));
await p.locator('#strimmel-hint').tap(); await p.waitForTimeout(2500);
console.log('efter', JSON.stringify(await snap()));
console.log('besked', await p.evaluate(() => { const e = document.querySelector('#spil-hint-besked'); const q = e.getBoundingClientRect(); return JSON.stringify({ tekst: e.textContent, top: Math.round(q.top + scrollY), bund: Math.round(q.bottom + scrollY), vindueH: innerHeight, scrollY: Math.round(scrollY) }); }));
await p.screenshot({ path: 'outputs/kritik-777/360x560-G5-hint-efter-2s.png' });
await b.close();
