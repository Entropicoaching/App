// ORDRE 351 - Bhishak som KRITIKER: skak paa telefon (efter 344) og matematik (efter 345).
// Retter intet og committer intet i skak- eller matematik-repoet: hver `main` traekkes ud
// med `git archive` til en midlertidig mappe, og kun den koeres headless. Ingen elevdata
// (spilfiguren hedder "Ravn"; alt ligger i en flygtig browserprofil).
//
// Brug: node scripts/kritik-skole-3.mjs   (npm run verify:kritik-skole-3)
// Udgang: outputs/kritik-skole-3/ (alle skaermbilleder + maalinger.json). Exit 1 kun hvis scriptet selv fejler.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik351-'));
function traek(rod, navn) {
  const mappe = path.join(tmp, navn);
  mkdirSync(mappe, { recursive: true });
  const tar = path.join(tmp, `${navn}.tar`);
  execFileSync('git', ['-C', rod, 'archive', '--format=tar', '-o', tar, 'main']);
  execFileSync('tar', ['-xf', `${navn}.tar`, '-C', navn], { cwd: tmp });
  const hash = execFileSync('git', ['-C', rod, 'rev-parse', '--short', 'main']).toString().trim();
  return { mappe, hash };
}
const skak = traek(SKAK_ROD, 'skak');
const mat = traek(MAT_ROD, 'mat');
const skakUrl = (f) => pathToFileURL(path.join(skak.mappe, f)).href;
const matUrl = pathToFileURL(path.join(mat.mappe, 'spil.html')).href;
const ud = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-skole-3');
mkdirSync(ud, { recursive: true });

