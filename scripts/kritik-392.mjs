// ORDRE 392 - Bhishak som KRITIKER: den levende Moelle (matematik main efter 390) og den smukke
// skak (skak main efter 391) set som en elev paa telefonen, foer Marc bruger dem i klassen.
// Retter intet og committer intet i de to repoer: main traekkes ud med `git archive` til en
// midlertidig mappe, og kun den koeres headless (skabelon: scripts/kritik-379.mjs).
// Ingen elevdata: fremgangen ligger i en flygtig browserprofil, figuren hedder "Ravn".
//
// Brug: node scripts/kritik-392.mjs [--kun moellen|skak]   (npm run verify:kritik-392)
// Udgang: outputs/kritik-392/ (skaermbilleder + maalinger.json). Exit 1 kun hvis scriptet selv fejler.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const APP_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-app-wt2';
const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak';
const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const skakKraev = createRequire(path.join(SKAK_ROD, 'package.json'));
const { chromium } = skakKraev('playwright');
const kun = process.argv.includes('--kun') ? process.argv[process.argv.indexOf('--kun') + 1] : null;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik392-'));
function traek(rod, navn, rev) {
  const mappe = path.join(tmp, navn);
  mkdirSync(mappe, { recursive: true });
  execFileSync('git', ['-C', rod, 'archive', '--format=tar', '-o', path.join(tmp, `${navn}.tar`), rev]);
  execFileSync('tar', ['-xf', `${navn}.tar`, '-C', navn], { cwd: tmp });
  const hash = execFileSync('git', ['-C', rod, 'rev-parse', '--short', rev]).toString().trim();
  return { mappe, hash };
}
const ud = path.join(APP_ROD, 'outputs', 'kritik-392');
mkdirSync(ud, { recursive: true });
const maalFil = path.join(ud, 'maalinger.json');
const maal = existsSync(maalFil) ? JSON.parse(readFileSync(maalFil, 'utf8')) : {};
const gem = () => writeFileSync(maalFil, JSON.stringify(maal, null, 1));

// Taeller lyde: hver oscillator der startes (Moellen og skakken syntetiserer begge i Web Audio).
const LYD_SPION = () => {
  window.__lyde = 0;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return;
  const orig = A.prototype.createOscillator;
  A.prototype.createOscillator = function (...a) { const o = orig.apply(this, a); const s = o.start.bind(o); o.start = (...b) => { window.__lyde++; return s(...b); }; return o; };
};
// Uendelige animationer lige nu: navn, periode, og om de roerer opacity (det der kan ligne blink).
const ANIMATIONER = () => document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
  const t = a.effect?.getComputedTiming?.() ?? {};
  const kf = a.effect?.getKeyframes?.() ?? [];
  const op = kf.map((k) => k.opacity).filter((x) => x !== undefined).map(Number);
  return { navn: a.animationName ?? a.transitionProperty ?? '?', ms: Math.round(Number(t.duration) || 0), uendelig: t.iterations === Infinity,
    opacitetSpaend: op.length ? Math.round((Math.max(...op) - Math.min(...op)) * 100) / 100 : 0,
    maal: a.effect?.target ? (a.effect.target.getAttribute('class') ?? a.effect.target.tagName).toString().slice(0, 40) : '' };
});
function opsumAnim(liste) {
  const uendelige = liste.filter((a) => a.uendelig);
  const navne = {};
  for (const a of uendelige) navne[`${a.navn} ${a.ms}ms`] = (navne[`${a.navn} ${a.ms}ms`] ?? 0) + 1;
  const hurtigste = uendelige.reduce((m, a) => (a.ms && a.ms < m.ms ? a : m), { ms: Infinity });
  const blinkAgtige = uendelige.filter((a) => a.opacitetSpaend >= 0.3 && a.ms < 3000);
  return { koerende: liste.length, uendelige: uendelige.length, hurtigsteUendelige: hurtigste.ms === Infinity ? null : hurtigste, blinkAgtige: blinkAgtige.map((a) => `${a.navn} ${a.ms}ms op ${a.opacitetSpaend}`), navne };
}

// ---------- BLOK 1: MOELLEN SOM ELEV ----------

