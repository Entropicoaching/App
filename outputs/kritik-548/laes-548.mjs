// Kritik 548, blok 2: LAES-SQUAT.html (Setu 543) som Marc ville laese den, headless uden net
// paa 390 px med touch og 1280 px med mus. Og tre ting talt selv:
//   C  Marcs ord: hvert citat maerket "DINE STIKORD 13. SEP" / "DINE SVAR 26. SEP" / "21. SEP" / "NU"
//      holdt op mod kilden (git show paa entropi-coaching-site: artikel-squat-marcs-ord 915e57b's
//      outputs/SVAR-squat.md og artikel-squat.html, udgivelse-squat-min-krop 9390990, og Marcs svar i
//      ordrer/arkiv-ORDRE-Setu-398.md). Ordret? Klippet midt i Marcs saetning?
//   T  Sammenligningen: ord, overskrifter, figurer, tabeller, tankestreger og angivet laesetid for
//      deload og "Hvad laver en coach" paa sitets main 8df8846, talt af mig i samme browser.
//   L  Laesningen: skaerme, skrift, trykflader, kontrast i lys og moerk, vandret rul, net, JS-fejl.
//   node outputs/kritik-548/laes-548.mjs  -> laes-548.json og L-*.png
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LAES = 'C:/Users/Entropi/Desktop/LAES-SQUAT.html'
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site'
const show = (ref, f) => execSync(`git -C ${SITE} show ${ref}:${f}`, { encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\r/g, '')
const REF = { marc: '915e57b', ny: '9390990', main: '8df8846' }
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }

// Kilderne som tekst (de to artikler og memoet paa grenen).
const TMP = path.join(tmpdir(), 'kritik-548-site')
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
const skriv = (navn, s) => { const p = path.join(TMP, navn); writeFileSync(p, s); return pathToFileURL(p).href }
const stikord = show(REF.marc, 'outputs/SVAR-squat.md')
const svar398 = readFileSync('C:/Users/Entropi/Desktop/ordrer/arkiv-ORDRE-Setu-398.md', 'utf8').replace(/\r/g, '').split('\n').slice(12, 18).join('\n')
const U = {
  sep21: skriv('sep21.html', show(REF.marc, 'artikel-squat.html')),
  nu: skriv('nu.html', show(REF.ny, 'artikel-squat.html')),
  deload: skriv('artikel-deload.html', show(REF.main, 'artikel-deload.html')),
  coach: skriv('artikel-hvad-laver-en-coach.html', show(REF.main, 'artikel-hvad-laver-en-coach.html')),
}

const browser = await chromium.launch({ headless: true })
async function aabn(url, bredde, { moerk = false } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: moerk ? 'dark' : 'light' })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(m.text()) })
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  await page.goto(url, { waitUntil: 'load' })
  return { ctx, page, net, fejl }
}
const tekstAf = async (url) => { const S = await aabn(url, 1280); const t = await S.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await S.ctx.close(); return t }
const norm = (s) => s.replace(/\s+/g, ' ').replace(/[“”„]/g, '"').trim()

