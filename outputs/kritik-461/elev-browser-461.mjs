// ORDRE 461 blok 1b: eleven i browseren (headless Chromium, file://, intet netvaerk).
// 390 x 844 og 1280 x 800. Eleven (min simulering fra elev-node-461.mjs) spiller hvid
// mod niveau 1, 2 og 3, giver op efter 60 traek hvis partiet ikke er slut, og ser
// saa resultatboksen og "Tre steder hvor partiet vendte". Alle vendepunkter laeses
// (tekst, pile, knap, begrundelse), og knappen proeves: aabner den kompetencen i
// biblioteket, og staar partiet der stadig, naar man gaar tilbage til Spil?
// Til sidst et parti mod en makker paa samme pc (begge sider spilles af "ny").
// Partierne fortsaetter, til der er mindst 20 vendepunkter (hoejst 14 partier).
//   node outputs/kritik-461/elev-browser-461.mjs
// Skriver elev-browser-461.json og skaermbilleder b1-*.png i samme mappe.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { skakKopi } from './skak-kopi-461.mjs'
import { elevTraek, mulberry32 } from './elev-profiler-461.mjs'

const HER = path.dirname(fileURLToPath(import.meta.url))
const kopi = skakKopi()
const req = createRequire(path.join(kopi.mappe, 'package.json'))
const { chromium } = req('playwright')
const { Chess } = await import(pathToFileURL(req.resolve('chess.js')).href)
const { findVendepunkter } = await kopi.importer('src/vendepunkter.js')

const fejl = []
const tjek = (b, t) => { console.log(`${b ? 'OK  ' : 'FEJL'} ${t}`); if (!b) fejl.push(t) }
const fen4 = (f) => f.split(' ').slice(0, 4).join(' ')
const fen = (page) => page.$eval('#fen-tekst', (el) => el.value)
const skaerm = (page, navn) => page.screenshot({ path: path.join(HER, navn) })

async function klikTraek(page, m) {
  await page.click(`#braet .felt[data-square="${m.from}"]`)
  await page.click(`#braet .felt[data-square="${m.to}"]`)
  const forv = page.locator('#forvandling-modal:not([hidden]) button')
  if (await forv.count()) await forv.nth(Math.max(0, 'qrbn'.indexOf(m.promotion ?? 'q'))).click()
}
async function startForfra(page) {
  await page.click('#knap-spil-forfra')
  if (await page.locator('#knap-spil-forfra-bekraeft').isVisible()) await page.click('#knap-spil-forfra-bekraeft')
}
const slut = (page) => page.evaluate(() => !document.getElementById('spil-resultat').hidden)
async function venterPaaEleven(page) {
  await page.waitForFunction(() => {
    const status = document.getElementById('status')?.textContent ?? ''
    const v = document.getElementById('fen-tekst')?.value ?? ''
    return !document.getElementById('spil-resultat').hidden || (!/tænker/.test(status) && v.split(' ')[1] === 'w')
  }, null, { timeout: 20000 })
}
async function venterPaaVendepunkter(page) {
  await page.waitForFunction(() => {
    const boks = document.getElementById('spil-vendepunkter')
    const status = document.getElementById('vendepunkt-status')?.textContent ?? ''
    return boks && !boks.hidden && !/ser partiet igennem/.test(status)
  }, null, { timeout: 60000 })
}
async function laesVendepunkter(page) {
  const ud = []
  if (!(await page.isVisible('#vendepunkt-indhold'))) return { status: (await page.textContent('#vendepunkt-status')).trim(), punkter: ud }
  for (let i = 0; i < 3; i += 1) {
    const p = await page.evaluate(() => ({
      overskrift: document.getElementById('vendepunkt-overskrift').textContent.trim(),
      tekst: document.getElementById('vendepunkt-tekst').textContent.trim(),
      knap: document.getElementById('knap-vendepunkt-traen').hidden ? null : document.getElementById('knap-vendepunkt-traen').textContent.trim(),
      grund: document.getElementById('vendepunkt-traen-grund').textContent.trim(),
      taeller: document.getElementById('vendepunkt-taeller').textContent.trim(),
      pile: [...document.querySelectorAll('#vendepunkt-braet .mini-pile g line')].map((l) => l.getAttribute('stroke')),
      foersteFeltHarBrik: Boolean(document.querySelector('#vendepunkt-braet .felt')?.querySelector('svg')),
    }))
    ud.push(p)
    if (await page.isDisabled('#knap-vendepunkt-naeste')) break
    await page.click('#knap-vendepunkt-naeste')
  }
  return { status: '', punkter: ud }
}
const ingenSidelaens = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

