// ORDRE 343 - Bhishak som KRITIKER af skak (efter 335) og matematik (efter 329).
// Retter intet, committer intet i skak- eller matematik-repoet: kun laesning og
// headless koersel af skak.html og spil.html. Ingen elevdata.
//
// Brug: node scripts/kritik-skole-2.mjs   (npm run verify:kritik-skole-2)
// Udgang: outputs/kritik-skole-2/ (skaermbilleder, maalinger.json, fund.json).
// Exit-kode 1 hvis scriptet selv fejler (ikke hvis det finder fund - fund er dets job).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const skakUrl = pathToFileURL(path.join(SKAK_ROD, 'skak.html')).href;
const matUrl = pathToFileURL(path.join(MAT_ROD, 'spil.html')).href;
const ud = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-skole-2');
mkdirSync(ud, { recursive: true });

const fund = [];
const maalinger = {};
let stille = false; // "mobil-meta"-varianten er hypotetisk og logger ikke fund
function noter(alvor, blok, titel, note) {
  if (stille) return;
  fund.push({ alvor, blok, titel, note });
  console.log(`  [${alvor}] (${blok}) ${titel} - ${note}`);
}
const skaerm = (page, navn, opts = {}) => page.screenshot({ path: path.join(ud, navn), ...opts });

// ---------- faelles maalefunktioner (koeres i siden) ----------
const MAAL_KONTRAST = () => {
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bagGrund = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const ud = [];
  const set = new Set();
  const els = [...document.querySelectorAll('h1,h2,h3,p,button,.fane,.segment-knap,label,small,span,.hjaelp,.besked,.statuslinje')];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || !el.offsetParent) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bagGrund(el);
    const nøgle = `${el.tagName}.${el.className}|${cs.color}|${cs.fontSize}`;
    if (set.has(nøgle)) continue; set.add(nøgle);
    ud.push({ el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`, tekst: txt.slice(0, 30), px: parseFloat(cs.fontSize), vaegt: cs.fontWeight, kontrast: Math.round(ratio(fg, bg) * 100) / 100 });
  }
  return ud;
};

const MAAL_TRYK = (min) => {
  const ud = [];
  for (const el of document.querySelectorAll('button, .segment-knap, .fane, .felt, .palet-brik, .vaerktoej, a, input, select, summary')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !el.offsetParent) continue;
    if (r.width < min || r.height < min) ud.push({ el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]}`, b: Math.round(r.width), h: Math.round(r.height), tekst: (el.textContent || '').trim().slice(0, 20) });
  }
  return ud;
};

const MAAL_ANIM = () => {
  const ud = {};
  const saml = (navn, el) => { if (!el) return; const cs = getComputedStyle(el); ud[navn] = { anim: cs.animationName, animVarighed: cs.animationDuration, overgang: cs.transitionDuration }; };
  saml('statuslinje-tekst', document.querySelector('.status-tekst'));
  saml('brik', document.querySelector('.brik-svg'));
  saml('felt', document.querySelector('#braet .felt'));
  saml('knap', document.querySelector('.segment-knap'));
  return ud;
};

