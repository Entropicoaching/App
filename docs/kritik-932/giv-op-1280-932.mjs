// Ordre 932: makker med ur og Giv op paa 1280 (id'er #knap-spil-giv-op, -bekraeft). Frisk profil.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire('C:/Users/Entropi/Desktop/skak/package.json')('playwright');
const url = pathToFileURL(path.join(process.argv[2], 'skak.html')).href;
const ud = 'C:/Users/Entropi/Desktop/entropi-app-kritik/outputs/kritik-932';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); await p.goto(url); await p.waitForTimeout(800);
const k = async (s) => { await p.locator(s).first().click({ timeout: 3000 }).catch(() => console.log('fejl', s)); await p.waitForTimeout(350); };
await k('#fane-spil'); await k('#knap-start-makker'); await k('#segment-skakur .segment-knap:has-text("5+0")');
for (const f of ['e2', 'e4', 'e7', 'e5']) await k(`#braet .felt[data-square="${f}"]`);
await p.screenshot({ path: `${ud}/1280x800-U1-ur-efter-2-traek.png` });
await k('#knap-spil-giv-op'); await p.screenshot({ path: `${ud}/1280x800-U2-giv-op-spoerg.png` });
await k('#knap-spil-giv-op-bekraeft'); await p.waitForTimeout(600); await p.screenshot({ path: `${ud}/1280x800-U3-giv-op-slut.png` });
console.log(await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent && /fortryd/i.test(x.textContent)).map((x) => x.id + ':' + x.textContent.trim())));
await b.close();
