// ORDRE 361 - Bhishak som KRITIKER: Laer skak (efter 356) og matematik (efter 357) paa telefon.
// Retter intet og committer intet i skak- eller matematik-repoet: hver `main` traekkes ud
// med `git archive` til en midlertidig mappe, og kun den koeres headless. Ingen elevdata
// (spilfiguren hedder "Ravn"; alt ligger i en flygtig browserprofil).
//
// Brug: node scripts/kritik-skole-4.mjs   (npm run verify:kritik-skole-4)
// Udgang: outputs/kritik-skole-4/ (alle skaermbilleder + maalinger.json). Exit 1 kun hvis scriptet selv fejler.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik361-'));
function traek(rod, navn, rev = 'main') {
  const mappe = path.join(tmp, navn);
  mkdirSync(mappe, { recursive: true });
  const tar = path.join(tmp, `${navn}.tar`);
  execFileSync('git', ['-C', rod, 'archive', '--format=tar', '-o', tar, rev]);
  execFileSync('tar', ['-xf', `${navn}.tar`, '-C', navn], { cwd: tmp });
  const hash = execFileSync('git', ['-C', rod, 'rev-parse', '--short', rev]).toString().trim();
  return { mappe, hash };
}
const skak = traek(SKAK_ROD, 'skak', 'f71af13'); // ordren pinner skak til f71af13 (main er siden flyttet af 359)
const mat = traek(MAT_ROD, 'mat');
const skakUrl = (f) => pathToFileURL(path.join(skak.mappe, f)).href;
const matUrl = pathToFileURL(path.join(mat.mappe, 'spil.html')).href;
const ud = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-skole-4');
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

// ---------- BLOK 1: SKAK (Laer skak efter 356) ----------
const LOES = {
  'Brættet': async (t, felt) => { await t(felt('e4')); },
  'Bonden slår på skrå': async (t, felt) => { await t(felt('e4')); await t(felt('d5')); },
  'Svar på skak': async (t, felt) => { await t(felt('a8')); await t(felt('e8')); },
  'Forvandling': async (t, felt, page) => { await t(felt('e7')); await t(felt('e8')); await page.waitForSelector('#forvandling-valg button', { timeout: 3000 }).catch(() => {}); await page.locator('#forvandling-valg button').first().tap().catch(() => {}); },
  'Patt er remis': async (t, felt) => { await t(felt('g1')); await t(felt('g6')); },
};
const NYE_TRIN = ['Bonden slår på skrå', 'Svar på skak', 'Forvandling', 'Patt er remis'];

