// Ordre 437, blok 2: en ny elev i "Gaader" paa 390 px, der loeser 10 af de
// foerste 20 gaader rent (uden fejl og uden hint) og fejler resten, som et barn
// goer det: (a) et forkert traek, "Tag traekket tilbage", saa facit; (b) to
// forkerte traek, saa loesningen vises, tilbage og facit; (c) "Vis et hint" og
// "Spring over". Og en elev B, der forbedrer sig: 10 forkerte, saa 10 rigtige.
// Headless Chromium, 390 x 844, touch, 2x. Koerer mod en KOPI af skak
// (git archive af skak/main), aldrig mod skak-mappen selv.
//
// Brug: node outputs/kritik-437/elev-437.mjs <skak-kopi>
// Skriver outputs/kritik-437/G-*.png og outputs/kritik-437/elev-437.json.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(her, { recursive: true });
const kraev = createRequire(path.join(skak, 'package.json'));
const { chromium } = kraev('playwright');
const imp = (p) => import(pathToFileURL(path.join(skak, p)).href);
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js');
const { afkodGaadebankStor } = await imp('src/gaadedata.js');
const laes = (fil) => JSON.parse(readFileSync(path.join(skak, 'data', fil), 'utf8'))
  .map((g) => ({ id: g.id, fen: g.fen, solutionUci: g.solutionUci, rating: g.svaerhed, tema: g.tema }));
const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(laes('gaader.json'), laes('gaader-lette.json'));
const iBank = new Map(bank.map((g) => [`${g.fen.split(' ')[0]} ${g.fen.split(' ')[1]}`, g]));
const url = pathToFileURL(path.join(skak, 'skak.html')).href;

// Samme raekkefoelge som "tilfaeldig (froe 437)" i rating-437.mjs: 10 R og 10 F.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bland(liste, froe) {
  const r = mulberry32(froe);
  const k = [...liste];
  for (let i = k.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  return k;
}
const skift = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
const ELEV_A = bland(skift, 437);
const ELEV_B = Array.from({ length: 20 }, (_, i) => i >= 10);

function placering(felter) {
  const r = [];
  for (let y = 8; y >= 1; y -= 1) {
    let l = ''; let t = 0;
    for (const f of 'abcdefgh') {
      const b = felter[`${f}${y}`];
      if (!b) { t += 1; continue; }
      if (t) { l += t; t = 0; }
      l += b[0] === 'w' ? b[1].toUpperCase() : b[1];
    }
    if (t) l += t;
    r.push(l);
  }
  return r.join('/');
}

async function nySide(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
  const page = await ctx.newPage();
  const sidefejl = [];
  page.on('pageerror', (e) => sidefejl.push(e.message));
  await page.clock.install({ time: new Date('2026-09-28T10:00:00') });
  await page.goto(url);
  await page.waitForSelector('#gaade-indlaeser[hidden]', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, sidefejl };
}

