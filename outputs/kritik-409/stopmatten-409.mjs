// Ordre 409, blok 2: "Stop matten" i browseren. Hvad viser "Vis et hint"-pilen,
// og hvad siger appen til et godtaget svar der taber materiale?
// Brug: node outputs/kritik-409/stopmatten-409.mjs <skak-kopi>
// Skriver outputs/kritik-409/S-*.png og outputs/kritik-409/stopmatten-409.json.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(skak, 'package.json'))('playwright');
const bib = await import(pathToFileURL(path.join(skak, 'src/bibliotek.js')).href);

const TILFAELDE = [
  { oevelse: 'sm07', uci: 'd1g4' }, // Dg4+ - dronningen slaas
  { oevelse: 'sm03', uci: 'd2d3' }, // Td3 - taarnet gaar tabt
];
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
const page = await ctx.newPage();
const vent = (ms) => page.waitForTimeout(ms);
const tryk = async (f) => { await page.locator(`#braet .felt[data-square="${f}"]`).tap(); await vent(120); };
const besked = () => page.evaluate(() => ({
  besked: document.getElementById('bib-besked').textContent.trim(),
  pil: [...document.querySelectorAll('#braet svg line, #braet svg path, .pil, [data-pil]')].length,
}));
const ud = [];
for (const t of TILFAELDE) {
  const idx = bib.bibOevelser('stop-matten').findIndex((o) => o.id === t.oevelse);
  await page.goto(pathToFileURL(path.join(skak, 'skak.html')).href);
  await page.evaluate((i) => localStorage.setItem('skak-bibliotek-fremgang-v1', JSON.stringify({ taeller: { 'stop-matten': i }, fremgang: {} })), idx);
  await page.reload();
  await page.waitForSelector('#braet .felt');
  await page.locator('#fane-bibliotek').tap();
  await vent(400);
  await page.locator('.bib-traen[data-kompetence="stop-matten"]').tap();
  await vent(600);
  await page.locator('#knap-bib-hint').tap();
  await vent(400);
  const hint = await besked();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(her, `S-${t.oevelse}-hint-pil.png`) });
  await tryk(t.uci.slice(0, 2));
  await tryk(t.uci.slice(2, 4));
  await vent(500);
  const svar = await besked();
  await page.screenshot({ path: path.join(her, `S-${t.oevelse}-${t.uci}.png`) });
  ud.push({ ...t, godeFoerste: bib.bibOevelser('stop-matten')[idx].godeFoerste, hint: hint.besked, svar: svar.besked });
  console.log(JSON.stringify(ud.at(-1)));
}
writeFileSync(path.join(her, 'stopmatten-409.json'), JSON.stringify(ud, null, 1));
await browser.close();
