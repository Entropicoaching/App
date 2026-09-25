// ORDRE 374 - Bhishak som KRITIKER: squat-opslagsvaerket (site, squat-opslag-7) laest paa telefonen,
// og broektrappen (matematik main) spillet som elev. Retter intet og committer intet i de to repoer:
// hver revision traekkes ud med `git archive` til en midlertidig mappe, og kun den koeres headless.
// Ingen elevdata (spilfiguren hedder "Ravn"; alt ligger i en flygtig browserprofil), ingen atletnavne.
//
// Brug: node scripts/kritik-374.mjs [--kun squat|broek]   (npm run verify:kritik-374)
// Udgang: outputs/kritik-374/ (alle skaermbilleder + maalinger.json). Exit 1 kun hvis scriptet selv fejler.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak'; // kun for at laane playwright
const SITE_ROD = 'C:\\Users\\Entropi\\Desktop\\entropi-coaching-site-wt2';
const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright');
const kun = process.argv.includes('--kun') ? process.argv[process.argv.indexOf('--kun') + 1] : null;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik374-'));
function traek(rod, navn, rev) {
  const mappe = path.join(tmp, navn);
  mkdirSync(mappe, { recursive: true });
  execFileSync('git', ['-C', rod, 'archive', '--format=tar', '-o', path.join(tmp, `${navn}.tar`), rev]);
  execFileSync('tar', ['-xf', `${navn}.tar`, '-C', navn], { cwd: tmp });
  const hash = execFileSync('git', ['-C', rod, 'rev-parse', '--short', rev]).toString().trim();
  return { mappe, hash };
}
const ud = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-374');
mkdirSync(ud, { recursive: true });
const maalFil = path.join(ud, 'maalinger.json');
const maal = existsSync(maalFil) ? JSON.parse(readFileSync(maalFil, 'utf8')) : {};
const skaerm = (page, navn, opts = {}) => page.screenshot({ path: path.join(ud, navn), ...opts });
const konsol = (page, liste) => {
  page.on('pageerror', (e) => liste.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') liste.push(`console.${m.type()}: ${m.text().slice(0, 160)}`); });
  page.on('requestfailed', (r) => liste.push(`requestfailed: ${r.url().slice(0, 100)}`));
  page.on('response', (r) => { if (r.status() >= 400) liste.push(`${r.status()}: ${r.url().slice(0, 100)}`); });
};

// ---------- BLOK 1: SQUAT-ARTIKLEN ----------
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

// Maales i siden: hvert kapitel, dets tekst (som laeseren ser den), figurer og stilregler.
const KAPITEL_MAAL = () => {
  const vb = document.documentElement.clientWidth, vh = innerHeight;
  const synlig = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden' && e.offsetParent !== null; };
  const kaps = [...document.querySelectorAll('h2[id^="h-"]')];
  const ud = [];
  const intro = [];
  for (let n = document.querySelector('article h1, main h1, h1'); n; n = n.nextElementSibling ?? n.parentElement?.nextElementSibling) {
    if (n.matches?.('h2[id^="h-"]') || n.querySelector?.('h2[id^="h-"]')) break;
    if (intro.length > 60) break;
    intro.push(n);
  }
  for (const h of kaps) {
    const sek = h.closest('section') ?? h.parentElement;
    const r = sek.getBoundingClientRect();
    const figurer = [...sek.querySelectorAll('figure, canvas, img, svg:not(figure svg):not(button svg)')].filter(synlig).filter((e) => !e.closest('figure') || e.tagName === 'FIGURE').map((e) => {
      const b = e.getBoundingClientRect();
      const img = e.tagName === 'FIGURE' ? e.querySelector('img, canvas, svg') : e;
      const ib = img?.getBoundingClientRect();
      let skriftSkala = null;
      if (img?.tagName === 'IMG' && img.naturalWidth) skriftSkala = Math.round((ib.width / img.naturalWidth) * 100) / 100;
      if (img?.tagName?.toLowerCase() === 'svg') {
        const tx = [...img.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * (ib.width / (img.viewBox?.baseVal?.width || ib.width)));
        if (tx.length) skriftSkala = { mindsteSvgTekstPx: Math.round(Math.min(...tx) * 10) / 10 };
      }
      return { tag: e.tagName.toLowerCase(), id: e.id || img?.id || '', src: img?.getAttribute?.('src')?.split('/').pop() ?? '', caption: e.querySelector?.('figcaption')?.innerText.slice(0, 90) ?? '', b: Math.round(b.width), h: Math.round(b.height), billedB: ib ? Math.round(ib.width) : null, billedH: ib ? Math.round(ib.height) : null, hoejereEndVindue: b.height > vh, bredereEndVindue: b.right > vb + 1, naturligB: img?.naturalWidth ?? null, skala: skriftSkala };
    });
    const smaa = [...sek.querySelectorAll('button, a, input, select, summary, label, [role=button]')].filter(synlig).map((e) => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 22), b: Math.round(b.width), h: Math.round(b.height) }; }).filter((x) => x.b < 44 || x.h < 44);
    let mindste = 99, mindsteT = '';
    for (const e of sek.querySelectorAll('p,li,td,th,figcaption,small,span,summary,label,button,text,dd,dt')) {
      if (!synlig(e) && e.tagName !== 'text') continue;
      const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (!t) continue;
      const px = parseFloat(getComputedStyle(e).fontSize);
      if (px < mindste) { mindste = px; mindsteT = `${e.tagName.toLowerCase()}: "${t.slice(0, 30)}"`; }
    }
    const udenfor = [...sek.querySelectorAll('*')].filter(synlig).filter((e) => { const b = e.getBoundingClientRect(); return b.right > vb + 1 || b.left < -1; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`).slice(0, 6);
    const tekst = sek.innerText;
    ud.push({ id: h.id, titel: h.innerText.replace(/\s+/g, ' ').trim(), top: Math.round(r.top + scrollY), hoejde: Math.round(r.height), skaerme: Math.round((r.height / vh) * 10) / 10, ord: tekst.split(/\s+/).filter(Boolean).length, marc: (tekst.match(/\[MARC:/g) || []).length, figurer, smaaTryk: smaa, mindsteSkriftPx: mindste, mindsteSkriftEl: mindsteT, udenForSkaerm: udenfor });
  }
  return { vindue: { b: vb, h: vh }, sideHoejde: document.documentElement.scrollHeight, scrollBredde: document.documentElement.scrollWidth, skaerme: Math.round((document.documentElement.scrollHeight / vh) * 10) / 10, kapitler: ud };
};

// Stilregler paa den synlige tekst (alle folder aabne): tankestreger, "man skal", meta-ord, interne navne.
const STIL = () => {
  const t = document.body.innerText;
  const linjer = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const fund = (re) => linjer.filter((l) => re.test(l)).map((l) => { const m = l.match(re); const i = Math.max(0, m.index - 50); return l.slice(i, m.index + 70); });
  return {
    emDash: fund(/\u2014/), enDash: fund(/\u2013/), manSkal: fund(/\bman skal\b/i), skal: fund(/\bskal\b/i).length,
    meta: fund(/\b(herunder|herover|ovenfor|nedenfor|i dette kapitel|kapitlet handler|som vi så|se kapitel|læs videre)\b/i),
    kapitelHenvisninger: fund(/\(kapitel \d\)|kapitel \d\b/i).length,
    interne: fund(/\b(Yantra|Setu|Ganita|Drishti|Bhishak|Vaidya|RAPPORT|ordre \d|dag \d\d)\b/),
    marc: fund(/\[MARC:/).length,
    udraabstegn: fund(/!/),
    tomt: fund(/\[ \]|TODO|lorem/i),
    disclaimerLinjer: linjer.map((l, i) => [i, l]).filter(([, l]) => /forbehold|ikke medicinsk|ikke rådgivning|erstatter ikke|disclaimer/i.test(l)).map(([i, l]) => ({ linje: i, af: linjer.length, tekst: l.slice(0, 90) })),
  };
};

async function squatSession(browser, base, w, h, navn) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, deviceScaleFactor: w < 800 ? 2 : 1 });
  const page = await ctx.newPage();
  const fejl = [];
  konsol(page, fejl);
  await page.goto(`${base}/artikel-squat.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // lazy-billeder: rul hele vejen ned som en laeser, saa de indlaeses
  const hoejde = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hoejde; y += h * 0.8) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(60); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  const Q = {};
  Q.foldeLukket = await page.evaluate(KAPITEL_MAAL);
  Q.foersteSkaerm = await page.evaluate(() => innerHeight && document.elementsFromPoint ? [...document.querySelectorAll('h1, .lede, .ingress, header p, article > p')].filter((e) => e.getBoundingClientRect().top < innerHeight).map((e) => e.innerText.slice(0, 200)) : []);
  await skaerm(page, `squat-${navn}-00-top.png`);
  // hvert kapitel, lukket, skaerm for skaerm (kun paa telefonen; desktop faar et billede pr. kapitel)
  for (const k of Q.foldeLukket.kapitler) {
    const nr = k.id.replace('h-', '');
    if (w < 800) {
      const n = Math.min(Math.ceil(k.hoejde / h), 30);
      for (let i = 0; i < n; i++) {
        await page.evaluate((yy) => scrollTo(0, yy), k.top + i * h - 8);
        await page.waitForTimeout(90);
        await skaerm(page, `squat-${navn}-${nr}-${String(i + 1).padStart(2, '0')}.png`);
      }
    } else {
      await page.evaluate((yy) => scrollTo(0, yy), k.top - 8);
      await page.waitForTimeout(90);
      await skaerm(page, `squat-${navn}-${nr}.png`);
    }
  }
  // Intro (foer kapitel 1): tekst
  Q.intro = await page.evaluate(() => { const h2 = document.querySelector('h2[id^="h-"]'); const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT); let n; while ((n = w.nextNode())) { if (n === h2) break; if (/^(P|H1|LI)$/.test(n.tagName) && n.innerText.trim() && !n.closest('nav, header .site-nav, details.toc')) out.push(n.innerText.trim()); } return out; });
  // Panelet i kapitel 2: tryk paa de synlige knapper/valg, og maal
  Q.panel = await page.evaluate(() => { const p = document.querySelector('#squat-canvas')?.closest('section, .loeft-panel, figure, div'); if (!p) return null; const b = p.getBoundingClientRect(); const c = document.querySelector('#squat-canvas').getBoundingClientRect(); const knapper = [...p.querySelectorAll('button, select, input, label')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.type || '').trim().slice(0, 20), b: Math.round(r.width), h: Math.round(r.height) }; }); return { b: Math.round(b.width), h: Math.round(b.height), canvasB: Math.round(c.width), canvasH: Math.round(c.height), knapper }; });
  // Panelet som en coach bruger det: vaelg hver kropstype og stang, laes etiketter og aflaesning,
  // og maal om figuren og skyderen kan ses paa samme skaerm.
  const panelLaes = () => page.evaluate(() => {
    const c = document.querySelector('#squat-canvas'); const p = c.closest('.loeft-panel, figure, section');
    const etiketter = [...p.querySelectorAll('label, .panel-label, legend, dt, .loeft-label')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((t) => /°|ANKEL|SKINNE/i.test(t)).slice(0, 4);
    const aflaes = [...p.querySelectorAll('dd, .loeft-readout, output, .aflaesning, li')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8);
    const skydere = [...p.querySelectorAll('input[type=range]')].map((s) => ({ min: s.min, max: s.max, value: s.value, disabled: s.disabled }));
    const tekst = p.innerText.split('\n').map((l) => l.trim()).filter((l) => /mulig positur|Ingen|dybdekrav/i.test(l)).slice(0, 4);
    return { etiketter, aflaes, skydere, tekst };
  });
  const panelKnap = (t) => page.locator('button, label').filter({ hasText: new RegExp(`^\\s*${t}\\s*$`, 'i') }).first();
  Q.panelKombinationer = [];
  for (const krop of ['Balanceret', 'Lang lårknogle', 'Lang torso']) {
    for (const stang of ['Lowbar', 'Highbar']) {
      try { await panelKnap(krop).click({ timeout: 2000 }); await panelKnap(stang).click({ timeout: 2000 }); await page.waitForTimeout(250); Q.panelKombinationer.push({ krop, stang, ...(await panelLaes()) }); } catch (e) { Q.panelKombinationer.push({ krop, stang, fejl: e.message.slice(0, 80) }); }
    }
  }
  await panelKnap('Balanceret').click().catch(() => {}); await panelKnap('Lowbar').click().catch(() => {});
  Q.panelSamtidig = await page.evaluate(() => {
    const c = document.querySelector('#squat-canvas').getBoundingClientRect();
    const s = [...document.querySelectorAll('#squat-canvas ~ * input[type=range], .loeft-panel input[type=range]')].pop() ?? document.querySelector('input[type=range]');
    const r = s.getBoundingClientRect();
    const spaend = Math.round(r.bottom + scrollY - (c.top + scrollY));
    return { canvasTop: Math.round(c.top + scrollY), skyderBund: Math.round(r.bottom + scrollY), spaendPx: spaend, vindue: innerHeight, kanSesSamtidig: spaend <= innerHeight };
  });
  if (w < 800) {
    const sk = page.locator('input[type=range]').first();
    await sk.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
    await skaerm(page, `squat-${navn}-segmentmodellen-skyder-i-syne.png`);
  }
  Q.tabeller = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => { const b = t.getBoundingClientRect(); let o = t.parentElement, wrap = null; while (o && o !== document.body) { const cs = getComputedStyle(o); if (/auto|scroll/.test(cs.overflowX)) { wrap = { kl: String(o.className).split(' ')[0], b: Math.round(o.clientWidth), scrollB: o.scrollWidth }; break; } o = o.parentElement; } return { kl: String(t.className).split(' ')[0], b: Math.round(b.width), synligB: document.documentElement.clientWidth, kolonner: t.querySelectorAll('thead th').length, overskrifter: [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim()), rulleramme: wrap, kommaCeller: [...t.querySelectorAll('td')].filter((x) => x.innerText.trim() === ',').length }; }));
  // Aabn alle folder og maal igen
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(500);
  Q.foldeAabne = await page.evaluate(KAPITEL_MAAL);
  Q.stil = await page.evaluate(STIL);
  Q.foldeTitler = await page.evaluate(() => [...document.querySelectorAll('details > summary')].map((s) => s.innerText.trim()));
  Q.ordLukket = Q.foldeLukket.kapitler.reduce((a, k) => a + k.ord, 0);
  Q.ordAabne = Q.foldeAabne.kapitler.reduce((a, k) => a + k.ord, 0);
  Q.laesetidTekst = await page.evaluate(() => (document.body.innerText.match(/\d+\s*min[^\n]{0,20}/) || [''])[0]);
  if (w < 800) {
    writeFileSync(path.join(ud, `squat-${navn}-tekst-aabne-folder.txt`), await page.evaluate(() => document.body.innerText));
    for (const k of Q.foldeAabne.kapitler) {
      await page.evaluate((yy) => scrollTo(0, yy), k.top - 8); await page.waitForTimeout(60);
      await skaerm(page, `squat-${navn}-${k.id.replace('h-', '')}-aaben-01.png`);
    }
  }
  Q.konsol = fejl;
  maal[`squat-${navn}`] = Q;
  await ctx.close();
}

