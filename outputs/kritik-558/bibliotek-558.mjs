// KRITIK 558 blok 2: skakkens "Mit bibliotek" og "Gentag i dag" (Chaturanga 547) som en elev paa 12 aar.
//   node outputs/kritik-558/bibliotek-558.mjs
// skak.html fra C:\Users\Entropi\Desktop\skak @ main hentes med `git archive` (traeet roeres ikke) og
// aabnes som file://, headless Chromium uden net: 360 og 390 px med touch (tap), 1280 med mus.
// Eleven (samme som 517-552): mat i 1, ellers stoerste slag, ellers skak, ellers tilfaeldigt.
//
// Dag 0 (pc'ens eget ur):
//   - 8 gaader i "Som de kommer": nr. 0 et forkert traek og saa loest, nr. 1 et hint og saa loest,
//     nr. 2 et forkert traek og "Spring over", resten rent. 4 gafler (3 med et forkert traek foerst)
//     og 3 bindinger rent. Mit bibliotek laeses og holdes op mod min egen optaelling efter 547's regel.
//   - "Oev gafler" fra "Dit svageste tema".
//   - En storm i ca. 35 s med vilje daarligt, stoppet (K12: slutkortet).
// Dag 1-13 med et falsk ur (page.clock.setFixedTime, siden genindlaeses hver dag):
//   hvad "Gentag i dag" viser, "Gentag nu" spilles igennem, og hvad beskeden siger. Min forventning er
//   regnet med min egen model af 547's regel (fejl: i morgen; rigtigt: 3, saa 7 dage; to i traek: laert).
//   Dag 1: alt rent, undtagen hint-gaaden (nu med et forkert traek). Dag 4: gaade nr. 0 med et forkert
//   traek. Ellers rent. Dagene: 0, 1, 2, 3, 4, 5, 11, 12, 13.
// Skriver outputs/kritik-558/bibliotek-558.json og B-*.png. Ingen elevdata: kun min syntetiske elev.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k558-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main skak.html data src/lichesstemaer.js src/gaadebank-stor.js src/gentag.js src/kompetencer.js`)
execSync('tar -xf s.tar', { cwd: dir })
const CHESS = pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href
const { Chess } = await import(CHESS)
const { LICHESS_TEMAER } = await import(pathToFileURL(path.join(dir, 'src', 'lichesstemaer.js')).href)
const G = await import(pathToFileURL(path.join(dir, 'src', 'gentag.js')).href)
const LICHESS = JSON.parse(readFileSync(path.join(dir, 'data', 'gaader-lichess.json'), 'utf8'))
const { GAADEBANK_STOR_GZIP_BASE64: B64 } = await import(pathToFileURL(path.join(dir, 'src', 'gaadebank-stor.js')).href)
const STOR = gunzipSync(Buffer.from(B64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => { const [id, fen, moves, rating, tema] = l.split('\t'); return { id, fen, solutionUci: moves.split(','), rating: Number(rating), tema } })
const egne = (f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8')).map((g) => ({ ...g, rating: g.svaerhed }))
const ALLE = [...LICHESS, ...STOR, ...egne('gaader.json'), ...egne('gaader-lette.json'), ...egne('gaader-slutspil.json')]
const placering = (fen) => fen.split(' ')[0]
const URL_ = pathToFileURL(path.join(dir, 'skak.html')).href
const BREDDER = process.env.KUN_BREDDE ? [Number(process.env.KUN_BREDDE)] : [360, 390, 1280]
const TAGS = LICHESS_TEMAER.map((t) => t.tag)

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }
function froe(n) { let s = n; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff } }
const VAERDI = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
function elevTraek(fen, rnd) {
  const c = new Chess(fen)
  const tr = c.moves({ verbose: true })
  if (!tr.length) return null
  const mat = tr.find((m) => m.san.endsWith('#'))
  if (mat) return mat
  const slag = tr.filter((m) => m.captured).sort((a, b) => VAERDI[b.captured] - VAERDI[a.captured])
  if (slag.length && rnd() < 0.8) return slag[0]
  const skak = tr.filter((m) => m.san.includes('+'))
  if (skak.length && rnd() < 0.5) return skak[Math.floor(rnd() * skak.length)]
  return tr[Math.floor(rnd() * tr.length)]
}
const uciAf = (m) => m.from + m.to + (m.promotion ?? '')

