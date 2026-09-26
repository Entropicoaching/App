// ORDRE 432 - Bhishak som KRITIKER: hele udgivelsesgrenen udgivelse-squat (Setu 430) laest som laeser, coach og
// Google, foer Marc trykker deploy. Genbruger scripts/kritik-394.mjs uaendret for figurer og artikel (Q1-Q22, A1-A7,
// K6, stil) mod udgivelse-squat og loeftmodellen 7e3ef64 (som Setu i 430), og laegger blok 3 "udgivelse" til: head og
// delingskort, sitemap, artikler.html og forsiden, kapitelmenuen, de skjulte MARC-bokse, N2-N6/F8/Q21 fra 394, hvad
// pushet goer offentligt, og om Setus deploy-kommandoer kan koere i entropi-coaching-site. Sitet laeses kun
// (git archive, ls-tree, show, status); intet i sitet aendres. Headless Chromium paa 390x844 (touch, 2x) og 1280x900.
//
// Brug: node outputs/kritik-432/kritik-432.mjs [--blok figurer|artikel|udgivelse|alle]   (npm run verify:kritik-432)
// Udgang: KUN outputs/kritik-432/ (ud() kontrollerer stien). Exit 1 kun hvis scriptet selv fejler; fundene er en
// laesning, ikke en test. Atletnavne: fornavnene hentes ved koersel fra app-repoets .gitignore (supabase/<navn>-*),
// og kun antal og filstier skrives, aldrig navnene.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const APP_ROD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-coaching-site-wt2';
const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak'; // kun for at laane playwright, som i 374
const REV = 'udgivelse-squat';
const LOEFTMODEL = { repo: 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva', rev: '7e3ef64' };
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const slug = (t) => t.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-');
const blok = process.argv.includes('--blok') ? process.argv[process.argv.indexOf('--blok') + 1] : 'alle';

// Al skrivning gaar gennem ud(): kun under app-wt2/outputs/kritik-432/.
const UD = path.join(APP_ROD, 'outputs', 'kritik-432');
const UD_VIST = path.relative(APP_ROD, UD).split(path.sep).join('/');
const ud = (...d) => {
  const p = path.join(UD, ...d);
  if (!p.startsWith(UD + path.sep)) throw new Error(`skriver uden for ${UD}: ${p}`);
  mkdirSync(path.dirname(p), { recursive: true });
  return p;
};
const maalFil = ud('maalinger.json');
const maal = existsSync(maalFil) ? JSON.parse(readFileSync(maalFil, 'utf8')) : {};

function traek() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik432-'));
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
  console.log(`Blok 1: ${F[390].figurer.length} figurer og indlejringer x 2 bredder (+ panel/vaelger i brug). Se ${UD_VIST}/figurer.txt`);
}

