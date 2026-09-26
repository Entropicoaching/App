// Ordre 409, blok 1: Traeningsbiblioteket og Laer skak set af en elev.
// Headless Chrome, 390 x 844, touch, 2x. Koerer mod en KOPI af skak
// (git archive af skak/main), aldrig mod skak-mappen selv.
//
// Brug: node outputs/kritik-409/elev-409.mjs <skak-kopi>
//   <skak-kopi> = mappe med skak.html, src/ og node_modules (playwright, chess.js).
// Skriver outputs/kritik-409/E-*.png og outputs/kritik-409/elev-409.json.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
const kraev = createRequire(path.join(skak, 'package.json'));
const { chromium } = kraev('playwright');
const { Chess } = await import(pathToFileURL(kraev.resolve('chess.js')).href);
const bib = await import(pathToFileURL(path.join(skak, 'src/bibliotek.js')).href);
const { vaelgForsvarsTraek } = await import(pathToFileURL(path.join(skak, 'src/slutspilforsvar.js')).href);
const loeser = await import(pathToFileURL(path.join(skak, 'scripts/tremandsloeser.mjs')).href);
const { kasseTraek, husk } = await import(pathToFileURL(path.join(her, 'kasse.mjs')).href);
mkdirSync(her, { recursive: true });

const log = [];
const note = (hvad, data = {}) => { log.push({ hvad, ...data }); console.log(hvad, JSON.stringify(data)); };

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light',
});
const page = await ctx.newPage();
const sidefejl = [];
page.on('pageerror', (e) => sidefejl.push(e.message));
await page.goto(pathToFileURL(path.join(skak, 'skak.html')).href);
await page.waitForSelector('#braet .felt');
await page.waitForTimeout(600);

const vent = (ms) => page.waitForTimeout(ms);
const skud = async (navn, { fuld = false, top = true } = {}) => {
  if (top) await page.evaluate(() => window.scrollTo(0, 0));
  await vent(300);
  await page.screenshot({ path: path.join(her, `E-${navn}.png`), fullPage: fuld });
};
const felt = (f) => page.locator(`#braet .felt[data-square="${f}"]`);
const tryk = async (f) => { await felt(f).tap(); await vent(120); };
const traek = async (uci) => {
  await tryk(uci.slice(0, 2));
  await tryk(uci.slice(2, 4));
  if (uci.length > 4) {
    const i = 'qrbn'.indexOf(uci[4]);
    await page.locator('#forvandling-valg button').nth(i).tap();
    await vent(120);
  }
};
const tekst = (id) => page.evaluate((i) => document.getElementById(i)?.textContent?.trim() ?? '', id);
const synlig = (sel) => page.locator(sel).isVisible().catch(() => false);
const bibBesked = async () => ({ tekst: await tekst('bib-tekst'), besked: await tekst('bib-besked'), stjerner: await tekst('bib-stjerner') });
const laerBesked = async () => page.evaluate(() => ({
  titel: document.getElementById('laer-titel')?.textContent?.trim(),
  tekst: document.getElementById('laer-tekst')?.textContent?.trim(),
  besked: [...document.querySelectorAll('#laer-besked, .laer-besked')].map((e) => e.textContent.trim()).join(' | '),
  taeller: document.getElementById('laer-trin-taeller')?.textContent?.trim(),
  videre: Boolean(document.getElementById('knap-laer-videre') && !document.getElementById('knap-laer-videre').hidden),
}));
const taeller = async (id) => page.evaluate((i) => {
  try { return JSON.parse(localStorage.getItem('skak-bibliotek-fremgang-v1'))?.taeller?.[i] ?? 0; } catch { return 0; }
}, id);
const aktuelOevelse = async (id) => bib.bibOevelseVedTaeller(id, await taeller(id));
const tilbage = async () => { await page.locator('#knap-bib-tilbage').tap(); await vent(400); };
const traen = async (id) => { await page.locator(`.bib-traen[data-kompetence="${id}"]`).tap(); await vent(600); };
const naeste = async () => { await page.locator('#knap-bib-naeste').tap(); await vent(500); };