// --- L: laesningen -------------------------------------------------------------------------
const L = {}
for (const bredde of [390, 1280]) {
  for (const moerk of [false, true]) {
    const S = await aabn(pathToFileURL(LAES).href, bredde, { moerk })
    const m = await S.page.evaluate(() => {
      const H = innerHeight
      const top = (sel) => { const e = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim().startsWith(sel)); return e ? e.getBoundingClientRect().top + scrollY : null }
      const artikelStart = top('Hele artiklen')
      const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
      const bg = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; const a = c.match(/rgba\([^)]*,\s*([\d.]+)\)/); if (c && !/transparent/.test(c) && !(a && Number(a[1]) < 0.5)) return c; e = e.parentElement } return 'rgb(255,255,255)' }
      const foerArtikel = (e) => artikelStart === null || e.getBoundingClientRect().top + scrollY < artikelStart
      const tekster = [...document.querySelectorAll('p, li, td, th, summary, span, div, h3, small, code, q, blockquote')].filter((e) => e.offsetParent && foerArtikel(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
      let minSkrift = 99, minKontrast = 99, minKontrastTekst = ''
      for (const e of tekster) {
        const cs = getComputedStyle(e)
        minSkrift = Math.min(minSkrift, parseFloat(cs.fontSize))
        const a = lum(cs.color), b = lum(bg(e))
        const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        if (k < minKontrast) { minKontrast = k; minKontrastTekst = e.textContent.trim().slice(0, 60) }
      }
      const tryk = [...document.querySelectorAll('a, button, summary')].filter((e) => e.offsetParent && foerArtikel(e)).map((e) => ({ t: e.textContent.trim().slice(0, 40), h: Math.round(e.getBoundingClientRect().height) }))
      const broedskrift = parseFloat(getComputedStyle(document.querySelector('p')).fontSize)
      return {
        hoejde: document.documentElement.scrollHeight, skaerme: +(document.documentElement.scrollHeight / H).toFixed(1),
        valgSlut: +((top('Sammenlignet') ?? 0) / H).toFixed(1), sammenligningSlut: +((top('Dine ord') ?? 0) / H).toFixed(1), artikelStart: +((artikelStart ?? 0) / H).toFixed(1),
        side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
        minSkrift, broedskrift, minKontrast: +minKontrast.toFixed(2), minKontrastTekst,
        smaaTryk: tryk.filter((x) => x.h < 44), antalTryk: tryk.length,
        billeder: [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length,
        folde: document.querySelectorAll('details').length,
      }
    })
    L[`${bredde}${moerk ? '-moerk' : ''}`] = { ...m, net: S.net, fejl: S.fejl }
    if (!moerk) {
      await S.page.screenshot({ path: path.join(HERE, `L-${bredde}-top.png`) })
      if (bredde === 390) {
        for (const [navn, sel] of [['valg-7', '7Forbehold'], ['sammenligning', 'Sammenlignet'], ['dine-ord-kropstyper', 'Kropstyper']]) {
          await S.page.evaluate((s) => { const e = [...document.querySelectorAll('h2, h3')].find((h) => h.textContent.replace(/\s+/g, '').startsWith(s.replace(/\s+/g, ''))); if (e) e.scrollIntoView() }, sel)
          await S.page.screenshot({ path: path.join(HERE, `L-390-${navn}.png`) })
        }
      }
    }
    await S.ctx.close()
  }
}