function elevHjaelpere(page) {
  const vent = (ms) => page.waitForTimeout(ms);
  const tekst = (sel) => page.locator(sel).textContent().then((t) => (t ?? '').trim());
  const felter = () => page.$$eval('#braet .felt', (els) => Object.fromEntries(els.map((el) => {
    const m = (el.querySelector('.brik-svg use')?.getAttribute('href') ?? '').match(/-([wb][pnbrqk])$/i);
    return [el.dataset.square, m ? m[1].toLowerCase() : null];
  })));
  const signatur = () => page.$$eval('#braet .felt', (els) => els.map((el) => el.querySelector('.brik-svg use')?.getAttribute('href') ?? '').join('|'));
  const aktiv = async () => {
    const p = placering(await felter());
    for (const tur of ['w', 'b']) { const g = iBank.get(`${p} ${tur}`); if (g) return g; }
    throw new Error(`stillingen er ikke i banken: ${p}`);
  };
  const tryk = async (f) => { await page.locator(`#braet .felt[data-square="${f}"]`).tap(); await vent(80); };
  const traek = async (u) => {
    await tryk(u.slice(0, 2)); await tryk(u.slice(2, 4));
    if (u.length > 4) {
      const knap = page.locator(`.forvandling-valg [data-brik="${u[4]}"], [data-forvandling="${u[4]}"]`);
      if (await knap.count()) await knap.first().tap();
    }
  };
  // Vent til brikken paa feltet har den farve (modstanderens svar er landet).
  const ventPaaBrik = (felt, farve) => page.waitForFunction(([f, c]) => {
    const href = document.querySelector(`#braet .felt[data-square="${f}"] .brik-svg use`)?.getAttribute('href') ?? '';
    return new RegExp(`-${c}[pnbrqk]$`, 'i').test(href);
  }, [felt, farve], { timeout: 6000 });
  const spilFacit = async (g) => {
    const tur = g.fen.split(' ')[1];
    const mod = tur === 'w' ? 'b' : 'w';
    for (let i = 0; i < g.solutionUci.length; i += 2) {
      if (i > 0) { await ventPaaBrik(g.solutionUci[i - 1].slice(2, 4), mod); await ventPaaBrik(g.solutionUci[i].slice(0, 2), tur); await vent(250); }
      await traek(g.solutionUci[i]);
    }
    await page.waitForFunction(() => /løst/i.test(document.querySelector('#status')?.textContent ?? ''), null, { timeout: 5000 })
      .catch(async (e) => {
        console.log('  STOP', g.id, g.fen, g.solutionUci.join(' '), '|', await tekst('#status'));
        await page.screenshot({ path: path.join(her, 'G-fejl.png') });
        throw e;
      });
  };
  const forkertTraek = async (g) => {
    const fs = await felter();
    const tur = g.fen.split(' ')[1];
    for (const [fra, b] of Object.entries(fs)) {
      if (!b || b[0] !== tur) continue;
      await tryk(fra);
      const maal = await page.$$eval('#braet .felt.lovligt-traek, #braet .felt.lovligt-slag', (els) => els.map((el) => el.dataset.square));
      const til = maal.find((t) => `${fra}${t}` !== g.solutionUci[0].slice(0, 4));
      if (til) { await tryk(til); return `${fra}${til}`; }
      await tryk(fra);
    }
    throw new Error('intet forkert traek');
  };
  const tilbage = async () => {
    await page.waitForSelector('#knap-gaade-fortryd:not([hidden])', { timeout: 3000 });
    await page.locator('#knap-gaade-fortryd').tap();
    await vent(250);
  };
  const tal = async () => ({
    rating: await tekst('#gaade-rating'),
    aendring: await tekst('#gaade-rating-aendring'),
    aendringFarve: await page.locator('#gaade-rating-aendring').evaluate((el) => getComputedStyle(el).color),
    grafPunkter: await page.locator('#gaade-rating-graf-linje').getAttribute('points').then((p) => (p ? p.split(' ').length : 0)),
    grafSynlig: await page.locator('#gaade-rating-graf').isVisible(),
    grafLabel: await page.locator('#gaade-rating-graf').getAttribute('aria-label'),
    dage: await tekst('#gaade-stime-dage'),
    iTraek: await tekst('#gaade-streak'),
    loestIDag: await tekst('#gaade-loest-i-dag'),
    loestIAlt: await tekst('#gaade-loest-i-alt'),
  });
  return { vent, tekst, signatur, aktiv, traek, spilFacit, forkertTraek, tilbage, tal };
}

async function koerElev(browser, navn, moenster, skud) {
  const { ctx, page, sidefejl } = await nySide(browser);
  const h = elevHjaelpere(page);
  const forloeb = [];
  const start = await h.tal();
  if (skud) await page.screenshot({ path: path.join(her, `G-00-${navn}-start.png`) });
  let fejlNr = 0;
  for (const [i, rent] of moenster.entries()) {
    const g = await h.aktiv();
    const foer = await h.signatur();
    // Hvem er i traek, hvad staar der, og vises brattet fra den side der skal spille?
    const tur = g.fen.split(' ')[1];
    const startStatus = await h.tekst('#status');
    const titel = await h.tekst('#gaade-titel');
    const braetFraHvid = await page.$eval('#braet .felt', (el) => el.dataset.square === 'a8');
    let maade = 'rent';
    const beskeder = [];
    if (rent) {
      await h.spilFacit(g);
    } else {
      maade = ['forkert-tilbage', 'to-forkerte-vist', 'hint-spring'][fejlNr % 3];
      fejlNr += 1;
      if (maade === 'forkert-tilbage') {
        await h.forkertTraek(g); await h.vent(300);
        beskeder.push(await h.tekst('#status'));
        await h.tilbage();
        await h.spilFacit(g);
      } else if (maade === 'to-forkerte-vist') {
        await h.forkertTraek(g); await h.vent(300);
        beskeder.push(await h.tekst('#status'));
        await h.tilbage();
        await h.forkertTraek(g); await h.vent(300);
        beskeder.push(await h.tekst('#status'));
        await h.tilbage();
        await h.spilFacit(g);
      } else {
        await page.locator('#knap-gaade-hint').tap(); await h.vent(300);
        beskeder.push(await h.tekst('#status'));
        await page.locator('#knap-gaade-spring-over').tap(); await h.vent(400);
      }
    }
    await h.vent(150);
    const efter = await h.tal();
    const status = await h.tekst('#status');
    forloeb.push({ nr: i + 1, id: g.id, tema: g.tema, gaadeRating: g.rating, tur, braetFraHvid, startStatus, titel, maade, beskeder, status, ...efter });
    console.log(navn, i + 1, g.id, g.tema, g.rating, maade, efter.rating, efter.aendring, '|', status.slice(0, 90));
    if (skud && [1, 2, 5, 10, 20].includes(i + 1)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(her, `G-${String(i + 1).padStart(2, '0')}-${navn}-efter-gaade-${i + 1}.png`) });
    }
    if (skud && maade === 'to-forkerte-vist' && !forloeb.some((x) => x.skudFejl)) {
      forloeb[forloeb.length - 1].skudFejl = true;
      await page.screenshot({ path: path.join(her, `G-${String(i + 1).padStart(2, '0')}-${navn}-minus-efter-to-fejl.png`) });
    }
    // Vent paa naeste gaade (efter "Loest!" kommer den af sig selv efter 0,9 s).
    await page.waitForFunction((gammel) => {
      const s = [...document.querySelectorAll('#braet .felt')].map((el) => el.querySelector('.brik-svg use')?.getAttribute('href') ?? '').join('|');
      return s !== gammel && !/løst/i.test(document.querySelector('#status')?.textContent ?? '');
    }, foer, { timeout: 8000 }).catch(() => {});
    await h.vent(200);
  }
  // Tallene og grafen taet paa, og hvor store de er paa skaermen.
  const raekke = page.locator('.gaade-tal-raekke');
  // Maal ved scroll 0: hvad ser eleven uden at scrolle (skaermen er 844 hoej)?
  await page.evaluate(() => window.scrollTo(0, 0));
  await h.vent(300);
  const maal = await page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(b.x), y: Math.round(b.y), b: Math.round(b.width), h: Math.round(b.height), skrift: cs.fontSize }; };
    return { skaermHoejde: window.innerHeight, status: r('#status'), rating: r('#gaade-rating'), aendring: r('#gaade-rating-aendring'), graf: r('#gaade-rating-graf'), label: r('.gaade-tal-rating small'), braet: r('#braet'), raekke: r('.gaade-tal-raekke') };
  });
  maal.grafSesUdenScroll = maal.graf.y + maal.graf.h <= maal.skaermHoejde;
  maal.ratingSesUdenScroll = maal.rating.y + maal.rating.h <= maal.skaermHoejde;
  if (skud) await raekke.screenshot({ path: path.join(her, `G-21-${navn}-tal-og-graf.png`) });
  await ctx.close();
  return { navn, moenster: moenster.map((x) => (x ? 'R' : 'F')).join(''), start, forloeb, maal, sidefejl };
}