// ---------- BLOK 2: hele artiklen med alle folde aabne, stil og Q1-Q22 ----------
async function artikel(browser, base, rod, w, h) {
  const { ctx, page, fejl } = await aabn(browser, base, w, h);
  const M = { konsol: fejl, panelStart: await page.evaluate(() => document.getElementById('squat-panel').innerText) };
  const imgs = await page.evaluate(() => [...document.querySelectorAll('.fejlbillede-figur img, .anatomi-figur img')].map((i) => ({ src: i.getAttribute('src'), visB: i.getBoundingClientRect().width || i.closest('details')?.parentElement.getBoundingClientRect().width || 0 })));
  M.figurTekst = imgs.map((f) => ({ src: f.src.split('/').pop(), visB: Math.round(f.visB), mindstePx: svgMindsteTekst(rod, f.src, f.visB) }));
  M.hkMaerker = await page.evaluate(() => { const t = document.querySelector('.fase-figur svg .fig-tekst'); if (!t) return null; const s = t.ownerSVGElement; return Math.round(parseFloat(getComputedStyle(t).fontSize) * (s.getBoundingClientRect().width / s.viewBox.baseVal.width) * 10) / 10; });
  // ORDRE 388: uden inline-SVG er hofte- og knaemaerket tekst i billedet; mindste stoerrelse i kapitel 1 og 5 paa skaermen
  if (M.hkMaerker === null) M.hkMaerker = Math.min(...(await page.evaluate(() => [...document.querySelectorAll('.fase-figur img[src*="squat-figurer/"]')].map((i) => ({ src: i.getAttribute('src'), visB: i.getBoundingClientRect().width })))).map((f) => svgMindsteTekst(rod, f.src, f.visB) ?? 99));
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
  // ORDRE 388: kapitel 1 og 5 er billeder (assets/squat-figurer/k1-*.svg); titlen staar i alt, noeglen er stadig ft-<fase>
  M.figurTitler = await page.evaluate(() => Object.fromEntries([...[...document.querySelectorAll('.fase-figur svg title')].map((t) => [t.id, t.textContent]), ...[...document.querySelectorAll('.fase-figur img[src*="squat-figurer/k1-"]')].map((i) => ['ft-' + i.getAttribute('src').replace(/.*k1-|\.svg$/g, ''), i.alt])]));
  // Q21: smaa trykflader i kapitel 6
  M.smaaTryk = await page.evaluate(() => [...document.querySelectorAll('#kap-virkeligheden button, #kap-virkeligheden summary, #squat-panel button, #anatomi-panel button')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim().slice(0, 24), b: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44));
  // Med foldene lukket: skaerme og ord pr. kapitel; derefter alle folde aabne
  M.lukket = await page.evaluate(() => [...document.querySelectorAll('section.kapitel')].map((s) => ({ id: s.id, skaerme: Math.round((s.getBoundingClientRect().height / innerHeight) * 10) / 10, ord: s.innerText.split(/\s+/).filter(Boolean).length })));
  M.foersteFaseY = await page.evaluate(() => Math.round(((document.getElementById('h-fase-opstilling').getBoundingClientRect().top - document.getElementById('h-faserne').getBoundingClientRect().top) / innerHeight) * 10) / 10);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(400);
  M.aaben = await page.evaluate(() => [...document.querySelectorAll('section.kapitel')].map((s) => ({ id: s.id, titel: s.querySelector('h2')?.innerText.replace(/\s+/g, ' ').trim(), skaerme: Math.round((s.getBoundingClientRect().height / innerHeight) * 10) / 10, ord: s.innerText.split(/\s+/).filter(Boolean).length })));
  M.k6Tabel = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#kap-virkeligheden table.mom-tabel tbody tr')].map((r) => [r.cells[0].innerText.trim(), [...r.cells].slice(1).map((c) => c.innerText.replace(/\s+/g, ' ').trim())])));
  M.k6Indlejring = await page.evaluate(() => document.getElementById('maalt-over-model-mount')?.innerText.replace(/\s+/g, ' ').slice(0, 3000) ?? '');
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
  q.Q11 = { ok: /inden for (båndet|én standardafvigelse)/.test(k['kap-virkeligheden']) && /svag enighed/.test(k['kap-virkeligheden']) && !/Stangen er en anden sag|Det er grunden til at sammenligne/.test(k['kap-virkeligheden']), hvad: '"inden for baandet" forklaret' };
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
  const a = {};
  const kf = k['kap-fejlbilleder'], kv = k['kap-virkeligheden'], ks = k['kap-stang'], ka = k['kap-anatomien'], kfa = k['kap-faserne'];
  const antal = (tx, re) => (tx.match(re) || []).length;
  // ORDRE 388: Yantras 385 aendrede scenariet til samme dybde; titlen er nu hans "Ankelgrænsen stopper skinnebenet"
  const titel1 = /ankelgrænsen stopper skinnebenet/i;
  a.A1 = { ok: !/presset forbi ankelgrænsen|presses skinnebenet længere frem|5 cm dybere|dybere squat/i.test(t) && titel1.test(kf) && /knæet kommer mindre frem/.test(kf), hvad: `titlen: ${titel1.test(kf) ? '"Ankelgrænsen stopper skinnebenet"' : 'mangler'}, "dybere squat"/"5 cm dybere" ${antal(t, /dybere squat|5 cm dybere/gi)}, foerste saetning: knaeet kommer mindre frem ${/knæet kommer mindre frem/.test(kf) ? 'ja' : 'nej'}; "presset forbi" ${antal(t, /presset forbi/gi)}` };
  a.A2 = { ok: antal(kf, /stang 100 kg/g) === 4 && /stang 100 kg/.test(k['kap-kropstyper']) && /100 kg/.test(kfa), hvad: `"stang 100 kg" under kapitel 7's tabeller ${antal(kf, /stang 100 kg/g)} af 4, stangvaegt ved kropstyperne ${antal(k['kap-kropstyper'], /stang \d+ kg/g)}, "100 kg" i kapitel 1 ${antal(kfa, /100 kg/g)}` };
  a.A3 = { ok: !/lændmomentet stiger mere end hoftemomentet falder/.test(t) && /mens knæmomentet falder/.test(kf), hvad: 'good morning: kriteriet er hofte og laend op, knae ned, som scenariet' };
  const k6 = m390.k6Tabel; const tal = JSON.parse(execFileSync('git', ['-C', LOEFTMODEL.repo, 'show', `${LOEFTMODEL.rev}:outputs/maalt-over-model/tal.json`]).toString()).modelversioner['1'];
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
  const forskel = [];
  for (const [led, celler] of Object.entries(k6)) ['start', 'foer-knae', 'knaehoejde', 'efter-knae', 'lockout'].forEach((st, i) => { const r = tal[st].raekker.find((x) => x.led === led); if (!r) { forskel.push(`${led}: ikke i tal.json`); return; } const e = r.enhed === 'cm' ? ' cm' : '°'; const vent = `${f1(r.maalt)} ± ${f1(r.baand)}${e} model ${f1(r.model)}${e}, ${r.paalidelig === false ? 'upålidelig' : r.indenFor ? 'inden for' : 'uden for'}`; if (celler[i] !== vent) forskel.push(`${led} ${st}: "${celler[i]}" mod "${vent}"`); });
  a.A4 = { ok: !/står derfor ikke i tabellen/.test(kv) && 'Skinneben mod lodret (tilpasset)' in k6 && forskel.length === 0, hvad: `skinnebenet i den statiske tabel: ${'Skinneben mod lodret (tilpasset)' in k6 ? 'ja' : 'nej'}, i indlejringens tabel: ${/Skinneben mod lodret/.test(m390.k6Indlejring) ? 'ja' : 'nej'}; "staar derfor ikke i tabellen" ${/står derfor ikke i tabellen/.test(kv) ? 'ja' : 'nej'}; ${Object.keys(k6).length} raekker x 5 celler mod loeftmodellens tal.json (${LOEFTMODEL.rev}): ${forskel.length} forskelle${forskel.length ? ' (' + forskel.slice(0, 3).join('; ') + ')' : ''}` };
  const startSvg = execFileSync('git', ['-C', SITE_ROD, 'show', REV + ':assets/maalt-over-model/1-start-model1.svg']).toString();
  a.K6 = { ok: /#57544c/i.test(startSvg) && /Gråt: modellens figur/.test(kv) && !/85,8|33,5|75,1|ingen positur/.test(kv) && /78,8/.test(kv) && /Målt ± én standardafvigelse/.test(kv), hvad: `start-SVG'en har den graa figur: ${/#57544c/i.test(startSvg) ? 'ja' : 'nej'}; gamle tal (85,8 / 33,5 / 75,1 / "ingen positur") i kapitel 6: ${antal(kv, /85,8|33,5|75,1|ingen positur/g)}; lockout 78,8 mod 73,0: ${/78,8/.test(kv) ? 'ja' : 'nej'}; tabellen hedder "Maalt ± en standardafvigelse": ${/Målt ± én standardafvigelse/.test(kv) ? 'ja' : 'nej'}` };
  a.A5 = { ok: !/stiv linje/.test(t) && antal(t, /ét stift segment/g) === 2, hvad: `"stiv linje" ${antal(t, /stiv linje/g)}, "et stift segment" ${antal(t, /ét stift segment/g)}` };
  const a6 = { krav: antal(t, /skulle levere/gi), laar: antal(kfa, /32,5/g), hofte: ka.split('\n').filter((l) => !l.includes('\t') && !/^Jo tykkere streg/.test(l) && /hofte/i.test(l) && /uden for modellens område|kan regne på|mister derfor deres krav|uden for området/.test(l)).length, k5: antal(ks, /49,1°|37,2°|22,1°|23,6°/g) + antal(ks, /mod highbars|mod 37° ved highbar/g) };
  a.A6 = { ok: a6.krav <= 3 && a6.laar <= 2 && a6.hofte <= 2 && a6.k5 === 0, hvad: `"skulle levere" ${a6.krav} (var 4; nu vaelgerens forklaring og folden "Saadan laeses krav"), laarets 32,5 i kapitel 1 ${a6.laar} (var 4), afsnit der forklarer hoften uden for modellen i kapitel 3 ${a6.hofte} (var 4; tabelceller og legenden ikke talt), kapitel 5's tal gentaget i fold og front squat-afsnit ${a6.k5}` };
  const a7 = { lordose: /Balancen\.? Lænden/.test(t), mellemrum: /måling\.Modelvalg/.test(t), frame: /\bframe\b/i.test(broed), meta: /egen dokumentation for|fik sin egen stangposition/.test(t) };
  a.A7 = { ok: !Object.values(a7).some(Boolean), hvad: `"Balancen." om lordose ${a7.lordose ? 'ja' : 'nej'}, "maaling.Modelvalg" ${a7.mellemrum ? 'ja' : 'nej'}, "frame" ${a7.frame ? 'ja' : 'nej'}, meta-henvisninger ${a7.meta ? 'ja' : 'nej'}` };
  return { q, a, stil, egennavne: egennavne(t) };
};

// ---------- BLOK 3 (ORDRE 432): udgivelsen som laeser, coach og Google ----------
const DEPLOY_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-coaching-site'; // hvor RAPPORT-430's deploy-kommandoer koeres
const git = (...a) => execFileSync('git', ['-C', SITE_ROD, ...a], { maxBuffer: 1 << 28 }).toString();
const TEKST_EXT = /\.(md|txt|json|html|mjs|js|css|xml|svg)$/i;

function pngMaal(fil) {
  const b = readFileSync(fil);
  return { b: b.readUInt32BE(16), h: b.readUInt32BE(20), kB: Math.round(b.length / 1024) };
}
function head(rod) {
  const html = readFileSync(path.join(rod, 'artikel-squat.html'), 'utf8');
  const meta = (re) => (re.exec(html) ?? [])[1] ?? null;
  const prop = (p) => meta(new RegExp(`<meta property="${p}" content="([^"]*)"`));
  const ld = JSON.parse(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/.exec(html)[1]);
  const billede = prop('og:image');
  const lokal = billede && path.join(rod, billede.replace('https://entropicoaching.dk/', ''));
  const kommentarer = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  return {
    titel: meta(/<title>([^<]*)<\/title>/), beskrivelse: meta(/<meta name="description" content="([^"]*)"/),
    robots: meta(/<meta name="robots" content="([^"]*)"/), canonical: meta(/<link rel="canonical" href="([^"]*)"/),
    og: Object.fromEntries(['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt'].map((p) => [p, prop(p)])),
    twitter: meta(/<meta name="twitter:card" content="([^"]*)"/),
    ld: { headline: ld.headline, datePublished: ld.datePublished, dateModified: ld.dateModified, image: ld.image, author: ld.author?.name, beskrivelseSomMeta: ld.description === meta(/<meta name="description" content="([^"]*)"/) },
    billede: lokal && existsSync(lokal) ? pngMaal(lokal) : null,
    kommentarer: kommentarer.filter((k) => k.length > 20),
    interneKommentarer: kommentarer.filter((k) => /Marc svarede|Ordre \d|outputs\/|Dhruva|digtet|RAPPORT|KRITIK/i.test(k)),
    marcIKilden: (html.match(/\[MARC:/g) || []).length, bodyKlasse: meta(/<body class="([^"]*)"/),
  };
}