// Loes den aktuelle oevelse korrekt (facit-linjen, modstanderens svar spilles af appen).
async function loesRigtigt(id) {
  const o = await aktuelOevelse(id);
  const linje = o.godeFoerste?.length ? [o.godeFoerste[0]] : o.loesning;
  for (let i = 0; i < linje.length; i += 2) {
    await traek(linje[i]);
    await vent(i + 2 < linje.length ? 1100 : 500);
  }
  return o;
}

// Et forkert, men lovligt traek (ikke facit, ikke mat). Foretraekker et der giver skak, hvis "skak".
function forkertTraek(o, { skak = null } = {}) {
  const c = new Chess(o.fen);
  const gode = new Set(o.godeFoerste?.length ? o.godeFoerste : [o.loesning[0]]);
  const kandidater = c.moves({ verbose: true }).filter((m) => {
    const uci = m.from + m.to + (m.promotion ?? '');
    if (gode.has(uci) || m.san.includes('#')) return false;
    if (skak === true) return m.san.includes('+');
    if (skak === false) return !m.san.includes('+');
    return true;
  });
  const m = kandidater[0];
  return m ? m.from + m.to + (m.promotion ?? '') : null;
}

const resultat = { marc: {}, frit: {}, laer: {}, alternativer: [] };

// =============== Marcs tur (RAPPORT-400, "Hvad er naeste") ===============
await page.locator('#fane-bibliotek').tap();
await vent(500);
await skud('01-oversigt');
await skud('01b-oversigt-helside', { fuld: true });
resultat.marc.oversigt = await page.evaluate(() => ({
  samlet: document.getElementById('bib-samlet')?.textContent,
  kategorier: [...document.querySelectorAll('.bib-kategori')].map((k) => ({
    titel: k.querySelector('h3')?.textContent,
    kompetencer: [...k.querySelectorAll('.bib-kompetence-titel')].map((t) => t.textContent),
  })),
  sidehoejde: document.documentElement.scrollHeight,
  knapHoejde: document.querySelector('.bib-traen')?.getBoundingClientRect().height,
}));
note('oversigt', resultat.marc.oversigt);

// 2. Dronningemat: forkert med vilje (ikke skak), forkert igen (skak men ikke mat) -> pil, saa rigtigt.
await traen('damemat');
await skud('02-damemat-start');
{
  const o = await aktuelOevelse('damemat');
  const f1 = forkertTraek(o, { skak: false });
  await traek(f1);
  await vent(250);
  const b1 = await bibBesked();
  await skud('03-damemat-forkert-1');
  await vent(1300);
  const f2 = forkertTraek(o, { skak: true }) ?? forkertTraek(o, { skak: false });
  await traek(f2);
  await vent(250);
  const b2 = await bibBesked();
  await vent(1300);
  await skud('04-damemat-forkert-2-pil');
  await traek(o.loesning[0]);
  await vent(500);
  const b3 = await bibBesked();
  await skud('05-damemat-loest-med-fejl');
  resultat.marc.damemat = { oevelse: o.id, forkert1: f1, b1, forkert2: f2, b2, rigtigt: b3 };
  note('damemat forkert/pil/rigtigt', resultat.marc.damemat);
  const efter = [];
  for (let i = 0; i < 3; i++) {
    await naeste();
    const oo = await loesRigtigt('damemat');
    efter.push({ id: oo.id, ...(await bibBesked()) });
  }
  await skud('06-damemat-tre-rigtige');
  resultat.marc.damematEfter = efter;
  note('damemat 3 rigtige', efter);
}
await tilbage();

