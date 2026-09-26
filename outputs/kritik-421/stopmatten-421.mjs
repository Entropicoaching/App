// Ordre 421, blok 1: stopmatten-409.mjs koert igen mod skak/main (efter 415).
// Samme maaling som 409 (saet taelleren til oevelsen, tryk "Vis et hint", spil
// det dyre svar), men nu med hint-trappen: foerste tryk (tip + ring), andet tryk
// (pilen). Og alle fire dyre svar fra 409, ikke kun sm07 og sm03.
// Kopi af outputs/kritik-409/stopmatten-409.mjs; skriver kun i kritik-421.
// Brug: node outputs/kritik-421/stopmatten-421.mjs <skak-kopi>
// Skriver outputs/kritik-421/S-*.png og outputs/kritik-421/stopmatten-421.json.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(skak, 'package.json'))('playwright');
const bib = await import(pathToFileURL(path.join(skak, 'src/bibliotek.js')).href);

const TILFAELDE = [
  { oevelse: 'sm07', uci: 'd1g4' }, // Dg4+ - dronningen slaas (409: -12)
  { oevelse: 'sm03', uci: 'd2d3' }, // Td3 - taarnet gaar tabt (409: -6)
  { oevelse: 'sm08', uci: 'c7c6' }, // Tc6 (409: -6)
  { oevelse: 'sm02', uci: 'h8g7' }, // Kg7 (409: -3)
];
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
const page = await ctx.newPage();
const sidefejl = [];
page.on('pageerror', (e) => sidefejl.push(e.message));
const vent = (ms) => page.waitForTimeout(ms);
const tryk = async (f) => { await page.locator(`#braet .felt[data-square="${f}"]`).tap(); await vent(120); };
const tilstand = () => page.evaluate(() => ({
  besked: document.getElementById('bib-besked').textContent.trim(),
  knap: document.getElementById('knap-bib-hint').textContent.trim(),
  ring: document.querySelectorAll('#tegne-lag circle, #tegne-lag ellipse').length,
  pil: document.querySelectorAll('#tegne-lag line, #tegne-lag path, #tegne-lag polygon, #tegne-lag polyline').length,
  stjerner: document.getElementById('bib-stjerner').textContent.trim(),
}));
const ud = [];
for (const t of TILFAELDE) {
  const liste = bib.bibOevelser('stop-matten');
  const idx = liste.findIndex((o) => o.id === t.oevelse);
  if (idx < 0) { ud.push({ ...t, fejl: 'oevelsen findes ikke' }); continue; }
  await page.goto(pathToFileURL(path.join(skak, 'skak.html')).href);
  await page.evaluate((i) => localStorage.setItem('skak-bibliotek-fremgang-v1', JSON.stringify({ taeller: { 'stop-matten': i }, fremgang: {} })), idx);
  await page.reload();
  await page.waitForSelector('#braet .felt');
  await page.locator('#fane-bibliotek').tap();
  await vent(400);
  await page.locator('.bib-traen[data-kompetence="stop-matten"]').tap();
  await vent(600);
  // Foerst det dyre svar uden hint: hvad siger appen?
  await tryk(t.uci.slice(0, 2));
  await tryk(t.uci.slice(2, 4));
  await vent(500);
  const svar = await tilstand();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(her, `S-${t.oevelse}-${t.uci}.png`) });
  await vent(1500);
  // Saa hint-trappen: tryk 1 og tryk 2.
  await page.locator('#knap-bib-hint').tap();
  await vent(400);
  const hint1 = await tilstand();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(her, `S-${t.oevelse}-hint-1.png`) });
  const hint2 = (await page.locator('#knap-bib-hint').isVisible()) ? (await page.locator('#knap-bib-hint').tap(), await vent(400), await tilstand()) : null;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(her, `S-${t.oevelse}-hint-2-pil.png`) });
  const o = liste[idx];
  ud.push({ ...t, godeFoerste: o.godeFoerste, dyre: o.dyre ?? [], svar, hint1, hint2 });
  console.log(JSON.stringify(ud.at(-1)));
}
writeFileSync(path.join(her, 'stopmatten-421.json'), JSON.stringify({ tilfaelde: ud, sidefejl }, null, 1));
console.log(sidefejl.length ? `Sidefejl: ${sidefejl.join(' | ')}` : 'Ingen sidefejl');
await browser.close();