async function konsolFejl(page, liste) {
  page.on('pageerror', (e) => liste.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') liste.push(`console.${m.type()}: ${m.text()}`); });
  page.on('requestfailed', (r) => liste.push(`requestfailed: ${r.url().slice(0, 80)}`));
}

// ---------- SKAK ----------
async function skakSession(browser, mobil, medMeta = false) {
  const tag = mobil ? (medMeta ? 'mobil-meta' : 'mobil') : 'tavle';
  stille = medMeta;
  const ctx = await browser.newContext(mobil
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const fejl = [];
  await konsolFejl(page, fejl);
  if (medMeta) await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1'; document.head.appendChild(m); }); });
  await page.goto(skakUrl);
  await page.waitForSelector('#braet .felt');
  await page.waitForTimeout(500);
  const cdp = mobil ? await ctx.newCDPSession(page) : null;

  const felt = (f) => `#braet .felt[data-square="${f}"]`;
  const midt = async (sel) => { await page.locator(sel).scrollIntoViewIfNeeded(); const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tryk = async (sel) => {
    if (!mobil) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.click(sel); await page.waitForTimeout(80); return; }
    // Paa felter bruges ægte touch (CDP, som 296's roegtest); paa faner/knapper et musetryk, fordi CDP-touch rammer forkert paa en side der er pinch-skaleret (ingen viewport-meta).
    if (!/#braet/.test(sel)) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.locator(sel).click(); await page.waitForTimeout(100); return; }
    const p = await midt(sel); await touch('touchStart', p.x, p.y); await touch('touchEnd'); await page.waitForTimeout(100);
  };
  const traek = async (fra, til) => {
    const a = await midt(fra), b = await midt(til);
    if (!mobil) {
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 10 }); await page.mouse.up();
    } else {
      await touch('touchStart', a.x, a.y);
      for (let i = 1; i <= 10; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
      await touch('touchEnd');
    }
    await page.waitForTimeout(120);
  };
  const laes = () => page.evaluate(() => ({
    fen: document.querySelector('#fen-tekst').value, titel: document.querySelector('#laer-titel').textContent,
    taeller: document.querySelector('#laer-trin-taeller').textContent, besked: document.querySelector('#laer-besked').textContent,
    tekst: document.querySelector('#laer-tekst')?.textContent ?? '', faerdig: !document.querySelector('#laer-faerdig').hidden,
    niveauValg: !document.querySelector('#laer-niveau-valg').hidden,
  }));
  const valgNiveau = async (v) => { await tryk(`.segment[data-segment="laer-niveau"] .segment-knap[data-value="${v}"]`); await page.waitForTimeout(300); };
  const vent = async (fen, ms = 6000) => { await page.waitForFunction((f) => document.querySelector('#fen-tekst').value !== f, fen, { timeout: ms }).catch(() => {}); return (await laes()).fen; };
  const nulstil = async () => { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#braet .felt'); await page.waitForTimeout(300); };

  // Forsiden
  console.log(`\n== SKAK ${tag} ==`);
  await skaerm(page, `skak-${tag}-01-forside.png`);
  const start = await page.evaluate(() => ({ aktivFane: document.querySelector('.fane[aria-selected="true"], .fane.aktiv')?.id ?? null, titel: document.title, braet: Math.round(document.querySelector('#braet').getBoundingClientRect().width) }));
  start.layoutBredde = await page.evaluate(() => document.documentElement.clientWidth);
  start.harViewportMeta = await page.evaluate(() => !!document.querySelector('meta[name=viewport]'));
  start.mindsteSkriftPx = await page.evaluate(() => Math.min(...[...document.querySelectorAll('p,button,summary,span,label')].filter((e) => e.offsetParent && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))));
  maalinger[`skak-${tag}-start`] = start;
  console.log(`  layoutbredde ${start.layoutBredde}px, viewport-meta ${start.harViewportMeta}, mindste skrift ${start.mindsteSkriftPx}px`);
  if (mobil && !medMeta && start.layoutBredde > 500) noter('alvor-1', 'skak', 'Ingen viewport-meta: en telefon (390 bred) tegner siden som 980 px bred og skrumper den', `layoutbredde ${start.layoutBredde}px; skrift skaleres til ca. ${Math.round(start.mindsteSkriftPx * 390 / start.layoutBredde * 10) / 10}px; @media (max-width: 700px) rammer aldrig`);
  maalinger[`skak-${tag}-kontrast`] = await page.evaluate(MAAL_KONTRAST);
  maalinger[`skak-${tag}-animationer`] = await page.evaluate(MAAL_ANIM);
  const smaa = await page.evaluate(MAAL_TRYK, 44);
  maalinger[`skak-${tag}-under44`] = smaa;
  if (mobil && smaa.length) noter('alvor-2', 'skak', 'Trykflader under 44px paa 390px (forside)', JSON.stringify(smaa.slice(0, 6)));

  // ---- Laer skak: tre niveauer x to lektioner x (traek + tryk) ----
  await tryk('#fane-laer');
  await page.waitForTimeout(200);
  await skaerm(page, `skak-${tag}-02-laer-niveauvalg.png`);

  // 1) "Jeg er ny": tryk-lektion (bonde e2-e4), drag-lektion efter reset
  await valgNiveau('ny');
  let s = await laes();
  console.log(`  ny: "${s.titel}" ${s.taeller}`);
  const laerY = await page.evaluate(() => ({ titelTop: Math.round(document.querySelector('#laer-titel').getBoundingClientRect().top + scrollY), vindue: innerHeight }));
  maalinger[`skak-${tag}-laer-titel-y`] = laerY;
  if (mobil && laerY.titelTop > laerY.vindue) {
    if (medMeta) fund.push({ alvor: 'alvor-2', blok: 'skak', titel: 'Med viewport-meta ligger lektionens tekst under folden paa 390x844', note: `overskriften staar ved y=${laerY.titelTop} i et ${laerY.vindue} px vindue: eleven ser braettet men ikke opgaven uden at scrolle (hypotetisk variant med meta indsat)` });
    else noter('alvor-2', 'skak', 'Lektionens tekst ligger under folden paa telefon', `y=${laerY.titelTop} i et ${laerY.vindue} px vindue`);
  }
  await skaerm(page, `skak-${tag}-03-ny-lektion1.png`);
  await tryk(felt('e2')); await tryk(felt('e4'));
  await page.waitForTimeout(1000);
  const s2 = await laes();
  console.log(`  ny lektion 1 (tryk): ${s.taeller} -> ${s2.taeller}, "${s2.titel}"`);
  if (s2.taeller === s.taeller) noter('alvor-1', 'skak', `"Jeg er ny", lektion 1 gik ikke videre med tryk (${tag})`, `staar stadig ved ${s.taeller}`);
  await skaerm(page, `skak-${tag}-04-ny-lektion2.png`);
  // nulstil; lektion 1 er et enkelt tryk paa e4, lektion 2 (kongen, e3) tages med DRAG
  await nulstil(); await tryk('#fane-laer'); await valgNiveau('ny');
  await tryk(felt('e4')); await page.waitForTimeout(1000);
  const foerDrag = await laes();
  await traek(felt('e3'), felt('e4'));
  await page.waitForTimeout(1000);
  const efterDrag = await laes();
  console.log(`  ny lektion 2 (traek): ${foerDrag.taeller} "${foerDrag.titel}" -> ${efterDrag.taeller}`);
  if (efterDrag.taeller === foerDrag.taeller) noter('alvor-1', 'skak', `"Jeg er ny", lektion 2 (kongen): et TRAEK (drag) gaar ikke videre (${tag})`, `fen ${efterDrag.fen.split(' ')[0]}`);

  // 2) "Jeg kan reglerne": princip centrum - forkert traek (drag) skal afvises, rigtigt (tryk) godtages
  await nulstil(); await tryk('#fane-laer'); await valgNiveau('reglerne');
  s = await laes();
  console.log(`  reglerne: "${s.titel}" ${s.taeller}`);
  await skaerm(page, `skak-${tag}-05-reglerne-princip.png`);
  const fenR = s.fen;
  await traek(felt('a2'), felt('a3'));
  await page.waitForTimeout(400);
  const forkR = await laes();
  await skaerm(page, `skak-${tag}-06-reglerne-forkert-drag.png`);
  console.log(`  reglerne forkert drag a2-a3 -> besked "${forkR.besked}"`);
  if (!forkR.besked && forkR.fen !== fenR) noter('alvor-1', 'skak', `Forkert traek med DRAG afvises ikke i "Jeg kan reglerne" (${tag})`, 'traekket bliver staaende uden besked (samme fejl som 312-fundet, ikke lukket)');
  await page.waitForTimeout(1400);
  const rulR = await laes();
  if (rulR.fen !== fenR && forkR.fen !== fenR) noter('alvor-1', 'skak', `Forkert traek ruller ikke tilbage (${tag})`, `fen efter ${rulR.fen.split(' ')[0]}`);
  await tryk(felt('e2')); await tryk(felt('e4'));
  await page.waitForTimeout(1000);
  const rigtR = await laes();
  console.log(`  reglerne rigtigt (tryk) e2-e4 -> "${rigtR.titel}" ${rigtR.taeller}`);
  if (rigtR.taeller === s.taeller) noter('alvor-1', 'skak', `Rigtigt princip-traek (tryk) godtages ikke (${tag})`, s.titel);

  // 3) "Jeg spiller allerede": italiensk - forkert TRYK-traek, derefter rigtig linje med drag
  await nulstil(); await tryk('#fane-laer'); await valgNiveau('spiller');
  s = await laes();
  console.log(`  spiller: "${s.titel}" ${s.taeller}`);
  await skaerm(page, `skak-${tag}-07-spiller-aabning.png`);
  await tryk(felt('d2')); await tryk(felt('d4'));
  await page.waitForTimeout(300);
  const forkA = await laes();
  await skaerm(page, `skak-${tag}-08-spiller-forkert-tryk.png`);
  console.log(`  spiller forkert tryk d2-d4 -> "${forkA.besked}"`);
  if (!forkA.besked) noter('alvor-1', 'skak', `Forkert traek (tryk) i aabning giver ingen besked (${tag})`, '');
  await page.waitForTimeout(1500);
  // forkert med DRAG
  await traek(felt('d2'), felt('d4'));
  await page.waitForTimeout(300);
  const forkD = await laes();
  console.log(`  spiller forkert drag d2-d4 -> "${forkD.besked}"`);
  if (!forkD.besked && forkD.fen.split(' ')[0] !== s.fen.split(' ')[0]) noter('alvor-1', 'skak', `Forkert traek med DRAG i aabning afvises ikke (${tag})`, 'traekket staar; besked tom (312-fundet er ikke lukket)');
  await page.waitForTimeout(1500);
  await nulstil(); await tryk('#fane-laer'); await valgNiveau('spiller');
  let fen = (await laes()).fen;
  for (const [fra, til] of [['e2', 'e4'], ['g1', 'f3']]) {
    await traek(felt(fra), felt(til));
    fen = await vent(fen); fen = await vent(fen);
  }
  await skaerm(page, `skak-${tag}-09-spiller-efter-to-traek.png`);
  const efterLinje = await laes();
  console.log(`  spiller drag-linje e4, Sf3: fen ${efterLinje.fen.split(' ')[0]}, "${efterLinje.taeller}"`);

  // ---- Gaade ----
  await tryk('#fane-gaader');
  await page.waitForSelector('#knap-gaade-hint', { state: 'visible', timeout: 10000 }).catch(() => noter('alvor-1', 'skak', `Gaade-fanen viser ikke en gaade inden for 10 s (${tag})`, ''));
  await page.waitForTimeout(500);
  await skaerm(page, `skak-${tag}-10-gaade.png`);
  const gaade = await page.evaluate(() => ({ titel: document.querySelector('#gaade-titel')?.textContent ?? '', indlaeser: document.querySelector('#gaade-indlaeser')?.textContent ?? '' , hintKnap: !!document.querySelector('#knap-gaade-hint') }));
  console.log(`  gaade: "${gaade.titel}" ${gaade.indlaeser}`);
  if (await page.locator('#knap-gaade-hint').isVisible()) await tryk('#knap-gaade-hint');
  await page.waitForTimeout(400);
  await skaerm(page, `skak-${tag}-11-gaade-hint.png`);
  // et bevidst forkert forsoeg: findes en lovlig fra-brik? Vi proever d2-d4-lignende via foerste hvide bonde.
  const gaadeFen = await page.evaluate(() => document.querySelector('#fen-tekst').value);
  maalinger[`skak-${tag}-gaade-fen`] = gaadeFen.split(' ').slice(0, 2).join(' ');

  // ---- Parti mod motoren ----
  await tryk('#fane-spil');
  await tryk('.segment[data-segment="spil-modus"] .segment-knap[data-value="computer"]');
  await page.waitForTimeout(300);
  await tryk('#knap-spil-forfra');
  if (await page.locator('#knap-spil-forfra-bekraeft').isVisible().catch(() => false)) await tryk('#knap-spil-forfra-bekraeft');
  await page.waitForTimeout(300);
  await skaerm(page, `skak-${tag}-12-spil-opsaetning.png`);
  const fenSpil0 = await page.evaluate(() => document.querySelector('#fen-tekst').value);
  const t0 = Date.now();
  await tryk(felt('e2')); await tryk(felt('e4'));
  await page.waitForFunction((f) => document.querySelector('#fen-tekst').value !== f && / w /.test(document.querySelector('#fen-tekst').value), fenSpil0, { timeout: 15000 }).catch(() => {});
  const motorSvarMs = Date.now() - t0;
  await page.waitForTimeout(700);
  await skaerm(page, `skak-${tag}-13-spil-efter-svar.png`);
  maalinger[`skak-${tag}-motor-svar-ms`] = motorSvarMs;
  console.log(`  motoren svarede efter ${motorSvarMs} ms`);
  const efterSpil = await page.evaluate(() => document.querySelector('#fen-tekst').value);
  if (efterSpil === fenSpil0) noter('alvor-1', 'skak', `Motoren svarer ikke i partiet (${tag})`, 'fen uaendret efter 15 s');
  // et tryk-traek mere for at se landing/glid, og et drag
  const b2 = await page.evaluate(() => document.querySelector('#status')?.textContent ?? '');
  console.log(`  statuslinje: "${b2}"`);
  await traek(felt('g1'), felt('f3'));
  await page.waitForTimeout(2500);
  await skaerm(page, `skak-${tag}-14-spil-efter-drag.png`);

  // ---- Opstil + tegnelag ----
  await tryk('#fane-opstil');
  await page.waitForTimeout(200);
  await skaerm(page, `skak-${tag}-15-opstil.png`, { fullPage: mobil });
  await tryk('.palet-brik[data-farve="w"][data-type="q"]');
  await tryk(felt('d4'));
  await tryk('.vaerktoej[data-vaerktoej="pil"]');
  await traek(felt('d4'), felt('f6'));
  await tryk('.farve-knap[data-farve="roed"]');
  await tryk('.vaerktoej[data-vaerktoej="ring"]');
  await tryk(felt('c5'));
  await page.waitForTimeout(150);
  const tegn = await page.evaluate(() => ({ piler: document.querySelectorAll('#tegne-lag line').length, ringe: document.querySelectorAll('#tegne-lag circle').length }));
  console.log(`  tegning: ${tegn.piler} pil, ${tegn.ringe} ring`);
  if (tegn.piler < 1 || tegn.ringe < 1) noter('alvor-1', 'skak', `Tegnelaget tegner ikke pil/ring (${tag})`, JSON.stringify(tegn));
  await skaerm(page, `skak-${tag}-16-opstil-tegning.png`, { fullPage: mobil });
  const opstilSmaa = await page.evaluate(MAAL_TRYK, 44);
  maalinger[`skak-${tag}-opstil-under44`] = opstilSmaa;
  if (mobil && opstilSmaa.length) noter('alvor-2', 'skak', 'Trykflader under 44px i Opstil paa 390px', JSON.stringify(opstilSmaa.slice(0, 6)));
  if (mobil) {
    const bund = await page.evaluate(() => Math.round(document.documentElement.scrollHeight));
    maalinger['skak-mobil-opstil-sidehoejde'] = bund;
  }

  maalinger[`skak-${tag}-konsol`] = fejl;
  if (fejl.length) noter('alvor-1', 'skak', `Konsol ikke tom (${tag})`, fejl.slice(0, 4).join(' | '));
  else console.log('  konsol tom');
  await ctx.close();
}

// ---------- MATEMATIK ----------
const STEDER = ['Møllen', 'Kirken', 'Grusgraven', 'Landsbygaden', 'Sporvognen'];
async function lavFigur(page) {
  await page.waitForSelector('#op-navn');
  await page.fill('#op-navn', 'Ravn');
  await page.locator('.opret-udseende').nth(1).click();
  await page.click('#op-start');
  await page.waitForSelector('.spil-figur');
}
async function aabnKlynge(page) {
  const k = page.locator('.sted-knap--klynge');
  if ((await k.count()) > 0 && (await k.getAttribute('aria-expanded')) === 'false') { await k.click(); await page.waitForTimeout(30); }
}
async function gaaTil(page, navn) {
  await aabnKlynge(page);
  await page.locator('.sted-knap').filter({ has: page.locator('.sted-navn', { hasText: new RegExp(`^${navn}$`) }) }).click();
  await page.waitForSelector('.sted-scene');
}
async function lukBanner(page) {
  if (await page.locator('.niveau-banner').isVisible().catch(() => false)) { await page.click('#niveau-banner-luk'); await page.waitForTimeout(30); }
}
const broek = (t) => { const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(t); return m ? [Number(m[1]), Number(m[2])] : null; };

// Loeser en opgave; registrerer broeker, uforkortede svar, og tekster.
async function loesOpgave(page, stat, skaermNavn) {
  await page.waitForSelector('.quest-opgave');
  const spoergsmaal = (await page.locator('.quest-opgave').innerText()).replace(/\s+/g, ' ').slice(0, 160);
  const valg = await page.$$eval('.quest-svar button', (b) => b.map((x) => x.textContent.trim()));
  const erBroek = valg.some((v) => broek(v)) || /\d\s*\/\s*\d|brøk|del af/i.test(spoergsmaal);
  if (erBroek) stat.broekOpgaver += 1;
  if (skaermNavn && erBroek && !stat.broekSkaerm) { stat.broekSkaerm = true; await skaerm(page, skaermNavn); }
  for (let i = 0; i < valg.length; i++) {
    if (await page.locator('#quest-videre').isVisible().catch(() => false)) break;
    await page.locator('.quest-svar button').nth(i).click();
    await page.waitForTimeout(15);
  }
  await page.waitForSelector('#quest-videre', { timeout: 5000 });
  const ros = (await page.locator('.quest-besked--korrekt').count()) ? await page.locator('.quest-besked--korrekt').innerText() : '';
  stat.opgaver += 1;
  if (/kan (også )?skrives/.test(ros)) { stat.uforkortet += 1; stat.uforkortetTekst = ros; }
  // "uforkortet rigtigt svar": to svarmuligheder med samme vaerdi
  const b = valg.map(broek).filter(Boolean);
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i][0] * b[j][1] === b[j][0] * b[i][1]) stat.ensVaerdi += 1;
  await page.click('#quest-videre');
  await page.waitForTimeout(15);
  await lukBanner(page);
  return spoergsmaal;
}
async function loesFlere(page, stat, antal, skaermNavn) {
  const ud = [];
  for (let i = 0; i < antal; i++) {
    if (!(await page.locator('.quest-opgave').isVisible().catch(() => false))) break;
    ud.push(await loesOpgave(page, stat, skaermNavn));
  }
  return ud;
}