// 3. Dronning mod konge: spil mod motoren (optimalt, via loeseren) til mat.
async function spilSlutspil(id, vaelg, { maks = 60, skudNavn = null } = {}) {
  const o = await aktuelOevelse(id);
  const c = new Chess(o.fen);
  let n = 0;
  const set = new Map();
  while (n < maks) {
    const uci = vaelg(c, set);
    if (!uci) break;
    await traek(uci);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    husk(c, set);
    n += 1;
    if (c.isCheckmate() || c.isStalemate()) { await vent(500); break; }
    const b = await bibBesked();
    if (b.besked && /Stjernerne|Skakmat|sidder/.test(b.besked)) break;
    await vent(900);
    const svar = vaelgForsvarsTraek(c);
    c.move(svar);
    if (skudNavn && n === 4) await skud(`${skudNavn}-midt`);
    if (svar.captured) { await vent(300); break; }
  }
  await vent(300);
  return { oevelse: o.id, traek: n, mat: c.isCheckmate(), patt: c.isStalemate(), ...(await bibBesked()) };
}
await traen('dronning-mod-konge');
await skud('07-dronning-mod-konge-start');
resultat.marc.dronningMat = await spilSlutspil('dronning-mod-konge', (c) => loeser.hurtigsteMatTraek(c.fen()), { skudNavn: '08-dronning-mod-konge' });
await skud('09-dronning-mod-konge-mat');
note('dronning mod konge (optimalt)', resultat.marc.dronningMat);
// Med vilje: haeng dronningen (stil den ved siden af kongen uden daekning).
await naeste();
{
  const haeng = (c) => {
    const bk = c.board().flat().find((p) => p && p.type === 'k' && p.color === 'b').square;
    const m = c.moves({ verbose: true }).find((mm) => {
      if (mm.piece !== 'q') return false;
      const df = Math.abs(mm.to.charCodeAt(0) - bk.charCodeAt(0));
      const dr = Math.abs(Number(mm.to[1]) - Number(bk[1]));
      if (df > 1 || dr > 1) return false;
      c.move(mm); const daekket = c.isAttacked(mm.to, 'w'); c.undo();
      return !daekket;
    });
    return m ? m.from + m.to : loeser.hurtigsteMatTraek(c.fen());
  };
  resultat.marc.dronningHaengt = await spilSlutspil('dronning-mod-konge', haeng, { maks: 3 });
  await skud('10-dronning-haengt');
  note('dronning haengt', resultat.marc.dronningHaengt);
}
// Med vilje: patt (dk1: Kf6, Dh6 mod Kf3 -> find et patt-traek hvis det findes i loebet).
await naeste();
{
  const pattEllerMat = (c) => {
    const ms = c.moves({ verbose: true });
    const patt = ms.find((m) => { c.move(m); const p = c.isStalemate(); c.undo(); return p; });
    return patt ? patt.from + patt.to : loeser.hurtigsteMatTraek(c.fen());
  };
  resultat.marc.dronningPatt = await spilSlutspil('dronning-mod-konge', pattEllerMat);
  await skud('11-dronning-patt-eller-mat');
  note('dronning: patt med vilje', resultat.marc.dronningPatt);
}
await tilbage();

// 4. Oppositionen: forkert (bonden frem), saa rigtigt.
await traen('opposition');
await skud('12-opposition-start');
{
  const o = await aktuelOevelse('opposition');
  const c = new Chess(o.fen);
  const bonde = c.moves({ verbose: true }).find((m) => m.piece === 'p');
  await traek(bonde.from + bonde.to);
  await vent(250);
  const b1 = await bibBesked();
  await skud('13-opposition-bonden-frem');
  await vent(1300);
  await traek(o.loesning[0]);
  await vent(1200);
  const b2 = await bibBesked();
  await skud('14-opposition-foerste-rigtigt');
  await traek(o.loesning[2]);
  await vent(500);
  const b3 = await bibBesked();
  await skud('15-opposition-loest');
  resultat.marc.opposition = { oevelse: o.id, fen: o.fen, bondeTraek: bonde.san, b1, b2, b3 };
  note('opposition', resultat.marc.opposition);
}
await tilbage();

// 5. Kapitlet "Rokade, en passant, forvandling, patt".
{
  const kap = page.locator('.bib-kapitel', { hasText: 'Rokade' });
  await kap.tap();
  await vent(700);
  const foer = await laerBesked();
  await skud('16-kapitel-rokade');
  await tryk('e1'); await tryk('g1');
  await vent(400);
  const efter = await laerBesked();
  await skud('17-kapitel-rokade-rigtigt');
  resultat.marc.kapitelRokade = { foer, efter };
  note('kapitel rokade', resultat.marc.kapitelRokade);
}

