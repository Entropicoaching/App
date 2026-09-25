// ORDRE 379 - Bhishak som KRITIKER: taktikstien (skak main efter 372) spillet som en elev paa
// telefonen, og atletens app efter 373 (AthleteView delt i moduler) sammenlignet med e524d5e.
// Retter intet og committer intet i skak-repoet: skak main traekkes ud med `git archive` til en
// midlertidig mappe, og kun den koeres headless. App-versionerne traekkes ud paa samme maade.
// Ingen elevdata (fremgangen ligger i en flygtig browserprofil), ingen atletdata (kun e2e-seedens
// syntetiske atlet fra e2e/fixtures.mjs).
//
// Brug: node scripts/kritik-379.mjs [--kun taktik|gaader|atlet]   (npm run verify:kritik-379)
// Udgang: outputs/kritik-379/ (skaermbilleder + maalinger.json). Exit 1 kun hvis scriptet selv fejler.
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const APP_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-app-wt2';
const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const skakKraev = createRequire(path.join(SKAK_ROD, 'package.json'));
const { chromium } = skakKraev('playwright');
const kun = process.argv.includes('--kun') ? process.argv[process.argv.indexOf('--kun') + 1] : null;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik379-'));
function traek(rod, navn, rev) {
  const mappe = path.join(tmp, navn);
  mkdirSync(mappe, { recursive: true });
  execFileSync('git', ['-C', rod, 'archive', '--format=tar', '-o', path.join(tmp, `${navn}.tar`), rev]);
  execFileSync('tar', ['-xf', `${navn}.tar`, '-C', navn], { cwd: tmp });
  const hash = execFileSync('git', ['-C', rod, 'rev-parse', '--short', rev]).toString().trim();
  return { mappe, hash };
}
const ud = path.join(APP_ROD, 'outputs', 'kritik-379');
mkdirSync(ud, { recursive: true });
const maalFil = path.join(ud, 'maalinger.json');
const maal = existsSync(maalFil) ? JSON.parse(readFileSync(maalFil, 'utf8')) : {};
const gem = () => writeFileSync(maalFil, JSON.stringify(maal, null, 1));
const vent = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- BLOK 1: TAKTIKSTIEN SOM ELEV ----------

// LIX (laesbarhed, dansk): ord pr. saetning + 100 * lange ord (> 6 bogstaver) / ord.
function lix(tekst) {
  const ord = tekst.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
  const saetn = Math.max(1, (tekst.match(/[.!?:]+(\s|$)/g) || []).length);
  const lange = ord.filter((o) => o.replace(/-/g, '').length > 6).length;
  return Math.round(ord.length / saetn + (100 * lange) / Math.max(1, ord.length));
}

// Gaaderne som data: mat i 1 der ikke er facit, mat til modstanderen efter loesningen, og
// Chaturangas egen materiale-soegning (scripts/taktiksoegning.mjs) koert et halvtraek dybere
// (4 i stedet for 3) for "een loesning" og for elevens andet traek. Tager ca. 8 minutter.
async function gaader() {
  const skak = traek(SKAK_ROD, 'skak-data', 'main');
  execFileSync('cmd', ['/c', 'mklink', '/J', path.join(skak.mappe, 'node_modules'), path.join(SKAK_ROD, 'node_modules')]);
  const { Chess } = await import(pathToFileURL(skakKraev.resolve('chess.js')).href);
  const { TAKTIK_GAADER } = await import(pathToFileURL(path.join(skak.mappe, 'src', 'taktikgaader.js')).href);
  const { entydigMaterialeGaade } = await import(pathToFileURL(path.join(skak.mappe, 'scripts', 'taktiksoegning.mjs')).href);
  const T = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const matI1 = (c) => c.moves({ verbose: true }).filter((m) => { c.move(m); const r = c.isCheckmate(); c.undo(); return r; }).map((m) => m.san);
  const G = { skakMain: skak.hash, matFraStartIkkeMatMoenster: [], modstanderMatEfterLoesning: [], matITraek2: [], soegning4: [], stillinger: 0 };
  for (const [mid, liste] of Object.entries(TAKTIK_GAADER)) {
    for (const [i, g] of liste.entries()) {
      G.stillinger++;
      const c = new Chess(g.fen);
      const start = matI1(c);
      if (!/mat/.test(mid) && start.length) G.matFraStartIkkeMatMoenster.push({ moenster: mid, indeks: i, eksempel: i < 3, id: g.id, fen: g.fen, mat: start, facit: g.godeFoerste?.length ? `${g.godeFoerste.length} gode foerste traek` : g.loesning.join(' ') });
      const linje = g.godeFoerste?.length ? [g.godeFoerste[0]] : g.loesning;
      for (const u of linje) c.move(T(u));
      if (!c.isGameOver() && matI1(c).length) G.modstanderMatEfterLoesning.push({ moenster: mid, id: g.id, mat: matI1(c) });
      if (g.loesning.length >= 3) { const d = new Chess(g.fen); d.move(T(g.loesning[0])); d.move(T(g.loesning[1])); const m2 = matI1(d); if (m2.length && !/mat/.test(mid)) G.matITraek2.push({ moenster: mid, id: g.id, mat: m2, facit: g.loesning[2] }); }
      if (['mat-i-1', 'baglinjemat', 'kvaelningsmat', 'mat-i-2', 'forsvar'].includes(mid)) continue;
      const r = entydigMaterialeGaade(g.fen, g.loesning[0], { dybde: 4, minGevinst: mid === 'ubeskyttet' ? 3 : 2 });
      let trin2 = null;
      if (g.loesning.length >= 3) {
        const d = new Chess(g.fen); d.move(T(g.loesning[0])); d.move(T(g.loesning[1]));
        const r2 = entydigMaterialeGaade(d.fen(), g.loesning[2], { dybde: 3, minGevinst: -99, margin: 1 });
        trin2 = r2.ok ? 'ok' : r2.grund;
      }
      if (!r.ok || (trin2 && trin2 !== 'ok')) G.soegning4.push({ moenster: mid, indeks: i, id: g.id, fen: g.fen, facit: g.loesning.join(' '), foerste: r.ok ? 'ok' : r.grund, trin2 });
    }
  }
  maal.gaader = G;
  gem();
  console.log(`gaader: ${G.stillinger} stillinger, mat fra start ${G.matFraStartIkkeMatMoenster.length}, soegning4-fund ${G.soegning4.length}`);
}