const browser = await chromium.launch({ headless: true })
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent) }, sel)
const rul = (S) => S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const boks = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bund: Math.round(r.bottom + scrollY), iVindue: r.top >= 0 && r.bottom <= innerHeight, h: Math.round(r.height), vinduH: innerHeight } }, sel)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
async function uciTraek(S, uci) {
  await tryk(S, `#braet .felt[data-square="${uci.slice(0, 2)}"]`)
  await tryk(S, `#braet .felt[data-square="${uci.slice(2, 4)}"]`)
  if (uci.length > 4) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).evaluate((b) => b.click()) }
}
async function proevForkert(S, f, rigtigt, rnd) {
  const c = new Chess(f)
  let m = elevTraek(f, rnd)
  for (let i = 0; i < 20 && m && uciAf(m) === rigtigt; i++) m = elevTraek(f, rnd)
  if (!m || uciAf(m) === rigtigt) m = c.moves({ verbose: true }).find((x) => uciAf(x) !== rigtigt)
  if (!m) return null
  await uciTraek(S, uciAf(m))
  await S.page.waitForTimeout(500)
  const besked = await tekst(S, '#status')
  if (await synlig(S, '#knap-gaade-fortryd')) await tryk(S, '#knap-gaade-fortryd')
  await S.page.waitForTimeout(400)
  return { san: m.san, besked }
}
async function loes(S, sol) {
  for (let i = 0; i < sol.length; i += 2) {
    await uciTraek(S, sol[i])
    if (i + 1 < sol.length) {
      const foer = await fen(S)
      for (let k = 0; k < 40; k++) { await S.page.waitForTimeout(100); const f = await fen(S); if (f !== foer && /Din tur|trækker/.test(await tekst(S, '#status'))) break }
      await S.page.waitForTimeout(150)
    }
  }
  await S.page.waitForTimeout(500)
}
// Vent paa en ny gaade (en anden stilling end `gammel`).
async function ventNy(S, gammel) {
  for (let k = 0; k < 60; k++) { const f = await fen(S); if (placering(f) !== placering(gammel) && /Din tur|trækker/.test((await tekst(S, '#status')) ?? '')) return f; await S.page.waitForTimeout(150) }
  return null
}
const hentKort = (S) => S.page.evaluate((n) => { try { return JSON.parse(localStorage.getItem(n) || '{}') } catch { return {} } }, G.GENTAG_NOEGLE)
// Gaaden paa braettet: fra kortene (under "Gentag nu") eller fra bankerne.
async function gaaden(S) {
  const f = await fen(S)
  const pl = placering(f)
  const kort = await hentKort(S)
  for (const [n, k] of Object.entries(kort)) if (k.data?.fen && placering(k.data.fen) === pl) return { noegle: n, fen: k.data.fen, sol: k.data.solutionUci, tema: k.data.tema, f }
  const g = ALLE.find((x) => placering(x.fen) === pl)
  return g ? { noegle: G.gaadeNoegle(g.id), fen: g.fen, sol: g.solutionUci, tema: g.tema, f } : { noegle: null, f }
}
async function nySide(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? (bredde === 360 ? 780 : 844) : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const S = { ctx, mobil, bredde, net: [], fejl: [] }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => S.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  S.page = page
  await aabnSiden(S)
  return S
}
async function aabnSiden(S, genindlaes = false) {
  if (genindlaes) await S.page.reload(); else await S.page.goto(URL_)
  await S.page.waitForSelector('#braet .felt')
  await S.page.waitForTimeout(500)
  await tryk(S, '#fane-gaader'); await S.page.waitForTimeout(300)
  await S.page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 20000 })
  await S.page.waitForTimeout(300)
}
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) { await S.page.locator(`#${id} > summary`).scrollIntoViewIfNeeded(); await tryk(S, `#${id} > summary`) }
  await S.page.waitForTimeout(300)
}
async function vaelgTema(S, tag) {
  await aabnFold(S, 'fold-gaade-temaer')
  const knap = `#gaade-temaer .gaade-tema-knap[data-tema="${tag}"]`
  await S.page.locator(knap).scrollIntoViewIfNeeded()
  await tryk(S, knap); await S.page.waitForTimeout(500)
}
const laesBibliotek = (S) => S.page.evaluate(() => ({
  resume: document.getElementById('mit-bibliotek-resume')?.textContent.trim(),
  svageste: document.getElementById('mit-svageste-tekst')?.textContent.trim(),
  knap: (() => { const k = document.getElementById('knap-mit-svageste'); return k && !k.hidden ? { tekst: k.textContent.trim(), tema: k.dataset.tema } : null })(),
  raekker: [...document.querySelectorAll('#mit-bibliotek-grupper .mit-bib-raekke')].map((li) => ({ art: li.dataset.art, id: li.dataset.id, navn: li.querySelector('.mit-bib-navn')?.textContent.trim(), tal: li.querySelector('.mit-bib-tal')?.textContent.trim(), maaler: li.querySelector('.mit-bib-maaler span')?.style.width, svag: li.querySelector('.mit-bib-maaler span')?.className === 'svag', knapH: Math.round(li.querySelector('.mit-bib-knap')?.getBoundingClientRect().height ?? 0) })),
}))
const laesGentag = (S) => S.page.evaluate(() => {
  const b = document.getElementById('gentag-kort')
  const r = b?.getBoundingClientRect()
  const braet = document.getElementById('braet').getBoundingClientRect()
  return { vist: !!(b && !b.hidden && b.offsetParent), antal: document.getElementById('gentag-antal')?.textContent.trim(), hvad: document.getElementById('gentag-hvad')?.textContent.trim(), knap: document.getElementById('knap-gentag')?.textContent.trim(), top: r ? Math.round(r.top + scrollY) : null, braetTop: Math.round(braet.top + scrollY), braetBund: Math.round(braet.bottom + scrollY), vinduH: innerHeight, knapH: Math.round(document.getElementById('knap-gentag')?.getBoundingClientRect().height ?? 0) }
})
const rating = (S) => tekst(S, '#gaade-rating')