// --- C: Marcs ord ------------------------------------------------------------------------------
const side = await tekstAf(pathToFileURL(LAES).href)
let citater = []
{
  const S = await aabn(pathToFileURL(LAES).href, 1280)
  citater = await S.page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim().startsWith('Dine ord'))
    const sek = h.closest('section') || h.parentElement
    return [...sek.querySelectorAll('q')].map((q) => { const k = q.querySelector('.k'); const t = q.textContent.slice(k ? k.textContent.length : 0).trim(); return { mrk: (k ? k.textContent : '').trim().toUpperCase(), q: t } })
  })
  await S.ctx.close()
}
const stikordLinjer = stikord.split('\n')
const stikordFlad = norm(stikord.replace(/\n\s+/g, ' '))
const tSep21 = norm(await tekstAf(U.sep21)), tNu = norm(await tekstAf(U.nu))
const C = { antal: citater.length, pr: {}, klippet: [], ikkeOrdret: [], ikkeMarc: [] }
for (const c of citater) {
  // Et citat kan slutte med Setus egen kommentar paa samme linje (fx "Samme pointe."): tag kun citatet.
  const q = norm(c.q)
  C.pr[c.mrk] = (C.pr[c.mrk] || 0) + 1
  let ordret = false
  if (c.mrk === 'DINE STIKORD 13. SEP') {
    ordret = stikordFlad.includes(q)
    const linje = stikordLinjer.findIndex((l) => norm(l.replace(/^-\s*/, '')).endsWith(q) || norm(l.replace(/^-\s*/, '')) === q || norm(l).includes(q))
    if (linje >= 0) {
      const l = stikordLinjer[linje].trim(), naeste = (stikordLinjer[linje + 1] || '').trim()
      // Klippet: citatet slutter, hvor kildelinjen slutter, og saetningen fortsaetter paa naeste linje.
      if (norm(l).endsWith(q) && !/[.:)]$/.test(q) && naeste && !/^[-#]/.test(naeste)) C.klippet.push({ q, mangler: naeste })
      if (/ikke besvaret/i.test(q) || /^Ikke besvaret/.test(l.replace(/^-\s*/, ''))) C.ikkeMarc.push({ q, grund: 'Dhruvas note "Ikke besvaret ...", ikke Marcs ord' })
    }
  } else if (c.mrk === 'DINE SVAR 26. SEP') ordret = norm(svar398).includes(q)
  else if (c.mrk === '21. SEP') ordret = tSep21.includes(q)
  else ordret = tNu.includes(q)
  if (!ordret) C.ikkeOrdret.push({ mrk: c.mrk, q })
}
C.svar398ErOrdret = /ordret i substans/.test(svar398)
C.siden = /dine egne ord, skrevet ned af Dhruva/.test(side)

// --- T: sammenligningen, talt selv ----------------------------------------------------------------
async function tael(url) {
  const S = await aabn(url, 1280)
  const r = await S.page.evaluate(() => {
    const ord = (s) => (s.match(/[0-9A-Za-zÆØÅæøåÉé][0-9A-Za-zÆØÅæøåÉé'-]*/g) || []).length
    const main = document.querySelector('main')
    const intro = main.querySelector('.article-intro'), body = main.querySelector('.article-body')
    const synligt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('script,style,.references,.author-strip,.article-next,.back-link,.toc,.loeft-panel,.loeft-controls,iframe,canvas,button,label,input,.kap-top,details').forEach((x) => x.remove()); document.body.appendChild(c); c.style.position = 'absolute'; c.style.left = '-99999px'; const t = c.innerText; c.remove(); return t }
    const brodP = [intro, ...body.querySelectorAll('p')].filter((p) => p && !p.closest('details,figure,table,.note,.references,.author-strip,.reflection,.loeft-panel,.article-figure,.mom-mount,figcaption'))
    return {
      ordUdenFold: ord(synligt(intro) + ' ' + synligt(body)),
      ordBroed: brodP.reduce((a, e) => a + ord(e.innerText), 0),
      overskrifter: body.querySelectorAll('h2,h3,h4').length, tabeller: body.querySelectorAll('table').length,
      laes: (document.querySelector('.meta-read') || {}).textContent || null,
      tankestregerSynligt: (document.body.innerText.match(/[–—]/g) || []).length,
      tankestregerIkkeRef: (synligt(intro) + synligt(body)).match(/[–—]/g)?.length || 0,
      aabner: (intro?.textContent || '').trim().split(/(?<=\.)\s/)[0],
    }
  })
  await S.ctx.close()
  return r
}
const T = { deload: await tael(U.deload), coach: await tael(U.coach), squat21: await tael(U.sep21) }
// Fagord i de ni valg (fast liste; om de er forklaret, er min vurdering i LAES-SQUAT.md).
const valgTekst = side.split('De ni valg')[2]?.split('Sammenlignet med artiklerne på sitet')[0] || ''
const FAG = ['noindex', 'sitemap', 'datePublished', 'commit', 'assets/', 'src=', 'kildekode', 'vis kilde', 'outputs/', 'scripts/', 'HTTP 200', 'main', 'gren', 'fold', 'indlejre', 'bundt', 'U2', 'U5', 'U6', 'U7', 'U8', 'U10', 'U11', 'U13', 'N1/V8', 'kildemærke', 'jeg-form', 'fagord', 'segmentmodel']
T.fagordIValg = Object.fromEntries(FAG.map((f) => [f, (valgTekst.match(new RegExp(f.replace(/[/.]/g, '\$&'), 'g')) || []).length]).filter(([, n]) => n))
T.valgOrd = (valgTekst.match(/\S+/g) || []).length
// Setus tal paa siden.
const setuTal = (navn) => { const i = side.indexOf(` ${navn} `, side.indexOf('Sammenlignet med artiklerne på sitet')); return side.slice(i, i + 140) }
T.setuDeload = setuTal('Deload'); T.setuCoach = setuTal('Hvad laver en coach')
await browser.close()

// --- tjek ------------------------------------------------------------------------------------
const B = ['390', '1280', '390-moerk', '1280-moerk']
paastaa('Ingen vandret rulning paa 390 og 1280, lys og moerk', B.every((b) => L[b].side <= L[b].klient), B.map((b) => [L[b].side, L[b].klient]))
paastaa('Intet net og ingen JS- eller konsolfejl', B.every((b) => L[b].net.length === 0 && L[b].fejl.length === 0), B.map((b) => [L[b].net.length, L[b].fejl]))
paastaa('Alle billeder er indlaest', B.every((b) => L[b].billeder === 0))
paastaa('Skrift uden for artiklen: mindste maalt (fund: under 12 px er etiketterne og tallenes parenteser)', B.every((b) => L[b].minSkrift > 10), B.map((b) => [L[b].minSkrift, L[b].broedskrift]))
paastaa('Kontrast uden for artiklen: mindste maalt, over 4 i lys og moerk (under 4,5 er et lavt fund)', B.every((b) => L[b].minKontrast >= 4), B.map((b) => [L[b].minKontrast, L[b].minKontrastTekst]))
paastaa('Siden paa 390: skaerme til valgene, sammenligningen, Marcs ord og artiklen maalt', L['390'].skaerme > 0 && L['390'].artikelStart > 0, { skaerme: L['390'].skaerme, valgSlut: L['390'].valgSlut, sammenligningSlut: L['390'].sammenligningSlut, artikelStart: L['390'].artikelStart })
paastaa('Trykflader foer artiklen maalt (under 44 px taelles)', true, { antal: L['390'].antalTryk, under44: L['390'].smaaTryk.length, eks: L['390'].smaaTryk.slice(0, 6) })
paastaa(`Marcs ord: ${C.antal} citater fundet og holdt op mod kilderne`, C.antal === 54, C.pr)
paastaa('Alle citater staar ordret i deres kilde', C.ikkeOrdret.length === 0, C.ikkeOrdret)
paastaa('Stikord klippet midt i Marcs saetning ved kildens linjeskift (fund, ikke fejl i scriptet)', C.klippet.length > 0, C.klippet)
paastaa('"DINE STIKORD" om Dhruvas note "Ikke besvaret" (fund)', C.ikkeMarc.length > 0, C.ikkeMarc)
paastaa('Marcs svar 26. sep er "ordret i substans" i kilden, siden kalder dem "dine egne ord"', C.svar398ErOrdret && C.siden)
const tal = (t) => Number((t.match(/ (\d\.?\d*) /) || [])[1]?.replace('.', ''))
paastaa('Sammenligningen: deload talt selv, inden for 3 % af Setus ord og samme overskrifter', Math.abs(T.deload.ordUdenFold / tal(T.setuDeload) - 1) < 0.03 && T.deload.overskrifter === 7, { mig: T.deload, setu: T.setuDeload })
paastaa('Sammenligningen: "Hvad laver en coach" talt selv, inden for 3 % og samme overskrifter', Math.abs(T.coach.ordUdenFold / tal(T.setuCoach) - 1) < 0.03 && T.coach.overskrifter === 6, { mig: T.coach, setu: T.setuCoach })

paastaa('Squat 21. sep: 453 ord som Setu', T.squat21.ordUdenFold === 453)
paastaa('Fagord i de ni valg talt', Object.keys(T.fagordIValg).length > 0, T.fagordIValg)
const ud = { laes: LAES, ref: REF, bredder: [390, 1280], L, C: { ...C, citater }, T, tjek }
writeFileSync(path.join(HERE, 'laes-548.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne`)
if (nej) process.exitCode = 1