// Hvad pushet goer offentligt (sitet serverer hele repoet, og repoet er offentligt paa GitHub)
function offentligt(atletnavne) {
  const nye = git('diff', '--name-only', '--diff-filter=A', 'origin/main', REV).split('\n').filter(Boolean);
  const pr = {};
  for (const f of nye) { const d = f.includes('/') ? f.split('/')[0] + '/' : '(roden)'; pr[d] = (pr[d] ?? 0) + 1; }
  const tekst = nye.filter((f) => TEKST_EXT.test(f));
  const hits = { interne: [], marcSvarede: [], atletnavne: [] };
  const navneRe = atletnavne.length ? new RegExp(`\\b(${atletnavne.join('|')})\\b`, 'i') : null;
  for (const f of tekst) {
    const t = git('show', `${REV}:${f}`);
    if (/\b(Dhruva|Setu|Yantra|Bhishak|Ganita|Drishti|Vaidya)\b/.test(t)) hits.interne.push(f);
    if (/Marc svarede ikke|ikke besvaret|ordret fra chatten|digtes/i.test(t)) hits.marcSvarede.push(f);
    if (navneRe && navneRe.test(t)) hits.atletnavne.push(f);
  }
  return { originMain: git('rev-parse', '--short', 'origin/main').trim(), commitsForanOrigin: Number(git('rev-list', '--count', `origin/main..${REV}`)), mainForanOrigin: git('log', '--format=%h %s', 'origin/main..main').trim().split('\n'), outputsFoer: git('ls-tree', '-r', '--name-only', 'origin/main', 'outputs').split('\n').filter(Boolean).length, outputsEfter: git('ls-tree', '-r', '--name-only', REV, 'outputs').split('\n').filter(Boolean).length, nyeFiler: nye.length, prMappe: pr, tekstfiler: tekst.length, hits };
}