// Et parti mod computeren. Returnerer SAN-listen og hvad appen sagde bagefter.
async function spilModComputer(page, { niveau, profil, frø, bredde, nr }) {
  const rng = mulberry32(frø)
  await page.click('#fane-spil')
  await page.click('#segment-spil-modus [data-value="computer"]')
  await page.click(`#segment-niveau [data-value="${niveau}"]`)
  await startForfra(page)
  const chess = new Chess()
  let opgivet = false
  let tabtSpor = null // FEN hvis scriptet mistede sporet af partiet (skal ikke ske)
  for (let i = 0; i < 60; i += 1) {
    await venterPaaEleven(page)
    // Computerens traek: find det ud fra FEN.
    const f = await fen(page)
    if (fen4(f) !== fen4(chess.fen())) {
      const m = chess.moves({ verbose: true }).find((x) => { chess.move(x); const ok = fen4(chess.fen()) === fen4(f); chess.undo(); return ok })
      if (!m) { tabtSpor = f; break }
      chess.move(m)
    }
    if (await slut(page) || chess.isGameOver()) break
    const m = elevTraek(chess, profil, rng)
    await klikTraek(page, m)
    chess.move(m)
    if (chess.isGameOver()) break
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(300)
  let f = await fen(page)
  if (fen4(f) !== fen4(chess.fen())) {
    const m = chess.moves({ verbose: true }).find((x) => { chess.move(x); const ok = fen4(chess.fen()) === fen4(f); chess.undo(); return ok })
    if (m) chess.move(m)
  }
  if (!(await slut(page))) {
    await page.click('#knap-spil-giv-op')
    await page.click('#knap-spil-giv-op-bekraeft')
    opgivet = true
  }
  await page.waitForFunction(() => !/Ser på dine træk/.test(document.getElementById('spil-resultat-forklaring').textContent), null, { timeout: 30000 })
  const boks = await page.evaluate(() => ({
    overskrift: document.getElementById('spil-resultat-overskrift').textContent.trim(),
    forklaring: document.getElementById('spil-resultat-forklaring').textContent.trim(),
    forslag: document.getElementById('knap-spil-forslag').hidden ? null : document.getElementById('knap-spil-forslag').textContent.trim(),
  }))
  await venterPaaVendepunkter(page)
  const vp = await laesVendepunkter(page)
  const san = chess.history()
  // Samme analyse i Node paa samme traek: siger appen det samme?
  const node = findVendepunkter(new Chess().fen(), san, { kunFarve: 'w' })
  const resultat = chess.isCheckmate() ? (chess.turn() === 'w' ? 'tabt' : 'vundet') : opgivet ? 'opgivet' : chess.isGameOver() ? 'remis' : 'ukendt'
  await page.locator('#spil-resultat').scrollIntoViewIfNeeded()
  await skaerm(page, `b1-${bredde}-parti${nr}-niveau${niveau}-resultat.png`)
  if (vp.punkter.length) {
    await page.locator('#spil-vendepunkter').scrollIntoViewIfNeeded()
    await skaerm(page, `b1-${bredde}-parti${nr}-niveau${niveau}-vendepunkt.png`)
  }
  return {
    bredde, nr, niveau, profil, frø, resultat, tabtSpor, halvtraek: san.length, san, boks, vendepunkter: vp,
    nodeSigerSamme: node.length === vp.punkter.length && node.every((p, i) => vp.punkter[i]?.overskrift.startsWith(`Træk ${p.traekNr}:`) && vp.punkter[i]?.tekst.includes(` ${p.san} `)),
    node: node.map((p) => ({ traekNr: p.traekNr, san: p.san, bedsteSan: p.bedsteSan, art: p.art, brik: p.brik, fald: p.fald, fen: p.fen, uci: p.uci, bedsteUci: p.bedsteUci, kendetegn: p.kendetegn })),
    ingenSidelaens: await ingenSidelaens(page),
  }
}

async function proevTraenKnap(page, bredde) {
  const knap = page.locator('#knap-vendepunkt-traen')
  if (!(await page.isVisible('#vendepunkt-indhold')) || !(await knap.isVisible())) return null
  await page.click('#knap-vendepunkt-forrige').catch(() => {})
  const tekst = (await knap.textContent()).trim()
  const titel = tekst.replace(/^Træn "(.+)"$/, '$1')
  const sanFoer = await page.$$eval('#traekliste li', (l) => l.length)
  await knap.click()
  await page.waitForTimeout(400)
  const ud = {
    knap: tekst,
    bibliotekAabent: await page.getAttribute('#fane-bibliotek', 'aria-selected') === 'true',
    titelVises: (await page.locator('body').innerText()).includes(titel),
  }
  await skaerm(page, `b1-${bredde}-bibliotek-fra-vendepunkt.png`)
  await page.click('#fane-spil')
  await page.waitForTimeout(400)
  ud.tilbageTraeklisteSamme = (await page.$$eval('#traekliste li', (l) => l.length)) === sanFoer
  ud.tilbageVendepunkterSynlige = await page.isVisible('#vendepunkt-indhold')
  ud.tilbageResultatSynligt = await page.isVisible('#spil-resultat')
  return ud
}

// Makker paa samme pc: begge sider spilles af "ny"; Fortryd proeves undervejs.
async function spilMakker(page, bredde) {
  const rng = mulberry32(4610 + bredde)
  await page.click('#fane-spil')
  await page.click('#segment-spil-modus [data-value="makker"]')
  await startForfra(page)
  const chess = new Chess()
  const ud = { bredde }
  for (let i = 0; i < 120 && !chess.isGameOver(); i += 1) {
    const m = elevTraek(chess, 'ny', rng)
    await klikTraek(page, m)
    chess.move(m)
    if (i === 5) {
      const foer = await fen(page)
      await page.click('#knap-fortryd')
      await page.waitForTimeout(150)
      chess.undo()
      ud.fortrydVirker = fen4(await fen(page)) === fen4(chess.fen()) && foer !== (await fen(page))
      ud.orienteringEfterSortsTraek = await page.evaluate(() => document.querySelector('#braet .felt')?.dataset.square)
    }
    if (i === 10) ud.orienteringEfterHvidsTraek = await page.evaluate(() => document.querySelector('#braet .felt')?.dataset.square)
  }
  if (!chess.isGameOver()) {
    await page.click('#knap-spil-giv-op')
    await page.click('#knap-spil-giv-op-bekraeft')
    ud.opgivet = true
  }
  ud.halvtraek = chess.history().length
  ud.mat = chess.isCheckmate()
  ud.status = (await page.textContent('#status')).trim()
  ud.resultatboksSynlig = await page.isVisible('#spil-resultat')
  await venterPaaVendepunkter(page)
  const vp = await laesVendepunkter(page)
  ud.vendepunkter = vp
  ud.hvidSortTekst = vp.punkter.every((p) => /^(Hvid|Sort) spillede /.test(p.tekst))
  ud.san = chess.history()
  ud.ingenSidelaens = await ingenSidelaens(page)
  await page.locator('#spil-vendepunkter').scrollIntoViewIfNeeded().catch(() => {})
  await skaerm(page, `b1-${bredde}-makker.png`)
  return ud
}

const PLAN = [
  { bredde: 390, niveau: 1, profil: 'oevet' },
  { bredde: 390, niveau: 2, profil: 'ny' },
  { bredde: 390, niveau: 3, profil: 'ny' },
  { bredde: 1280, niveau: 1, profil: 'ny' },
  { bredde: 1280, niveau: 2, profil: 'oevet' },
  { bredde: 1280, niveau: 3, profil: 'oevet' },
  { bredde: 390, niveau: 1, profil: 'ny' },
  { bredde: 1280, niveau: 2, profil: 'ny' },
  { bredde: 390, niveau: 3, profil: 'oevet' },
  { bredde: 1280, niveau: 1, profil: 'oevet' },
  { bredde: 390, niveau: 2, profil: 'oevet' },
  { bredde: 1280, niveau: 3, profil: 'ny' },
  { bredde: 390, niveau: 2, profil: 'ny' },
  { bredde: 1280, niveau: 3, profil: 'ny' },
]

const t0 = Date.now()
const browser = await chromium.launch()
const ud = { skakMain: kopi.hash, partier: [], traenKnap: [], makker: [], sidefejl: [], netvaerk: [] }
try {
  const sider = {}
  for (const [bredde, hoejde] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => ud.sidefejl.push(`${bredde}: ${e.message}`))
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) ud.netvaerk.push(r.url()) })
    await page.goto(kopi.url('skak.html'))
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.click('#fane-spil')
    await page.click('#segment-spil-modus [data-value="computer"]')
    await skaerm(page, `b1-${bredde}-niveauvalg.png`)
    sider[bredde] = page
  }
  let nr = 0
  for (const p of PLAN) {
    const antal = ud.partier.reduce((a, x) => a + x.vendepunkter.punkter.length, 0)
    if (antal >= 20 && nr >= 6) break
    nr += 1
    const page = sider[p.bredde]
    const r = await spilModComputer(page, { ...p, frø: 46100 + nr, nr })
    ud.partier.push(r)
    console.log(`parti ${nr} (${p.bredde} px, niveau ${p.niveau}, ${p.profil}): ${r.resultat} efter ${r.halvtraek} halvtraek; boks "${r.boks.overskrift}" / "${r.boks.forslag}"; ${r.vendepunkter.punkter.length} vendepunkter; Node siger samme: ${r.nodeSigerSamme}`)
    if (!ud.traenKnap.some((k) => k.bredde === p.bredde) && r.vendepunkter.punkter.length) {
      const k = await proevTraenKnap(page, p.bredde)
      if (k) ud.traenKnap.push({ bredde: p.bredde, nr, ...k })
    }
  }
  for (const bredde of [390, 1280]) ud.makker.push(await spilMakker(sider[bredde], bredde))
} finally {
  await browser.close()
}