async function taktik() {
  const skak = traek(SKAK_ROD, 'skak', 'main');
  maal.skakMain = skak.hash;
  const { Chess } = await import(pathToFileURL(skakKraev.resolve('chess.js')).href);
  const { TAKTIK_GAADER } = await import(pathToFileURL(path.join(skak.mappe, 'src', 'taktikgaader.js')).href);
  const { TAKTIK_MOENSTRE } = await import(pathToFileURL(path.join(skak.mappe, 'src', 'taktiksti.js')).href);
  const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const uciAf = (m) => `${m.from}${m.to}${m.promotion ?? ''}`;
  const somTraek = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

  // Tekster: laengde og LIX pr. moenster (forklaring, opgave, hint).
  maal.taktikTekster = TAKTIK_MOENSTRE.map((m) => ({ id: m.id, titel: m.titel,
    forklaring: { ord: m.forklaring.split(/\s+/).length, lix: lix(m.forklaring) },
    opgave: { ord: m.opgave.split(/\s+/).length, lix: lix(m.opgave) },
    hint: { ord: m.hint.split(/\s+/).length, lix: lix(m.hint) } }));

  // Er brikken paa "felt" absolut bundet (til egen konge)? Straaler fra kongen.
  function bundne(chess) {
    const tur = chess.turn();
    const kFelt = chess.board().flat().find((b) => b && b.type === 'k' && b.color === tur).square;
    const f = kFelt.charCodeAt(0) - 97, r = Number(kFelt[1]) - 1;
    const ud = [];
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let egen = null;
      for (let i = 1; i < 8; i++) {
        const x = f + df * i, y = r + dr * i;
        if (x < 0 || x > 7 || y < 0 || y > 7) break;
        const sq = String.fromCharCode(97 + x) + (y + 1);
        const b = chess.get(sq);
        if (!b) continue;
        if (b.color === tur) { if (egen) break; egen = sq; continue; }
        const skraa = df !== 0 && dr !== 0;
        if (egen && (b.type === 'q' || (skraa ? b.type === 'b' : b.type === 'r'))) ud.push(egen);
        break;
      }
    }
    return ud;
  }

  // Elevens "typiske fejl" pr. moenster (docs/TAKTIKSTIEN.md), regnet ud af stillingen.
  function typiskFejl(moensterId, fen, rigtige) {
    const c = new Chess(fen);
    const alle = c.moves({ verbose: true }).filter((m) => !rigtige.includes(uciAf(m)));
    const giverMat = (m) => { c.move(m); const r = c.isCheckmate(); c.undo(); return r; };
    const ikkeMat = alle.filter((m) => !giverMat(m));
    const valg = (liste, grund) => (liste.length ? { uci: uciAf(liste[0]), san: liste[0].san, grund } : null);
    const daekket = (m) => { c.move(m); const r = c.moves({ verbose: true }).some((s) => s.to === m.to); c.undo(); return r; };
    const fejl = {
      ubeskyttet: () => valg(ikkeMat.filter((m) => m.captured && daekket(m) && V[m.piece] > V[m.captured]), 'slaar en daekket brik med en dyrere brik')
        ?? valg(ikkeMat.filter((m) => m.captured), 'slaar en anden brik'),
      forsvar: () => valg(ikkeMat.filter((m) => m.from === (rigtige[0] ?? '').slice(0, 2)), 'flytter brikken til et felt der ogsaa er angrebet')
        ?? valg(ikkeMat.filter((m) => m.piece !== 'k'), 'laver et andet traek og glemmer truslen'),
      mat: () => valg(ikkeMat.filter((m) => m.san.includes('+')), 'giver det foerste skak, men det er ikke mat'),
      gaffel: () => valg(ikkeMat.filter((m) => m.captured), 'slaar med det samme i stedet for at gafle (ser ikke gaflen)')
        ?? valg(ikkeMat.filter((m) => m.piece === (c.get(rigtige[0].slice(0, 2))?.type)), 'flytter gaffelbrikken et andet sted hen'),
      binding: () => valg(ikkeMat.filter((m) => m.piece === (c.get(rigtige[0].slice(0, 2))?.type)), 'ser ikke bindingen: flytter samme brik et andet sted hen'),
      spid: () => valg(ikkeMat.filter((m) => m.piece === (c.get(rigtige[0].slice(0, 2))?.type) && !m.captured), 'angriber fra en side hvor der ikke staar noget bagved'),
      afdaekket: () => valg(ikkeMat.filter((m) => m.from === rigtige[0].slice(0, 2)), 'flytter den forreste brik hen hvor den ingenting goer'),
      'mat-i-2': () => valg(ikkeMat.filter((m) => m.san.includes('+')), 'giver et andet skak, der ikke fører til mat'),
    };
    const noegle = { 'mat-i-1': 'mat', baglinjemat: 'mat', kvaelningsmat: 'mat', 'gaffel-springer': 'gaffel', 'gaffel-andre': 'gaffel' }[moensterId] ?? moensterId;
    return (fejl[noegle]?.() ?? null) ?? valg(ikkeMat, 'et tilfaeldigt andet traek');
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const konsol = [];
  page.on('pageerror', (e) => konsol.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') konsol.push(`console.error: ${m.text().slice(0, 160)}`); });
  await page.goto(pathToFileURL(path.join(skak.mappe, 'skak.html')).href);
  await page.waitForSelector('#braet .felt');
  await page.waitForTimeout(500);
  const skaerm = (navn, opts = {}) => page.screenshot({ path: path.join(ud, `taktik-${navn}.png`), ...opts });

  // Laes stillingen af braettet (brikkernes <use href="#brik-<saet>-<farve><type>">).
  const placering = () => page.evaluate(() => {
    const kort = {};
    for (const f of document.querySelectorAll('#braet .felt')) {
      const u = f.querySelector('.brik-svg use');
      if (u) kort[f.dataset.square] = u.getAttribute('href').slice(-2);
    }
    let ud = '';
    for (let r = 8; r >= 1; r--) {
      let tom = 0;
      for (const fil of 'abcdefgh') {
        const b = kort[fil + r];
        if (!b) { tom++; continue; }
        if (tom) { ud += tom; tom = 0; }
        ud += b[0] === 'w' ? b[1].toUpperCase() : b[1];
      }
      if (tom) ud += tom;
      if (r > 1) ud += '/';
    }
    return ud;
  });
  // Skaermen som eleven ser den: tekstfelter, braet, besked, liste, skriftstoerrelser.
  const laesSkaerm = () => page.evaluate(() => {
    const rekt = (id) => { const e = document.getElementById(id); if (!e || e.hidden || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), h: Math.round(r.height), px: parseFloat(getComputedStyle(e).fontSize) }; };
    const tekst = (id) => document.getElementById(id)?.textContent.trim() ?? '';
    const b = document.querySelector('#braet').getBoundingClientRect();
    const pil = document.querySelectorAll('svg polygon').length; // pilespidser paa tegnelaget
    const liste = document.getElementById('taktik-liste').getBoundingClientRect();
    return {
      taeller: tekst('taktik-taeller'), titel: tekst('taktik-titel'), forklaring: tekst('taktik-forklaring'), tekst: tekst('taktik-tekst'), besked: tekst('taktik-besked'),
      rekt: { titel: rekt('taktik-titel'), forklaring: rekt('taktik-forklaring'), tekst: rekt('taktik-tekst'), besked: rekt('taktik-besked') },
      braet: { top: Math.round(b.top), bund: Math.round(b.bottom), b: Math.round(b.width) }, vindue: innerHeight, scrollY: Math.round(scrollY),
      listeTop: Math.round(liste.top + scrollY), tegnelagElementer: pil,
      teksterOgBraetSamtidig: b.bottom <= innerHeight && (document.getElementById('taktik-forklaring').getBoundingClientRect().top >= 0),
    };
  });
  const felt = (sq) => page.locator(`#braet [data-square="${sq}"]`);
  const spil = async (uci) => { await felt(uci.slice(0, 2)).tap(); await page.waitForTimeout(80); await felt(uci.slice(2, 4)).tap(); await page.waitForTimeout(120); if (uci[4]) { const navn = { q: 'Dronning', r: 'Tårn', b: 'Løber', n: 'Springer' }[uci[4]]; await page.locator(`#forvandling-valg button[aria-label="${navn}"]`).tap().catch(() => {}); } };
  const findGaade = async (moensterId) => {
    const p = await placering();
    const liste = TAKTIK_GAADER[moensterId];
    const i = liste.findIndex((g) => g.fen.split(' ')[0] === p);
    return i < 0 ? null : { i, g: liste[i] };
  };
  // Venter til en ny stilling er stillet op (placeringen skifter), eller til teksten skifter.
  const ventPaaNy = async (gammel, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await placering()) !== gammel) return true; await page.waitForTimeout(100); } return false; };

  await page.locator('#fane-taktik').tap();
  await page.waitForTimeout(500);
  const T = { start: await laesSkaerm(), moenstre: [], fund: [] };
  await skaerm('00-foerste-skaerm');
  await skaerm('00-foerste-skaerm-hel', { fullPage: true });
  T.listeTekster = await page.evaluate(() => [...document.querySelectorAll('.taktik-liste-knap')].map((k) => ({ t: k.textContent, title: k.title, h: Math.round(k.getBoundingClientRect().height) })));
  T.panelTekst = await page.evaluate(() => document.getElementById('panel-taktik').innerText);

  const SPRING = 'afdaekket'; // "Spring over" proeves paa det svaereste moenster, som en elev ville
  for (const [mi, m] of TAKTIK_MOENSTRE.entries()) {
    const M = { id: m.id, titel: m.titel, eksempler: [], gaader: [], skaerme: [] };
    T.moenstre.push(M);
    const nr = String(mi + 1).padStart(2, '0');
    // --- tre eksempler ---
    for (let e = 0; e < 3; e++) {
      const fund = await findGaade(m.id);
      const s = await laesSkaerm();
      const E = { gaade: fund?.g.id ?? null, indeks: fund?.i ?? null, taeller: s.taeller, tekst: s.tekst, samtidig: s.teksterOgBraetSamtidig, braet: s.braet, forklaringRekt: s.rekt.forklaring };
      if (!fund) { E.fejl = 'stillingen blev ikke genkendt'; M.eksempler.push(E); break; }
      if (e === 0) await skaerm(`${nr}-${m.id}-eksempel-1`);
      const g = fund.g;
      const rigtige = g.godeFoerste?.length ? g.godeFoerste : [g.loesning[0]];
      if (e === 0 && mi === 0) {
        // en elev der ikke foelger pilen i allerfoerste eksempel
        const f = typiskFejl(m.id, g.fen, rigtige);
        if (f) { await spil(f.uci); await page.waitForTimeout(250); E.forkertIEksempel = { traek: f.san, besked: (await laesSkaerm()).besked }; await skaerm(`${nr}-${m.id}-eksempel-forkert`); await page.waitForTimeout(1300); }
      }
      await spil(rigtige[0]);
      await page.waitForTimeout(200);
      E.efterTraek1 = (await laesSkaerm()).besked;
      if (g.loesning.length >= 3 && !g.godeFoerste?.length) {
        await page.waitForTimeout(900);
        const s2 = await laesSkaerm();
        E.efterSvar = s2.besked;
        E.pilEfterSvar = s2.tegnelagElementer;
        if (e === 0) await skaerm(`${nr}-${m.id}-eksempel-1-din-tur-igen`);
        await spil(g.loesning[2]);
        await page.waitForTimeout(200);
        E.efterTraek2 = (await laesSkaerm()).besked;
      }
      E.naeste = await ventPaaNy(await placering());
      M.eksempler.push(E);
    }
    // --- gaader ---
    if (m.id === SPRING) {
      const s = await laesSkaerm();
      await skaerm(`${nr}-${m.id}-foer-spring-over`);
      await page.locator('#knap-taktik-spring-over').tap();
      await page.waitForTimeout(500);
      const efter = await laesSkaerm();
      M.sprungetOver = { foer: s.taeller, efter: efter.taeller, titelEfter: efter.titel, scrollY: efter.scrollY,
        listeMarkering: await page.evaluate((i) => document.querySelectorAll('.taktik-liste-knap')[i].textContent, mi),
        lager: await page.evaluate(() => localStorage.getItem('skak-taktik-fremgang-v1')) };
      M.springKnapPlacering = await page.evaluate(() => { const r = document.getElementById('knap-taktik-spring-over').getBoundingClientRect(); return { top: Math.round(r.top + scrollY), h: Math.round(r.height), b: Math.round(r.width) }; });
      continue;
    }
    for (let n = 0; n < 12; n++) {
      const fund = await findGaade(m.id);
      const s = await laesSkaerm();
      const G = { taeller: s.taeller, tekst: s.tekst, samtidig: s.teksterOgBraetSamtidig };
      if (!fund) { G.fejl = `stillingen blev ikke genkendt (titel nu: ${s.titel})`; M.gaader.push(G); break; }
      G.gaade = fund.g.id; G.indeks = fund.i; G.rating = fund.g.rating ?? null;
      const g = fund.g;
      const rigtige = g.godeFoerste?.length ? g.godeFoerste : [g.loesning[0]];
      if (n === 0) await skaerm(`${nr}-${m.id}-gaade-1`);
      // Gaade 1: typisk fejl een gang. Gaade 2: to fejl, saa pilen kommer.
      const antalFejl = n === 0 ? 1 : n === 1 ? 2 : 0;
      G.fejl = [];
      for (let k = 0; k < antalFejl; k++) {
        const f = typiskFejl(m.id, g.fen, rigtige);
        if (!f) { G.fejl.push({ note: 'intet forkert traek fundet' }); break; }
        await spil(f.uci);
        await page.waitForTimeout(250);
        const sf = await laesSkaerm();
        G.fejl.push({ traek: f.san, grund: f.grund, besked: sf.besked, braetTop: sf.braet.top, braetTopFoer: s.braet.top });
        if (n <= 1 && mi < 11) await skaerm(`${nr}-${m.id}-gaade-${n + 1}-fejl-${k + 1}`);
        await page.waitForTimeout(1300);
      }
      if (antalFejl === 2) { const sp = await laesSkaerm(); G.pilEfterToFejl = sp.tegnelagElementer; await skaerm(`${nr}-${m.id}-gaade-2-pil-efter-to-fejl`); }
      await spil(rigtige[0]);
      await page.waitForTimeout(200);
      G.efterTraek1 = (await laesSkaerm()).besked;
      if (g.loesning.length >= 3 && !g.godeFoerste?.length) {
        const c = new Chess(g.fen); c.move(somTraek(g.loesning[0]));
        if (!c.isCheckmate()) {
          await page.waitForTimeout(900);
          c.move(somTraek(g.loesning[1]));
          if (n === 0) {
            // anden halvdel: eleven slaar forkert efter gaflen/bindingen/spiddet
            const alle = c.moves({ verbose: true }).filter((x) => uciAf(x) !== g.loesning[2]);
            const giverMat = (x) => { c.move(x); const r = c.isCheckmate(); c.undo(); return r; };
            const forkert = alle.find((x) => x.captured && !giverMat(x)) ?? alle.find((x) => !giverMat(x));
            if (forkert) {
              await spil(uciAf(forkert));
              await page.waitForTimeout(250);
              G.fejlTraek2 = { traek: forkert.san, besked: (await laesSkaerm()).besked };
              await skaerm(`${nr}-${m.id}-gaade-1-fejl-i-traek-2`);
              await page.waitForTimeout(1300);
            }
          }
          await spil(g.loesning[2]);
          await page.waitForTimeout(200);
          G.efterTraek2 = (await laesSkaerm()).besked;
        }
      }
      const sl = await laesSkaerm();
      G.slut = sl.besked; G.braetTopSlut = sl.braet.top;
      if (/Du har lært/.test(sl.besked)) { await skaerm(`${nr}-${m.id}-laert`); M.gaader.push(G); M.mestretEfter = n + 1; await ventPaaNy(await placering(), 5000); break; }
      M.gaader.push(G);
      await ventPaaNy(await placering());
    }
    M.efter = await laesSkaerm();
    M.listeMarkering = await page.evaluate((i) => document.querySelectorAll('.taktik-liste-knap')[i].textContent, mi);
    gem();
  }
  // Tilbage til det oversprungne moenster fra listen, som en laerer ville
  T.efterSidste = await laesSkaerm();
  await skaerm('90-efter-sidste-moenster');
  T.lagerFoerGenindlaes = await page.evaluate(() => localStorage.getItem('skak-taktik-fremgang-v1'));
  // Genindlaes (eleven lukker fanen og kommer igen)
  await page.reload();
  await page.waitForSelector('#braet .felt');
  await page.locator('#fane-taktik').tap();
  await page.waitForTimeout(500);
  T.efterGenindlaes = await laesSkaerm();
  await skaerm('91-efter-genindlaes');
  // Listen: hvor er den, og hvad staar der
  T.listeEfter = await page.evaluate(() => [...document.querySelectorAll('.taktik-liste-knap')].map((k) => ({ t: k.textContent, title: k.title })));
  await page.locator('#panel-taktik').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await skaerm('92-liste-og-knapper');
  // "Start forfra": spoerger den foerst?
  let dialog = null;
  page.once('dialog', async (d) => { dialog = d.message(); await d.dismiss(); });
  await page.locator('#knap-taktik-forfra').tap();
  await page.waitForTimeout(500);
  T.startForfra = { dialog, efter: await laesSkaerm(), lager: await page.evaluate(() => localStorage.getItem('skak-taktik-fremgang-v1')) };
  await page.evaluate(() => scrollTo(0, 0));
  await skaerm('93-efter-start-forfra');
  // "Flytter den bundne brik": i mat i 1's foerste gaade (0Psb8) er sorts dronning paa d7 bundet til
  // kongen. Eleven proever at flytte den ud af linjen. Hvad ser eleven?
  await page.locator('.taktik-liste-knap[data-indeks="2"]').tap();
  await page.waitForTimeout(500);
  for (let e = 0; e < 3; e++) { const f = await findGaade('mat-i-1'); if (!f) break; await spil(f.g.loesning[0]); await page.waitForTimeout(200); await ventPaaNy(await placering()); }
  const bf = await findGaade('mat-i-1');
  T.bundenBrik = { gaade: bf?.g.id ?? null };
  if (bf) {
    const c = new Chess(bf.g.fen);
    const sq = bundne(c)[0];
    const lovlige = c.moves({ square: sq, verbose: true }).map((x) => x.to);
    const fil = sq.charCodeAt(0) - 97, rk = Number(sq[1]) - 1;
    const naboer = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [fil + a, rk + b]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => String.fromCharCode(97 + x) + (y + 1));
    const ulovligt = naboer.find((n) => !c.get(n) && !lovlige.includes(n));
    T.bundenBrik = { gaade: bf.g.id, felt: sq, brik: c.get(sq).type, lovligeFelter: lovlige, proevetFelt: ulovligt };
    const foerTekst = await laesSkaerm();
    await felt(sq).tap(); await page.waitForTimeout(200);
    T.bundenBrik.valgt = await page.evaluate((s) => ({ markeret: document.querySelector(`#braet [data-square="${s}"]`).classList.contains('markeret'), viste: document.querySelectorAll('#braet .lovligt-traek, #braet .lovligt-slag').length }), sq);
    await skaerm('94-bunden-brik-valgt');
    if (ulovligt) { await felt(ulovligt).tap(); await page.waitForTimeout(400); }
    const efterTekst = await laesSkaerm();
    T.bundenBrik.efter = { besked: efterTekst.besked, tekstFoer: foerTekst.tekst, tekstEfter: efterTekst.tekst, stillingUaendret: (await placering()) === bf.g.fen.split(' ')[0] };
    await skaerm('95-bunden-brik-forsoegt-flyttet');
  }
  // Trykflader under 44 px i Taktik
  T.smaaTryk = await page.evaluate(() => [...document.querySelectorAll('button, summary, select, input:not([type=hidden]), label, a')].filter((e) => e.offsetParent && !e.closest('[hidden]')).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24), b: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.b > 0 && (x.b < 43.5 || x.h < 43.5)));
  T.konsol = konsol;
  maal.taktik = T;
  gem();
  await browser.close();
  console.log(`taktik: ${T.moenstre.length} moenstre gennemgaaet, konsol ${konsol.length}`);
}