// Kan Setus fem kommandoer koere? Kun laesning: status i deploy-mappen og merge-tree.
function deployTjek() {
  const d = (...a) => execFileSync('git', ['-C', DEPLOY_ROD, ...a], { maxBuffer: 1 << 26 }).toString();
  const usporet = d('status', '--porcelain', '--untracked-files=all').split('\n').filter((l) => l.startsWith('?? ')).map((l) => l.slice(3)).filter((f) => !f.startsWith('node_modules/'));
  const aendret = d('status', '--porcelain').split('\n').filter((l) => l && !l.startsWith('??'));
  const iGren = new Set(git('ls-tree', '-r', '--name-only', REV).split('\n'));
  const iMain = new Set(git('ls-tree', '-r', '--name-only', 'main').split('\n'));
  const kollision = usporet.filter((f) => iGren.has(f)).map((f) => ({ fil: f, iMain: iMain.has(f), samme: d('hash-object', f).trim() === git('rev-parse', `${REV}:${f}`).trim() }));
  let mergeTree = '';
  try { git('merge-tree', '--write-tree', 'main', REV); mergeTree = 'rent'; } catch (e) { mergeTree = `konflikt: ${String(e.stdout ?? e.message).slice(0, 200)}`; }
  return { gren: d('branch', '--show-current').trim(), usporet: usporet.length, aendredeSporede: aendret.length, kollision, mergeTree };
}

