// ORDRE 384 - Bhishak som KRITIKER: squat-opslagsvaerket paa squat-opslag-9 (Setus 375/378 og Yantras rettede
// figurer) laest en sidste gang som coach, foer Marc faar det. Genbruger squat-delen af scripts/kritik-374.mjs og
// fund-tjekkene fra sitets scripts/kritik-378.mjs, men skriver KUN i outputs/kritik-384/ (374-koerslen overskrev
// gamle mapper; det maa ikke ske igen). Retter intet i sitet: grenen traekkes ud med `git archive` til en
// midlertidig mappe og serveres lokalt; headless Chromium paa 390x844 (touch, 2x) og 1280x900. Ingen atletnavne.
//
// Brug: node scripts/kritik-384.mjs [--blok figurer|artikel|alle]   (npm run verify:kritik-384 = alle)
//   figurer  blok 1: hver figur og indlejring for sig paa 390 og 1280, med figurtekst og mindste tekst i px
//   artikel  blok 2: hele artiklen med alle folde aabne, stilregler og status for Q1-Q22
// Udgang: outputs/kritik-384/ (skaermbilleder, tekst, maalinger.json, resultat.txt). Exit 1 kun hvis scriptet
// selv fejler; fundene er en laesning, ikke en test, og deres status staar i resultat.txt.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const APP_ROD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak'; // kun for at laane playwright, som i 374
const SITE_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-coaching-site-wt2';
const REV = 'squat-opslag-9';
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const slug = (t) => t.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-');
const blok = process.argv.includes('--blok') ? process.argv[process.argv.indexOf('--blok') + 1] : 'alle';

// Al skrivning gaar gennem ud(): kun under outputs/kritik-384/.
const UD = path.join(APP_ROD, 'outputs', 'kritik-384');
const ud = (...d) => {
  const p = path.join(UD, ...d);
  if (!p.startsWith(UD + path.sep)) throw new Error(`skriver uden for outputs/kritik-384: ${p}`);
  mkdirSync(path.dirname(p), { recursive: true });
  return p;
};
const maalFil = ud('maalinger.json');
const maal = existsSync(maalFil) ? JSON.parse(readFileSync(maalFil, 'utf8')) : {};

function traek() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik384-'));
  const mappe = path.join(tmp, 'site');
  mkdirSync(mappe);
  execFileSync('git', ['-C', SITE_ROD, 'archive', '--format=tar', '-o', path.join(tmp, 'site.tar'), REV]);
  execFileSync('tar', ['-xf', 'site.tar', '-C', 'site'], { cwd: tmp });
  return { mappe, hash: execFileSync('git', ['-C', SITE_ROD, 'rev-parse', '--short', REV]).toString().trim() };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
function server(rod) {
  const s = createServer((req, res) => {
    const p = path.join(rod, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (!p.startsWith(rod) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}
async function aabn(browser, base, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, deviceScaleFactor: w < 800 ? 2 : 1 });
  await ctx.addInitScript(() => {
    window.__canvasTekst = new Set();
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__canvasTekst.add(String(t)); return f.call(this, t, ...r); };
  });
  const page = await ctx.newPage();
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(`console.error: ${m.text().slice(0, 160)}`); });
  page.on('response', (r) => { if (r.status() >= 400) fejl.push(`${r.status()}: ${r.url().slice(0, 100)}`); });
  await page.goto(`${base}/artikel-squat.html`, { waitUntil: 'networkidle' });
  const hoejde = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hoejde; y += h * 0.8) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(40); }
  await page.evaluate(() => scrollTo(0, 0));
  return { ctx, page, fejl };
}