async function skakSession(browser, w, h) {
  const tag = String(w);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const fejl = [];
  konsol(page, fejl);
  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.tap(); await page.waitForTimeout(150); };
  const top = () => page.evaluate(() => window.scrollTo(0, 0)).then(() => page.waitForTimeout(80));
  const laes = () => page.evaluate(() => ({
    fen: document.querySelector('#fen-tekst')?.value ?? '', titel: document.querySelector('#laer-titel')?.textContent?.trim() ?? '',
    taeller: document.querySelector('#laer-trin-taeller')?.textContent?.trim() ?? '', tekst: document.querySelector('#laer-tekst')?.textContent?.trim() ?? '',
    besked: document.querySelector('#laer-besked')?.textContent?.trim() ?? '',
    faerdig: !!document.querySelector('#laer-faerdig') && !document.querySelector('#laer-faerdig').hidden,
    niveauValg: document.querySelector('#laer-niveau-valg') ? !document.querySelector('#laer-niveau-valg').hidden : null,
  }));
  // Laesbarhed uden scroll: ligger opgaveteksten OG hele braettet inden for vinduet ved scrollY = 0?
  const layout = () => page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bund: Math.round(b.bottom + scrollY) }; };
    const o = r('#laer-oeverst'), t = r('#laer-tekst'), b = r('#braet'), v = innerHeight;
    return { vindue: v, oeverst: o, tekst: t, braet: b, tekstOgBraetSynlige: !!(o && b && o.top >= 0 && b.bund <= v), braetBundOverVindue: b ? b.bund - v : null };
  });
  const foldeY = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bund: Math.round(r.bottom + scrollY), vindue: innerHeight }; }, sel);
  const vaerktoej = () => page.evaluate(() => { const e = document.querySelector('.vaerktoejslinje'); if (!e) return 'findes ikke'; const r = e.getBoundingClientRect(); return getComputedStyle(e).display === 'none' || r.height < 2 ? 'skjult' : `synlig ${Math.round(r.height)} px`; });
  const S = (n, v) => { maal[`skak-${tag}-${n}`] = v; };

  await page.goto(skakUrl('skak.html'));
  await page.waitForSelector('#braet .felt');
  await page.waitForTimeout(500);
  S('forside', await page.evaluate(MAAL_SIDE, 44));
  S('forside-vaerktoej', await vaerktoej());
  await skaerm(page, `skak-${tag}-01-forside.png`);
  await skaerm(page, `skak-${tag}-01-forside-hel.png`, { fullPage: true });

  await tap('#fane-laer');
  await page.waitForTimeout(250);
  await top();
  S('laer-valg-layout', await layout());
  S('laer-vaerktoej', await vaerktoej());
  S('niveau-under', await page.evaluate(() => [...document.querySelectorAll('.segment-niveau .segment-knap')].map((k) => { const u = k.querySelector('.niveau-under'); const r = k.getBoundingClientRect(); return { knap: k.firstChild.textContent.trim(), under: u?.textContent.trim() ?? null, undertekstPx: u ? parseFloat(getComputedStyle(u).fontSize) : null, knapB: Math.round(r.width), knapH: Math.round(r.height) }; })));
  S('koordinater', await page.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10; };
    const ud = [];
    for (const kl of ['.rang-label', '.fil-label']) {
      const e = document.querySelector(`#braet ${kl}`); if (!e) { ud.push({ kl, findes: false }); continue; }
      const cs = getComputedStyle(e); const bg = getComputedStyle(e.closest('.felt') || e.parentElement).backgroundColor;
      ud.push({ kl, px: parseFloat(cs.fontSize), vaegt: cs.fontWeight, farve: cs.color, felt: bg, kontrast: kontrast(cs.color, bg) });
    }
    // alle koordinater: mindste skrift og mindste/stoerste kontrast
    let min = 99, kmin = 99;
    for (const e of document.querySelectorAll('#braet .rang-label, #braet .fil-label')) { const cs = getComputedStyle(e); min = Math.min(min, parseFloat(cs.fontSize)); kmin = Math.min(kmin, kontrast(cs.color, getComputedStyle(e.closest('.felt') || e.parentElement).backgroundColor)); }
    return { udvalgt: ud, mindstePx: min, laveste: kmin };
  }));
  await skaerm(page, `skak-${tag}-02-laer-niveauvalg.png`);
  await skaerm(page, `skak-${tag}-02-laer-niveauvalg-hel.png`, { fullPage: true });

  const valg = (v) => tap(`.segment[data-segment="laer-niveau"] .segment-knap[data-value="${v}"]`).then(() => page.waitForTimeout(300));
  const nytNiveau = async (v) => { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#braet .felt'); await page.waitForTimeout(300); await tap('#fane-laer'); await valg(v); await top(); };

  // "Jeg er ny": alle trin, mest mulig loest, resten sprunget over. Hvert trin maales uden scroll.
  await valg('ny');
  await top();
  const trin = [];
  let forrige = '';
  for (let i = 0; i < 40; i++) {
    await top();
    const s = await laes();
    if (s.faerdig || !s.taeller || s.taeller === forrige) { S('slut', { faerdig: s.faerdig, taeller: s.taeller }); break; }
    forrige = s.taeller;
    const lay = await layout();
    const rec = { ...lay, taeller: s.taeller, titel: s.titel, tekst: s.tekst, fen: s.fen };
    const nr = trin.length + 1;
    const ny = NYE_TRIN.includes(s.titel);
    const id = String(nr).padStart(2, '0');
    if (ny || nr === 1 || /konge|Sicil|Dronninggambit|Konge og bonde|samme brik|Bonden$/.test(s.titel)) await skaerm(page, `skak-${tag}-03-trin-${id}-${s.titel.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 24)}.png`);
    if (LOES[s.titel]) {
      await LOES[s.titel](tap, felt, page);
      await page.waitForTimeout(250);
      rec.beskedEfterTraek = (await laes()).besked;
      if (ny) await skaerm(page, `skak-${tag}-04-loest-${id}-${s.titel.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 24)}.png`);
      await page.waitForTimeout(2200);
      const efter = await laes();
      rec.gaaetVidere = efter.taeller !== s.taeller;
      if (!rec.gaaetVidere) { await tap('#knap-laer-spring-over').catch(() => {}); rec.sprungetOverEfterLoesning = true; await page.waitForTimeout(400); }
    } else {
      await tap('#knap-laer-spring-over');
      await page.waitForTimeout(400);
      rec.sprungetOver = true;
    }
    trin.push(rec);
  }
  S('ny-trin', trin);
  S('ny-antalTrin', trin.length);
  S('ny-synlighed', { udenScroll: trin.filter((t) => t.tekstOgBraetSynlige).length, af: trin.length, ikkeSynlige: trin.filter((t) => !t.tekstOgBraetSynlige).map((t) => ({ trin: t.taeller, titel: t.titel, braetBundOverVindue: t.braetBundOverVindue })) });

  await nytNiveau('spiller');
  let s = await laes();
  S('spiller', { titel: s.titel, taeller: s.taeller, layout: await layout() });
  await skaerm(page, `skak-${tag}-05-spiller-start.png`);
  await nytNiveau('reglerne');
  s = await laes();
  S('reglerne', { titel: s.titel, taeller: s.taeller, layout: await layout() });
  await skaerm(page, `skak-${tag}-06-reglerne-start.png`);
  S('laer-efter', await page.evaluate(MAAL_SIDE, 44));

  await tap('#fane-spil');
  await page.waitForTimeout(250);
  await top();
  S('spil-vaerktoej', await vaerktoej());
  await skaerm(page, `skak-${tag}-07-spil.png`);
  for (const [fane, navn] of [['#fane-opstil', 'opstil'], ['#fane-gaader', 'gaader']]) {
    await tap(fane); await page.waitForTimeout(300); await top();
    S(`${navn}-vaerktoej`, await vaerktoej());
  }
  S('konsol', fejl);
  await ctx.close();
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


const KORTDETALJE = () => {
  const k = document.querySelector('.kort').getBoundingClientRect();
  const rr = (e) => { const r = e.getBoundingClientRect(); return { venstre: Math.round(r.left - k.left), hoejre: Math.round(k.right - r.right), top: Math.round(r.top - k.top), bund: Math.round(k.bottom - r.bottom), b: Math.round(r.width), h: Math.round(r.height) }; };
  const knapper = [...document.querySelectorAll('.sted-knap')].filter((e) => e.offsetParent).map((e) => ({ navn: e.querySelector('.sted-navn')?.textContent ?? '', ...rr(e) }));
  const skilte = [...document.querySelectorAll('.klynge-etiket, .sted-knap--klynge')].filter((e) => e.offsetParent).map((e) => {
    const t = [...e.querySelectorAll('*')].filter((x) => x.children.length === 0 && x.textContent.trim());
    const b = e.getBoundingClientRect();
    const tekster = t.map((x) => { const g = document.createRange(); g.selectNodeContents(x); const q = g.getBoundingClientRect(); return { tekst: x.textContent.trim(), venstreLuft: Math.round(q.left - b.left), hoejreLuft: Math.round(b.right - q.right) }; });
    return { klasse: String(e.className).split(' ')[0], b: Math.round(b.width), ...rr(e), tekster };
  });
  const laas = [...document.querySelectorAll('.kort *')].filter((e) => e.children.length === 0 && /kræver/i.test(e.textContent)).map((e) => ({ tekst: e.textContent.trim().slice(0, 40), px: parseFloat(getComputedStyle(e).fontSize), ...rr(e) }));
  const under12 = [...document.querySelectorAll('.kort *')].filter((e) => e.offsetParent && e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => ({ tekst: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) }));
  const mol = knapper.find((x) => x.navn === 'Møllen');
  const huse = [...document.querySelectorAll('.kort svg *')].filter((e) => /moelle|moelle|mill|hus/i.test((e.id || '') + ' ' + String(e.className?.baseVal ?? e.className ?? ''))).map((e) => ({ id: e.id, kl: String(e.className?.baseVal ?? ''), ...rr(e) })).slice(0, 6);
  return { kortB: Math.round(k.width), kortH: Math.round(k.height), knapper, skilte, laas, under12, moellenKnap: mol ?? null, husKandidater: huse };
};