async function side(browser, base, fil, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, deviceScaleFactor: w < 800 ? 2 : 1 });
  const page = await ctx.newPage();
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(`console.error: ${m.text().slice(0, 160)}`); });
  page.on('response', (r) => { if (r.status() >= 400) fejl.push(`${r.status()}: ${r.url().slice(0, 100)}`); });
  await page.goto(`${base}/${fil}`, { waitUntil: 'networkidle' });
  return { ctx, page, fejl };
}

async function udgivelse(browser, base, rod) {
  const U = { head: head(rod) };
  // Sitemap og noindex
  const sm = readFileSync(path.join(rod, 'sitemap.xml'), 'utf8');
  const urls = [...sm.matchAll(/<loc>https:\/\/entropicoaching\.dk\/([^<]*)<\/loc>/g)].map((m) => m[1] || 'index.html');
  const htmlRod = execFileSync('git', ['-C', SITE_ROD, 'ls-tree', '--name-only', REV]).toString().split('\n').filter((f) => f.endsWith('.html'));
  const linkes = (f) => htmlRod.filter((g) => g !== f && readFileSync(path.join(rod, g), 'utf8').includes(`href="${f}`));
  U.sitemap = { antal: urls.length, mangler: urls.filter((u) => !existsSync(path.join(rod, u))), squat: urls.includes('artikel-squat.html') };
  U.noindex = htmlRod.filter((f) => /<meta name="robots" content="[^"]*noindex/.test(readFileSync(path.join(rod, f), 'utf8'))).map((f) => ({ fil: f, iSitemap: urls.includes(f), linkesFra: linkes(f) }));
  U.squatLinkesFra = linkes('artikel-squat.html');
  U.billedeKopi = 'squat-deling.png';
  writeFileSync(ud(U.billedeKopi), readFileSync(path.join(rod, 'assets', 'squat-deling.png')));

  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const R = {};
    // Forsiden, artikler.html, viden.html
    for (const fil of ['index.html', 'artikler.html', 'viden.html']) {
      const { ctx, page, fejl } = await side(browser, base, fil, w, h);
      const kort = await page.evaluate(() => { const a = document.querySelector('a[href="artikel-squat.html"]'); if (!a) return null; const alle = [...document.querySelectorAll('.article-card')]; return { plads: alle.indexOf(a) + 1, af: alle.length, tekst: a.innerText.replace(/\s+/g, ' ').trim(), h: Math.round(a.getBoundingClientRect().height) }; });
      R[fil] = { konsol: fejl, squatKort: kort, bredde: await page.evaluate(() => document.documentElement.scrollWidth) };
      await page.screenshot({ path: ud(`side-${w}-${fil.replace('.html', '')}.png`), fullPage: fil !== 'index.html' });
      if (fil === 'artikler.html' && kort) {
        await page.locator('a[href="artikel-squat.html"]').scrollIntoViewIfNeeded();
        await page.locator('a[href="artikel-squat.html"]').screenshot({ path: ud(`kort-${w}-artikler-squat.png`) });
        await page.locator('a[href="artikel-squat.html"]').click();
        await page.waitForLoadState('networkidle');
        R[fil].kortAabner = page.url().endsWith('artikel-squat.html');
      }
      await ctx.close();
    }
    // Artiklen: MARC-bokse, folde, kapitelmenu, "< Artikler"
    const { ctx, page, fejl } = await aabn(browser, base, w, h);
    R.artikelKonsol = fejl;
    R.marc = await page.evaluate(() => [...document.querySelectorAll('.marc')].map((m) => {
      const p = m.closest('p'); const kap = m.closest('section.kapitel')?.id;
      const vist = p.innerText.replace(/\s+/g, ' ').trim();
      return { kap, skjult: getComputedStyle(m).display === 'none', slutter: vist.slice(-90), hullerTegn: /\s[.,;:]|\s{2,}/.test(p.innerText), sidst: !m.nextSibling || !String(m.nextSibling.textContent).trim(), synligTekstMedMarc: /\[MARC/.test(p.innerText) };
    }));
    R.folde = await page.evaluate(() => [...document.querySelectorAll('details')].map((d) => ({ summary: d.querySelector('summary')?.innerText.trim().slice(0, 70), kap: d.closest('section.kapitel')?.id ?? '(foer kapitlerne)' })));
    R.tilbage = await page.evaluate(() => document.querySelector('.nav-back')?.getAttribute('href'));
    R.viserMarc = await page.evaluate(() => /\[MARC/.test(document.body.innerText));
    // Kapitelmenuen
    const km = page.locator('.kapmenu-knap');
    R.kapmenu = { knapSynlig: await km.isVisible(), navSynligFoer: await page.locator('#kapmenu').isVisible() };
    if (w < 800) {
      await page.evaluate(() => scrollTo(0, 3000)); await page.waitForTimeout(200);
      R.kapmenu.knapTekst = (await km.innerText()).replace(/\s+/g, ' ').trim();
      R.kapmenu.knapH = Math.round((await km.boundingBox()).height);
      await km.click(); await page.waitForTimeout(200);
      R.kapmenu.navSynligEfterKlik = await page.locator('#kapmenu').isVisible();
      await page.screenshot({ path: ud('kapmenu-390-aaben.png') });
      await page.locator('#kapmenu a[href="#kap-virkeligheden"]').click(); R.kapmenu.landingForloeb = []; for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); R.kapmenu.landingForloeb.push(await page.evaluate(() => Math.round(document.getElementById('kap-virkeligheden').getBoundingClientRect().top))); }
    } else {
      await page.screenshot({ path: ud('kapmenu-1280.png') });
      R.kapmenu.overlap = await page.evaluate(() => { const n = document.getElementById('kapmenu').getBoundingClientRect(); const a = document.querySelector('.article-wrap').getBoundingClientRect(); return n.right > a.left && n.left < a.right; });
      await page.locator('#kapmenu a[href="#kap-virkeligheden"]').click(); R.kapmenu.landingForloeb = []; for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); R.kapmenu.landingForloeb.push(await page.evaluate(() => Math.round(document.getElementById('kap-virkeligheden').getBoundingClientRect().top))); }
    }
    R.kapmenu.navSynligEfterValg = await page.locator('#kapmenu').isVisible();
    R.kapmenu.landingTop = await page.evaluate(() => Math.round(document.getElementById('kap-virkeligheden').getBoundingClientRect().top));
    R.kapmenu.nrEfterValg = (await km.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await page.screenshot({ path: ud(`kapmenu-${w}-efter-valg-kap6.png`) });
    // Fund fra 394 der kan maales; F1-F10 er figurer og ses paa billederne fra blok 1
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => document.body.innerText);
    R.n394 = {
      N3: { gammelt: /83°[^.]*105°|83 og 105/.test(t), hvad: 'foldens hoftetal 83°/105° mod teksten 89°/107°' },
      N4: { gammelt: /største afvigelse i løftet/.test(t) || /siger tabellen nej på knæet/.test(t), hvad: '"stoerste afvigelse" / "nej paa knaeet" i kapitel 6' },
      N5: { gammelt: /vokser mest i anden halvdel/.test(t), hvad: '"vokser mest i anden halvdel af nedturen"' },
      N6: { gammelt: /sænker næsten farten/.test(t), hvad: '"stangen saenker naesten farten"' },
    };
    R.k5Maerker = await page.evaluate(() => { const i = [...document.querySelectorAll('#kap-stang img')]; return i.map((x) => ({ src: x.getAttribute('src').split('/').pop(), visB: Math.round(x.getBoundingClientRect().width) })); });
    R.k5MindstePx = Math.min(...R.k5Maerker.map((f) => svgMindsteTekst(rod, 'assets/squat-figurer/' + f.src, f.visB) ?? 99));
    R.sideBredde = await page.evaluate(() => document.documentElement.scrollWidth);
    // Top til bund med alle folde aabne paa 1280 (390 tages i blok 2)
    if (w >= 800) {
      const hoejde = await page.evaluate(() => document.documentElement.scrollHeight);
      let i = 0;
      for (let y = 0; y < hoejde; y += h - 80) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(40); await page.screenshot({ path: ud('artikel-1280', `${String(++i).padStart(3, '0')}.png`) }); }
      R.artikelSkaermbilleder = i;
    }
    await ctx.close();
    U[w] = R;
  }
  // Atletnavne: fornavne fra app-repoets .gitignore (supabase/<navn>-*), aldrig skrevet ud
  const gi = readFileSync(path.join(APP_ROD, '.gitignore'), 'utf8');
  const navne = [...new Set([...gi.matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))];
  U.offentligt = offentligt(navne);
  U.offentligt.atletnavneTjekket = navne.length;
  U.deploy = deployTjek();
  maal.udgivelse = U;
  return U;
}

