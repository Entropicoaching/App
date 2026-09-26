// Ordre 421, blok 2: Marcs foerste skaktime (skak outputs/RAPPORT-415.md,
// "Hvad er naeste") gennemfoert som elev paa 390 px. Headless Chrome, touch, 2x.
// Koerer mod en KOPI af skak/main, aldrig mod skak-mappen selv.
//   1. Projektor: Biblioteket, "Naeste for dig" = Mat i 1. To loeses sammen,
//      "Vis et hint" to gange (tip + ring, saa pilen).
//   2. Eleven selv: foelg "Naeste for dig"-kortet Mat i 1 -> Dronningemat -> Taarnmat,
//      som en 10-aarig: en fejl undervejs og et hint i hver kompetence.
//   3. De hurtige: Slaa den ubeskyttede -> Red din brik (samme kort).
//   4. Faelles afslutning: Stop matten sm07 paa projektoren (Dg4+ og det rigtige svar).
//   5. Genindlaesning: sidder stjernerne stadig (samme pc)?
// Brug: node outputs/kritik-421/time-421.mjs <skak-kopi>
// Skriver outputs/kritik-421/T-*.png og outputs/kritik-421/time-421.json.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
const kraev = createRequire(path.join(skak, 'package.json'));
const { chromium } = kraev('playwright');
const { Chess } = await import(pathToFileURL(kraev.resolve('chess.js')).href);
const bib = await import(pathToFileURL(path.join(skak, 'src/bibliotek.js')).href);

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
const page = await ctx.newPage();
const sidefejl = [];
page.on('pageerror', (e) => sidefejl.push(e.message));
const log = [];
const note = (hvad, data = {}) => { log.push({ hvad, ...data }); console.log(hvad, JSON.stringify(data)); };
const vent = (ms) => page.waitForTimeout(ms);
const skud = async (navn) => { await page.evaluate(() => window.scrollTo(0, 0)); await vent(250); await page.screenshot({ path: path.join(her, `T-${navn}.png`) }); };
const tryk = async (f) => { await page.locator(`#braet .felt[data-square="${f}"]`).tap(); await vent(120); };
const traek = async (uci) => {
  await tryk(uci.slice(0, 2)); await tryk(uci.slice(2, 4));
  if (uci.length > 4) { await page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).tap(); await vent(120); }
};
const tekst = (id) => page.evaluate((i) => document.getElementById(i)?.textContent?.trim() ?? '', id);
const synlig = (sel) => page.locator(sel).isVisible().catch(() => false);
const bes = async () => ({ besked: await tekst('bib-besked'), stjerner: await tekst('bib-stjerner'), knap: await tekst('knap-bib-hint') });
const tegn = () => page.evaluate(() => ({
  ring: document.querySelectorAll('#tegne-lag circle, #tegne-lag ellipse').length,
  pil: document.querySelectorAll('#tegne-lag line, #tegne-lag path, #tegne-lag polygon, #tegne-lag polyline').length,
}));
const fremgang = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('skak-bibliotek-fremgang-v1')); } catch { return null; } });
const aktuel = async (id) => bib.bibOevelseVedTaeller(id, (await fremgang())?.taeller?.[id] ?? 0);
const naesteKort = () => page.evaluate(() => {
  const k = document.getElementById('bib-naeste');
  if (!k || k.hidden) return null;
  const r = k.getBoundingClientRect();
  return { tekst: k.textContent.replace(/\s+/g, ' ').trim(), top: Math.round(r.top + window.scrollY), bund: Math.round(r.bottom + window.scrollY), synligUdenScroll: r.bottom <= window.innerHeight };
});
const tilOversigt = async () => {
  await page.locator('#fane-bibliotek').tap(); await vent(400);
  if (await synlig('#knap-bib-tilbage')) { await page.locator('#knap-bib-tilbage').tap(); await vent(400); }
};
const brugKortet = async () => { await tilOversigt(); const kort = await naesteKort(); await page.locator('#knap-bib-naeste-for-dig').tap(); await vent(600); return kort; };
const braetSynligt = () => page.evaluate(() => {
  const b = document.getElementById('braet').getBoundingClientRect();
  return { top: Math.round(b.top), bund: Math.round(b.bottom), helt: b.top >= 0 && b.bottom <= window.innerHeight };
});