// Mindste tekst i en SVG-fil i pixels ved den viste bredde (img-figurerne).
function svgMindsteTekst(rod, src, visB) {
  const t = readFileSync(path.join(rod, src), 'utf8');
  const vb = /viewBox="[\d.\s-]*?\s([\d.]+)\s[\d.]+"/.exec(t);
  const vbB = vb ? Number(vb[1]) : Number(/width="([\d.]+)"/.exec(t)[1]);
  const str = [...t.matchAll(/<text[^>]*font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  if (!str.length) return null;
  return Math.round(((Math.min(...str) * visB) / vbB) * 10) / 10;
}

// ---------- BLOK 1: hver figur og indlejring for sig ----------
// Alle figurer i artiklens raekkefoelge: inline SVG (kapitel 1 og 5), img (anatomi, kapitel 6, fejlbilleder),
// panelet og anatomivaelgeren (canvas) og kapitel 6's indlejring (mom-mount).
const FIGUR_LISTE = () => {
  const alle = [...document.querySelectorAll('figure.fase-figur, .article-figure, #squat-panel, #anatomi-panel, .mom-mount')];
  return alle.map((e, i) => {
    const kap = e.closest('section.kapitel');
    const fase = e.closest('section.fase');
    const img = e.querySelector('img'); const svg = e.querySelector(':scope > svg'); const cv = e.querySelector('canvas');
    const b = (img || svg || cv || e).getBoundingClientRect();
    let svgTekstPx = null;
    if (svg) { const tx = [...svg.querySelectorAll('text')]; if (tx.length) svgTekstPx = Math.round(Math.min(...tx.map((t) => parseFloat(getComputedStyle(t).fontSize) * (b.width / svg.viewBox.baseVal.width))) * 10) / 10; }
    // Afsnittet foer og efter figuren i hovedteksten (det laeseren sammenligner billedet med)
    const naboP = (el, retning) => { let n = el[retning]; while (n && !(n.tagName === 'P')) n = n[retning]; return n?.innerText.trim().slice(0, 400) ?? ''; };
    return {
      nr: i + 1, kapitel: kap?.id ?? '', fase: fase?.id ?? '',
      art: svg ? 'svg' : img ? 'img' : cv ? 'canvas' : 'mount',
      kilde: img?.getAttribute('src') ?? svg?.querySelector('title')?.id ?? e.id ?? '',
      titel: svg?.querySelector('title')?.textContent ?? img?.getAttribute('alt') ?? '',
      figurtekst: e.querySelector('figcaption')?.innerText.trim() ?? '',
      foer: naboP(e.closest('details') ?? e, 'previousElementSibling'), efter: naboP(e.closest('details') ?? e, 'nextElementSibling'),
      visB: Math.round(b.width), visH: Math.round(b.height), svgTekstPx, iFold: !!e.closest('details'),
    };
  });
};

async function figurer(browser, base, rod) {
  const F = {};
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const { ctx, page, fejl } = await aabn(browser, base, w, h);
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(500);
    const liste = await page.evaluate(FIGUR_LISTE);
    const els = page.locator('figure.fase-figur, .article-figure, #squat-panel, #anatomi-panel, .mom-mount');
    for (const f of liste) {
      const el = els.nth(f.nr - 1);
      await el.scrollIntoViewIfNeeded();
      const img = el.locator('img');
      if (await img.count()) await img.first().evaluate((i) => i.complete || new Promise((r) => { i.onload = r; i.onerror = r; }));
      await page.waitForTimeout(f.art === 'svg' || f.art === 'img' ? 60 : 700);
      const navn = `fig-${w}-${String(f.nr).padStart(2, '0')}-${f.kapitel.replace('kap-', '')}${f.fase ? '-' + f.fase.replace('fase-', '') : ''}-${path.basename(String(f.kilde)).replace(/\.svg$/, '').replace(/^ft-/, '').slice(0, 40)}.png`;
      await el.screenshot({ path: ud(navn) });
      f.billede = navn;
      if (f.art === 'img' && f.kilde.endsWith('.svg')) f.imgTekstPx = svgMindsteTekst(rod, f.kilde, f.visB);
    }
    // Panelet og vaelgeren som en coach bruger dem paa telefonen: skinneben ned og op, highbar, lang laarknogle
    if (w < 800) {
      const knap = (sel, t) => page.locator(`${sel} button`).filter({ hasText: new RegExp(`^\\s*${t}\\s*$`, 'i') }).first();
      await page.locator('#squat-canvas').scrollIntoViewIfNeeded();
      for (const [krop, stang] of [['Lang lårknogle', 'Lowbar'], ['Lang torso', 'Highbar'], ['Balanceret', 'Highbar']]) {
        await knap('#squat-panel', krop).click(); await knap('#squat-panel', stang).click(); await page.waitForTimeout(400);
        await page.locator('#squat-panel').screenshot({ path: ud(`fig-390-panel-${slug(krop)}-${slug(stang)}.png`) });
      }
      await knap('#squat-panel', 'Balanceret').click(); await knap('#squat-panel', 'Lowbar').click();
      for (const fase of ['Halvvejs ned', 'Sticking point']) {
        await knap('#anatomi-panel', fase).click(); await page.waitForTimeout(400);
        await page.locator('#anatomi-panel').screenshot({ path: ud(`fig-390-vaelger-${slug(fase)}.png`) });
      }
    }
    F[w] = { figurer: liste, konsol: fejl, canvasTekst: await page.evaluate(() => [...window.__canvasTekst]) };
    await ctx.close();
  }
  maal.figurer = F;
  // Kort liste til laesningen: figur, bredde, mindste tekst
  const linjer = F[390].figurer.map((f) => {
    const d = F[1280].figurer.find((x) => x.nr === f.nr) ?? {};
    const px = (x) => x.svgTekstPx ?? x.imgTekstPx ?? '-';
    return `${String(f.nr).padStart(2)} ${f.kapitel.padEnd(18)} ${f.art.padEnd(6)} ${String(path.basename(String(f.kilde))).slice(0, 44).padEnd(44)} 390: ${f.visB}px bred, tekst ${px(f)} px | 1280: ${d.visB}px, tekst ${px(d)} px${f.iFold ? ' (i fold)' : ''}`;
  });
  writeFileSync(ud('figurer.txt'), `Figurer i squat-artiklen, ${maal.siteRev}\n\n${linjer.join('\n')}\n`);
  console.log(`Blok 1: ${F[390].figurer.length} figurer og indlejringer x 2 bredder (+ panel/vaelger i brug). Se outputs/kritik-384/figurer.txt`);
}

// ---------- BLOK 2: hele artiklen med alle folde aabne, stil og Q1-Q22 ----------
async function artikel(browser, base, rod, w, h) {
  const { ctx, page, fejl } = await aabn(browser, base, w, h);
  const M = { konsol: fejl, panelStart: await page.evaluate(() => document.getElementById('squat-panel').innerText) };
  const imgs = await page.evaluate(() => [...document.querySelectorAll('.fejlbillede-figur img, .anatomi-figur img')].map((i) => ({ src: i.getAttribute('src'), visB: i.getBoundingClientRect().width || i.closest('details')?.parentElement.getBoundingClientRect().width || 0 })));
  M.figurTekst = imgs.map((f) => ({ src: f.src.split('/').pop(), visB: Math.round(f.visB), mindstePx: svgMindsteTekst(rod, f.src, f.visB) }));
  M.hkMaerker = await page.evaluate(() => { const t = document.querySelector('.fase-figur svg .fig-tekst'); if (!t) return null; const s = t.ownerSVGElement; return Math.round(parseFloat(getComputedStyle(t).fontSize) * (s.getBoundingClientRect().width / s.viewBox.baseVal.width) * 10) / 10; });
  const knap = (t) => page.locator('#squat-panel button').filter({ hasText: new RegExp(`^\\s*${t}\\s*$`, 'i') }).first();
  M.panel = [];
  for (const krop of ['Balanceret', 'Lang lårknogle', 'Lang torso']) {
    for (const stang of ['Lowbar', 'Highbar']) {
      await knap(krop).click(); await knap(stang).click(); await page.waitForTimeout(200);
      M.panel.push({ krop, stang, ...(await page.evaluate(() => ({ ankel: document.getElementById('squat-ankle-value').textContent, skinneben: document.getElementById('squat-tibia-value').textContent, stang: document.querySelector('[data-stat="bar"]').textContent, dybde: document.querySelector('[data-stat="ipf"]').textContent, tekst: document.getElementById('squat-panel').innerText.replace(/\s+/g, ' ').slice(0, 600) }))) });
    }
  }
  await knap('Balanceret').click(); await knap('Lowbar').click();
  M.panelSamtidig = await page.evaluate(() => {
    const c = document.querySelector('#squat-canvas').getBoundingClientRect();
    const bund = Math.max(...[...document.querySelectorAll('#squat-panel input[type=range]')].map((s) => s.getBoundingClientRect().bottom));
    const spaend = Math.round(bund - c.top);
    return { canvasH: Math.round(c.height), spaendPx: spaend, vindue: innerHeight, kanSesSamtidig: spaend <= innerHeight };
  });
  M.tabel = await page.evaluate(() => {
    const t = document.querySelector('.anatomi-tabel'); if (!t) return null;
    const wrap = t.closest('.anatomi-tabel-wrap') ?? t.parentElement;
    return { overskrifter: [...t.querySelectorAll('thead th')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), kommaCeller: [...t.querySelectorAll('td')].filter((x) => x.innerText.trim() === ',').length, rammeB: wrap.clientWidth, scrollB: wrap.scrollWidth, alleKolonnerSynlige: wrap.scrollWidth <= wrap.clientWidth + 1 };
  });
  M.anatomiFaser = {};
  for (const fase of ['Halvvejs ned', 'Bund', 'Sticking point']) {
    await page.locator('#anatomi-panel button').filter({ hasText: new RegExp(`^\\s*${fase}\\s*$`) }).first().click();
    await page.waitForTimeout(150);
    M.anatomiFaser[fase] = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#anatomi-panel .anatomi-tabel tbody tr')].map((r) => [r.cells[0].innerText.split('(')[0].trim(), r.cells[3].innerText.trim()])));
  }
  await page.locator('#anatomi-panel button').filter({ hasText: /^\s*Bund\s*$/ }).first().click();
  M.figurTitler = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.fase-figur svg title')].map((t) => [t.id, t.textContent])));
  // Q21: smaa trykflader i kapitel 6
  M.smaaTryk = await page.evaluate(() => [...document.querySelectorAll('#kap-virkeligheden button, #kap-virkeligheden summary, #squat-panel button, #anatomi-panel button')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim().slice(0, 24), b: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44));
  // Med foldene lukket: skaerme og ord pr. kapitel; derefter alle folde aabne
  M.lukket = await page.evaluate(() => [...document.querySelectorAll('section.kapitel')].map((s) => ({ id: s.id, skaerme: Math.round((s.getBoundingClientRect().height / innerHeight) * 10) / 10, ord: s.innerText.split(/\s+/).filter(Boolean).length })));
  M.foersteFaseY = await page.evaluate(() => Math.round(((document.getElementById('h-fase-opstilling').getBoundingClientRect().top - document.getElementById('h-faserne').getBoundingClientRect().top) / innerHeight) * 10) / 10);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(400);
  M.aaben = await page.evaluate(() => [...document.querySelectorAll('section.kapitel')].map((s) => ({ id: s.id, titel: s.querySelector('h2')?.innerText.replace(/\s+/g, ' ').trim(), skaerme: Math.round((s.getBoundingClientRect().height / innerHeight) * 10) / 10, ord: s.innerText.split(/\s+/).filter(Boolean).length })));
  M.canvasTekst = await page.evaluate(() => [...window.__canvasTekst]);
  M.tekst = await page.evaluate(() => document.body.innerText);
  M.kapitel = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('section.kapitel')].map((s) => [s.id, s.innerText])));
  M.sideBredde = await page.evaluate(() => document.documentElement.scrollWidth);
  M.skaerme = await page.evaluate(() => Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10);
  if (w < 800) {
    writeFileSync(ud('squat-390-tekst-aabne-folder.txt'), M.tekst);
    // Hele artiklen skaerm for skaerm med foldene aabne (til laesningen top til bund)
    const hoejde = await page.evaluate(() => document.documentElement.scrollHeight);
    let i = 0;
    for (let y = 0; y < hoejde; y += h - 60) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(50); await page.screenshot({ path: ud('artikel-390', `${String(++i).padStart(3, '0')}.png`) }); }
    M.artikelSkaermbilleder = i;
  }
  await ctx.close();
  return M;
}