// Elevens regning (samme loeser som matematik/scripts/moellen-lever-390.mjs).
const gcd2 = (a, b) => (b ? gcd2(b, a % b) : Math.abs(a));
const R = (n, d = 1) => { const g = gcd2(n, d) || 1; return [n / g, d / g]; };
const ens = (x, y) => x && y && x[0] * y[1] === y[0] * x[1];
function laesTal(t) {
  t = t.replace(/\s*sæk\s*$/, '').trim();
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t); if (m) return R(Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3]));
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return R(Number(m[1]), Number(m[2]));
  m = /^(\d+)$/.exec(t); if (m) return R(Number(m[1]));
  return null;
}
const plus = (a, b) => R(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
function facit(tekst) {
  let m;
  if ((m = /delt (?:sin mark )?i (\d+) lige store (felter|stykker), og (\d+) er/.exec(tekst))) return R(+m[3], +m[1]);
  if ((m = /deler (\d+) sæk(?:ke)? korn ligeligt mellem (\d+) gårde/.exec(tekst))) return R(+m[1], +m[2]);
  if ((m = /malede mølleren (\d+)\/(\d+) sæk, om tirsdagen (\d+)\/(\d+) sæk/.exec(tekst))) return +m[1] > +m[3] ? R(+m[1], +m[2]) : R(+m[3], +m[4]);
  if ((m = /en sæk i (\d+) lige store dele, en anden dag i (\d+) lige store dele/.exec(tekst))) return R(1, Math.min(+m[1], +m[2]));
  if ((m = /størst: (\d+)\/(\d+) sæk eller (\d+)\/(\d+) sæk/.exec(tekst))) return R(+m[1], Math.min(+m[2], +m[4]));
  if ((m = /Hvilken brøk er lige så meget som (\d+)\/(\d+)/.exec(tekst))) return R(+m[1], +m[2]);
  if ((m = /skrevet (\d+)\/(\d+) sæk i regnebogen/.exec(tekst))) return R(+m[1], +m[2]);
  if ((m = /fylder (\d+)\/(\d+) sæk korn om morgenen og (\d+)\/(\d+) sæk/.exec(tekst))) return plus(R(+m[1], +m[2]), R(+m[3], +m[4]));
  return null;
}

async function moellen(browser) {
  const mat = traek(MAT_ROD, 'mat', 'main');
  const url = pathToFileURL(path.join(mat.mappe, 'spil.html')).href;
  const M = { matMain: mat.hash, forloeb: [], konsol: [] };
  const nyKontekst = async (reduced = 'no-preference') => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: reduced });
    await ctx.addInitScript(LYD_SPION);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => M.konsol.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') M.konsol.push(`console.error: ${m.text().slice(0, 160)}`); });
    return { ctx, page };
  };
  const start = async (page) => {
    await page.goto(url);
    await page.waitForSelector('#op-navn');
    await page.fill('#op-navn', 'Ravn');
    await page.click('#op-start');
    await page.waitForSelector('.spil-figur');
    await page.waitForTimeout(400);
  };
  const lukBanner = async (page) => { if (await page.locator('.niveau-banner').isVisible().catch(() => false)) { await page.click('#niveau-banner-luk'); await page.waitForTimeout(40); } };
  const laesBy = (page) => page.evaluate(() => {
    const v = document.querySelector('.by-vaagner');
    const r = v?.getBoundingClientRect();
    return {
      trin: Number(document.querySelector('.kort-liv')?.dataset.trin ?? -1),
      prikker: document.querySelectorAll('.by-prik--vaagen').length,
      indbyggere: document.querySelector('.by-indbyggere')?.textContent ?? '',
      naeste: document.querySelector('.by-naeste')?.textContent ?? '',
      lydKnap: document.querySelector('#by-lyd')?.textContent ?? '',
      vaagner: v?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      vaagnerISyne: r ? { top: Math.round(r.top), bund: Math.round(r.bottom), vindue: innerHeight, synlig: r.top < innerHeight && r.bottom > 0 } : null,
      ring: !!document.querySelector('.liv-ny-ring'),
      scrollY: Math.round(scrollY),
      sideHoejde: document.documentElement.scrollHeight,
    };
  });
  const laesQuest = (page) => page.evaluate(() => ({
    kaede: document.querySelector('.quest-kaede-tal')?.textContent ?? '', titel: document.querySelector('.quest-kort h3')?.textContent ?? '',
    replik: document.querySelector('.quest-replik')?.textContent ?? '',
    opgave: document.querySelector('.quest-opgave-tekst')?.textContent ?? '', valg: [...document.querySelectorAll('.quest-svar button')].map((b) => b.textContent.trim()),
    beskeder: [...document.querySelectorAll('.quest-besked')].map((e) => ({ art: e.className.replace('quest-besked ', ''), tekst: e.textContent.trim() })),
    videre: !!document.querySelector('#quest-videre'),
  }));
  const tryk = async (page, tekst) => { const k = page.locator('.quest-svar button').filter({ hasText: new RegExp(`^${tekst.replace(/[/]/g, '\\/')}$`) }).first(); await k.scrollIntoViewIfNeeded(); await k.tap(); };
  const billedeAfKort = async (page, navn) => {
    await page.locator('.by-bjaelke').scrollIntoViewIfNeeded();
    const k = await page.evaluate(() => { const a = document.querySelector('.by-bjaelke').getBoundingClientRect(); const b = document.querySelector('.kort').getBoundingClientRect(); return { x: Math.min(a.left, b.left), y: a.top + scrollY, w: Math.max(a.right, b.right) - Math.min(a.left, b.left), h: b.bottom - a.top }; });
    await page.screenshot({ path: path.join(ud, navn), fullPage: true, clip: { x: k.x, y: k.y, width: k.w, height: k.h } });
  };

  // 1. Hovedturen: trin 1-4, et bevidst forkert svar pr. forloeb (for at se hintet), resten rigtigt.
  {
    const { ctx, page } = await nyKontekst();
    await start(page);
    M.start = await laesBy(page);
    M.start.anim = opsumAnim(await page.evaluate(ANIMATIONER));
    await page.screenshot({ path: path.join(ud, 'moelle-00-start.png') });
    await billedeAfKort(page, 'moelle-00-kort-trin0.png');
    let dop = null;
    for (let k = 1; k <= 4; k++) {
      const F = { forloeb: k, opgaver: [], foer: await laesBy(page) };
      let fejlet = false;
      for (let i = 0; i < 20; i++) {
        const q = await laesQuest(page);
        if (!new RegExp(`Forløb ${k} af`).test(q.kaede)) break;
        const f = facit(q.opgave);
        const rigtig = q.valg.find((t) => ens(laesTal(t), f));
        const rec = { opgave: q.opgave, titel: q.titel, replik: q.replik, forsoeg: [] };
        if (!rigtig) { rec.ukendt = true; F.opgaver.push(rec); break; }
        if (!fejlet) {
          fejlet = true;
          const forkert = q.valg.find((t) => t !== rigtig);
          await tryk(page, forkert);
          await page.waitForTimeout(450);
          const e = await laesQuest(page);
          const b = e.beskeder.pop();
          rec.forsoeg.push({ svar: 'forkert', besked: b?.tekst ?? '', art: b?.art ?? '' });
          await page.screenshot({ path: path.join(ud, `moelle-${k}-a-hint.png`) });
        }
        const lydeFoer = await page.evaluate(() => window.__lyde);
        await tryk(page, rigtig);
        if (!dop) {
          await page.waitForTimeout(120);
          dop = await page.evaluate(() => ({ melkorn: document.querySelectorAll('.melkorn').length, flyver: document.querySelectorAll('.erfaring-flyver').length, dopBesked: !!document.querySelector('.quest-besked--dop'), nikker: !!document.querySelector('.sted-ikon--nikker') }));
          await page.screenshot({ path: path.join(ud, 'moelle-01-dop.png') });
          await page.waitForTimeout(900);
          dop.melkornEfter1s = await page.evaluate(() => document.querySelectorAll('.melkorn').length);
        } else await page.waitForTimeout(300);
        const e = await laesQuest(page);
        rec.forsoeg.push({ svar: 'rigtigt', besked: e.beskeder.at(-1)?.tekst ?? '', lyde: (await page.evaluate(() => window.__lyde)) - lydeFoer });
        F.opgaver.push(rec);
        F.vaagnerFoerVidere = F.vaagnerFoerVidere || !!(await laesBy(page)).vaagner;
        if (await page.locator('#quest-videre').isVisible().catch(() => false)) {
          await page.locator('#quest-videre').tap();
          const t1 = Date.now();
          await page.waitForTimeout(150);
          const by = await laesBy(page);
          if (by.vaagner && !F.vaagnerSomSet) {
            // Mestringen: "Byen vaagner" staar der nu. Ses det uden at eleven ruller?
            F.vaagnerSomSet = { ...by.vaagnerISyne, scrollY: by.scrollY, indbyggereStraks: by.vaagner.match(/Indbyggere: [^M]*/)?.[0] ?? '' };
            await page.screenshot({ path: path.join(ud, `moelle-${k}-b-mestret-som-set.png`) });
            await page.waitForTimeout(Math.max(0, 1300 - (Date.now() - t1)));
            F.indbyggereEfter1300ms = (await laesBy(page)).vaagner.match(/Indbyggere: [^M]*/)?.[0] ?? '';
            await page.locator('.by-vaagner').scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            await page.screenshot({ path: path.join(ud, `moelle-${k}-c-byen-vaagner.png`) });
          }
        }
        await lukBanner(page);
      }
      F.efter = await laesBy(page);
      if (await page.locator('#by-se-kortet').isVisible().catch(() => false)) {
        await page.locator('#by-se-kortet').tap();
        await page.waitForTimeout(900);
        F.efterSeKortet = await laesBy(page);
        await page.screenshot({ path: path.join(ud, `moelle-${k}-d-se-kortet.png`) });
      }
      await page.waitForTimeout(6000); // ringen (3 x 1,8 s) er faerdig: hvad bevaeger sig nu hele tiden?
      F.anim = opsumAnim(await page.evaluate(ANIMATIONER));
      await billedeAfKort(page, `moelle-${k}-e-kort-trin${k}.png`);
      M.forloeb.push(F);
      await page.evaluate(() => scrollTo(0, 0));
    }
    M.dop = dop;
    M.lydeMedLydFra = await page.evaluate(() => window.__lyde);
    // Cookie Clicker-proeven: 30 tryk paa kortet, tallet, prikkerne og det genopbyggede. Vokser noget?
    const foerKlik = await laesBy(page);
    await page.locator('.by-bjaelke').scrollIntoViewIfNeeded();
    const maalFlader = ['.by-indbyggere', '.by-prik--vaagen', '.kort-liv', '.kort'];
    let tryk30 = 0;
    for (let i = 0; i < 30; i++) {
      const sel = maalFlader[i % maalFlader.length];
      const el = page.locator(sel).first();
      const bb = await el.boundingBox().catch(() => null);
      if (!bb) continue;
      await page.touchscreen.tap(bb.x + bb.width * (0.2 + 0.6 * ((i * 7) % 10) / 10), bb.y + bb.height * (0.2 + 0.6 * ((i * 3) % 10) / 10)).catch(() => {});
      tryk30++;
      await page.waitForTimeout(30);
      if (!(await page.locator('.by-bjaelke').isVisible().catch(() => false))) { await page.goBack().catch(() => {}); }
    }
    const efterKlik = await laesBy(page);
    M.klikkerProeve = { tryk: tryk30, indbyggereFoer: foerKlik.indbyggere, indbyggereEfter: efterKlik.indbyggere, trinFoer: foerKlik.trin, trinEfter: efterKlik.trin };
    // Lyd: taend, et rigtigt svar, taeller toner.
    await page.evaluate(() => scrollTo(0, 0));
    const lydKnap = page.locator('#by-lyd');
    await lydKnap.scrollIntoViewIfNeeded();
    await lydKnap.tap();
    M.lydKnapEfterTryk = await lydKnap.textContent();
    const q = await laesQuest(page);
    const f = facit(q.opgave);
    const rigtig = q.valg.find((t) => ens(laesTal(t), f));
    const l0 = await page.evaluate(() => window.__lyde);
    if (rigtig) { await tryk(page, rigtig); await page.waitForTimeout(400); }
    M.lydeVedRigtigtMedLydTil = (await page.evaluate(() => window.__lyde)) - l0;
    await ctx.close();
  }

  // 2. Gaettemaskinen: en elev der trykker sig igennem (altid et forkert svar foerst). Vaagner byen?
  {
    const { ctx, page } = await nyKontekst();
    await start(page);
    const G = { opgaver: 0, beskeder: [] };
    for (let i = 0; i < 16; i++) {
      const q = await laesQuest(page);
      if (!/Forløb 1 af/.test(q.kaede) || !q.valg.length) break;
      const f = facit(q.opgave);
      const rigtig = q.valg.find((t) => ens(laesTal(t), f));
      const plan = [...q.valg.filter((t) => t !== rigtig), rigtig];
      for (const s of plan) { if (await page.locator('#quest-videre').isVisible().catch(() => false)) break; await tryk(page, s); await page.waitForTimeout(120); }
      G.opgaver++;
      const e = await laesQuest(page);
      G.beskeder.push(e.beskeder.map((b) => b.tekst).join(' | ').slice(0, 220));
      if (await page.locator('#quest-videre').isVisible().catch(() => false)) { await page.locator('#quest-videre').tap(); await page.waitForTimeout(120); }
      await lukBanner(page);
    }
    G.by = await laesBy(page);
    G.kaede = (await laesQuest(page)).kaede;
    M.gaettemaskine = G;
    await page.screenshot({ path: path.join(ud, 'moelle-90-gaettemaskine.png') });
    await ctx.close();
  }

  // 3. Roligt? Trin 8 sat direkte i spillets egen lokale tilstand: alt paa kortet paa een gang,
  // med og uden prefers-reduced-motion.
  for (const reduced of ['no-preference', 'reduce']) {
    const { ctx, page } = await nyKontekst(reduced);
    const tilstand = { figur: { navn: 'Ravn', udseendeId: 'teal', niveau: 3, erfaring: 80, hoved: 3, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: { moellen: Array.from({ length: 8 }, () => true) }, sidsteQuestId: null, hemmeligKlaret: false, udstyrDeaktiveret: [] };
    await page.goto(url);
    await page.evaluate((t) => localStorage.setItem('ganita:spil', JSON.stringify(t)), tilstand);
    await page.reload();
    await page.waitForSelector('.kort-liv');
    await page.waitForTimeout(1500);
    M[`trin8${reduced === 'reduce' ? 'Reduceret' : ''}`] = { by: await laesBy(page), anim: opsumAnim(await page.evaluate(ANIMATIONER)) };
    await billedeAfKort(page, `moelle-95-trin8${reduced === 'reduce' ? '-reduceret' : ''}.png`);
    await ctx.close();
  }
  maal.moellen = M;
  gem();
  const t = M.forloeb.map((f) => `${f.foer.trin}->${f.efter.trin} (${f.foer.indbyggere} -> ${f.efter.indbyggere})`).join(', ');
  console.log(`moellen: ${t}; gaettemaskine trin ${M.gaettemaskine.by.trin}; klikker ${M.klikkerProeve.indbyggereFoer}->${M.klikkerProeve.indbyggereEfter}; konsol ${M.konsol.length}`);
}