const maal = { skakMain: skak.hash, matMain: mat.hash };
const skaerm = (page, navn, opts = {}) => page.screenshot({ path: path.join(ud, navn), ...opts });
const konsol = (page, liste) => {
  page.on('pageerror', (e) => liste.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') liste.push(`console.${m.type()}: ${m.text()}`); });
  page.on('requestfailed', (r) => liste.push(`requestfailed: ${r.url().slice(0, 80)}`));
};

// Maaler i siden: layout, vandret overflow, elementer uden for skaermen, smaa trykflader, mindste skrift.
const MAAL_SIDE = (min) => {
  const vb = document.documentElement.clientWidth;
  const synlig = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && e.offsetParent !== null; };
  const navnPaa = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''}`;
  const smaa = [], uden = [];
  for (const e of document.querySelectorAll('button, a, input, select, summary, .fane, .segment-knap, label')) {
    if (!synlig(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < min || r.height < min) smaa.push({ el: navnPaa(e), b: Math.round(r.width), h: Math.round(r.height), t: (e.textContent || '').trim().slice(0, 18) });
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!synlig(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vb + 1 || r.left < -1) uden.push({ el: navnPaa(e), venstre: Math.round(r.left), hoejre: Math.round(r.right) });
  }
  let mindste = 99, mindsteEl = '';
  for (const e of document.querySelectorAll('p,button,summary,span,label,li,td,small,h1,h2,h3')) {
    if (!synlig(e)) continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!t) continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < mindste) { mindste = px; mindsteEl = `${navnPaa(e)}: "${t.slice(0, 24)}"`; }
  }
  return { layoutBredde: vb, scrollBredde: document.documentElement.scrollWidth, hoejde: document.documentElement.scrollHeight, harMeta: !!document.querySelector('meta[name=viewport]'), smaaTryk: smaa.slice(0, 12), antalSmaa: smaa.length, udenForSkaerm: uden.slice(0, 8), antalUden: uden.length, mindsteSkriftPx: mindste, mindsteSkriftEl: mindsteEl };
};

// ---------- BLOK 1: SKAK ----------
async function skakSession(browser, w, h) {
  const tag = String(w);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const fejl = [];
  konsol(page, fejl);
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.tap(); await page.waitForTimeout(150); };
  const laes = () => page.evaluate(() => ({
    fen: document.querySelector('#fen-tekst')?.value ?? '', titel: document.querySelector('#laer-titel')?.textContent ?? '',
    taeller: document.querySelector('#laer-trin-taeller')?.textContent ?? '', besked: document.querySelector('#laer-besked')?.textContent ?? '',
    niveauValg: document.querySelector('#laer-niveau-valg') ? !document.querySelector('#laer-niveau-valg').hidden : null,
  }));
  const S = (n) => maal[`skak-${tag}-${n}`];
  const sæt = (n, v) => { maal[`skak-${tag}-${n}`] = v; };
  const foldeY = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bund: Math.round(r.bottom + scrollY), vindue: innerHeight }; }, sel);

  await page.goto(skakUrl('skak.html'));
  await page.waitForSelector('#braet .felt');
  await page.waitForTimeout(500);
  sæt('forside', await page.evaluate(MAAL_SIDE, 44));
  sæt('forside-braet', await page.evaluate(() => { const r = document.querySelector('#braet').getBoundingClientRect(); return { b: Math.round(r.width), top: Math.round(r.top), bund: Math.round(r.bottom), vindue: innerHeight }; }));
  await skaerm(page, `skak-${tag}-01-forside.png`);
  await skaerm(page, `skak-${tag}-01-forside-hel.png`, { fullPage: true });

  // Laer skak: tre niveauer med spring over ("Jeg er ny" -> spring over -> "Jeg spiller allerede") + "reglerne"
  await tap('#fane-laer');
  await page.waitForTimeout(250);
  sæt('laer-valg', await page.evaluate(MAAL_SIDE, 44));
  await skaerm(page, `skak-${tag}-02-laer-niveauvalg.png`);
  await skaerm(page, `skak-${tag}-02-laer-niveauvalg-hel.png`, { fullPage: true });
  const valg = (v) => tap(`.segment[data-segment="laer-niveau"] .segment-knap[data-value="${v}"]`).then(() => page.waitForTimeout(300));
  const niveauer = {};
  const nytNiveau = async (v) => { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#braet .felt'); await page.waitForTimeout(300); await tap('#fane-laer'); await valg(v); };
  await valg('ny');
  let s = await laes();
  sæt('ny-titelplacering', await foldeY('#laer-titel'));
  sæt('ny-braetbund', await foldeY('#braet'));
  await skaerm(page, `skak-${tag}-03-ny-lektion1.png`);
  niveauer.ny = { titel: s.titel, taeller: s.taeller };
  await tap(felt('e2')); await tap(felt('e4')); await page.waitForTimeout(1000);
  const s2 = await laes();
  niveauer.nyEfterTraek = { titel: s2.titel, taeller: s2.taeller, gaaetVidere: s2.taeller !== s.taeller };
  await skaerm(page, `skak-${tag}-04-ny-lektion2.png`);

  // spring "reglerne" over: direkte til "spiller"
  await nytNiveau('spiller');
  s = await laes();
  niveauer.spiller = { titel: s.titel, taeller: s.taeller };
  sæt('spiller-titelplacering', await foldeY('#laer-titel'));
  await skaerm(page, `skak-${tag}-05-spiller-aabning.png`);
  await tap(felt('d2')); await tap(felt('d4')); await page.waitForTimeout(300);
  const fork = await laes();
  niveauer.spillerForkert = { besked: fork.besked };
  await skaerm(page, `skak-${tag}-06-spiller-forkert-traek.png`);
  await page.waitForTimeout(1600);
  await nytNiveau('reglerne');
  s = await laes();
  niveauer.reglerne = { titel: s.titel, taeller: s.taeller };
  await skaerm(page, `skak-${tag}-07-reglerne.png`);
  await tap(felt('a2')); await tap(felt('a3')); await page.waitForTimeout(400);
  niveauer.reglerneForkert = { besked: (await laes()).besked };
  await skaerm(page, `skak-${tag}-08-reglerne-forkert.png`);
  sæt('laer-niveauer', niveauer);
  sæt('laer-efter', await page.evaluate(MAAL_SIDE, 44));

  // Parti mod computeren: fem traek
  await tap('#fane-spil');
  await tap('.segment[data-segment="spil-modus"] .segment-knap[data-value="computer"]');
  await page.waitForTimeout(300);
  await tap('#knap-spil-forfra');
  if (await page.locator('#knap-spil-forfra-bekraeft').isVisible().catch(() => false)) await tap('#knap-spil-forfra-bekraeft');
  await page.waitForTimeout(400);
  sæt('spil-opsaetning', await page.evaluate(MAAL_SIDE, 44));
  await skaerm(page, `skak-${tag}-09-spil-opsaetning.png`);
  const planer = [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4'], ['d2', 'd3'], ['b1', 'c3']];
  const parti = [];
  for (let i = 0; i < planer.length; i++) {
    const foer = await page.evaluate(() => document.querySelector('#fen-tekst').value);
    await tap(felt(planer[i][0])); await tap(felt(planer[i][1]));
    // vent paa motorens svar (side i traek igen = " w ")
    const t0 = Date.now();
    await page.waitForFunction((f) => { const v = document.querySelector('#fen-tekst').value; return v !== f && / w /.test(v); }, foer, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const nu = await page.evaluate(() => ({ fen: document.querySelector('#fen-tekst').value, status: document.querySelector('#status')?.textContent ?? '' }));
    parti.push({ traek: `${planer[i][0]}-${planer[i][1]}`, motorMs: Date.now() - t0, hvidTilTraek: / w /.test(nu.fen), status: nu.status.trim().slice(0, 60), ok: nu.fen !== foer });
    if (i === 0 || i === 4) await skaerm(page, `skak-${tag}-10-spil-traek-${i + 1}.png`);
  }
  sæt('spil-parti', parti);
  sæt('spil-efter', await page.evaluate(MAAL_SIDE, 44));
  sæt('spil-braetbund', await foldeY('#braet'));

  // Opstil (paletten ligger under braettet)
  await tap('#fane-opstil');
  await page.waitForTimeout(250);
  await skaerm(page, `skak-${tag}-11-opstil.png`, { fullPage: true });
  sæt('opstil', await page.evaluate(MAAL_SIDE, 44));
  sæt('opstil-tekst', await page.evaluate(() => [...document.querySelectorAll('#panel-opstil p, [id*=opstil] p, .palet-hjaelp')].map((e) => e.textContent.trim()).filter((t) => /brik.*h.jre|h.jre/i.test(t)).slice(0, 3)));

  // Gaader (kort blik)
  await tap('#fane-gaader');
  await page.waitForSelector('#knap-gaade-hint', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  await skaerm(page, `skak-${tag}-12-gaade.png`);
  sæt('gaade', await page.evaluate(MAAL_SIDE, 44));

  sæt('konsol', fejl);
  await ctx.close();

  // Laerer-siden
  const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  const fejl2 = [];
  konsol(p2, fejl2);
  await p2.goto(skakUrl('laerer.html'));
  await p2.waitForTimeout(800);
  await skaerm(p2, `skak-${tag}-13-laerer.png`);
  await skaerm(p2, `skak-${tag}-13-laerer-hel.png`, { fullPage: true });
  sæt('laerer', await p2.evaluate(MAAL_SIDE, 44));
  sæt('laerer-konsol', fejl2);
  await ctx2.close();
}

// ---------- BLOK 2: MATEMATIK ----------
const broek = (t) => { const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(t); return m ? [Number(m[1]), Number(m[2])] : null; };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const kanForkortes = ([a, b]) => gcd(a, b) > 1;
const lignerBroek = (t) => /\d\s*\/\s*\d/.test(t);

async function lavFigur(page) {
  await page.waitForSelector('#op-navn');
  await page.fill('#op-navn', 'Ravn');
  await page.locator('.opret-udseende').nth(1).click();
  await page.click('#op-start');
  await page.waitForSelector('.spil-figur');
}
async function aabnKlynge(page) {
  const k = page.locator('.sted-knap--klynge');
  if ((await k.count()) > 0 && (await k.getAttribute('aria-expanded')) === 'false') { await k.tap(); await page.waitForTimeout(80); }
}
async function gaaTil(page, navn) {
  await aabnKlynge(page);
  await page.locator('.sted-knap').filter({ has: page.locator('.sted-navn', { hasText: new RegExp(`^${navn}$`) }) }).tap();
  await page.waitForSelector('.sted-scene');
}
async function lukBanner(page) {
  if (await page.locator('.niveau-banner').isVisible().catch(() => false)) { await page.click('#niveau-banner-luk'); await page.waitForTimeout(40); }
}

async function matSession(browser, w, h) {
  const tag = String(w);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const fejl = [];
  konsol(page, fejl);
  const M = {};
  await page.goto(matUrl);
  await lavFigur(page);
  await page.waitForTimeout(600);
  await skaerm(page, `mat-${tag}-01-start.png`);
  await skaerm(page, `mat-${tag}-01-start-hel.png`, { fullPage: true });
  M.start = await page.evaluate(MAAL_SIDE, 44);

  // Kortet: Moellen-knap mod kant + landsbyens raekkefoelge
  await page.evaluate(() => document.querySelector('.kort')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  M.kort = await page.evaluate(() => {
    const k = document.querySelector('.kort').getBoundingClientRect();
    const mol = [...document.querySelectorAll('.sted-knap')].find((e) => e.querySelector('.sted-navn')?.textContent === 'Møllen');
    const mr = mol?.getBoundingClientRect();
    const prikker = [...document.querySelectorAll('.sted-prik, .klynge-prik')].map((p) => {
      const r = p.getBoundingClientRect();
      const bo = p.closest('.sted-knap, .kort-klynge');
      return { navn: bo?.querySelector('.sted-navn, .klynge-etiket')?.textContent?.trim() ?? '', x: Math.round(r.x + r.width / 2 - k.x), y: Math.round(r.y + r.height / 2 - k.y) };
    });
    const alle = [...document.querySelectorAll('.sted-knap')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { navn: e.querySelector('.sted-navn')?.textContent ?? '', venstre: Math.round(r.left - k.left), hoejre: Math.round(k.right - r.right), top: Math.round(r.top - k.top), bund: Math.round(k.bottom - r.bottom), b: Math.round(r.width), h: Math.round(r.height) }; });
    return { kortB: Math.round(k.width), kortH: Math.round(k.height), moellen: mr ? { b: Math.round(mr.width), h: Math.round(mr.height), bundTilKortkant: Math.round(k.bottom - mr.bottom), hoejreTilKortkant: Math.round(k.right - mr.right), venstreTilKortkant: Math.round(mr.left - k.left) } : null, knapper: alle, prikker };
  });
  await skaerm(page, `mat-${tag}-02-kort.png`);
  // fold klyngen ud og maal Kirken og Landsbygaden mod Moellen
  await aabnKlynge(page);
  await page.waitForTimeout(200);
  M.klynge = await page.evaluate(() => {
    const k = document.querySelector('.kort').getBoundingClientRect();
    const find = (n) => { const e = [...document.querySelectorAll('.sted-knap')].find((x) => x.querySelector('.sted-navn')?.textContent === n); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2 - k.x), y: Math.round(r.y + r.height / 2 - k.y), venstre: Math.round(r.left - k.left), hoejre: Math.round(k.right - r.right) }; };
    return { kirken: find('Kirken'), landsbygaden: find('Landsbygaden'), moellen: find('Møllen'), klyngeKnap: (() => { const e = document.querySelector('.sted-knap--klynge'); if (!e) return null; const r = e.getBoundingClientRect(); return { hoejreTilKortkant: Math.round(k.right - r.right), b: Math.round(r.width) }; })() };
  });
  await skaerm(page, `mat-${tag}-03-kort-klynge-aaben.png`);
  await aabnKlynge(page);

  // 20 broekopgaver i traek i Moellen. Hver loeses ved at proeve svarene; hvis to svar har samme vaerdi
  // og det ene er uforkortet, trykkes det uforkortede foerst (4/6 i stedet for 2/3).
  await gaaTil(page, 'Møllen');
  await page.waitForTimeout(250);
  await skaerm(page, `mat-${tag}-04-moellen-scene.png`);
  const opg = [];
  let forsoeg = 0;
  while (opg.length < 20 && forsoeg < 120) {
    forsoeg += 1;
    if (!(await page.locator('.quest-opgave').isVisible().catch(() => false))) break;
    const spm = (await page.locator('.quest-opgave').innerText()).replace(/\s+/g, ' ').trim();
    const valg = await page.$$eval('.quest-svar button', (b) => b.map((x) => x.textContent.trim()));
    const erBroek = valg.some((v) => broek(v)) || lignerBroek(spm);
    if (!erBroek) {
      // ikke-broekopgave: loes den og gaa videre (taeller ikke)
      for (let i = 0; i < valg.length; i++) { if (await page.locator('#quest-videre').isVisible().catch(() => false)) break; await page.locator('.quest-svar button').nth(i).click(); await page.waitForTimeout(20); }
      await page.waitForSelector('#quest-videre', { timeout: 5000 }).catch(() => {});
      await page.click('#quest-videre').catch(() => {}); await lukBanner(page); continue;
    }
    // find kandidat: uforkortet svar med en aeqvivalent (samme vaerdi) blandt valgene
    const bs = valg.map(broek);
    let foerst = -1;
    for (let i = 0; i < bs.length; i++) if (bs[i] && kanForkortes(bs[i])) foerst = i;
    const rec = { spoergsmaal: spm.slice(0, 90), valg, spoergsmaalHarForkortelig: (spm.match(/\d+\s*\/\s*\d+/g) || []).some((t) => kanForkortes(broek(t.replace(/\s/g, '')))), valgHarForkortelig: bs.some((b) => b && kanForkortes(b)), proevetUforkortetFoerst: foerst >= 0, forsoeg: [] };
    const raekke = [...valg.keys()];
    if (foerst >= 0) raekke.splice(raekke.indexOf(foerst), 1), raekke.unshift(foerst);
    let skaermtaget = false;
    for (const i of raekke) {
      if (await page.locator('#quest-videre').isVisible().catch(() => false)) break;
      await page.locator('.quest-svar button').nth(i).click();
      await page.waitForTimeout(40);
      const besk = await page.evaluate(() => [...document.querySelectorAll('.quest-besked')].map((e) => ({ klasse: e.className, tekst: e.innerText.replace(/\s+/g, ' ').trim() })));
      const tekst = besk.map((b) => b.tekst).join(' | ');
      const rigtigt = besk.some((b) => /korrekt/.test(b.klasse));
      rec.forsoeg.push({ svar: valg[i], rigtigt, besked: tekst.slice(0, 200) });
      if (rigtigt && !skaermtaget && bs[i] && kanForkortes(bs[i]) && !maal[`mat-${tag}-uforkortet-skaerm`]) { await skaerm(page, `mat-${tag}-05-uforkortet-svar.png`); maal[`mat-${tag}-uforkortet-skaerm`] = true; skaermtaget = true; }
    }
    rec.rigtigt = rec.forsoeg.find((f) => f.rigtigt)?.svar ?? null;
    rec.rigtigtErUforkortet = rec.rigtigt && broek(rec.rigtigt) ? kanForkortes(broek(rec.rigtigt)) : false;
    rec.ros = rec.forsoeg.find((f) => f.rigtigt)?.besked ?? '';
    rec.foersteForsoegRigtigt = rec.forsoeg[0]?.rigtigt ?? false;
    opg.push(rec);
    await page.waitForSelector('#quest-videre', { timeout: 5000 }).catch(() => {});
    if (opg.length === 1) await skaerm(page, `mat-${tag}-06-broekopgave.png`);
    await page.click('#quest-videre').catch(() => {});
    await lukBanner(page);
  }
  M.opgaver = opg;
  M.opsummering = {
    antal: opg.length,
    forkortelige: opg.filter((o) => o.spoergsmaalHarForkortelig || o.valgHarForkortelig).length,
    rigtigtSvarUforkortet: opg.filter((o) => o.rigtigtErUforkortet).length,
    uforkortetSvarTrykketFoerst: opg.filter((o) => o.proevetUforkortetFoerst).length,
    uforkortetFoerstMedRos: opg.filter((o) => o.proevetUforkortetFoerst && o.foersteForsoegRigtigt).length,
    rosMedHint: opg.filter((o) => /kan (også )?skrives/i.test(o.ros)).length,
  };

  // Journal
  await page.click('.sted-knap--tilbage, #sted-tilbage').catch(() => {});
  await page.waitForSelector('.kort').catch(() => {});
  await page.click('#journal-knap').catch(() => {});
  await page.waitForSelector('.journal-liste', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(250);
  await skaerm(page, `mat-${tag}-07-journal.png`);
  await skaerm(page, `mat-${tag}-07-journal-hel.png`, { fullPage: true });
  M.journal = { ...(await page.evaluate(() => ({ oversigt: document.querySelector('.journal-oversigt')?.textContent?.trim() ?? null, stedkort: [...document.querySelectorAll('.journal-liste > *')].map((e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 80)) }))), side: await page.evaluate(MAAL_SIDE, 44) };

  M.konsol = fejl;
  maal[`mat-${tag}`] = M;
  await ctx.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [w, h] of [[390, 844], [360, 800]]) { console.log(`skak ${w}`); await skakSession(browser, w, h); }
    for (const [w, h] of [[390, 844], [360, 800]]) { console.log(`matematik ${w}`); await matSession(browser, w, h); }
  } finally {
    await browser.close();
    writeFileSync(path.join(ud, 'maalinger.json'), JSON.stringify(maal, null, 2));
  }
  console.log(`\nKritik 351 faerdig (skak main ${skak.hash}, matematik main ${mat.hash}). Se outputs/kritik-skole-3/.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