function egennavne(tekst) {
  const brod = tekst.split(/\nREFERENCER\n/)[0];
  const ord = new Set();
  for (const l of brod.split('\n')) for (const m of l.matchAll(/(?<=[^.!?:\n] |\()([A-ZÆØÅ][a-zæøåéö]+)/g)) ord.add(m[1]);
  return [...ord].sort();
}

// Tjekkene fra sitets kritik-378.mjs (Q1-Q20), plus Q21 og Q22. Et tjek viser kun at fejlen fra 374 er vaek;
// om en coach laeser det rigtigt, staar i KRITIK-squat-378.md.
const TJEK = (m390, m1280) => {
  const k = m390.kapitel; const t = m390.tekst; const broed = t.split(/\nREFERENCER\n/)[0];
  const q = {};
  const q1Tekst = /I bunden står stangen næsten over midtfoden, ([\d,]+) cm bagved\. Oprejst står den ([\d,]+) cm bagved/.exec(k['kap-praksis']);
  const q1Fig = (id) => /stangen ([\d,]+) centimeter (bagved|foran)/.exec(m390.figurTitler[id] ?? '');
  const q1Bund = q1Fig('ft-bund'); const q1Top = q1Fig('ft-lockout');
  q.Q1 = { ok: !/Stangen over midtfoden er modellens balancebetingelse/.test(k['kap-praksis']) && /tyngdepunkt/.test(k['kap-praksis']) && !!q1Tekst && q1Tekst[1] === q1Bund?.[1] && q1Tekst[2] === q1Top?.[1], hvad: `kapitel 8: tyngdepunktet; stangen ${q1Tekst?.[1]} / ${q1Tekst?.[2]} cm bagved, figurerne ${q1Bund?.[1]} / ${q1Top?.[1]} cm` };
  const q2Knae = Number((/Knæ (\d+) grader/.exec(m390.figurTitler['ft-lockout'] ?? '') ?? [])[1]);
  const q2Forbehold = (k['kap-faserne'].match(/knæet er ikke låst|ikke det regelmæssige lockout|Samme position som lockout|kompromis mellem låst knæ|knæets manglende strækning/g) || []).length;
  q.Q2 = { ok: q2Knae >= 179 && q2Forbehold === 0, hvad: `lockout-figurens knae ${q2Knae}°, forbehold om ulaast lockout: ${q2Forbehold}` };
  const ankler = new Set([...m390.panel, ...m1280.panel].map((p) => p.ankel));
  const tekstAnkel = /ankelgrænse[^.]*?starter på (\d+)°/i.exec(k['kap-kropstyper']);
  q.Q3 = { ok: !!tekstAnkel && ankler.size === 1 && [...ankler][0] === `${tekstAnkel[1]}°`, hvad: `teksten ${tekstAnkel?.[1]}°, panelet ${[...ankler].join(', ')} i alle seks kombinationer` };
  q.Q4 = { ok: m390.tabel.kommaCeller === 0 && m1280.tabel.kommaCeller === 0 && m390.tabel.alleKolonnerSynlige, hvad: `kommaceller ${m390.tabel.kommaCeller}/${m1280.tabel.kommaCeller}, tabellen ${m390.tabel.scrollB} px i ramme paa ${m390.tabel.rammeB} px` };
  q.Q5 = { ok: !m390.tabel.overskrifter.some((o) => /^ledvinkel$/i.test(o)) && /180° er strakt/.test(k['kap-faserne']), hvad: `overskrifter: ${m390.tabel.overskrifter.join(' | ')}` };
  q.Q6 = { ok: !m390.canvasTekst.some((s) => /IPF/.test(s)) && !/IPF-dybde: ja/.test(t), hvad: `canvas-tekst om dybde: ${m390.canvasTekst.filter((s) => /dybde/i.test(s)).join(', ') || '(ingen)'}` };
  const smaa = m390.figurTekst.filter((f) => f.mindstePx !== null && f.mindstePx < 9);
  q.Q7 = { ok: smaa.length === 0 && m390.hkMaerker >= 9, hvad: `mindste img-SVG-tekst paa 390: ${Math.min(...m390.figurTekst.map((f) => f.mindstePx ?? 99))} px, H/K ${m390.hkMaerker} px` };
  q.Q8 = { ok: /\ngood morning\n/i.test(k['kap-fejlbilleder']) && /12,6°/.test(k['kap-fejlbilleder']), hvad: 'good morning: torsoen tipper 12,6° i figur og tekst' };
  const q9tal = /Modellen har registreret (\w+) fejlbilleder/.exec(k['kap-fejlbilleder']);
  q.Q9 = { ok: !/indad eller udad/.test(t) && q9tal?.[1] === 'seks', hvad: `valgus = indad; taellingen: ${q9tal?.[1] ?? 'ikke naevnt'}` };
  q.Q10 = { ok: !/11 %/.test(k['kap-faserne']) && /0,38 s/.test(k['kap-faserne']), hvad: 'vendepunktet 0,38 s, ingen "11 %"' };
  q.Q11 = { ok: /inden for båndet/.test(k['kap-virkeligheden']) && !/Stangen er en anden sag|Det er grunden til at sammenligne/.test(k['kap-virkeligheden']), hvad: '"inden for baandet" forklaret' };
  q.Q12 = { ok: m390.panelSamtidig.kanSesSamtidig && m1280.panelSamtidig.kanSesSamtidig, hvad: `figur til nederste skyder ${m390.panelSamtidig.spaendPx}/${m390.panelSamtidig.vindue} px (390), ${m1280.panelSamtidig.spaendPx}/${m1280.panelSamtidig.vindue} px (1280)` };
  const decimal = ((broed.replace(/(afsnit|og) \d(\.\d)+|OpenSim \d\.\d/g, '') + m390.panelStart + m1280.panelStart).match(/\d\.\d/g) || []).length;
  q.Q13 = { ok: decimal === 0, hvad: `decimalpunktum: ${decimal}` };
  const q14 = (broed.match(/SKULLE|RajagopalLaiUhlrich2023|Licensen|[Ii]kke sit eget led endnu|IKKE SIT EGET LED ENDNU/g) || []).length;
  q.Q14 = { ok: q14 === 0, hvad: `SKULLE/filnavn/licensnote/"endnu" i broedteksten: ${q14} (filnavnet staar kun i referencelisten)` };
  const meta = (broed.match(/se kapitlets indledning|samme legende som vælgeren|i kapitlet om segmentmodellen|målingerne herunder|se referencerne|står ved bunden i kapitel 1|resten af kapitel 2 og 3|Forbeholdet nederst\./g) || []).length;
  q.Q15 = { ok: meta === 0, hvad: `meta-henvisninger fra 374: ${meta}` };
  const q16 = { fold: /Hvad figurerne bygger på/i.test(t), samme: /samme positur/i.test(k['kap-anatomien']) };
  q.Q16 = { ok: !q16.fold && !q16.samme, hvad: `fold "Hvad figurerne bygger paa" ${q16.fold ? 'findes' : 'vaek'}, "samme positur" i kap. 3 ${q16.samme ? 'ja' : 'nej'}` };
  q.Q17 = { venter: true, hvad: 'venter paa Marcs svar' };
  q.Q18 = { ok: m390.foersteFaseY <= 1, hvad: `kapitel 1 til foerste fase ${m390.foersteFaseY} skaerm paa 390` };
  const q19 = /Modellen har (\d+)° torsohældning ved lowbar og (\d+)° ved highbar/.exec(k['kap-stang']);
  q.Q19 = { ok: !!q19 && /ca\. 10°/.test(k['kap-stang']) && /ingen forskel/.test(k['kap-stang']), hvad: `kapitel 5: ${q19?.[1]}° mod ${q19?.[2]}° ved siden af maalte ca. 10° og ingen forskel` };
  const pct = (fase) => { const r = m1280.anatomiFaser[fase] ?? {}; return { knae: r['Knæstrækkere'], saede: r['Sædemuskel'] }; };
  const tekstPct = [...k['kap-anatomien'].matchAll(/Knæstrækkernes krav er (\d+ %)/g)].map((m) => m[1]);
  const tabelPct = ['Halvvejs ned', 'Bund', 'Sticking point'].map((f) => pct(f).knae);
  q.Q20 = { ok: tekstPct.join() === tabelPct.join() && pct('Bund').saede === '-', hvad: `knaestraekkere tekst ${tekstPct.join('/')} = tabel ${tabelPct.join('/')}` };
  const smaaV = m390.smaaTryk.filter((x) => /virkelig|Model|Start|knæ|Lockout|figur/i.test(x.t));
  q.Q21 = { ok: m390.smaaTryk.length === 0, hvad: `trykflader under 44 px paa 390: ${m390.smaaTryk.map((x) => `"${x.t}" ${x.h}px`).join(', ') || 'ingen'}`, smaaV };
  const marc = (t.match(/\[MARC:/g) || []).length; const kommer = /\nKOMMER\n/i.test(t);
  q.Q22 = { venter: true, hvad: `[MARC: ...] ${marc}, "Kommer"-boks: ${kommer ? 'ja' : 'nej'} (med vilje til Marc)` };
  const stil = {
    tankestreger: (t.match(/[\u2014\u2013]/g) || []).length,
    manSkal: (t.match(/\bman skal\b/gi) || []).length,
    skal: (broed.match(/\bskal\b/gi) || []).length,
    interne: (t.match(/\b(Yantra|Setu|Ganita|Drishti|Bhishak|Dhruva|Vaidya|RAPPORT|ordre \d)\b/g) || []).length,
    udraab: (broed.match(/!/g) || []).length,
    kapitelHenvisninger: (broed.match(/kapitel \d/gi) || []).length,
    referencekrop: (broed.match(/referencekrop/gi) || []).length,
    iModellen: (broed.match(/i modellen/gi) || []).length,
    jeg: (broed.match(/\b(jeg|min|mine|mit)\b/gi) || []).length,
    forbeholdSidst: broed.lastIndexOf('\nFORBEHOLD\n') > broed.length * 0.85,
    konsol: [...m390.konsol, ...m1280.konsol],
    vandretRulning390: m390.sideBredde > 390,
    ordAabne: m390.aaben.reduce((a, x) => a + x.ord, 0), ordLukket: m390.lukket.reduce((a, x) => a + x.ord, 0),
    skaerme390: m390.skaerme, laesetid: (t.match(/\d+\s*min\.? læsning/) || [''])[0],
  };
  return { q, stil, egennavne: egennavne(t) };
};

async function main() {
  const site = traek();
  maal.siteRev = `${REV} ${site.hash}`;
  const s = await server(site.mappe);
  const base = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const log = [`Kritik 384 mod ${maal.siteRev} (headless Chromium, 390x844 touch 2x og 1280x900)`];
  try {
    if (blok === 'figurer' || blok === 'alle') await figurer(browser, base, site.mappe);
    if (blok === 'artikel' || blok === 'alle') {
      const m390 = await artikel(browser, base, site.mappe, 390, 844);
      const m1280 = await artikel(browser, base, site.mappe, 1280, 900);
      const res = TJEK(m390, m1280);
      const gem = ({ tekst, kapitel, ...rest }) => rest;
      maal.artikel = { ...res, squat390: gem(m390), squat1280: gem(m1280) };
      const fund = Object.entries(res.q).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
      for (const [n, v] of fund) log.push(`${v.venter ? 'VENTER' : v.ok ? 'LUKKET' : 'AABEN '} ${n}: ${v.hvad}`);
      const st = res.stil;
      log.push(`Stil: tankestreger ${st.tankestreger}, "man skal" ${st.manSkal}, "skal" ${st.skal}, interne navne ${st.interne}, udraabstegn ${st.udraab}, "kapitel N" ${st.kapitelHenvisninger}, "referencekrop" ${st.referencekrop}, "i modellen" ${st.iModellen}, jeg/min ${st.jeg}, forbehold sidst ${st.forbeholdSidst ? 'ja' : 'nej'}.`);
      log.push(`Laengde: ${st.ordLukket} ord lukket, ${st.ordAabne} aabne, ${st.skaerme390} skaerme paa 390 med folde aabne; siden siger "${st.laesetid}". Konsol: ${st.konsol.length}. Vandret rulning paa 390: ${st.vandretRulning390 ? 'ja' : 'nej'}.`);
      log.push(`Egennavne i broedteksten (gennemgaaet for atletnavne): ${res.egennavne.join(', ')}`);
      log.push(`Lukket: ${fund.filter(([, v]) => v.ok).map(([n]) => n).join(', ')}. Aabne: ${fund.filter(([, v]) => !v.ok && !v.venter).map(([n]) => n).join(', ') || 'ingen'}. Venter: ${fund.filter(([, v]) => v.venter).map(([n]) => n).join(', ')}.`);
    }
  } finally {
    await browser.close(); s.close();
    writeFileSync(maalFil, JSON.stringify(maal, null, 2));
  }
  if (log.length > 1) { writeFileSync(ud('resultat.txt'), log.join('\n') + '\n'); console.log(log.join('\n')); }
  console.log(`\nKritik 384 (${blok}) faerdig. Alt output i outputs/kritik-384/.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