// En gaade med sort i traek (spring over uden forsoeg taeller ikke): hvordan
// staar brattet, og staar der nogen steder hvem der skal traekke?
async function sortITraek(browser) {
  const { ctx, page, sidefejl } = await nySide(browser);
  const h = elevHjaelpere(page);
  let g = await h.aktiv();
  for (let i = 0; i < 40 && g.fen.split(' ')[1] !== 'b'; i += 1) {
    await page.locator('#knap-gaade-spring-over').tap(); await h.vent(300);
    g = await h.aktiv();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await h.vent(200);
  await page.screenshot({ path: path.join(her, 'G-22-sort-i-traek.png') });
  const ud = await page.evaluate(() => ({
    braetFraHvid: document.querySelector('#braet .felt')?.dataset.square === 'a8',
    nederstVenstre: [...document.querySelectorAll('#braet .felt')].at(-8)?.dataset.square,
    tekstOmTur: document.body.innerText.split(/\r?\n/).filter((l) => /(sort|hvid)/i.test(l) && /(træk|tur)/i.test(l)).slice(0, 5),
    status: document.querySelector('#status')?.textContent.trim(),
  }));
  await ctx.close();
  return { id: g.id, tema: g.tema, rating: g.rating, tur: g.fen.split(' ')[1], ...ud, sidefejl };
}

const browser = await chromium.launch();
const ud = {};
try {
  ud.A = await koerElev(browser, 'A', ELEV_A, true);
  ud.B = await koerElev(browser, 'B', ELEV_B, true);
  ud.sort = await sortITraek(browser);
} finally {
  await browser.close();
}
for (const e of [ud.A, ud.B]) {
  const r = e.forloeb.map((x) => Number(x.rating));
  e.slut = r[r.length - 1];
  e.plus = e.forloeb.filter((x) => x.aendring.startsWith('+')).length;
  e.minus = e.forloeb.filter((x) => x.aendring.startsWith('−')).length;
  e.hoejeste = Math.max(...r); e.laveste = Math.min(...r);
  e.sumPlus = e.forloeb.filter((x) => x.aendring.startsWith('+')).reduce((s, x) => s + Number(x.aendring.slice(1)), 0);
  e.sumMinus = e.forloeb.filter((x) => x.aendring.startsWith('−')).reduce((s, x) => s + Number(x.aendring.slice(1)), 0);
  e.letteGaader = e.forloeb.filter((x) => x.id.startsWith('425-')).length;
  e.sortITraek = e.forloeb.filter((x) => x.tur === 'b').length;
  e.sortSetFraHvid = e.forloeb.filter((x) => x.tur === 'b' && x.braetFraHvid).length;
  e.starttekster = [...new Set(e.forloeb.map((x) => x.startStatus))];
}
writeFileSync(path.join(her, 'elev-437.json'), `${JSON.stringify(ud, null, 1)}\n`);
console.log('sort i traek:', JSON.stringify(ud.sort));
console.log(`A: 800 -> ${ud.A.slut} (${ud.A.plus} plus, ${ud.A.minus} minus), B: 800 -> ${ud.B.slut}; sidefejl ${ud.A.sidefejl.length + ud.B.sidefejl.length}`);
