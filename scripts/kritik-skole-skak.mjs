// ORDRE 322, Blok 1 — Bhishak som KRITIKER af skak.html (312 + 296), FØR Marc
// kigger. Retter intet, committer intet i skak-repoet — kun læsning og
// headless kørsel. Genbruger de interaktionsmønstre skak-repoets EGNE
// røgtests (roegtest-312.mjs, roegtest-296.mjs) allerede har bevist virker,
// men kører dem her som en UAFHÆNGIG kritik, ikke som en gentagelse af deres
// "grøn/rød"-facit: formålet er skærmbilleder + observationer af hvad der
// stadig ser råt ud, og et par sunde stikprøver (forkert træk i en åbning,
// alle fire slutspil til mat/mål, Opstil+tegn med touch).
//
// Brug: node scripts/kritik-skole-skak.mjs
// Skærmbilleder: outputs/kritik-skole/skak/
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const requireFraSkak = createRequire(path.join(SKAK_ROD, 'package.json'));
const { Chess } = requireFraSkak('chess.js');
const { chromium } = requireFraSkak('playwright');

const url = pathToFileURL(path.join(SKAK_ROD, 'skak.html')).href;
const udMappe = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-skole', 'skak');
mkdirSync(udMappe, { recursive: true });

const fund = []; // { alvor, titel, note, fil }
function noter(alvor, titel, note, fil) {
  fund.push({ alvor, titel, note, fil });
  console.log(`  [${alvor}] ${titel}${fil ? ` (${fil})` : ''} — ${note}`);
}

const felt = (f) => `#braet .felt[data-square="${f}"]`;
const pal = (farve, type) => `.palet-brik[data-farve="${farve}"][data-type="${type}"]`;

function firkant(f) { return { fil: f.charCodeAt(0) - 97, raekke: Number(f[1]) - 1 }; }
function chebyshev(a, b) { const fa = firkant(a), fb = firkant(b); return Math.max(Math.abs(fa.fil - fb.fil), Math.abs(fa.raekke - fb.raekke)); }
function positionNoegle(c) { return c.fen().split(' ').slice(0, 3).join(' '); }
function findKonger(c) {
  const board = c.board(); let hvid = null, sort = null;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const b = board[r][f];
    if (b?.type === 'k') { const sq = `${'abcdefgh'[f]}${8 - r}`; if (b.color === 'w') hvid = sq; else sort = sq; }
  }
  return { hvid, sort };
}
function vaelgBedst(fen, kand, besoegt) {
  const uden = kand.filter((m) => { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to, promotion: m.promotion }); return !besoegt.has(positionNoegle(c2)); });
  const brug = uden.length ? uden : kand;
  let bedst = null, score = Infinity;
  for (const m of brug) { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to, promotion: m.promotion }); const mob = c2.moves().length; if (mob < score) { score = mob; bedst = m; } }
  return bedst;
}
function vaelgHvidtTraek(fen, besoegt) {
  const c = new Chess(fen); const alle = c.moves({ verbose: true });
  for (const m of alle) { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to, promotion: m.promotion }); if (c2.isCheckmate()) return m; }
  const sikre = alle.filter((m) => { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to, promotion: m.promotion }); if (c2.isStalemate()) return false; if (m.piece === 'q' || m.piece === 'r') { const tilbage = c2.moves({ verbose: true }).some((sm) => sm.to === m.to && sm.captured); if (tilbage) return false; } return true; });
  const kand = sikre.length ? sikre : alle;
  const { hvid, sort } = findKonger(c); const afstand = chebyshev(hvid, sort);
  if (afstand > 2) { const kt = kand.filter((m) => m.piece === 'k' && chebyshev(m.to, sort) < afstand); if (kt.length) return vaelgBedst(fen, kt, besoegt); }
  else { const tt = kand.filter((m) => m.piece === 'q' || m.piece === 'r'); if (tt.length) { const b = vaelgBedst(fen, tt, besoegt); const c2 = new Chess(fen); c2.move({ from: b.from, to: b.to }); if (!besoegt.has(positionNoegle(c2))) return b; } }
  return vaelgBedst(fen, kand, besoegt);
}
function vaelgHvidtTraekBonde(fen, besoegt) {
  const c = new Chess(fen); const alle = c.moves({ verbose: true });
  const forv = alle.find((m) => m.promotion === 'q'); if (forv) return forv;
  const { hvid, sort } = findKonger(c); const bt = alle.filter((m) => m.piece === 'p');
  for (const m of bt) { const angrebet = chebyshev(m.to, sort) <= 1; const daekket = chebyshev(m.to, hvid) <= 1; if (!angrebet || daekket) return m; }
  const maal = bt[0]?.to ?? sort;
  const kt = alle.filter((m) => m.piece === 'k').filter((m) => { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to }); return !c2.isStalemate(); });
  const uden = kt.filter((m) => { const c2 = new Chess(fen); c2.move({ from: m.from, to: m.to }); return !besoegt.has(positionNoegle(c2)); });
  const brug = uden.length ? uden : kt;
  return brug.slice().sort((a, b) => chebyshev(a.to, maal) - chebyshev(b.to, maal))[0];
}