// ---------- BLOK 2: ATLETENS APP EFTER 373 ----------
// Samme mock og seed som outputs/373/skaermbilleder.mjs (e2e/mock-supabase.mjs + buildSeed,
// kun syntetiske data), koert mod to udtraek: e524d5e (live hos atleterne) og main (efter 373).
async function atlet() {
  const { homedir } = os;
  const mods = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
  const kraev = createRequire(import.meta.url);
  const { PNG } = kraev(path.join(mods, 'pngjs'));
  const pm = kraev(path.join(mods, 'pixelmatch'));
  const pixelmatch = pm.default || pm;
  const versioner = [['live', 'e524d5e'], ['efter', 'main']];
  const A = { versioner: {}, skaerme: {} };
  for (const [navn, rev] of versioner) {
    const v = traek(APP_ROD, `app-${navn}`, rev);
    execFileSync('cmd', ['/c', 'mklink', '/J', path.join(v.mappe, 'node_modules'), path.join(APP_ROD, 'node_modules')]);
    // .env.e2e er git-sporet og kommer med i udtraekket.
    A.versioner[navn] = { rev, hash: v.hash, ...(await atletSession(v.mappe, navn)) };
    gem();
  }
  // Pixel-sammenligning live -> efter, skaerm for skaerm
  const liveDir = path.join(ud, 'atlet-live'), efterDir = path.join(ud, 'atlet-efter');
  for (const f of A.versioner.live.billeder) {
    const a = PNG.sync.read(readFileSync(path.join(liveDir, f)));
    if (!existsSync(path.join(efterDir, f))) { A.skaerme[f] = { note: 'mangler efter' }; continue; }
    const b = PNG.sync.read(readFileSync(path.join(efterDir, f)));
    if (a.width !== b.width || a.height !== b.height) { A.skaerme[f] = { forskelligStoerrelse: `${a.width}x${a.height} -> ${b.width}x${b.height}` }; continue; }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 });
    A.skaerme[f] = { afvigelsePixels: n, afvigelseProcent: Math.round((n / (a.width * a.height)) * 10000) / 100 };
    if (n) writeFileSync(path.join(ud, `atlet-diff-${f}`), PNG.sync.write(diff));
  }
  maal.atlet = A;
  gem();
  console.log('atlet:', JSON.stringify(A.skaerme));
}