async function matSession(browser, w, h, run = '') {
  const tag = String(w) + run;
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
  M.kortLukket = await page.evaluate(KORTDETALJE);
  await skaerm(page, `mat-${tag}-02-kort.png`);
  // fold klyngen ud og maal Kirken og Landsbygaden mod Moellen
  await aabnKlynge(page);
  await page.waitForTimeout(200);
  M.klynge = await page.evaluate(() => {
    const k = document.querySelector('.kort').getBoundingClientRect();
    const find = (n) => { const e = [...document.querySelectorAll('.sted-knap')].find((x) => x.querySelector('.sted-navn')?.textContent === n); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2 - k.x), y: Math.round(r.y + r.height / 2 - k.y), venstre: Math.round(r.left - k.left), hoejre: Math.round(k.right - r.right) }; };
    return { kirken: find('Kirken'), landsbygaden: find('Landsbygaden'), moellen: find('Møllen'), klyngeKnap: (() => { const e = document.querySelector('.sted-knap--klynge'); if (!e) return null; const r = e.getBoundingClientRect(); return { hoejreTilKortkant: Math.round(k.right - r.right), b: Math.round(r.width) }; })() };
  });
  M.kortAaben = await page.evaluate(KORTDETALJE);
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
    for (const [w, h, run] of [[390, 844, ''], [360, 800, ''], [390, 844, 'b']]) { console.log(`matematik ${w}${run}`); await matSession(browser, w, h, run); }
    const liste = (k) => (maal[k]?.opgaver ?? []).map((o) => o.spoergsmaal + ' | ' + o.valg.join(','));
    const a = liste('mat-390'), b = liste('mat-390b'), c = liste('mat-360');
    maal.matVariation = { antal: [a.length, b.length, c.length], ensPaaPladsA_B: a.filter((x, i) => x === b[i]).length, ensPaaPladsA_C: a.filter((x, i) => x === c[i]).length, ensIAlt_A_B: a.filter((x) => b.includes(x)).length, unikkeSpoergsmaalA: new Set(a).size, unikkeSpoergsmaalB: new Set(b).size };
  } finally {
    await browser.close();
    writeFileSync(path.join(ud, 'maalinger.json'), JSON.stringify(maal, null, 2));
  }
  console.log(`\nKritik 361 faerdig (skak main ${skak.hash}, matematik main ${mat.hash}). Se outputs/kritik-skole-4/.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