// ---------- BLOK 2: SKAKKEN SOM ELEV ----------

// WCAG-kontrast mellem to farver (rgb(...) eller #hex).
function lum(c) {
  let r, g, b;
  if (c.startsWith('#')) { const h = c.slice(1); [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); } else [r, g, b] = c.match(/[\d.]+/g).map(Number);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };

async function skak(browser) {
  const sk = traek(SKAK_ROD, 'skak', 'main');
  const url = pathToFileURL(path.join(sk.mappe, 'skak.html')).href;
  const { Chess } = await import(pathToFileURL(skakKraev.resolve('chess.js')).href);
  const S = { skakMain: sk.hash, bredder: {} };
  for (const bredde of [390, 1280]) {
    const mobil = bredde === 390;
    const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 800 }, hasTouch: mobil, isMobile: mobil, deviceScaleFactor: mobil ? 2 : 1, colorScheme: 'light' });
    await ctx.addInitScript(LYD_SPION);
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const B = { konsol: [] };
    page.on('pageerror', (e) => B.konsol.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') B.konsol.push(`console.error: ${m.text().slice(0, 160)}`); });
    await page.goto(url);
    await page.waitForSelector('#braet .felt');
    await page.waitForTimeout(700);
    const tryk = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (mobil) await l.tap(); else await l.click(); };
    const felt = (sq) => `#braet [data-square="${sq}"]`;
    const skud = async (navn, braetAlene = false) => {
      if (braetAlene) { const bb = await page.locator('.braet-wrap').boundingBox(); await page.screenshot({ path: path.join(ud, `skak-${bredde}-${navn}.png`), clip: { x: Math.max(0, bb.x - 4), y: Math.max(0, bb.y - 4), width: bb.width + 8, height: bb.height + 8 } }); } else await page.screenshot({ path: path.join(ud, `skak-${bredde}-${navn}.png`) });
    };
    const braetInfo = () => page.evaluate(() => {
      const b = document.querySelector('#braet').getBoundingClientRect();
      const f = document.querySelector('#braet .felt').getBoundingClientRect();
      const brikker = [...document.querySelectorAll('#braet .felt .brik-svg')].map((e) => e.getBoundingClientRect().width / f.width);
      const lab = [...document.querySelectorAll('#braet .fil-label, #braet .rang-label')].map((e) => { const cs = getComputedStyle(e); const felt = e.closest('.felt'); return { t: e.textContent, px: parseFloat(cs.fontSize), vaegt: cs.fontWeight, farve: cs.color, bag: getComputedStyle(felt).backgroundColor, lys: felt.classList.contains('lys') }; });
      const wrap = document.querySelector('.braet-wrap');
      return { braetPx: Math.round(b.width), feltPx: Math.round(f.width), brikAndel: brikker.length ? Math.round((brikker.reduce((a, x) => a + x, 0) / brikker.length) * 100) / 100 : null,
        braetTop: Math.round(b.top), braetBund: Math.round(b.bottom), vindue: innerHeight,
        tema: document.documentElement.dataset.braetTema, saet: document.querySelector('#braet .brik-svg use')?.getAttribute('href')?.split('-')[1] ?? null,
        ramme: getComputedStyle(document.querySelector('#braet')).borderWidth, skygge: getComputedStyle(document.querySelector('#braet')).boxShadow.slice(0, 60),
        labels: lab.slice(0, 2).concat(lab.filter((l) => l.lys).slice(0, 1)), wrapPx: Math.round(wrap.getBoundingClientRect().width) };
    });

    // Forsiden (gaaden) som den moeder eleven.
    B.forside = await braetInfo();
    await skud('01-forside');

    // Stillingen som eleven ser den (brikkerne paa braettet); tur = den side der staar nederst.
    const domFen = () => page.evaluate(() => {
      const kort = {};
      for (const f of document.querySelectorAll('#braet .felt')) { const u = f.querySelector('.brik-svg use'); if (u) kort[f.dataset.square] = u.getAttribute('href').slice(-2); }
      let ud = '';
      for (let r = 8; r >= 1; r--) { let tom = 0; for (const fil of 'abcdefgh') { const b = kort[fil + r]; if (!b) { tom++; continue; } if (tom) { ud += tom; tom = 0; } ud += b[0] === 'w' ? b[1].toUpperCase() : b[1]; } if (tom) ud += tom; if (r > 1) ud += '/'; }
      const tur = document.querySelector('#braet .felt')?.dataset.square === 'h1' ? 'b' : 'w';
      return `${ud} ${tur} - - 0 1`;
    });
    // Gaader: to loeste. Eleven proever selv (mat i 1 hvis der er et), ellers via hint-knappen
    // (fra-felt, saa til-felt) - som en elev der sidder fast. Et bevidst forkert traek i den foerste.
    await tryk('#fane-gaader');
    await page.waitForFunction(() => document.querySelector('#gaade-indlaeser')?.hidden === true, null, { timeout: 10000 });
    B.gaader = [];
    for (let g = 0; g < 2; g++) {
      await page.waitForTimeout(700);
      const G = { titel: await page.locator('#gaade-titel').textContent().catch(() => '') , forsoeg: [] };
      const fen = await domFen();
      G.fen = fen;
      let loest = false;
      if (g === 0 && fen) {
        const c = new Chess(fen);
        const t = c.moves({ verbose: true }).find((m) => !m.captured && m.piece !== 'k') ?? c.moves({ verbose: true })[0];
        await tryk(felt(t.from)); await page.waitForTimeout(80); await tryk(felt(t.to)); await page.waitForTimeout(900);
        G.forsoeg.push({ traek: t.san, status: (await page.locator('#status').textContent()).slice(0, 140) });
        await skud(`09-gaade${g + 1}-forkert`);
        if (await page.locator('#knap-gaade-fortryd').isVisible().catch(() => false)) { await tryk('#knap-gaade-fortryd'); await page.waitForTimeout(400); }
      }
      for (let f = 0; f < 8 && !loest; f++) {
        const fenNu = await domFen();
        let mat = null;
        try { const c = new Chess(fenNu); mat = c.moves({ verbose: true }).find((m) => { c.move(m); const r = c.isCheckmate(); c.undo(); return r; }); } catch { /* ingen fen */ }
        let fra, til, hvordan;
        if (mat) { fra = mat.from; til = mat.to; hvordan = 'selv (mat i 1)'; } else {
          const klar = await page.waitForSelector('#knap-gaade-hint:not([disabled])', { timeout: 6000 }).catch(() => null);
          if (!klar) { G.forsoeg.push({ hvordan: 'hint-knappen er slaaet fra', status: (await page.locator('#status').textContent()).slice(0, 140) }); await skud(`10-gaade${g + 1}-hint-fra`); break; }
          await tryk('#knap-gaade-hint'); await page.waitForSelector('#braet .felt.hint-fra', { timeout: 2000 }).catch(() => {});
          await page.waitForSelector('#knap-gaade-hint:not([disabled])', { timeout: 2000 }).catch(() => {});
          await tryk('#knap-gaade-hint'); await page.waitForSelector('#braet .felt.hint-til', { timeout: 2000 }).catch(() => {});
          fra = await page.locator('#braet .felt.hint-fra').getAttribute('data-square').catch(() => null);
          til = await page.locator('#braet .felt.hint-til').getAttribute('data-square').catch(() => null);
          hvordan = 'med hint';
          if (f === 0 && g === 0) await skud(`10-gaade${g + 1}-hint`, true);
        }
        if (!fra || !til) break;
        await tryk(felt(fra)); await page.waitForTimeout(80); await tryk(felt(til));
        loest = !!(await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Løst'), null, { timeout: 2000 }).catch(() => null));
        G.forsoeg.push({ traek: `${fra}${til}`, hvordan, status: (await page.locator('#status').textContent()).slice(0, 120) });
        if (loest) await skud(`11-gaade${g + 1}-loest`);
        await page.waitForTimeout(800);
      }
      G.loest = loest;
      B.gaader.push(G);
      await page.waitForTimeout(1200);
    }

    // Tegnevaerktoejet paa gaadens braet: en pil d2->d4. Rammer pilen feltmidten, nu hvor rammen er vaek?
    const vaerk = page.locator('.vaerktoej[data-vaerktoej="pil"]');
    B.tegnevaerktoej = { synlig: await vaerk.isVisible().catch(() => false) };
    if (B.tegnevaerktoej.synlig) {
      await vaerk.scrollIntoViewIfNeeded();
      if (mobil) await vaerk.tap(); else await vaerk.click();
      const a = await page.locator(felt('d2')).boundingBox();
      const b = await page.locator(felt('d4')).boundingBox();
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
      if (mobil) {
        const cdp = await ctx.newCDPSession(page);
        const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
        await t('touchStart', ax, ay);
        for (let i = 1; i <= 10; i++) await t('touchMove', ax + ((bx - ax) * i) / 10, ay + ((by - ay) * i) / 10);
        await t('touchEnd');
      } else {
        await page.mouse.move(ax, ay); await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(ax + ((bx - ax) * i) / 10, ay + ((by - ay) * i) / 10);
        await page.mouse.up();
      }
      await page.waitForTimeout(200);
      B.tegnevaerktoej.pil = await page.evaluate(({ ax, ay, bx, by }) => {
        const svg = document.querySelector('#tegne-lag');
        const linje = svg.querySelector('line, path');
        if (!linje) return { tegnet: false, elementer: svg.childElementCount };
        const ctm = svg.getScreenCTM();
        const pt = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(ctm); return { x: q.x, y: q.y }; };
        let s = null;
        if (linje.tagName === 'line') s = pt(+linje.getAttribute('x1'), +linje.getAttribute('y1'));
        return { tegnet: true, elementer: svg.childElementCount, startAfvigelsePx: s ? Math.round(Math.hypot(s.x - ax, s.y - ay) * 10) / 10 : null, tag: linje.tagName };
      }, { ax, ay, bx, by });
      await skud('08-tegnet-pil', true);
      const flyt = page.locator('.vaerktoej[data-vaerktoej="flyt"]');
      if (mobil) await flyt.tap(); else await flyt.click();
      await tryk('#knap-ryd-tegning').catch(() => {});
    }

    // Udseende: fire temaer x Staunton, derefter Merida/Chessnut/Egen tegning/Bogstav paa Trae.
    await tryk('.udseende-vaelger summary');
    await page.waitForTimeout(200);
    B.valg = { saet: await page.$$eval('#vaelg-brik-saet option', (e) => e.map((o) => `${o.value}:${o.textContent}`)), tema: await page.$$eval('#vaelg-braet-farve option', (e) => e.map((o) => `${o.value}:${o.textContent}`)), lydStandard: await page.locator('#vaelg-traek-lyd').isChecked() };
    const udseendeKasse = await page.locator('.udseende-vaelger').boundingBox();
    B.udseendeUnderBraet = { top: Math.round(udseendeKasse.y), vindue: mobil ? 844 : 800 };
    await page.screenshot({ path: path.join(ud, `skak-${bredde}-02-udseende-aaben.png`), fullPage: false });
    B.temaer = [];
    for (const tema of ['trae', 'skov', 'havblaa', 'nat']) {
      await page.selectOption('#vaelg-braet-farve', tema);
      await page.waitForTimeout(200);
      const i = await braetInfo();
      const kontraster = i.labels.map((l) => ({ t: l.t, px: l.px, vaegt: l.vaegt, lysFelt: l.lys, kontrast: kontrast(l.farve, l.bag) }));
      // Brikkerne mod felterne: sort brik (fyld) mod moerkt felt.
      const felter = await page.evaluate(() => ({ lys: getComputedStyle(document.documentElement).getPropertyValue('--felt-lys').trim(), moerk: getComputedStyle(document.documentElement).getPropertyValue('--felt-moerk').trim() }));
      B.temaer.push({ tema, kontraster, felter, lysMoerkKontrast: kontrast(felter.lys, felter.moerk), sortBrikMoerktFelt: kontrast('#000000', felter.moerk) });
      await skud(`03-tema-${tema}`, true);
    }
    await page.selectOption('#vaelg-braet-farve', 'trae');
    B.saet = [];
    for (const saet of ['merida', 'chessnut', 'klassisk', 'bogstav', 'staunton']) {
      await page.selectOption('#vaelg-brik-saet', saet);
      await page.waitForTimeout(200);
      const i = await braetInfo();
      B.saet.push({ saet, brikAndel: i.brikAndel, href: i.saet });
      if (saet !== 'staunton') await skud(`04-saet-${saet}`, true);
    }
    await tryk('.udseende-vaelger summary');

    // Spil: fem traek mod en makker (1.e4 e5 2.Dh5 Sc6 3.Dxf7+ ... skak). Glider det? Ses sidste traek og skak?
    await tryk('#fane-spil');
    await page.waitForTimeout(400);
    const fen0 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const saetFen = async (fen) => {
      const fold = page.locator('#fold-avanceret');
      if (!(await fold.evaluate((d) => d.open))) await tryk('#fold-avanceret summary');
      await page.locator('#fen-tekst').fill(fen);
      await tryk('#knap-fen-indsaet');
      await page.waitForTimeout(300);
      await tryk('#fold-avanceret summary');
    };
    await saetFen(fen0);
    B.spilVedAabning = await page.evaluate(() => ({ fen: document.querySelector('#fen-tekst')?.value ?? '', status: document.querySelector('#status')?.textContent ?? '' }));
    await skud('05a-spil-som-det-aabner');
    await tryk('#knap-spil-forfra');
    await page.waitForTimeout(300);
    B.spilForfraSpoerger = await page.locator('#spil-forfra-modal').isVisible().catch(() => false);
    if (B.spilForfraSpoerger) { await skud('05b-start-forfra-spoerger'); await tryk('#knap-spil-forfra-bekraeft'); }
    await page.waitForTimeout(500);
    B.spilEfterForfra = await page.evaluate(() => ({ fen: document.querySelector('#fen-tekst')?.value ?? '', status: document.querySelector('#status')?.textContent ?? '' }));
    if (!B.spilEfterForfra.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) { B.spilBrugteFen = true; await saetFen(fen0); }
    const spil = async (fra, til) => {
      await tryk(felt(fra));
      await page.waitForTimeout(90);
      await tryk(felt(til));
      await page.waitForTimeout(40);
      const glid = await page.evaluate((t) => { const b = document.querySelector(`#braet [data-square="${t}"] .brik-svg`); if (!b) return null; const cs = getComputedStyle(b); return { glider: b.classList.contains('glider'), transform: cs.transform, transition: cs.transitionDuration }; }, til);
      await page.waitForTimeout(400);
      const mark = await page.evaluate(() => ({ fra: document.querySelector('#braet .felt.sidst-fra')?.dataset.square ?? null, til: document.querySelector('#braet .felt.sidst-til')?.dataset.square ?? null, skak: document.querySelector('#braet .felt.i-skak')?.dataset.square ?? null, fen: document.querySelector('#fen-tekst')?.value ?? '' }));
      return { traek: `${fra}${til}`, glid, ...mark };
    };
    B.parti = [];
    B.parti.push(await spil('e2', 'e4'));
    B.parti.push(await spil('e7', 'e5'));
    B.parti.push(await spil('d1', 'h5'));
    // Midt i et glid: skaermbillede ca. 60 ms inde i et traek.
    await tryk(felt('b8'));
    await page.waitForTimeout(90);
    await skud('05-valgt-brik-lovlige-felter', true);
    await tryk(felt('c6'));
    await page.waitForTimeout(60);
    await skud('06-midt-i-glid', true);
    await page.waitForTimeout(400);
    B.parti.push({ traek: 'b8c6', ...(await page.evaluate(() => ({ fra: document.querySelector('#braet .felt.sidst-fra')?.dataset.square ?? null, til: document.querySelector('#braet .felt.sidst-til')?.dataset.square ?? null }))) });
    B.parti.push(await spil('h5', 'f7'));
    await skud('07-skak-efter-fem-traek');
    await skud('07b-skak-braet', true);
    B.lydeFraStandard = await page.evaluate(() => window.__lyde);
    // Kongen i skak: hvor tydelig? Farven i midten af kongens felt mod et almindeligt felt.
    B.skakFelt = await page.evaluate(() => { const f = document.querySelector('#braet .felt.i-skak'); if (!f) return null; const cs = getComputedStyle(f); return { felt: f.dataset.square, baggrund: cs.backgroundImage.slice(0, 90) }; });
    // Lyd til, et traek, taeller toner.
    await tryk('.udseende-vaelger summary');
    await page.locator('#vaelg-traek-lyd').check();
    await tryk('.udseende-vaelger summary');
    const l0 = await page.evaluate(() => window.__lyde);
    B.parti.push(await spil('e8', 'f7'));
    B.lydeEtTraekMedLyd = (await page.evaluate(() => window.__lyde)) - l0;

    // Laer skak: "Jeg spiller allerede" -> Italiensk, foerste trin e2-e4. Ses koordinaterne til "e4"?
    await tryk('#fane-laer');
    await page.waitForTimeout(300);
    if (await page.locator('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]').isVisible().catch(() => false)) await tryk('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]');
    await page.waitForTimeout(400);
    B.laer = { titel: await page.locator('#laer-titel').textContent(), tekst: (await page.locator('#laer-tekst').textContent()).slice(0, 200) };
    await skud('12-laer-start');
    await tryk(felt('e2')); await page.waitForTimeout(90); await tryk(felt('e4')); await page.waitForTimeout(1400);
    B.laer.efter = { titel: await page.locator('#laer-titel').textContent(), besked: await page.locator('#laer-besked').textContent(), taeller: await page.locator('#laer-trin-taeller').textContent().catch(() => '') };
    await skud('13-laer-efter-e4');
    B.laer.braet = await braetInfo();
    // Knapper under 44 px paa skaermen lige nu.
    B.smaaKnapper = await page.evaluate(() => [...document.querySelectorAll('button, summary, select')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.id).trim().slice(0, 18), b: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.b < 44));
    S.bredder[bredde] = B;
    await ctx.close();
    console.log(`skak ${bredde}: brik ${B.forside.brikAndel} af feltet, felt ${B.forside.feltPx}px, skak paa ${B.skakFelt?.felt ?? '-'}, gaader loest ${B.gaader.filter((g) => g.loest).length}/2, laer "${B.laer.efter.titel}", konsol ${B.konsol.length}`);
  }
  maal.skak = S;
  gem();
}

const browser = await chromium.launch({ headless: true });
try {
  if (!kun || kun === 'moellen') await moellen(browser);
  if (!kun || kun === 'skak') await skak(browser);
} finally {
  await browser.close();
}
console.log(`OK: outputs/kritik-392/ (maalinger.json + skaermbilleder)`);