async function atletSession(rod, navn) {
  const PORT_VITE = navn === 'live' ? 5291 : 5292, PORT_MOCK = navn === 'live' ? 8791 : 8792;
  const { ATHLETE_USER, buildSeed } = await import(pathToFileURL(path.join(rod, 'e2e', 'fixtures.mjs')).href);
  const { createMockSupabase } = await import(pathToFileURL(path.join(rod, 'e2e', 'mock-supabase.mjs')).href);
  const seed = buildSeed({ withMeasuredVideo: true });
  seed.tables.athletes[0].competition_date = '2026-12-05';
  const mock = createMockSupabase(seed);
  await mock.listen(PORT_MOCK);
  // .env.e2e peger paa mock-porten 8991; vi overstyrer med VITE_SUPABASE_URL i proces-miljoeet.
  const envTekst = readFileSync(path.join(rod, '.env.e2e'), 'utf8');
  const env = { ...process.env };
  for (const l of envTekst.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/8991/g, String(PORT_MOCK)); }
  const vite = spawn(process.execPath, [path.join(rod, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'e2e', '--port', String(PORT_VITE), '--strictPort', '--host', '127.0.0.1'], { cwd: rod, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let viteUd = '';
  vite.stdout.on('data', (d) => { viteUd += d; }); vite.stderr.on('data', (d) => { viteUd += d; });
  const url = `http://127.0.0.1:${PORT_VITE}/`;
  for (let i = 0; i < 150; i++) { try { await fetch(url); break; } catch { await vent(200); } }
  const dir = path.join(ud, `atlet-${navn}`);
  mkdirSync(dir, { recursive: true });
  const billeder = [];
  const R = { fejl: [], net: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => R.fejl.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('console', (m) => { if (m.type() === 'error') R.fejl.push(`console.error: ${m.text().slice(0, 200)}`); });
    page.on('response', (r) => { if (r.status() >= 400) R.net.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`); });
    const shot = async (n, fullPage = false) => { await page.screenshot({ path: path.join(dir, `${n}.png`), fullPage, animations: 'disabled', caret: 'hide' }); billeder.push(`${n}.png`); };
    const settle = async () => { await page.waitForFunction(() => !document.body.innerText.includes('Indlæser…'), null, { timeout: 15000 }).catch(() => {}); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200); };
    const nav = (label) => page.locator('nav button', { hasText: label }).click();
    await page.goto(url);
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email);
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password);
    await page.getByRole('button', { name: 'Log ind' }).click();
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
    await settle();
    await shot('01-forside');
    await shot('01-forside-hel', true);
    // Forsiden: tekst, bundnav, VideoCoach-knapper, "naeste saet"
    R.forside = await page.evaluate(() => {
      const knapper = [...document.querySelectorAll('button, a')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40), b: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) }; });
      const nav = [...document.querySelectorAll('nav button')].map((b) => ({ t: b.innerText.replace(/\s+/g, ' ').trim(), aktiv: b.getAttribute('aria-current') || b.className.includes('active') || '' }));
      return { tekst: document.body.innerText.replace(/\d{1,2}\.\s?\w+\.?\s?\d{0,4}/g, '#dato').slice(0, 3000), knapper, nav, videoKnapper: knapper.filter((k) => /video|film|optag/i.test(k.t)), sideHoejde: document.documentElement.scrollHeight, scrollB: document.documentElement.scrollWidth };
    });
    // Dagens pas: hvilket saet er nu?
    R.dagensPas = await page.evaluate(() => { const h = [...document.querySelectorAll('h1,h2,h3,div,span,p')].find((e) => e.textContent.trim() === 'Dagens pas'); const kort = h?.closest('section, article, div[class]')?.parentElement; return kort ? kort.innerText.replace(/\s+\n/g, '\n').slice(0, 900) : null; });
    // Log det aktuelle saet (Godkendt), som en atlet paa gulvet
    const godkendt = page.getByRole('button', { name: /Godkendt/ }).first();
    if (await godkendt.count()) {
      await godkendt.click();
      await page.waitForTimeout(1500);
      R.efterGodkendt = await page.evaluate(() => document.body.innerText.slice(0, 1500));
      await page.evaluate(() => scrollTo(0, 0));
      await shot('02-efter-godkendt');
    } else R.efterGodkendt = 'ingen Godkendt-knap fundet';
    // VideoCoach-knapperne: hvad aabner de?
    R.video = [];
    const vk = page.locator('button', { hasText: /VideoCoach|Film|Optag|video/i });
    const antal = await vk.count();
    for (let i = 0; i < Math.min(antal, 4); i++) {
      const k = vk.nth(i);
      if (!(await k.isVisible())) continue;
      const t = (await k.innerText()).replace(/\s+/g, ' ').trim();
      await k.scrollIntoViewIfNeeded();
      await k.click().catch((e) => R.video.push({ t, fejl: e.message.slice(0, 80) }));
      await page.waitForTimeout(1500);
      const efter = await page.evaluate(() => ({ iframe: [...document.querySelectorAll('iframe')].map((f) => (f.getAttribute('src') || '').replace(/[?#].*$/, '')), dialog: !!document.querySelector('[role=dialog]'), tekst: document.body.innerText.slice(0, 200) }));
      R.video.push({ t, ...efter });
      await shot(`03-video-${i + 1}`);
      // VideoCoach lukkes inde fra iframen (broen). Proev dens luk/tilbage-knap; ellers genindlaes.
      if (efter.dialog) {
        const fr = page.frameLocator('iframe[title="VideoCoach"]');
        R.video[R.video.length - 1].rammeTekst = await fr.locator('body').innerText({ timeout: 5000 }).then((t) => t.replace(/\s+/g, ' ').slice(0, 200)).catch(() => null);
        const luk = fr.getByRole('button', { name: /Luk|Tilbage|Afslut|×|✕/ }).first();
        const lukket = await luk.click({ timeout: 3000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(800);
        R.video[R.video.length - 1].lukketIndefra = lukket && !(await page.locator('[role=dialog][aria-label="VideoCoach"]').count());
        if (await page.locator('[role=dialog][aria-label="VideoCoach"]').count()) { await page.reload(); await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 20000 }); await settle(); }
      }
      await page.waitForTimeout(400);
    }
    await nav('Hjem').catch(() => {});
    await settle();
    await page.getByRole('button', { name: 'Mere', exact: true }).click();
    await settle();
    await shot('04-forside-mere', true);
    for (const [i, label] of [['05', 'Program'], ['06', 'Kost']]) {
      await nav(label).catch((e) => R.fejl.push(`nav ${label}: ${e.message.slice(0, 60)}`));
      await settle();
      await shot(`${i}-${label.toLowerCase()}`, true);
    }
    R.kost = await page.evaluate(() => document.body.innerText.slice(0, 1200));
    // bundnav: hver knap, hvad aabner den
    R.bundnav = [];
    const navKnapper = await page.locator('nav button').allInnerTexts();
    for (const t of navKnapper) {
      const label = t.replace(/\s+/g, ' ').trim();
      await page.locator('nav button', { hasText: label.split(' ').pop() }).first().click().catch(() => {});
      await page.waitForTimeout(900);
      R.bundnav.push({ label, overskrift: await page.evaluate(() => (document.querySelector('main h1, main h2, h1, h2')?.innerText || '').slice(0, 60)), fejlVises: await page.evaluate(() => /fejl|kunne ikke/i.test(document.body.innerText)) });
    }
    await shot('07-bundnav-sidste');
    await ctx.close();
  } finally {
    await browser.close();
    vite.kill();
    await mock.close();
  }
  R.billeder = billeder;
  if (!billeder.length) R.vite = viteUd.slice(-800);
  return R;
}

try {
  if (!kun || kun === 'taktik') await taktik();
  if (!kun || kun === 'gaader') await gaader();
  if (!kun || kun === 'atlet') await atlet();
  gem();
  console.log('\nKritik 379 faerdig. Se outputs/kritik-379/.');
} catch (e) {
  console.error('FEJL:', e);
  process.exitCode = 1;
}
