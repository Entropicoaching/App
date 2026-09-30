import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const b = await chromium.launch();
for (let k=0;k<3;k++){
const ctx = await b.newContext({ viewport: { width: 360, height: 560 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('run',k,'PAGEERROR', e.message, (e.stack||'').split('\n').slice(1,3).join('|')));
await p.goto(pathToFileURL(process.argv[2]+'/skak.html').href); await p.waitForTimeout(1500);
await p.locator('#fane-laer').tap(); await p.waitForTimeout(1500); await ctx.close(); }
await b.close();