// =============== Frit: tre kompetencer en 10-aarig ville vaelge ===============
// Gaffel med springeren (lyder sjovt), Taarnmat (den kender man), Taarn mod konge (svaer!).
await page.locator('#fane-bibliotek').tap();
await vent(500);
if (await synlig('#knap-bib-tilbage')) await tilbage();

async function traenTilStjerner(id, { fejlVed = [] } = {}) {
  await traen(id);
  const forloeb = [];
  let runde = 0;
  while (runde < 25) {
    const o = await aktuelOevelse(id);
    if (fejlVed.includes(runde)) {
      const f = forkertTraek(o);
      await traek(f);
      await vent(1400);
      forloeb.push({ runde, id: o.id, forkert: f, hint: (await bibBesked()).besked });
    }
    await loesRigtigt(id);
    const b = await bibBesked();
    forloeb.push({ runde, id: o.id, ...b });
    runde += 1;
    if (/Det sidder/.test(b.besked)) break;
    await naeste();
  }
  return forloeb;
}

// Gaffel: en fejl i runde 3 -> raekken nulstilles.
resultat.frit.gaffel = await traenTilStjerner('gaffel-springer', { fejlVed: [3] });
await skud('18-gaffel-sidder');
note('gaffel til stjerner', { runder: resultat.frit.gaffel.length, sidste: resultat.frit.gaffel.at(-1) });
await tilbage();

// Taarnmat: brug "Vis et hint" i runde 1 og se hvad det koster.
await traen('taarnmat');
{
  const forloeb = [];
  for (let runde = 0; runde < 20; runde++) {
    const o = await aktuelOevelse('taarnmat');
    if (runde === 1) {
      await page.locator('#knap-bib-hint').tap();
      await vent(300);
      forloeb.push({ runde, hint: (await bibBesked()).besked });
      await skud('19-taarnmat-hint');
    }
    await traek(o.loesning[0]);
    await vent(500);
    const b = await bibBesked();
    forloeb.push({ runde, id: o.id, ...b });
    if (/Det sidder/.test(b.besked)) break;
    await naeste();
  }
  resultat.frit.taarnmat = forloeb;
  await skud('20-taarnmat-sidder');
  note('taarnmat', { runder: forloeb.length, sidste: forloeb.at(-1) });
}
await tilbage();

// Taarn mod konge: som en 10-aarig der har laert kassen (outputs/kritik-409/kasse.mjs).
await traen('taarn-mod-konge');
await skud('21-taarn-mod-konge-start');
resultat.frit.taarnKasse = [];
for (let i = 0; i < 6; i++) {
  const r = await spilSlutspil('taarn-mod-konge', kasseTraek, { maks: 60 });
  await skud(`22-taarn-kasse-${r.oevelse}`);
  resultat.frit.taarnKasse.push(r);
  note('taarn mod konge (kasse)', r);
  if (/Det sidder/.test(r.besked)) break;
  await naeste();
}
await skud('23-taarn-kasse-sidste');
await tilbage();

// =============== Flere loesninger: godtager appen et andet godt traek? ===============
// Stillinger fundet i blok 2's soegning (se KRITIK-bibliotek.md). Hvert tilfaelde: saet taelleren
// til oevelsen, spil det alternative traek, laes beskeden.
const ALTERNATIVER = JSON.parse(process.env.ALT_409 ?? '[]');
for (const a of ALTERNATIVER) {
  const liste = bib.bibOevelser(a.kompetence);
  const idx = liste.findIndex((o) => o.id === a.oevelse);
  await page.evaluate(([k, i]) => {
    const d = JSON.parse(localStorage.getItem('skak-bibliotek-fremgang-v1') ?? '{"taeller":{},"fremgang":{}}');
    d.taeller = { ...(d.taeller ?? {}), [k]: i };
    localStorage.setItem('skak-bibliotek-fremgang-v1', JSON.stringify(d));
  }, [a.kompetence, idx]);
  await page.reload();
  await page.waitForSelector('#braet .felt');
  await page.locator('#fane-bibliotek').tap();
  await vent(400);
  if (await synlig('#knap-bib-tilbage')) await tilbage();
  await traen(a.kompetence);
  await traek(a.uci);
  await vent(300);
  const b = await bibBesked();
  await skud(`24-alternativ-${a.kompetence}-${a.oevelse}`);
  resultat.alternativer.push({ ...a, ...b });
  note('alternativ', { ...a, ...b });
  await vent(1300);
}