async function matSession(browser, mobil) {
  const tag = mobil ? 'mobil' : 'desktop';
  const ctx = await browser.newContext({ viewport: mobil ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const fejl = [];
  await konsolFejl(page, fejl);
  const stat = { opgaver: 0, broekOpgaver: 0, uforkortet: 0, ensVaerdi: 0, broekSkaerm: false, uforkortetTekst: '' };
  console.log(`\n== MATEMATIK ${tag} ==`);
  await page.goto(matUrl);
  await lavFigur(page);
  await page.waitForTimeout(500);
  await skaerm(page, `mat-${tag}-01-kort.png`, { fullPage: true });

  // Kortet: geografi + trykflader + overlap + hoejde
  const kort = await page.evaluate(() => {
    const knapper = [...document.querySelectorAll('.sted-knap')].map((e) => { const r = e.getBoundingClientRect(); return { navn: e.querySelector('.sted-navn')?.textContent ?? '', x: r.x, y: r.y, b: r.width, h: r.height, laast: e.disabled || e.getAttribute('aria-disabled') === 'true' }; });
    const overlap = [];
    for (let i = 0; i < knapper.length; i++) for (let j = i + 1; j < knapper.length; j++) { const a = knapper[i], c = knapper[j]; if (a.x < c.x + c.b && c.x < a.x + a.b && a.y < c.y + c.h && c.y < a.y + a.h) overlap.push([a.navn, c.navn]); }
    const k = document.querySelector('.kort')?.getBoundingClientRect();
    const kl = document.querySelector('.sted-knap--klynge')?.getBoundingClientRect();
    return { knapper: knapper.map((k2) => ({ navn: k2.navn, b: Math.round(k2.b), h: Math.round(k2.h), laast: k2.laast })), overlap, kortH: k ? Math.round(k.height) : null, klyngeHoejreMarginPx: k && kl ? Math.round(k.right - kl.right) : null, kortB: k ? Math.round(k.width) : null, vindueH: innerHeight, skilt: document.querySelector('.kort-skilt')?.textContent ?? '' };
  });
  maalinger[`mat-${tag}-kort`] = kort;
  console.log(`  kort ${kort.kortB}x${kort.kortH}, vindue ${kort.vindueH}, knapper ${kort.knapper.length}, overlap ${kort.overlap.length}`);
  if (kort.klyngeHoejreMarginPx !== null && kort.klyngeHoejreMarginPx < 12) noter('alvor-3', 'matematik', `"Kirken og Landsbygaden"-skiltet ligger helt ud til kortkanten (${tag})`, `${kort.klyngeHoejreMarginPx}px fra kortets hoejre kant; teksten kan klippes`);
  const smaaKnapper = kort.knapper.filter((k) => k.b < 44 || k.h < 44);
  if (smaaKnapper.length) noter('alvor-2', 'matematik', `Sted-trykflader under 44px paa kortet (${tag})`, JSON.stringify(smaaKnapper));
  if (kort.overlap.length) noter('alvor-2', 'matematik', `Sted-knapper overlapper (${tag})`, JSON.stringify(kort.overlap));
  if (!mobil && kort.kortH > kort.vindueH) noter('alvor-2', 'matematik', 'Kortet er hoejere end 800px-vinduet paa desktop', `${kort.kortH}px, kraever scroll for at se hele kortet`);
  maalinger[`mat-${tag}-kontrast`] = await page.evaluate(MAAL_KONTRAST);

  // Rejse gennem tre steder (mobil: alle aabne, desktop: to), med bilag
  const antalSteder = mobil ? 3 : 2;
  let besoegt = 0;
  for (const navn of STEDER) {
    if (besoegt >= antalSteder) break;
    const aaben = await page.$$eval('.sted-knap:not(.sted-knap--klynge)', (els, n) => { const e = els.find((x) => x.querySelector('.sted-navn')?.textContent === n); return e ? !e.disabled : false; }, navn).catch(() => false);
    if (!aaben) { console.log(`  ${navn}: laast endnu`); continue; }
    await gaaTil(page, navn);
    await page.waitForTimeout(250);
    await skaerm(page, `mat-${tag}-02-sted-${besoegt + 1}-${navn}.png`, { fullPage: true });
    const tryk = await page.evaluate(MAAL_TRYK, 44);
    if (mobil && tryk.length) noter('alvor-2', 'matematik', `Trykflader under 44px i ${navn} (390px)`, JSON.stringify(tryk.slice(0, 5)));
    const spm = await loesFlere(page, stat, mobil ? 14 : 4, `mat-${tag}-03-broekopgave.png`);
    console.log(`  ${navn}: ${spm.length} opgaver, fx "${spm[0]?.slice(0, 80)}"`);
    if (spm.length === 0) noter('alvor-1', 'matematik', `${navn} viser ingen opgave`, '');
    await page.click('.sted-knap--tilbage, #sted-tilbage').catch(() => {});
    await page.waitForSelector('.kort').catch(() => {});
    besoegt += 1;
  }
  // Dyb jagt paa bregopgaver med uforkortet svar paa mobil: loes resten af de aabne steder
  if (mobil) {
    for (const navn of STEDER) {
      if (stat.uforkortet > 0 || stat.broekOpgaver >= 6) break;
      const aaben = await page.$$eval('.sted-knap:not(.sted-knap--klynge)', (els, n) => { const e = els.find((x) => x.querySelector('.sted-navn')?.textContent === n); return e ? !e.disabled : false; }, navn).catch(() => false);
      if (!aaben) continue;
      await gaaTil(page, navn);
      await loesFlere(page, stat, 60, `mat-${tag}-03-broekopgave.png`);
      await page.click('.sted-knap--tilbage, #sted-tilbage').catch(() => {});
      await page.waitForSelector('.kort').catch(() => {});
    }
  }
  maalinger[`mat-${tag}-opgaver`] = { ...stat };
  console.log(`  opgaver ${stat.opgaver}, broekopgaver ${stat.broekOpgaver}, uforkortet-hint ${stat.uforkortet}, ens-vaerdi-valg ${stat.ensVaerdi}`);

  // Udstyr + journal + "hvor langt er jeg naaet"
  await page.click('#journal-knap').catch(() => {});
  await page.waitForSelector('.journal-liste', { timeout: 3000 }).catch(() => {});
  await skaerm(page, `mat-${tag}-04-journal.png`, { fullPage: true });
  const jour = await page.evaluate(() => ({
    oversigt: document.querySelector('.journal-oversigt')?.textContent ?? null,
    udstyr: document.querySelector('.udstyr-liste')?.innerText.replace(/\n+/g, ' | ') ?? null,
    knapper: [...document.querySelectorAll('#app button')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 20), b: Math.round(r.width), h: Math.round(r.height) }; }),
    poster: document.querySelectorAll('.journal-liste > *').length,
  }));
  maalinger[`mat-${tag}-journal`] = jour;
  console.log(`  journal: "${jour.oversigt}", udstyr: ${jour.udstyr}, poster ${jour.poster}`);
  if (!jour.oversigt) noter('alvor-2', 'matematik', `Journalen viser ikke "hvor langt du er naaet" (${tag})`, '');
  const smaaJ = jour.knapper.filter((k) => k.h < 44 || k.b < 44);
  if (smaaJ.length) noter('alvor-2', 'matematik', `Journal-trykflader under 44px (${tag})`, JSON.stringify(smaaJ));
  if (!jour.udstyr) noter('alvor-2', 'matematik', `Ingen udstyrsliste i journalen efter ${stat.opgaver} opgaver (${tag})`, 'enten laast eller ikke vist - se skaermbillede');

  maalinger[`mat-${tag}-konsol`] = fejl;
  if (fejl.length) noter('alvor-1', 'matematik', `Konsol ikke tom (${tag})`, fejl.slice(0, 4).join(' | '));
  else console.log('  konsol tom');
  await ctx.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    await skakSession(browser, false);
    await skakSession(browser, true);
    await skakSession(browser, true, true);
    stille = false;
    await matSession(browser, true);
    await matSession(browser, false);
  } finally {
    await browser.close();
    writeFileSync(path.join(ud, 'fund.json'), JSON.stringify(fund, null, 2));
    writeFileSync(path.join(ud, 'maalinger.json'), JSON.stringify(maalinger, null, 2));
  }
  console.log(`\nKritik 343 faerdig. ${fund.length} fund. Se outputs/kritik-skole-2/.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