// Min egen model af 547's regel (efter rapporten, ikke koden): {noegle: {forfald, iTraek, trin}}.
function minModel(m, noegle, rigtigt, dag) {
  const k = m[noegle]
  if (!rigtigt) { m[noegle] = { forfald: dag + 1, iTraek: 0, trin: k?.trin ?? 0 }; return }
  if (!k || k.forfald > dag) return
  if (k.iTraek + 1 >= 2) { delete m[noegle]; return }
  m[noegle] = { forfald: dag + [1, 3, 7][Math.min(k.trin + 1, 2)], iTraek: k.iTraek + 1, trin: k.trin + 1 }
}
const forfaldneI = (m, dag) => Object.entries(m).filter(([, k]) => k.forfald <= dag).map(([n]) => n).sort()

const ud = { skak: SHA, bredder: BREDDER, net: 0, jsFejl: 0 }
const DAG_MS = 86400000
for (const bredde of BREDDER) {
  const R = (ud[bredde] = { dag0: { gaader: [] }, dage: [] })
  const S = await nySide(bredde)
  const p = S.page
  const rnd = froe(558 + bredde)
  const optael = {} // min optaelling pr. tema: {forsoeg, rigtige}
  const model = {}
  const talOp = (tema, forsoeg, rigtigt) => { const o = (optael[tema] = optael[tema] || { forsoeg: 0, rigtige: 0 }); o.forsoeg += forsoeg; o.rigtige += rigtigt ? 1 : 0 }
  const nu0 = Date.now()
  const dag0 = G.dagNr(new Date(nu0))

  // --- dag 0: foer ---------------------------------------------------------------------------------
  await aabnFold(S, 'fold-mit-bibliotek')
  R.dag0.foer = await laesBibliotek(S)
  // --- "Som de kommer": 8 gaader -------------------------------------------------------------------
  await vaelgTema(S, 'alle')
  const spil = async (maade, label) => {
    const g = await gaaden(S)
    const x = { label, maade, tema: g.tema, noegle: g.noegle, temaIBibliotek: TAGS.includes(g.tema) }
    if (!g.sol) { x.fejl = 'ukendt gaade'; return x }
    if (maade === 'forkert' || maade === 'spring') x.forkert = await proevForkert(S, g.fen, g.sol[0], rnd)
    if (maade === 'hint') { await tryk(S, '#knap-gaade-hint'); await p.waitForTimeout(400); x.hintBesked = await tekst(S, '#status') }
    if (maade === 'spring') {
      await tryk(S, '#knap-gaade-spring-over'); await p.waitForTimeout(300); x.slut = await tekst(S, '#status')
      await ventNy(S, g.f)
      talOp(g.tema, 1, false); minModel(model, g.noegle, false, dag0)
      return x
    }
    await loes(S, g.sol)
    x.slut = await tekst(S, '#status')
    talOp(g.tema, 1, maade !== 'forkert') // 547: rigtigt = loest uden forkert traek
    minModel(model, g.noegle, maade === 'ren', dag0) // gentag: hint taeller som fejl
    await ventNy(S, g.f)
    return x
  }
  const plan = ['forkert', 'hint', 'spring', 'ren', 'ren', 'ren', 'ren', 'ren']
  for (let i = 0; i < plan.length; i++) R.dag0.gaader.push(await spil(plan[i], `som-de-kommer-${i}`))
  await vaelgTema(S, 'fork')
  for (const m of ['forkert', 'forkert', 'forkert', 'ren']) R.dag0.gaader.push(await spil(m, 'gaffel'))
  await vaelgTema(S, 'pin')
  for (const m of ['ren', 'ren', 'ren']) R.dag0.gaader.push(await spil(m, 'binding'))
  await vaelgTema(S, 'alle')
  R.dag0.optael = optael
  // --- Mit bibliotek -------------------------------------------------------------------------------
  await aabnFold(S, 'fold-mit-bibliotek')
  R.dag0.efter = await laesBibliotek(S)
  await p.locator('#fold-mit-bibliotek').screenshot({ path: path.join(HERE, `B-${bredde}-1-mit-bibliotek.png`) })
  R.dag0.foldH = (await boks(S, '#fold-mit-bibliotek'))?.h
  R.dag0.gentag = await laesGentag(S)
  // "Oev gafler"
  if (R.dag0.efter.knap) {
    await p.locator('#knap-mit-svageste').scrollIntoViewIfNeeded()
    await tryk(S, '#knap-mit-svageste'); await p.waitForTimeout(700)
    const g = await gaaden(S)
    R.dag0.oev = { duOever: await tekst(S, '#gaade-tema-valgt'), tema: g.tema, braet: await p.evaluate(() => { const r = document.getElementById('braet').getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), vinduH: innerHeight } }) }
    if (S.mobil) await p.screenshot({ path: path.join(HERE, `B-${bredde}-2-oev-gafler.png`) })
    await vaelgTema(S, 'alle')
  }
  // --- stormen (K12) -------------------------------------------------------------------------------
  {
    await p.waitForFunction(() => !document.getElementById('knap-storm-start').disabled, null, { timeout: 20000 })
    await p.locator('#knap-storm-start').scrollIntoViewIfNeeded()
    await tryk(S, '#knap-storm-start'); await p.waitForTimeout(800)
    const t0 = Date.now(); let sidst = '', tT = 0
    while (Date.now() - t0 < 35000) {
      if (await synlig(S, '#storm-resultat')) break
      const f = await fen(S)
      if (f === sidst) { if (Date.now() - tT > 2500) sidst = ''; else { await p.waitForTimeout(120); continue } }
      if (!(await synlig(S, '#storm-tur-tekst'))) { await p.waitForTimeout(150); continue }
      const m = elevTraek(f, rnd); if (!m) break
      sidst = f; await uciTraek(S, uciAf(m)); tT = Date.now(); await p.waitForTimeout(650)
    }
    if (await p.locator('#knap-storm-stop').isVisible()) await tryk(S, '#knap-storm-stop')
    await p.waitForFunction(() => { const r = document.getElementById('storm-resultat'); return r && !r.hidden }, null, { timeout: 60000 }).catch(() => {})
    await p.waitForTimeout(600)
    await p.locator('#storm-resultat').scrollIntoViewIfNeeded().catch(() => {})
    R.storm = {
      resultat: await boks(S, '#storm-resultat'), nyStorm: await boks(S, '#knap-storm-igen'), nyStormTekst: await tekst(S, '#knap-storm-igen'), liste: await boks(S, '#storm-missede'),
      missedeVist: await p.$$eval('.storm-missede-knap', (els) => els.filter((e) => e.offsetParent).length), visAlle: (await synlig(S, '#knap-storm-missede-alle')) ? await tekst(S, '#knap-storm-missede-alle') : null,
      missedeTitel: await tekst(S, '#storm-missede-titel'),
    }
    if (S.mobil) await p.screenshot({ path: path.join(HERE, `B-${bredde}-3-storm-slut.png`) })
    if (R.storm.visAlle) { await tryk(S, '#knap-storm-missede-alle'); await p.waitForTimeout(300); R.storm.efterVisAlle = await p.$$eval('.storm-missede-knap', (els) => els.filter((e) => e.offsetParent).length) }
    const kort = await hentKort(S)
    R.storm.kortEfter = Object.keys(kort).length
    for (const n of Object.keys(kort)) if (!model[n]) minModel(model, n, false, dag0)
    await tryk(S, '#knap-storm-luk'); await p.waitForTimeout(500)
  }
  R.dag0.kort = Object.keys(await hentKort(S)).sort()
  R.dag0.model = Object.keys(model).sort()

  // --- dagene med det falske ur --------------------------------------------------------------------
  const labelAf = Object.fromEntries(R.dag0.gaader.filter((g) => g.noegle).map((g) => [g.noegle, g.label]))
  const A = R.dag0.gaader[0].noegle, B = R.dag0.gaader[1].noegle
  for (const d of [1, 2, 3, 4, 5, 11, 12, 13]) {
    await p.clock.setFixedTime(new Date(nu0 + d * DAG_MS))
    await aabnSiden(S, true)
    const dag = dag0 + d
    const D = { d, dagNr: await p.evaluate(() => Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000)), forventet: forfaldneI(model, dag), gentag: await laesGentag(S), spillet: [] }
    if (S.mobil && [1, 4].includes(d)) { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: path.join(HERE, `B-${bredde}-4-gentag-dag${d}.png`) }) }
    if (D.gentag.vist) {
      D.ratingFoer = await rating(S)
      await p.locator('#knap-gentag').scrollIntoViewIfNeeded()
      await tryk(S, '#knap-gentag'); await p.waitForTimeout(700)
      for (let i = 0; i < 40; i++) {
        const titel = await tekst(S, '#gaade-titel')
        if (!/Gentag/.test(titel ?? '')) { D.stop = { titel, status: await tekst(S, '#status') }; break }
        const g = await gaaden(S)
        if (!g.sol) { D.spillet.push({ fejl: 'ukendt', titel }); break }
        const fejl = (d === 1 && g.noegle === B) || (d === 4 && g.noegle === A)
        if (fejl) await proevForkert(S, g.fen, g.sol[0], rnd)
        await loes(S, g.sol)
        const besked = await tekst(S, '#status')
        minModel(model, g.noegle, !fejl, dag)
        D.spillet.push({ noegle: g.noegle, label: labelAf[g.noegle] ?? 'storm', fejl, besked: (besked.match(/(Den kommer igen[^.]*\.|Rigtigt! Den kommer igen[^.]*\.|Den sidder nu[^.]*\.)/) || [besked])[0] })
        if (!(await ventNy(S, g.f))) { D.stop = { vent: true, titel: await tekst(S, '#gaade-titel'), status: await tekst(S, '#status') }; break }
      }
      D.ratingEfter = await rating(S)
      D.gentagEfter = await laesGentag(S)
    }
    D.kortEfter = Object.keys(await hentKort(S)).sort()
    D.modelEfter = Object.keys(model).sort()
    R.dage.push(D)
    console.log(bredde, 'dag', d, JSON.stringify(D.stop), D.gentag.vist ? D.gentag.antal : 'intet', '| forventet', D.forventet.length, '|', D.spillet.map((x) => `${x.label}:${x.besked}`).join(' / '))
  }
  await aabnFold(S, 'fold-mit-bibliotek')
  R.slutBibliotek = await laesBibliotek(S)
  R.rul = await rul(S)
  ud.net += S.net.length; ud.jsFejl += S.fejl.length
  R.net = S.net; R.fejl = S.fejl
  await S.ctx.close()
}
await browser.close()