// =============== Laer skak fra start til rokaden ===============
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#braet .felt');
await page.locator('#fane-laer').tap();
await vent(500);
await skud('30-laer-niveauvalg');
await page.locator('#segment-laer-niveau .segment-knap[data-value="ny"]').tap();
await vent(500);
const laer = [];
const trin = async (navn, handling) => {
  const foer = await laerBesked();
  const trinLog = { navn, foer, forsoeg: [] };
  for (const [beskrivelse, fn] of handling) {
    await fn();
    await vent(350);
    trinLog.forsoeg.push({ beskrivelse, ...(await laerBesked()) });
    if (beskrivelse.startsWith('forkert')) await vent(1200);
  }
  laer.push(trinLog);
  note(`laer ${navn}`, trinLog.forsoeg.at(-1));
};
const videre = async () => { if (await synlig('#knap-laer-videre')) { await page.locator('#knap-laer-videre').tap(); await vent(400); } };

await trin('braettet', [['forkert: d4', () => tryk('d4')], ['rigtigt: e4', () => tryk('e4')]]);
await skud('31-laer-braettet-rigtigt'); await videre();
await trin('kongen', [['tryk paa tomt felt', () => tryk('a1')], ['kongen e3-e4', () => traek('e3e4')]]);
await skud('32-laer-kongen'); await videre();
await trin('dronningen', [['dronningen d4-h8? slaa kongen', () => traek('d4h8')], ['dronningen d4-d7', () => traek('d4d7')]]);
await skud('33-laer-dronningen'); await videre();
await trin('taarnet', [['taarnet a1-a8', () => traek('a1a8')]]); await videre();
await trin('loeberen', [['forkert: loeberen lige frem c1-c3', () => traek('c1c3')], ['loeberen c1-f4', () => traek('c1f4')]]); await videre();
await trin('springeren', [['springeren b1-c3', () => traek('b1c3')]]); await videre();
await trin('bonden', [['bonden e2-e4', () => traek('e2e4')]]);
await skud('34-laer-bonden'); await videre();
await trin('bonden slaar', [['forkert: bonden lige frem e4-e5', () => traek('e4e5')], ['bonden slaar d5', () => traek('e4d5')]]);
await skud('35-laer-bonden-slaar'); await videre();
await trin('slag', [['forkert: springeren d4-f5 (intet slag)', () => traek('d4f5')], ['springeren slaar b5', () => traek('d4b5')]]); await videre();
await trin('skak og mat', [['forkert: Te7 (ikke skak)', () => traek('e1e7')], ['Te8 mat', () => traek('e1e8')]]);
await skud('36-laer-skakmat'); await videre();
await trin('svar paa skak', [['kongen d2', () => traek('e1d2')]]);
await skud('37-laer-svar-paa-skak'); await videre();
await trin('rokade', [['forkert: kongen et felt f1', () => traek('e1f1')], ['rokade lang e1-c1', () => traek('e1c1')]]);
await skud('38-laer-rokade'); await skud('38b-laer-rokade-helside', { fuld: true });
resultat.laer = laer;

resultat.sidefejl = sidefejl;
writeFileSync(path.join(her, 'elev-409.json'), JSON.stringify({ resultat, log }, null, 1));
console.log(sidefejl.length ? `Sidefejl: ${sidefejl.join(' | ')}` : 'Ingen sidefejl');
await browser.close();