function udgivelseLog(U) {
  const hd = U.head; const L = [];
  const r = (n, ok, hvad) => L.push(`${ok ? 'OK    ' : 'FUND  '} ${n}: ${hvad}`);
  r('titel', hd.titel.length <= 70, `${hd.titel.length} tegn ("${hd.titel.slice(0, 60)}..."); Google viser ca. 60`);
  r('metabeskrivelse', hd.beskrivelse.length <= 160, `${hd.beskrivelse.length} tegn; Google viser ca. 155, klippet efter "${hd.beskrivelse.slice(0, 155).split(' ').slice(-4).join(' ')}"`);
  r('robots', !hd.robots, `meta robots ${hd.robots ?? 'ingen'}; canonical ${hd.canonical}`);
  r('og', Object.values(hd.og).every(Boolean) && hd.twitter === 'summary_large_image', `og:* ${Object.values(hd.og).filter(Boolean).length}/8 udfyldt, twitter:card ${hd.twitter}`);
  r('delingsbillede', hd.billede && hd.billede.b === 1200 && hd.billede.h === 630, `${hd.billede ? `${hd.billede.b}x${hd.billede.h}, ${hd.billede.kB} kB` : 'mangler'}; kopi i outputs/kritik-432/${U.billedeKopi}`);
  r('datePublished', hd.ld.datePublished >= '2026-09-26', `ld+json datePublished ${hd.ld.datePublished}, dateModified ${hd.ld.dateModified}; siden viser kun "2026"`);
  r('html-kommentarer', hd.interneKommentarer.length === 0, `${hd.interneKommentarer.length} af ${hd.kommentarer.length} kommentarer i kilden er interne noter (fx "${(hd.interneKommentarer[1] ?? '').slice(0, 90)}")`);
  r('MARC i kilden', true, `${hd.marcIKilden} [MARC:]-tekster i HTML-kilden, body class="${hd.bodyKlasse}"`);
  r('sitemap', U.sitemap.squat && !U.sitemap.mangler.length && U.noindex.every((n) => !n.iSitemap), `${U.sitemap.antal} URL'er, artiklen med: ${U.sitemap.squat ? 'ja' : 'nej'}, uden fil: ${U.sitemap.mangler.length}`);
  r('noindex-sider', U.noindex.every((n) => !n.iSitemap && !n.linkesFra.length), U.noindex.map((n) => `${n.fil} (linkes fra: ${n.linkesFra.join(', ') || 'intet'})`).join('; '));
  r('artiklen linkes fra', U.squatLinkesFra.length > 0, U.squatLinkesFra.join(', '));
  for (const w of [390, 1280]) {
    const R = U[w];
    r(`${w} forsiden/artikler/viden`, ['index.html', 'artikler.html', 'viden.html'].every((f) => !R[f].konsol.length && R[f].bredde <= w), `konsol ${['index.html', 'artikler.html', 'viden.html'].map((f) => R[f].konsol.length).join('/')}; squat-kort: forsiden ${R['index.html'].squatKort ? 'ja' : 'nej'}, artikler.html plads ${R['artikler.html'].squatKort?.plads} af ${R['artikler.html'].squatKort?.af} (aabner artiklen: ${R['artikler.html'].kortAabner ? 'ja' : 'nej'}), viden.html ${R['viden.html'].squatKort ? 'ja' : 'nej'}; artiklens "< Artikler" -> ${R.tilbage}`);
    r(`${w} MARC-bokse`, R.marc.every((m) => m.skjult && !m.synligTekstMedMarc && !m.hullerTegn) && !R.viserMarc, R.marc.map((m) => `${m.kap}: skjult ${m.skjult ? 'ja' : 'nej'}, ${m.sidst ? 'sidst i afsnittet' : 'midt i afsnittet'}, afsnittet slutter "...${m.slutter.slice(-50)}"`).join(' | '));
    const k = R.kapmenu;
    r(`${w} kapitelmenu`, w < 800 ? k.navSynligEfterKlik && !k.navSynligEfterValg && Math.abs(k.landingTop) < 120 : k.navSynligFoer && !k.overlap && Math.abs(k.landingTop) < 120, w < 800 ? `knap "${k.knapTekst}" ${k.knapH}px, aabner ${k.navSynligEfterKlik ? 'ja' : 'nej'}, lukker efter valg ${k.navSynligEfterValg ? 'nej' : 'ja'}, kapitel 6 lander ${k.landingTop}px fra toppen (efter 3 s blid rulning; forloeb ${k.landingForloeb.join(' ')}), knappen viser "${k.nrEfterValg}"` : `menuen fast ved siden af teksten ${k.navSynligFoer ? 'ja' : 'nej'}, overlapper teksten ${k.overlap ? 'ja' : 'nej'}, kapitel 6 lander ${k.landingTop}px fra toppen (efter 3 s blid rulning; forloeb ${k.landingForloeb.join(' ')})`);
    r(`${w} folde`, true, `${R.folde.length} folde, alle aabnet i maalingen`);
    r(`${w} N3-N6 (394)`, Object.values(R.n394).every((x) => !x.gammelt), Object.entries(R.n394).map(([n, x]) => `${n} ${x.gammelt ? 'staar der' : 'vaek'}`).join(', '));
    r(`${w} N2 kapitel 5's maerker`, R.k5MindstePx >= 11, `mindste tekst i kapitel 5's figurer ${R.k5MindstePx} px`);
    r(`${w} vandret rulning`, R.sideBredde <= w, `${R.sideBredde} px, konsol i artiklen ${R.artikelKonsol.length}`);
  }
  const o = U.offentligt;
  r('pushet', o.hits.atletnavne.length === 0, `${o.commitsForanOrigin} commits foran origin/main ${o.originMain} (lokal main foran: ${o.mainForanOrigin.length}), ${o.nyeFiler} nye filer (${Object.entries(o.prMappe).map(([d, n]) => `${d} ${n}`).join(', ')}); outputs/ gaar fra ${o.outputsFoer} til ${o.outputsEfter} offentlige filer`);
  r('offentlige tekstfiler', !o.hits.marcSvarede.length, `${o.tekstfiler} nye tekstfiler: interne navne i ${o.hits.interne.length}, Marcs ubesvarede stikord/"digtes" i ${o.hits.marcSvarede.length} (${o.hits.marcSvarede.slice(0, 4).join(', ')}), atletnavne (${o.atletnavneTjekket} fornavne tjekket) i ${o.hits.atletnavne.length}${o.hits.atletnavne.length ? ' (' + o.hits.atletnavne.join(', ') + ')' : ''}`);
  const d = U.deploy;
  r('deploy-kommandoerne', !d.kollision.length && d.mergeTree === 'rent', `deploy-mappen staar paa ${d.gren}, ${d.aendredeSporede} aendrede sporede filer, ${d.usporet} usporede; usporede filer grenen vil skrive over: ${d.kollision.map((x) => `${x.fil} (${x.samme ? 'samme indhold' : 'andet indhold'})`).join(', ') || 'ingen'}; merge-tree main+${REV}: ${d.mergeTree}`);
  return L;
}