function forkert(o) {
  const c = new Chess(o.fen);
  const gode = new Set(o.godeFoerste?.length ? o.godeFoerste : [o.loesning[0]]);
  for (const m of c.moves({ verbose: true })) {
    const u = m.from + m.to + (m.promotion ?? '');
    if (gode.has(u) || m.san.includes('#') || (o.dyre ?? []).includes(u)) continue;
    return u;
  }
  return null;
}
// Loes aktuel oevelse rigtigt (hele linjen; appen spiller modstanderens svar).
async function loes(id) {
  const o = await aktuel(id);
  const linje = o.godeFoerste?.length ? [o.godeFoerste[0]] : o.loesning;
  for (let i = 0; i < linje.length; i += 2) { await traek(linje[i]); await vent(i + 2 < linje.length ? 1100 : 500); }
  return o;
}
// En 10-aarig: fejl i oevelse nr. <fejlVed>, hint i oevelse nr. <hintVed>, ellers rigtigt, til "Det sidder".
async function tilDetSidder(id, { fejlVed = -1, hintVed = -1, maks = 20 } = {}) {
  const forloeb = [];
  for (let n = 0; n < maks; n++) {
    const o = await aktuel(id);
    const post = { n, id: o.id };
    if (n === hintVed) { await page.locator('#knap-bib-hint').tap(); await vent(300); post.hint = (await bes()).besked; }
    if (n === fejlVed) { const f = forkert(o); if (f) { await traek(f); await vent(400); post.fejl = f; post.fejlBesked = (await bes()).besked; await vent(1400); } }
    await loes(id);
    Object.assign(post, await bes());
    forloeb.push(post);
    if (/Det sidder/.test(post.besked)) break;
    await page.locator('#knap-bib-naeste').tap(); await vent(500);
  }
  const efter = { knapper: await page.evaluate(() => [...document.querySelectorAll('#bib-oeverst button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim())) };
  return { id, oevelser: forloeb.length, sidder: /Det sidder/.test(forloeb.at(-1)?.besked ?? ''), forloeb, efter };
}

const ud = { trin: {} };
await page.goto(pathToFileURL(path.join(skak, 'skak.html')).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#braet .felt');
await vent(500);

// 1. Projektor
await tilOversigt();
ud.trin.kortStart = await naesteKort();
await skud('01-oversigt-naeste-for-dig');
note('naeste for dig ved start', ud.trin.kortStart);
await page.locator('#knap-bib-naeste-for-dig').tap(); await vent(600);
ud.trin.foersteKompetence = await tekst('bib-titel');
ud.trin.braetVedStart = await braetSynligt();
await skud('02-mat-i-1-start');
await page.locator('#knap-bib-hint').tap(); await vent(350);
const h1 = { ...(await bes()), ...(await tegn()) };
await skud('03-hint-1-tip-ring');
await page.locator('#knap-bib-hint').tap(); await vent(350);
const h2 = { ...(await bes()), ...(await tegn()) };
await skud('04-hint-2-pil');
ud.trin.projektorHint = { h1, h2 };
note('projektor hint-trappe', ud.trin.projektorHint);
const p1 = await loes('mat-i-1'); const p1b = await bes();
await page.locator('#knap-bib-naeste').tap(); await vent(500);
const p2 = await loes('mat-i-1'); const p2b = await bes();
ud.trin.projektorLoest = [{ id: p1.id, ...p1b }, { id: p2.id, ...p2b }];
note('projektor to loest', ud.trin.projektorLoest);

// 2. Eleven selv: foelg kortet (samme elev, samme pc som projektoren - Marc starter paa en frisk pc).
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('#braet .felt');
ud.trin.elev = [];
for (const [forventet, opts] of [['mat-i-1', { fejlVed: 1, hintVed: 3 }], ['damemat', { fejlVed: 2, hintVed: -1 }], ['taarnmat', { fejlVed: -1, hintVed: 1 }]]) {
  const kort = await brugKortet();
  const r = await tilDetSidder(forventet, opts);
  ud.trin.elev.push({ forventet, kort, ...r });
  await skud(`05-sidder-${forventet}`);
  note(`elev ${forventet}`, { kort: kort?.tekst, oevelser: r.oevelser, sidder: r.sidder, sidst: r.forloeb.at(-1)?.besked, knapper: r.efter.knapper });
}
// 3. De hurtige: kortet skal nu vise Slaa den ubeskyttede, saa Red din brik.
ud.trin.hurtige = [];
for (const [forventet, opts] of [['ubeskyttet', { fejlVed: 0 }], ['forsvar', { fejlVed: 1 }]]) {
  const kort = await brugKortet();
  const r = await tilDetSidder(forventet, opts);
  ud.trin.hurtige.push({ forventet, kort, ...r });
  await skud(`06-sidder-${forventet}`);
  note(`hurtige ${forventet}`, { kort: kort?.tekst, oevelser: r.oevelser, sidder: r.sidder, fejlBesked: r.forloeb.find((x) => x.fejl)?.fejlBesked });
}
await tilOversigt();
ud.trin.kortEfter = await naesteKort();
ud.trin.samlet = await tekst('bib-samlet');
await skud('07-oversigt-efter');
note('kort efter de fem', { kort: ud.trin.kortEfter, samlet: ud.trin.samlet });

// 4. Faelles: Stop matten sm07 paa projektoren.
{
  const idx = bib.bibOevelser('stop-matten').findIndex((o) => o.id === 'sm07');
  await page.evaluate((i) => {
    const d = JSON.parse(localStorage.getItem('skak-bibliotek-fremgang-v1') ?? '{"taeller":{},"fremgang":{}}');
    d.taeller = { ...(d.taeller ?? {}), 'stop-matten': i };
    localStorage.setItem('skak-bibliotek-fremgang-v1', JSON.stringify(d));
  }, idx);
  await page.reload(); await page.waitForSelector('#braet .felt');
  await tilOversigt();
  await page.locator('.bib-traen[data-kompetence="stop-matten"]').tap(); await vent(600);
  const opgave = await tekst('bib-tekst');
  await skud('08-stop-matten-sm07');
  await traek('d1g4'); await vent(450);
  const dg4 = await bes();
  await skud('09-stop-matten-dg4');
  await vent(1500);
  const o = bib.bibOevelser('stop-matten')[idx];
  await traek(o.godeFoerste[0]); await vent(500);
  const rigtigt = await bes();
  await skud('10-stop-matten-rigtigt');
  ud.trin.stopMatten = { opgave, dg4, rigtigt: { uci: o.godeFoerste[0], ...rigtigt }, godeFoerste: o.godeFoerste };
  note('stop matten sm07', ud.trin.stopMatten);
}

// 5. Genindlaesning: sidder det stadig?
await page.reload(); await page.waitForSelector('#braet .felt');
await tilOversigt();
ud.trin.efterGenindlaesning = { samlet: await tekst('bib-samlet'), kort: await naesteKort() };
note('efter genindlaesning', ud.trin.efterGenindlaesning);

// 6. En elev der spiller patt i Dronningemat (B9): dm01 har 7 patt-traek.
{
  const liste = bib.bibOevelser('damemat');
  const idx = liste.findIndex((o) => o.id === 'dm01');
  const c = new Chess(liste[idx].fen);
  const patt = c.moves({ verbose: true }).find((m) => { c.move(m); const p = c.isStalemate(); c.undo(); return p; });
  await page.evaluate((i) => {
    const d = JSON.parse(localStorage.getItem('skak-bibliotek-fremgang-v1') ?? '{"taeller":{},"fremgang":{}}');
    d.taeller = { ...(d.taeller ?? {}), damemat: i };
    localStorage.setItem('skak-bibliotek-fremgang-v1', JSON.stringify(d));
  }, idx);
  await page.reload(); await page.waitForSelector('#braet .felt');
  await tilOversigt();
  await page.locator('.bib-traen[data-kompetence="damemat"]').tap(); await vent(600);
  await traek(patt.from + patt.to); await vent(400);
  ud.trin.pattDamemat = { oevelse: 'dm01', traek: patt.san, ...(await bes()) };
  await skud('11-damemat-patt');
  note('damemat patt', ud.trin.pattDamemat);
}

writeFileSync(path.join(her, 'time-421.json'), JSON.stringify({ ...ud, sidefejl, log }, null, 1));
console.log(sidefejl.length ? `Sidefejl: ${sidefejl.join(' | ')}` : 'Ingen sidefejl');
await browser.close();