// ---------- BLOK 2: BROEKTRAPPEN SPILLET SOM ELEV ----------
// Eleven laeser opgaven, regner facit ud (som en elev der kan det), og laver i foerste runde af hvert
// forloeb bevidst den typiske fejl paa alle opgaver fra forloebets NYE trin. Saa skal mestringen
// fejle, og forloebet komme igen med nye tal; i anden runde svares rigtigt, og det uforkortede svar
// (4/6 for 2/3) vaelges, naar det staar der. Et sted svares det samme forkerte svar tre gange (fast).
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
const minus = (a, b) => R(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const BL = '(\\d+ \\d+/\\d+|\\d+/\\d+)';
// Klassificerer opgaven til et trin (efter BROEK-TRAPPE.md) og regner facit.
function loesOpgave(tekst) {
  let m;
  if ((m = /delt (?:sin mark )?i (\d+) lige store (felter|stykker), og (\d+) er/.exec(tekst))) return { trin: 1, facit: R(+m[3], +m[1]), n: +m[1], m: +m[3] };
  if ((m = /deler (\d+) sæk(?:ke)? korn ligeligt mellem (\d+) gårde/.exec(tekst))) return { trin: 2, facit: R(+m[1], +m[2]), s: +m[1], g: +m[2] };
  if ((m = /malede mølleren (\d+)\/(\d+) sæk, om tirsdagen (\d+)\/(\d+) sæk/.exec(tekst))) return { trin: 3, facit: +m[1] > +m[3] ? R(+m[1], +m[2]) : R(+m[3], +m[4]) };
  if ((m = /en sæk i (\d+) lige store dele, en anden dag i (\d+) lige store dele/.exec(tekst))) return { trin: 3, facit: R(1, Math.min(+m[1], +m[2])) };
  if ((m = /størst: (\d+)\/(\d+) sæk eller (\d+)\/(\d+) sæk/.exec(tekst))) return { trin: 3, facit: R(+m[1], Math.min(+m[2], +m[4])) };
  if ((m = /Hvilken brøk er lige så meget som (\d+)\/(\d+)/.exec(tekst))) return { trin: 4, facit: R(+m[1], +m[2]) };
  if ((m = /skrevet (\d+)\/(\d+) sæk i regnebogen/.exec(tekst))) return { trin: 4, facit: R(+m[1], +m[2]), kort: true };
  if ((m = /fylder (\d+)\/(\d+) sæk korn om morgenen og (\d+)\/(\d+) sæk/.exec(tekst))) return { trin: 5, art: 'plus', facit: plus(R(+m[1], +m[2]), R(+m[3], +m[4])), d: +m[2] };
  if ((m = /har (\d+) sække mel\. (\d+)\/(\d+) af dem/.exec(tekst))) return { trin: 6, facit: R((+m[1] * +m[2]) / +m[3]), M: +m[1], a: +m[2], b: +m[3] };
  if ((m = new RegExp(`har ${BL} sæk hvedemel og ${BL} sæk rugmel`).exec(tekst))) return { trin: 7, art: 'plus', facit: plus(laesTal(m[1]), laesTal(m[2])) };
  if ((m = new RegExp(`havde ${BL} sæk mel og brugte ${BL} sæk til brød`).exec(tekst))) return { trin: 7, art: 'minus', facit: minus(laesTal(m[1]), laesTal(m[2])) };
  if ((m = /har (\d+)\/(\d+) sæk mel\. Skriv det som et blandet tal/.exec(tekst))) return { trin: 8, art: 'omskriv', facit: R(+m[1], +m[2]) };
  if ((m = new RegExp(`har ${BL} sæk mel og får ${BL} sæk mere`).exec(tekst))) return { trin: 8, art: 'plus', facit: plus(laesTal(m[1]), laesTal(m[2])) };
  if ((m = new RegExp(`havde ${BL} sæk mel og solgte ${BL} sæk`).exec(tekst))) {
    const blandet = / \d+\//.test(m[1]) || / \d+\//.test(m[2]);
    return { trin: blandet ? 8 : 5, art: 'minus', facit: minus(laesTal(m[1]), laesTal(m[2])) };
  }
  return { trin: null, facit: null };
}
// Den typiske fejl eleven laver bevidst (ordrens tre: forkert naevner ved addition, 4/6-agtige svar,
// glemt helhed ved broek af en maengde) - vaelges blandt de viste forkerte svar.
function typiskFejl(l, valg) {
  const v = valg.map((t) => ({ t, x: laesTal(t) }));
  const forkerte = v.filter((o) => !(l.trin === 3 ? o.x && ens(o.x, l.facit) : o.x && ens(o.x, l.facit)));
  const find = (fn) => forkerte.find(fn);
  let o = null, hvilken = '';
  if (l.trin === 1) { o = find((f) => f.x && f.x[0] * l.m === l.n * f.x[1]); hvilken = 'byttet taeller og naevner'; if (!o) { o = find((f) => f.x && ens(f.x, R(l.n - l.m, l.n))); hvilken = 'talt de umalede'; } }
  if (l.trin === 2) { o = find((f) => f.x && ens(f.x, R(l.g, l.s))); hvilken = 'gaarde over saekke'; }
  if (l.trin === 3) { o = find((f) => f.x); hvilken = 'flere dele = stoerre'; }
  if (l.trin === 4) { o = find((f) => f.x && f.x[0] * l.facit[1] < l.facit[0] * f.x[1]); hvilken = 'kun naevneren ganget/trukket fra'; }
  if (l.trin === 5 && l.art === 'plus') { o = find((f) => f.x && f.x[1] > l.d && /\/(\d+)/.exec(f.t) && Number(/\/(\d+)/.exec(f.t)[1]) === 2 * l.d); hvilken = 'naevnerne lagt sammen'; }
  if (l.trin === 6) { o = find((f) => f.x && f.x[0] === l.M * l.a); hvilken = 'glemt at dele helheden i grupper'; if (!o) { o = find((f) => f.x && f.x[0] === l.M / l.b); hvilken = 'kun een gruppe'; } }
  if (l.trin === 7 && l.art === 'plus') { o = find((f) => /\//.test(f.t)); hvilken = 'taeller+taeller, naevner+naevner (eller taeller ikke ganget)'; }
  if (!o) { o = forkerte.find((f) => f.t !== undefined); hvilken = hvilken ? `${hvilken} (ikke vist, tog et andet forkert)` : 'foerste forkerte'; }
  return o ? { tekst: o.t, hvilken } : null;
}

async function broekSession(browser) {
  const mat = traek(MAT_ROD, 'mat', 'main');
  maal.matRev = `main ${mat.hash}`;
  const url = pathToFileURL(path.join(mat.mappe, 'spil.html')).href;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const fejl = [];
  konsol(page, fejl);
  const B = { forloeb: [], skaermbilleder: [] };
  const bille = async (navn) => { await skaerm(page, navn); B.skaermbilleder.push(navn); };
  await page.goto(url);
  await page.waitForSelector('#op-navn');
  await page.fill('#op-navn', 'Ravn');
  await page.locator('.opret-udseende').nth(1).click();
  await page.click('#op-start');
  await page.waitForSelector('.spil-figur');
  await page.waitForTimeout(400);
  const lukBanner = async () => { if (await page.locator('.niveau-banner').isVisible().catch(() => false)) { await page.click('#niveau-banner-luk'); await page.waitForTimeout(40); } };
  const aabnKlynge = async () => { const k = page.locator('.sted-knap--klynge'); if ((await k.count()) > 0 && (await k.getAttribute('aria-expanded')) === 'false') { await k.tap(); await page.waitForTimeout(80); } };
  const stedKnap = (navn) => page.locator('.sted-knap').filter({ has: page.locator('.sted-navn', { hasText: new RegExp(`^${navn}$`) }) });
  const stedStatus = async () => { await aabnKlynge(); const ud = await page.evaluate(() => [...document.querySelectorAll('.sted-knap')].filter((e) => e.querySelector('.sted-navn')).map((e) => ({ navn: e.querySelector('.sted-navn').textContent, aaben: !e.disabled, krav: e.querySelector('.sted-krav')?.textContent ?? null }))); await aabnKlynge(); return ud; };
  const gaaTil = async (navn) => { await aabnKlynge(); await stedKnap(navn).tap(); await page.waitForTimeout(250); await lukBanner(); };
  const laesQuest = () => page.evaluate(() => ({
    kaede: document.querySelector('.quest-kaede-tal')?.textContent ?? '', titel: document.querySelector('.quest-kort h3')?.textContent ?? '',
    replik: document.querySelector('.quest-replik')?.textContent ?? '', fremdrift: document.querySelector('.quest-fremdrift')?.textContent ?? '',
    status: document.querySelector('.quest-status')?.textContent ?? '',
    opgave: document.querySelector('.quest-opgave-tekst')?.textContent ?? '', valg: [...document.querySelectorAll('.quest-svar button')].map((b) => b.textContent.trim()),
    beskeder: [...document.querySelectorAll('.quest-besked')].map((e) => ({ art: e.className.replace('quest-besked ', ''), tekst: e.textContent.trim() })),
    videre: !!document.querySelector('#quest-videre'),
  }));
  const hintSynlig = () => page.evaluate(() => { const e = [...document.querySelectorAll('.quest-besked')].pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), vindue: innerHeight, heltSynlig: r.top >= 0 && r.bottom <= innerHeight }; });
  const tryk = async (tekst) => { const k = page.locator('.quest-svar button').filter({ hasText: new RegExp(`^${tekst.replace(/[/]/g, '\\/')}$`) }).first(); await k.scrollIntoViewIfNeeded(); await k.tap(); await page.waitForTimeout(90); };

  // Kirken (altid aaben): hvad moeder en elev dér, foer Moellen har introduceret trin 2 og 3?
  B.startSteder = await stedStatus();
  try {
    await gaaTil('Kirken');
    const k = await laesQuest();
    B.kirkenFoerst = { titel: k.titel, replik: k.replik, opgaver: [] };
    await bille('broek-00-kirken-foerste-opgave.png');
    // Kirkens foerste forloeb spilles helt (rigtige svar), for at se hvilke trin det kraever paa dag 1.
    for (let i = 0; i < 6; i++) {
      const q = await laesQuest();
      if (!q.opgave || q.titel !== k.titel) break;
      const l = loesOpgave(q.opgave);
      const rigtigt = q.valg.filter((t) => { const x = laesTal(t); return x && l.facit && ens(x, l.facit); });
      B.kirkenFoerst.opgaver.push({ opgave: q.opgave, valg: q.valg, trin: l.trin });
      if (l.trin === 3 && !B.skaermbilleder.includes('broek-00-kirken-trin3.png')) await bille('broek-00-kirken-trin3.png');
      for (const svar of rigtigt.length ? [rigtigt[0]] : q.valg) { if (await page.locator('#quest-videre').isVisible().catch(() => false)) break; await tryk(svar); }
      if (await page.locator('#quest-videre').isVisible().catch(() => false)) { await page.locator('#quest-videre').tap(); await page.waitForTimeout(120); }
      await lukBanner();
    }
  } catch (e) { B.kirkenFoerst = { fejl: e.message.slice(0, 80) }; }
  await gaaTil('Møllen');
  await bille('broek-01-moellen-start.png');

  const traeHintBillede = new Set();
  let fastTestet = false;
  for (let k = 1; k <= 8; k++) {
    const F = { forloeb: k, runder: [] };
    for (let runde = 1; runde <= 3; runde++) {
      const q0 = await laesQuest();
      const R0 = { runde, kaede: q0.kaede, titel: q0.titel, replik: q0.replik, fremdriftFoer: q0.fremdrift, mestringsbeskedVed: q0.beskeder.filter((b) => /første forsøg/.test(b.tekst)).map((b) => b.tekst), opgaver: [] };
      if (!new RegExp(`Forløb ${k} af`).test(q0.kaede)) { R0.uventet = `forventede forloeb ${k}, stod: ${q0.kaede} ${q0.status}`; F.runder.push(R0); break; }
      if (runde > 1 && !traeHintBillede.has(`mestring-${k}`)) { traeHintBillede.add(`mestring-${k}`); await page.locator('.quest-fremdrift').scrollIntoViewIfNeeded(); await bille(`broek-${String(k).padStart(2, '0')}-mestring-runde${runde}.png`); }
      for (let i = 0; i < 8; i++) {
        const q = await laesQuest();
        if (!q.opgave || !new RegExp(`Forløb ${k} af`).test(q.kaede)) break;
        const l = loesOpgave(q.opgave);
        const rec = { opgave: q.opgave, valg: q.valg, trin: l.trin, forsoeg: [] };
        const rigtigt = q.valg.filter((t) => { const x = laesTal(t); return x && l.facit && ens(x, l.facit); });
        const uforkortet = rigtigt.find((t) => { const x = /^(\d+)\/(\d+)$/.exec(t); return x && gcd2(+x[1], +x[2]) > 1; });
        const plan = [];
        if (runde === 1 && l.trin === k) {
          const f = typiskFejl(l, q.valg);
          if (f) { plan.push(f.tekst); rec.bevidstFejl = f.hvilken; }
          if (!fastTestet && k === 7 && f) { plan.push(f.tekst, f.tekst); fastTestet = true; rec.fastTest = 'samme forkerte svar tre gange'; }
        }
        if (rigtigt.length) plan.push(uforkortet ?? rigtigt[0]); else { plan.push(...q.valg); rec.ukendt = true; }
        for (const svar of plan) {
          const foer = await laesQuest();
          if (foer.videre) break;
          await tryk(svar);
          const efter = await laesQuest();
          const sidste = efter.beskeder.filter((b) => !/første forsøg/.test(b.tekst)).pop() ?? null;
          rec.forsoeg.push({ svar, besked: sidste?.tekst ?? '', art: sidste?.art ?? '', hintSynlig: await hintSynlig() });
          const navn = sidste && /hint/.test(sidste.art) ? `hint-trin${l.trin}` : sidste && /loesning/.test(sidste.art) ? 'loesning' : sidste && sidste.tekst !== 'Rigtigt!' ? 'ros' : null;
          if (navn && !traeHintBillede.has(navn)) { traeHintBillede.add(navn); await bille(`broek-${String(k).padStart(2, '0')}-${navn}.png`); }
        }
        rec.foersteForsoegRigtigt = rec.forsoeg[0] ? /korrekt/.test(rec.forsoeg[0].art) : null;
        R0.opgaver.push(rec);
        if (await page.locator('#quest-videre').isVisible().catch(() => false)) { await page.locator('#quest-videre').tap(); await page.waitForTimeout(120); }
        await lukBanner();
      }
      const q1 = await laesQuest();
      R0.efter = { kaede: q1.kaede, titel: q1.titel, status: q1.status, fremdrift: q1.fremdrift, beskeder: q1.beskeder.map((b) => b.tekst) };
      R0.rigtigeFoerste = R0.opgaver.filter((o) => o.foersteForsoegRigtigt).length;
      R0.raekkefoelgeTrin = R0.opgaver.map((o) => o.trin);
      R0.sidetekstHeleTrappen = await page.evaluate(() => /hele brøktrappen/i.test(document.body.innerText));
      F.runder.push(R0);
      if (!new RegExp(`Forløb ${k} af`).test(q1.kaede)) break; // videre til naeste forloeb (eller slut)
    }
    B.forloeb.push(F);
    if (k === 1 || k === 2) B[`stederEfterForloeb${k}`] = await stedStatus();
  }
  const slut = await laesQuest();
  B.slut = { status: slut.status, kaede: slut.kaede, heleTrappenNaevnt: await page.evaluate(() => /hele brøktrappen/i.test(document.body.innerText)) };
  await page.locator('.quest-kort').scrollIntoViewIfNeeded().catch(() => {});
  await bille('broek-99-slut.png');
  B.knapper = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 16), b: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.b < 44));
  B.konsol = fejl;
  maal.broek = B;
  await ctx.close();
}
async function broekSessioner(browser) { console.log('broektrappen 390'); await broekSession(browser); }

async function main() {
  const browser = await chromium.launch();
  try {
    if (kun !== 'broek') {
      const site = traek(SITE_ROD, 'site', 'squat-opslag-7');
      maal.siteRev = `squat-opslag-7 ${site.hash}`;
      const s = await server(site.mappe);
      const base = `http://127.0.0.1:${s.address().port}`;
      for (const [w, h, navn] of [[390, 844, '390'], [1280, 900, '1280']]) { console.log(`squat ${navn}`); await squatSession(browser, base, w, h, navn); }
      s.close();
    }
    if (kun !== 'squat') await broekSessioner(browser);
  } finally {
    await browser.close();
    writeFileSync(maalFil, JSON.stringify(maal, null, 2));
  }
  console.log(`\nKritik 374 faerdig (site ${maal.siteRev ?? '-'}, matematik ${maal.matRev ?? '-'}). Se outputs/kritik-374/.`);
}
await main().catch((e) => { console.error(e); process.exit(1); });