async function main() {
  const site = traek();
  maal.siteRev = `${REV} ${site.hash}`;
  const s = await server(site.mappe);
  const base = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const log = [`Kritik 432 mod ${maal.siteRev} (headless Chromium, 390x844 touch 2x og 1280x900)`];
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
      for (const [n, v] of Object.entries(res.a)) log.push(`${v.ok ? 'LUKKET' : 'AABEN '} ${n}: ${v.hvad}`);
      const st = res.stil;
      log.push(`Stil: tankestreger ${st.tankestreger}, "man skal" ${st.manSkal}, "skal" ${st.skal}, interne navne ${st.interne}, udraabstegn ${st.udraab}, "kapitel N" ${st.kapitelHenvisninger}, "referencekrop" ${st.referencekrop}, "i modellen" ${st.iModellen}, jeg/min ${st.jeg}, forbehold sidst ${st.forbeholdSidst ? 'ja' : 'nej'}.`);
      log.push(`Laengde: ${st.ordLukket} ord lukket, ${st.ordAabne} aabne, ${st.skaerme390} skaerme paa 390 med folde aabne; siden siger "${st.laesetid}". Konsol: ${st.konsol.length}. Vandret rulning paa 390: ${st.vandretRulning390 ? 'ja' : 'nej'}.`);
      log.push(`Egennavne i broedteksten (gennemgaaet for atletnavne): ${res.egennavne.join(', ')}`);
      log.push(`Lukket: ${fund.filter(([, v]) => v.ok).map(([n]) => n).join(', ')}. Aabne: ${fund.filter(([, v]) => !v.ok && !v.venter).map(([n]) => n).join(', ') || 'ingen'}. Venter: ${fund.filter(([, v]) => v.venter).map(([n]) => n).join(', ')}.`);
    }
    if (blok === 'udgivelse' || blok === 'alle') {
      log.push('', '--- Blok 3: udgivelsen (ORDRE 432) ---', ...udgivelseLog(await udgivelse(browser, base, site.mappe)));
    }
  } finally {
    await browser.close(); s.close();
    writeFileSync(maalFil, JSON.stringify(maal, null, 2));
  }
  if (log.length > 1) { writeFileSync(ud('resultat.txt'), log.join('\n') + '\n'); console.log(log.join('\n')); }
  console.log(`\nKritik 432 (${blok}) faerdig. Alt output i ${UD_VIST}.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