async function maalKnap(page, sel) {
  return page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { bredde: Math.round(r.width), hoejde: Math.round(r.height), radius: cs.borderRadius, skygge: cs.boxShadow, font: cs.fontFamily.split(',')[0], overgang: cs.transition };
  }).catch(() => null);
}

async function koerDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(`console.error: ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#braet .felt');

  const klik = async (f) => { await page.click(felt(f)); await page.waitForTimeout(60); };
  const klik0 = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };
  const laes = () => page.evaluate(() => ({
    fen: document.querySelector('#fen-tekst').value,
    titel: document.querySelector('#laer-titel').textContent,
    taeller: document.querySelector('#laer-trin-taeller').textContent,
    besked: document.querySelector('#laer-besked').textContent,
    faerdigSkjult: document.querySelector('#laer-faerdig').hidden,
    niveauValgSynligt: !document.querySelector('#laer-niveau-valg').hidden,
  }));

  async function spilFoersteLovligeTraek(fra) {
    await klik(fra);
    const maal = await page.evaluate(() => {
      const el = document.querySelector('#braet .felt.lovligt-traek, #braet .felt.lovligt-slag');
      return el ? el.dataset.square : null;
    });
    await klik(maal);
    await page.waitForTimeout(1000);
  }

  console.log('\n== SKAK: niveauvalg (1280x800) ==');
  await klik0('#fane-laer');
  let s = await laes();
  if (!s.niveauValgSynligt) noter('alvor-1', 'Niveauvælgeren vises ikke ved første besøg', 'forventet ved allerførste besøg i "Lær skak"');
  await page.screenshot({ path: path.join(udMappe, 'desktop-01-niveauvalg.png') });
  const niveauKnap = await maalKnap(page, '.segment[data-segment="laer-niveau"] .segment-knap');
  if (niveauKnap) console.log(`  niveauknap: ${niveauKnap.bredde}x${niveauKnap.hoejde}px, radius ${niveauKnap.radius}, skygge ${niveauKnap.skygge === 'none' ? 'ingen' : 'ja'}, font ${niveauKnap.font}`);

  await klik0('.segment[data-segment="laer-niveau"] .segment-knap[data-value="ny"]');
  s = await laes();
  console.log(`  "Jeg er ny" valgt: ${s.taeller}`);

  // ---- Brikker/slag/mat/rokade/en passant (trin 1-11), hurtigt ----
  await klik('e4'); await page.waitForTimeout(1000);
  const BRIK_FELTER = { konge: 'e3', dronning: 'd4', taarn: 'a1', loeber: 'c1', springer: 'b1', bonde: 'e2' };
  for (const fra of Object.values(BRIK_FELTER)) await spilFoersteLovligeTraek(fra);
  await klik('d4'); await klik('b5'); await page.waitForTimeout(1000); // slag
  await klik('e1'); await klik('e8'); await page.waitForTimeout(1000); // skak/mat
  await klik('e1'); await klik('g1'); await page.waitForTimeout(1000); // rokade
  await klik('e5'); await klik('d6'); await page.waitForTimeout(1000); // en passant
  s = await laes();
  console.log(`  Grundtrin klaret, står nu ved "${s.titel}" (${s.taeller}).`);
  await page.screenshot({ path: path.join(udMappe, 'desktop-02-efter-grundtrin.png') });

  // ---- Mønstre: spring til principperne med "Spring dette trin over" hvis de er gåde-trin ----
  for (let i = 0; i < 6; i++) {
    s = await laes();
    if (/^Princip/.test(s.titel)) break;
    await klik0('#knap-laer-spring-over');
  }
  s = await laes();
  console.log(`  Mønstre sprunget over (kritik bruger ikke gådebanken), står ved "${s.titel}".`);
  await page.screenshot({ path: path.join(udMappe, 'desktop-03-princip.png') });

  // ---- De fem principper: dårligt træk, se rul-tilbage, så godt træk ----
  const PRINCIPPER = [
    { titel: 'Princip: centrum', daarligt: ['a2', 'a3'], godt: ['e2', 'e4'] },
    { titel: 'Princip: udvikling', daarligt: ['g1', 'h3'], godt: ['g1', 'f3'] },
    { titel: 'Princip: kongens sikkerhed', daarligt: ['g2', 'g4'], godt: ['e1', 'g1'] },
    { titel: 'Princip: ikke samme brik to gange', daarligt: ['f3', 'g5'], godt: ['f1', 'c4'] },
    { titel: 'Princip: tårne på åbne linjer', daarligt: ['a1', 'b1'], godt: ['a1', 'c1'] },
  ];
  for (const p of PRINCIPPER) {
    s = await laes();
    if (s.titel !== p.titel) { console.log(`  ! forventede "${p.titel}", var ved "${s.titel}" — spring over.`); await klik0('#knap-laer-spring-over'); continue; }
    await klik(p.daarligt[0]); await klik(p.daarligt[1]); await page.waitForTimeout(250);
    const beskedDaarlig = (await laes()).besked;
    if (p === PRINCIPPER[0]) await page.screenshot({ path: path.join(udMappe, 'desktop-04-princip-daarligt-traek.png') });
    console.log(`  ${p.titel}: dårligt træk -> "${beskedDaarlig}"`);
    await page.waitForTimeout(1300);
    await klik(p.godt[0]); await klik(p.godt[1]); await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(udMappe, 'desktop-05-aabninger-start.png') });

  // ---- Åbninger: FORKERT træk først (se beskeden), så den rigtige linje ----
  const AABNINGER = {
    'Åbning: Italiensk': ['e2e4', 'g1f3', 'f1c4'],
    'Åbning: Spansk': ['e2e4', 'g1f3', 'f1b5'],
    'Åbning: Dronninggambit': ['d2d4', 'c2c4', 'b1c3'],
    'Åbning: Siciliansk': ['e2e4', 'g1f3', 'd2d4'],
  };
  let foersteAabning = true;
  for (const [titel, traek] of Object.entries(AABNINGER)) {
    s = await laes();
    if (s.titel !== titel) { console.log(`  ! forventede "${titel}", var ved "${s.titel}"`); continue; }
    if (foersteAabning) {
      // Bevidst FORKERT første træk (lovligt, men ikke linjens) - ordrens "spil et forkert træk og se beskeden".
      const fenFoer = (await laes()).fen;
      await klik('d2'); await klik('d4'); // afviger fra e4 i Italiensk
      await page.waitForTimeout(300);
      const efterForkert = await laes();
      noter('info', 'Forkert træk i åbning (Italiensk, d4 i stedet for e4)', `besked: "${efterForkert.besked}"`, 'src/laerforloeb.js');
      await page.screenshot({ path: path.join(udMappe, 'desktop-06-aabning-forkert-traek.png') });
      await page.waitForTimeout(1300);
      const efterRul = await laes();
      if (efterRul.fen !== fenFoer) noter('alvor-1', 'Forkert åbningstræk ruller ikke tilbage', `fen før "${fenFoer}" != fen efter "${efterRul.fen}"`, 'src/laerforloeb.js');
      else console.log('  Forkert træk rullede korrekt tilbage.');
      foersteAabning = false;
    }
    let fen = (await laes()).fen;
    for (const uci of traek) {
      await klik(uci.slice(0, 2)); await klik(uci.slice(2, 4));
      await page.waitForFunction((f) => document.querySelector('#fen-tekst').value !== f, fen, { timeout: 6000 });
      fen = (await laes()).fen;
      await page.waitForFunction((f) => document.querySelector('#fen-tekst').value !== f, fen, { timeout: 6000 });
      fen = (await laes()).fen;
    }
    await page.waitForFunction((t) => document.querySelector('#laer-titel').textContent !== t, titel, { timeout: 6000 });
    console.log(`  ${titel} gennemspillet.`);
  }
  await page.screenshot({ path: path.join(udMappe, 'desktop-07-slutspil-start.png') });

  // ---- De fire slutspil: demo, så ægte duel til mat/mål ----
  async function ventPaaDemoFaerdig(maks) {
    await page.waitForFunction(() => /Din tur/.test(document.querySelector('#laer-besked').textContent), null, { timeout: maks });
  }
  async function spilSlutspilTilMaal(titel, vaelger, maksTraek) {
    s = await laes();
    if (s.titel !== titel) { console.log(`  ! forventede "${titel}", var ved "${s.titel}"`); return; }
    await ventPaaDemoFaerdig(20000);
    await page.screenshot({ path: path.join(udMappe, `desktop-slutspil-${titel.replace(/[^a-zA-Zæøå]+/g, '-')}-demo-slut.png`) });
    const besoegt = new Set();
    for (let i = 0; i < maksTraek; i++) {
      s = await laes();
      if (s.titel !== titel) break;
      const traek = vaelger(s.fen, besoegt);
      if (!traek) { noter('alvor-1', `${titel}: intet lovligt træk fundet`, `fen ${s.fen}`, 'src/modstander.js'); return; }
      const cEfter = new Chess(s.fen); cEfter.move({ from: traek.from, to: traek.to, promotion: traek.promotion });
      besoegt.add(positionNoegle(cEfter));
      await klik(traek.from); await klik(traek.to);
      if (traek.promotion === 'q') { await page.waitForTimeout(150); await page.click('#forvandling-valg button[aria-label="Dronning"]'); await page.waitForTimeout(200); }
      await page.waitForFunction((t) => { const fen = document.querySelector('#fen-tekst').value; const nu = document.querySelector('#laer-titel').textContent; return nu !== t || / w /.test(fen); }, titel, { timeout: 10000 });
      s = await laes();
      if (s.titel !== titel) break;
    }
    s = await laes();
    if (s.titel === titel) noter('alvor-1', `${titel}: nåede ikke mål/mat inden for ${maksTraek} forsøgstræk`, '', 'src/laerforloeb.js');
    else console.log(`  ${titel}: bestået.`);
  }
  await spilSlutspilTilMaal('Slutspil: dronning mod konge', vaelgHvidtTraek, 40);
  await spilSlutspilTilMaal('Slutspil: tårn mod konge', vaelgHvidtTraek, 60);
  await spilSlutspilTilMaal('Slutspil: bondeslutspil', vaelgHvidtTraekBonde, 20);
  await spilSlutspilTilMaal('Slutspil: konge i centrum', vaelgHvidtTraekBonde, 20);
  s = await laes();
  if (s.faerdigSkjult !== false) noter('alvor-1', 'Rejsen (27/27) blev ikke markeret gennemført for "Jeg er ny"', '', 'src/laerforloeb.js');
  else console.log('  Hele rejsen (27/27) gennemført for "Jeg er ny".');
  await page.screenshot({ path: path.join(udMappe, 'desktop-08-laer-skak-faerdig.png') });

  // ---- Niveau "Jeg kan reglerne" / "Jeg spiller allerede": landing + skip til enden ----
  await klik0('#knap-laer-skift-niveau');
  await klik0('.segment[data-segment="laer-niveau"] .segment-knap[data-value="reglerne"]');
  s = await laes();
  if (s.titel !== 'Princip: centrum') noter('alvor-1', '"Jeg kan reglerne" lander forkert', `forventede principperne, fik "${s.titel}"`, 'src/laerforloeb.js');
  else console.log('  "Jeg kan reglerne" lander korrekt ved principperne.');
  await page.screenshot({ path: path.join(udMappe, 'desktop-09-niveau-reglerne.png') });

  await klik0('#knap-laer-skift-niveau');
  await klik0('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]');
  s = await laes();
  if (s.titel !== 'Åbning: Italiensk') noter('alvor-1', '"Jeg spiller allerede" lander forkert', `forventede åbningerne, fik "${s.titel}"`, 'src/laerforloeb.js');
  else console.log('  "Jeg spiller allerede" lander korrekt ved åbningerne.');
  await page.screenshot({ path: path.join(udMappe, 'desktop-10-niveau-spiller.png') });

  // ---- Opstil + tegneværktøjslinjen (296), mus ----
  console.log('\n== SKAK: Opstil + tegn (1280x800, mus) ==');
  await klik0('#fane-opstil');
  await page.screenshot({ path: path.join(udMappe, 'desktop-11-opstil.png') });
  const vaerktoejKnap = await maalKnap(page, '.vaerktoej');
  if (vaerktoejKnap) console.log(`  tegn-værktøjsknap: ${vaerktoejKnap.bredde}x${vaerktoejKnap.hoejde}px, radius ${vaerktoejKnap.radius}, skygge ${vaerktoejKnap.skygge === 'none' ? 'ingen' : 'ja'}`);
  if (vaerktoejKnap && (vaerktoejKnap.bredde < 44 || vaerktoejKnap.hoejde < 44)) noter('alvor-2', 'Tegn-værktøjsknap under 44px', `${vaerktoejKnap.bredde}x${vaerktoejKnap.hoejde}px`, 'src/... (tegn-toolbar CSS)');

  await page.click(pal('w', 'q'));
  await page.click(felt('d4'));
  await page.click('.vaerktoej[data-vaerktoej="pil"]');
  const traekPil = async (fra, til) => {
    const a = await page.locator(felt(fra)).boundingBox();
    const b = await page.locator(felt(til)).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(80);
  };
  await traekPil('d4', 'f6');
  await page.click('.farve-knap[data-farve="roed"]');
  await page.click('.vaerktoej[data-vaerktoej="ring"]');
  await page.click(felt('c5'));
  await page.waitForTimeout(100);
  let opstilState = await page.evaluate(() => ({ piler: document.querySelectorAll('#tegne-lag line').length, ringe: document.querySelectorAll('#tegne-lag circle').length }));
  console.log(`  Tegnet: ${opstilState.piler} pil(e), ${opstilState.ringe} ring(e).`);
  await page.screenshot({ path: path.join(udMappe, 'desktop-12-opstil-tegning.png') });

  await klik0('#fane-spil');
  opstilState = await page.evaluate(() => ({ piler: document.querySelectorAll('#tegne-lag line').length, ringe: document.querySelectorAll('#tegne-lag circle').length }));
  if (opstilState.piler === 0 && opstilState.ringe === 0) noter('alvor-1', 'Tegningen forsvinder ved skift til Spil', '', 'src/tegn.js');
  else console.log('  Tegningen blev liggende ved skift til Spil.');
  await page.screenshot({ path: path.join(udMappe, 'desktop-13-spil-med-tegning.png') });

  await klik0('#fane-opstil');
  await page.screenshot({ path: path.join(udMappe, 'desktop-14-opstil-igen.png') });

  if (fejl.length) noter('alvor-1', 'Konsol-/sidefejl under desktop-gennemløbet', fejl.join(' | '), '');
  else console.log('  Ingen konsol-/sidefejl gennem hele desktop-gennemløbet.');
  await page.close();
}

async function koerMobil(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(`console.error: ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#braet .felt');

  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const midt = async (sel) => { await page.locator(sel).scrollIntoViewIfNeeded(); const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const tryk = async (sel) => { const p = await midt(sel); await touch('touchStart', p.x, p.y); await touch('touchEnd'); await page.waitForTimeout(80); };
  const trak = async (fraSel, tilSel) => {
    const a = await midt(fraSel), b = await midt(tilSel);
    await touch('touchStart', a.x, a.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
    await touch('touchEnd');
    await page.waitForTimeout(100);
  };

  console.log('\n== SKAK: 390x844, touch ==');
  await tryk('#fane-laer');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(udMappe, 'mobil-01-niveauvalg.png') });
  const niveauKnap390 = await maalKnap(page, '.segment[data-segment="laer-niveau"] .segment-knap');
  if (niveauKnap390 && (niveauKnap390.hoejde < 44)) noter('alvor-2', 'Niveau-knap under 44px på 390px', `${niveauKnap390.bredde}x${niveauKnap390.hoejde}px`, '');
  const braetBund = await page.evaluate(() => Math.round(document.querySelector('#braet').getBoundingClientRect().bottom));
  if (braetBund > 844) noter('alvor-2', 'Brættet kræver scroll på 390x844 i "Lær skak"', `bræt slutter ved y=${braetBund}, vindue er 844px`, '');

  await tryk('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(udMappe, 'mobil-02-aabning-italiensk.png') });

  // Forkert træk med FINGER-TRÆK (drag, ikke tryk-tryk) — se beskeden.
  const fenFoerTouch = (await page.evaluate(() => document.querySelector('#fen-tekst').value));
  await trak(felt('d2'), felt('d4'));
  await page.waitForTimeout(1500);
  const beskedTouch = await page.evaluate(() => document.querySelector('#laer-besked').textContent);
  const fenEfterTouch = await page.evaluate(() => document.querySelector('#fen-tekst').value);
  await page.screenshot({ path: path.join(udMappe, 'mobil-03-forkert-traek-touch.png') });
  if (fenEfterTouch !== fenFoerTouch && beskedTouch === '') {
    noter('alvor-1', 'Forkert træk med finger-TRÆK (drag) i "Lær skak" bliver aldrig afvist eller forklaret', `d2-d4 i Åbning: Italiensk, spillet med et enkelt touchStart->touchMove->touchEnd-træk: trækket blev stående permanent (fen "${fenEfterTouch.split(' ')[0]}"), ingen "Lovligt, men ikke det vi øver"-besked, ingen rul-tilbage. Samme finger-træk (drag) på et PRINCIP-trin (a2-a3, "Princip: centrum") giver samme resultat: intet sker, ingen forklaring, trinnet fryser. Samme move med TRYK-TRYK (to separate finger-tryk, ingen drag) virker korrekt og viser beskeden. Fejlen rammer altså kun den ene finger-bevægelse (træk/drag) som er den mest naturlige på en touch-tavle - klik-klik virker.`, 'src/laerforloeb.js (eller den delte klik/træk-håndtering fra 307)');
    console.log(`  ALVORLIGT: touch-DRAG af et forkert træk blev aldrig afvist (fen ${fenEfterTouch.split(' ')[0]}, besked tom). Tryk-tryk virker; kun drag fejler.`);
  } else {
    console.log(`  Touch-drag: forkert åbningstræk -> "${beskedTouch}"`);
  }

  // Ryd op efter drag-fejlen (permanent forkert træk) med en frisk start, og spil linjen med TRYK-TRYK i stedet.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#braet .felt');
  await tryk('#fane-laer');
  await tryk('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]');
  await page.waitForTimeout(200);
  // Vent på at FEN faktisk ændrer sig (eget træk + sorts auto-svar), ikke en fast pause -
  // ellers rammer næste tryk midt i sort-demoens animation og bliver væk (set under udvikling).
  const ventFenAendrer = async (forrigeFen, timeoutMs = 6000) => {
    await page.waitForFunction((f) => document.querySelector('#fen-tekst').value !== f, forrigeFen, { timeout: timeoutMs });
    return page.evaluate(() => document.querySelector('#fen-tekst').value);
  };
  const traekTryk = async (fra, til) => { await tryk(felt(fra)); await tryk(felt(til)); };
  let fenNu = await page.evaluate(() => document.querySelector('#fen-tekst').value);
  for (const [fra, til] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4']]) {
    await traekTryk(fra, til);
    fenNu = await ventFenAendrer(fenNu); // eget træk
    fenNu = await ventFenAendrer(fenNu); // sorts auto-svar
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(udMappe, 'mobil-04-italiensk-gennemspillet.png') });

  // ---- Opstil + tegn med touch ----
  console.log('\n== SKAK: Opstil + tegn (390x844, touch) ==');
  await tryk('#fane-opstil');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(udMappe, 'mobil-05-opstil.png') });
  const braetBundOpstil = await page.evaluate(() => Math.round(document.querySelector('#braet').getBoundingClientRect().bottom));
  if (braetBundOpstil > 844) noter('alvor-2', 'Brættet + palette kræver scroll på 390x844 i Opstil', `y=${braetBundOpstil}`, '');

  await tryk('.vaerktoej[data-vaerktoej="pil"]');
  await trak(felt('g1'), felt('f3'));
  await tryk('.farve-knap[data-farve="roed"]');
  await tryk('.vaerktoej[data-vaerktoej="ring"]');
  await tryk(felt('e4'));
  await page.waitForTimeout(100);
  const touchTegn = await page.evaluate(() => ({ piler: document.querySelectorAll('#tegne-lag line').length, ringe: document.querySelectorAll('#tegne-lag circle').length }));
  console.log(`  Touch-tegning: ${touchTegn.piler} pil(e), ${touchTegn.ringe} ring(e).`);
  await page.screenshot({ path: path.join(udMappe, 'mobil-06-opstil-tegning.png') });

  if (fejl.length) noter('alvor-1', 'Konsol-/sidefejl under mobil-gennemløbet (390x844)', fejl.join(' | '), '');
  else console.log('  Ingen konsol-/sidefejl gennem hele mobil-gennemløbet.');
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  await koerDesktop(browser);
  await koerMobil(browser);
  await browser.close();
  writeFileSync(path.join(udMappe, 'fund.json'), JSON.stringify(fund, null, 2));
  console.log(`\nSkak-kritik færdig. ${fund.length} fund logget (se outputs/kritik-skole/skak/fund.json). Skærmbilleder i outputs/kritik-skole/skak/.`);
}

await main();