// Tjek: det der skal virke foran klassen.
const vp = ud.partier.flatMap((p) => p.vendepunkter.punkter)
tjek(ud.partier.length >= 6, `${ud.partier.length} partier mod computeren`)
tjek(vp.length >= 20, `${vp.length} vendepunkter laest (mindst 20)`)
tjek(ud.partier.every((p) => p.nodeSigerSamme), 'appens vendepunkter er de samme som vendepunkter.js i Node paa samme traek')
tjek(ud.partier.every((p) => p.ingenSidelaens), 'ingen sidelaens rulning efter partiet (390 og 1280)')
tjek(vp.every((p) => p.pile.length === 2 && p.pile[0] !== p.pile[1]), 'hvert vendepunkt har to pile i hver sin farve')
tjek(vp.every((p) => /^Du spillede /.test(p.tekst)), 'mod computeren siger teksten "du"')
tjek(vp.every((p) => p.knap && /^Træn ".+"$/.test(p.knap)), 'hvert vendepunkt har en Traen-knap')
tjek(ud.traenKnap.length === 2 && ud.traenKnap.every((k) => k.bibliotekAabent && k.titelVises), 'Traen-knappen aabner kompetencen i biblioteket (390 og 1280)')
tjek(ud.makker.every((m) => m.fortrydVirker), 'Fortryd mod en makker tager et traek tilbage')
tjek(ud.makker.every((m) => m.hvidSortTekst), 'mod en makker siger vendepunkterne "hvid"/"sort"')
tjek(ud.sidefejl.length === 0, `ingen sidefejl (${ud.sidefejl.join(' | ')})`)
tjek(ud.netvaerk.length === 0, `intet netvaerk (${ud.netvaerk.slice(0, 3).join(' | ')})`)
ud.tjek = { fejl, antalVendepunkter: vp.length, sekunder: Math.round((Date.now() - t0) / 1000) }
writeFileSync(path.join(HER, 'elev-browser-461.json'), JSON.stringify(ud, null, 1))
console.log(fejl.length ? `\n${fejl.length} tjek fejlede (de er fund, ikke scriptfejl)` : '\nAlle tjek OK', `- ${ud.tjek.sekunder} s`)