// --- ren logik: aabning og felt (src/gentag.js) --------------------------------------------------
{
  let k = {}
  const L = []
  k = G.registrerFejl(k, 'felt:e4', { navn: 'e4' }, 0); L.push(G.igenTekst(k, 'felt:e4', 0))
  let r = G.registrerRigtig(k, 'felt:e4', 0); L.push(`dag 0 igen: flyttet=${r.flyttet}`)
  r = G.registrerRigtig(k, 'felt:e4', 1); k = r.kort; L.push(G.igenTekst(k, 'felt:e4', 1))
  r = G.registrerRigtig(k, 'felt:e4', 4); k = r.kort; L.push(`laert=${r.laert}`)
  k = G.registrerFejl(k, 'aabning:w:italiensk', { navn: 'Italiensk' }, 0)
  r = G.registrerRigtig(k, 'aabning:w:italiensk', 1); k = r.kort
  k = G.registrerFejl(k, 'aabning:w:italiensk', null, 4); r = G.registrerRigtig(k, 'aabning:w:italiensk', 5); k = r.kort; L.push(G.igenTekst(k, 'aabning:w:italiensk', 5))
  ud.logik = L
}

// --- paastande --------------------------------------------------------------------------------------
const pct = (o) => (o.forsoeg ? Math.round((100 * o.rigtige) / o.forsoeg) : null)
for (const b of BREDDER) {
  const R = ud[b]
  const vist = Object.fromEntries(R.dag0.efter.raekker.filter((r) => r.art === 'tema').map((r) => [r.id, r.tal]))
  const forventet = Object.fromEntries(Object.entries(R.dag0.optael).filter(([t]) => TAGS.includes(t)).map(([t, o]) => [t, `${pct(o)} % rigtige · ${o.forsoeg} forsøg`]))
  R.dag0.sammenlign = { vist, forventet }
  paastaa(`${b}: foer: "Løs mindst 3 gåder i et tema ..." og 0 af N oevet`, /Løs mindst 3/.test(R.dag0.foer.svageste) && /^0 af/.test(R.dag0.foer.resume), [R.dag0.foer.resume, R.dag0.foer.svageste])
  paastaa(`${b}: Mit bibliotek: hvert tema med forsoeg viser min optaelling (forsoeg = loest + opgivet, rigtigt = uden forkert traek)`, Object.entries(forventet).every(([t, s]) => vist[t] === s), { vist, forventet })
  const usynlige = R.dag0.gaader.filter((g) => !g.temaIBibliotek)
  R.dag0.usynlige = usynlige.map((g) => g.tema)
  paastaa(`${b}: gaader med et tema uden for de 12 (taeller ikke i biblioteket)`, true, R.dag0.usynlige)
  {
    // Min egen udregning: lavest procent blandt temaer med mindst 3 forsoeg; lige: flest forsoeg.
    const kand = Object.entries(R.dag0.optael).filter(([t, o]) => TAGS.includes(t) && o.forsoeg >= 3).map(([t, o]) => ({ t, o, p: pct(o) })).sort((x, y) => x.p - y.p || y.o.forsoeg - x.o.forsoeg)
    const sv = kand[0]; const navn = LICHESS_TEMAER.find((x) => x.tag === sv.t)
    R.dag0.minSvageste = { tema: sv.t, procent: sv.p, forsoeg: sv.o.forsoeg }
    paastaa(`${b}: "Dit svageste tema" = min udregning (${navn.navn}, ${sv.p} %, ${sv.o.forsoeg} forsoeg) og knappen "${navn.oev}"`, R.dag0.efter.svageste === `Dit svageste tema: ${navn.navn} - ${sv.p} % rigtige i ${sv.o.forsoeg} forsøg.` && R.dag0.efter.knap?.tekst === navn.oev, [R.dag0.efter.svageste, R.dag0.efter.knap])
  }
  paastaa(`${b}: "Øv gafler" giver en gaffel og "Du øver: Gaffel"`, R.dag0.oev?.tema === 'fork' && /Gaffel/.test(R.dag0.oev?.duOever ?? ''), R.dag0.oev)
  const hint = R.dag0.gaader[1]
  paastaa(`${b}: hint-gaaden taeller som rigtig i biblioteket, men som fejl i "Gentag" (samme gaade, to svar)`, R.dag0.kort.includes(hint.noegle), { tema: hint.tema, noegle: hint.noegle })
  if (b < 500) paastaa(`${b}: Oev-knapperne i biblioteket er mindst 44 px`, R.dag0.efter.raekker.every((r) => r.knapH >= 44), Math.min(...R.dag0.efter.raekker.map((r) => r.knapH)))
  paastaa(`${b}: dag 0: kortene = min model (fejl, hint, spring, gafler og stormens missede)`, JSON.stringify(R.dag0.kort) === JSON.stringify(R.dag0.model), [R.dag0.kort.length, R.dag0.model.length])
  paastaa(`${b}: dag 0: "Gentag i dag" skjult (intet forfaldent endnu)`, !R.dag0.gentag.vist)
  for (const D of R.dage) {
    const n = D.forventet.length
    paastaa(`${b}: dag ${D.d}: ${n ? `"Gentag i dag: ${n}"` : 'intet at gentage (skjult)'}`, n ? D.gentag.vist && D.gentag.antal === `Gentag i dag: ${n}` : !D.gentag.vist, [D.gentag.antal, D.gentag.hvad, D.forventet.map((x) => x.slice(0, 20))])
    if (D.gentag.vist) {
      if (D.d === 1) paastaa(b < 500 ? `${b}: K19: "Gentag i dag" staar under braettet og under foerste skaerm (eleven skal rulle)` : `${b}: "Gentag i dag" staar paa foerste skaerm`, b < 500 ? D.gentag.top > D.gentag.braetBund && D.gentag.top > D.gentag.vinduH : D.gentag.top < D.gentag.vinduH, [D.gentag.top, D.gentag.braetTop, D.gentag.braetBund, D.gentag.vinduH])
      paastaa(`${b}: dag ${D.d}: alle ${n} gentaget, kortet skjult bagefter, ratingen uaendret`, D.spillet.length === n && !D.gentagEfter.vist && D.ratingFoer === D.ratingEfter, [D.spillet.length, D.gentagEfter?.antal, D.ratingFoer, D.ratingEfter])
    }
    paastaa(`${b}: dag ${D.d}: kortene efter = min model`, JSON.stringify(D.kortEfter) === JSON.stringify(D.modelEfter), [D.kortEfter.length, D.modelEfter.length])
  }
  const bes = (d, label) => R.dage.find((x) => x.d === d)?.spillet.find((x) => x.label === label)?.besked
  paastaa(`${b}: gaade nr. 0: dag 1 "om 3 dage", dag 4 (fejl) "i morgen", dag 5 "om 7 dage", dag 12 "sidder nu"`, /om 3 dage/.test(bes(1, 'som-de-kommer-0') ?? '') && /i morgen/.test(bes(4, 'som-de-kommer-0') ?? '') && /om 7 dage/.test(bes(5, 'som-de-kommer-0') ?? '') && /sidder nu/.test(bes(12, 'som-de-kommer-0') ?? ''), [1, 4, 5, 12].map((d) => bes(d, 'som-de-kommer-0')))
  paastaa(`${b}: en ren gaade: dag 1 "om 3 dage", dag 4 "sidder nu" (7 dage bruges ikke)`, /om 3 dage/.test(bes(1, 'som-de-kommer-2') ?? '') && /sidder nu/.test(bes(4, 'som-de-kommer-2') ?? ''), [bes(1, 'som-de-kommer-2'), bes(4, 'som-de-kommer-2')])
  paastaa(`${b}: K12: "Ny storm" over listen med de missede, hoejst 5 vist og "Vis alle"`, R.storm.nyStorm && R.storm.liste && R.storm.nyStorm.top < R.storm.liste.top && R.storm.missedeVist <= 5, R.storm)
  paastaa(`${b}: ingen vandret rulning, intet net, ingen JS-fejl`, R.rul <= 0 && !R.net.length && !R.fejl.length, [R.rul, R.net.length, R.fejl])
}
paastaa('logik: felt og aabning foelger samme regel (i morgen; dag 0 igen flytter ikke; om 3 dage; laert; efter ny fejl om 7 dage)', JSON.stringify(ud.logik) === JSON.stringify(['i morgen', 'dag 0 igen: flyttet=false', 'om 3 dage', 'laert=true', 'om 7 dage']), ud.logik)
ud.tjek = tjek
writeFileSync(path.join(HERE, 'bibliotek-558.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nbibliotek-558: ${tjek.length - roede.length}/${tjek.length} ok (skak main ${SHA})`)
