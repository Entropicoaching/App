// Kritik 568, blok 2: skakken efter Chaturangas 556 (K13-K17 fra min 552 og nr. 1 fra listen, #13).
//   node outputs/kritik-568/skak-568.mjs     -> skak-568.json, skak-568.log og S-*.png
// skak main hentes med `git archive` (skak.html, laerer.html, data, src); traeet roeres ikke.
// Eleven er 12 aar og har ingen navne: headless paa 360 og 390 med touch og 1280 med mus, uden net
// (alt andet end file/data/blob afvises og taelles), falsk ur fra 28. sep 2026 kl. 10.
//  K13  braettet og statuslinjen paa skaermen 100 ms og 1,2 s efter et tryk paa et kendt parti,
//       "Naeste kendte parti", "Oev gafler", "Oev" i Mit bibliotek og "Gentag nu" (dagen efter en fejl),
//       og paa en lav telefon (360 x 640).
//  K14  O-O-O# og Kd2# i kongejagten (og med hint). K15/K16 teksterne efter loesningen, holdt op mod
//       braettet med chess.js. K17 20 tryk pr. tema i de seks temaer for en ny elev (800) og en elev paa
//       1200: hvor mange er lichess-gaader (544, id "li-"), og hvor svaere; dagens gaade paa en lige og en
//       ulige dato. #13 "Med brikkerne" i "Find feltet" med touch, og klasseoevelsen i laerer.html.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k568-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main skak.html laerer.html data src`)
execSync('tar -xf s.tar', { cwd: dir })
const CHESS = pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href
// src-filerne importerer 'chess.js' uden sti; i kopien peger de paa skak's egen node_modules.
for (const f of readdirSync(path.join(dir, 'src')).filter((x) => x.endsWith('.js'))) {
  const p = path.join(dir, 'src', f)
  writeFileSync(p, readFileSync(p, 'utf8').replace(/from 'chess\.js'/g, `from '${CHESS}'`))
}
const { Chess } = await import(CHESS)
const KP = await import(pathToFileURL(path.join(dir, 'src', 'kendtepartier.js')).href)
const { LICHESS_TEMAER } = await import(pathToFileURL(path.join(dir, 'src', 'lichesstemaer.js')).href)
const G = await import(pathToFileURL(path.join(dir, 'src', 'gentag.js')).href)
const LICHESS = JSON.parse(readFileSync(path.join(dir, 'data', 'gaader-lichess.json'), 'utf8'))
const { GAADEBANK_STOR_GZIP_BASE64: B64 } = await import(pathToFileURL(path.join(dir, 'src', 'gaadebank-stor.js')).href)
const STOR = gunzipSync(Buffer.from(B64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => { const [id, fen, moves, rating, tema] = l.split('\t'); return { id, fen, solutionUci: moves.split(','), rating: Number(rating), tema } })
const egne = (f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8')).map((g) => ({ ...g, rating: g.svaerhed }))
const ALLE = [...LICHESS, ...STOR, ...egne('gaader.json'), ...egne('gaader-lette.json'), ...egne('gaader-slutspil.json')]
const placering = (fen) => fen.split(' ')[0]
const LI = new Map(LICHESS.map((g) => [placering(g.fen), g]))
const URL_ = pathToFileURL(path.join(dir, 'skak.html')).href
const LAERER = pathToFileURL(path.join(dir, 'laerer.html')).href
const SEKS = ['mateIn1', 'mateIn2', 'fork', 'pin', 'skewer', 'discoveredAttack']
const NU0 = new Date('2026-09-28T10:00:00').getTime()
const DAG = 86400000

const tjek = []
const log = []
const skriv = (s) => { log.push(s); console.log(s) }
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); skriv(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }
const ud = { skak: SHA, sider: {}, k17: {}, dagens: {}, tekster: {} }

const browser = await chromium.launch({ headless: true })
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent) }, sel)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
const iSyne = (S) => S.page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const b = r('braet'), s = r('status'); return { ok: b.top >= -1 && b.bottom <= innerHeight + 1 && s.top >= 0 && s.bottom <= innerHeight + 1, braet: [Math.round(b.top), Math.round(b.bottom)], status: [Math.round(s.top), Math.round(s.bottom)], vinduH: innerHeight, statusTekst: document.getElementById('status').textContent.trim().slice(0, 90) } })
async function efterTryk(S, sel) {
  await S.page.locator(sel).first().scrollIntoViewIfNeeded()
  const foer = await iSyne(S)
  await tryk(S, sel)
  await S.page.waitForTimeout(100)
  const e100 = await iSyne(S)
  await S.page.waitForTimeout(1100)
  return { foer, e100, e1200: await iSyne(S) }
}
async function uciTraek(S, uci) {
  await tryk(S, `#braet .felt[data-square="${uci.slice(0, 2)}"]`)
  await tryk(S, `#braet .felt[data-square="${uci.slice(2, 4)}"]`)
  if (uci.length > 4) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).evaluate((b) => b.click()) }
}
async function loes(S, sol, sidste = null) {
  for (let i = 0; i < sol.length; i += 2) {
    const erSidste = i + 1 >= sol.length
    await uciTraek(S, erSidste && sidste ? sidste : sol[i])
    if (!erSidste) {
      const foer = await fen(S)
      for (let k = 0; k < 50; k++) { await S.page.waitForTimeout(100); const f = await fen(S); if (f !== foer && /Din tur|trækker/.test((await tekst(S, '#status')) ?? '')) break }
      await S.page.waitForTimeout(150)
    }
  }
  await S.page.waitForTimeout(500)
}
async function gaaden(S) {
  const pl = placering(await fen(S))
  const kort = await S.page.evaluate((n) => { try { return JSON.parse(localStorage.getItem(n) || '{}') } catch { return {} } }, G.GENTAG_NOEGLE)
  for (const k of Object.values(kort)) if (k.data?.fen && placering(k.data.fen) === pl) return k.data
  return ALLE.find((x) => placering(x.fen) === pl) ?? null
}
async function nySide(bredde, hoejde, { rating = null, tid = NU0 } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const page = await ctx.newPage()
  const S = { ctx, page, mobil, bredde, net: [], fejl: [] }
  page.on('pageerror', (e) => S.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  await page.clock.setFixedTime(new Date(tid))
  if (rating) await page.addInitScript((r) => { if (!localStorage.getItem('skak-gaade-fremgang-v1')) localStorage.setItem('skak-gaade-fremgang-v1', JSON.stringify({ rating: r, ratingAntal: 60, loestIAlt: 60, streak: 0 })) }, rating)
  await aabn(S)
  return S
}
async function aabn(S, genindlaes = false) {
  if (genindlaes) await S.page.reload(); else await S.page.goto(URL_)
  await S.page.waitForSelector('#braet .felt')
  await S.page.waitForTimeout(400)
  await tryk(S, '#fane-gaader'); await S.page.waitForTimeout(300)
  await S.page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 20000 })
  await S.page.waitForTimeout(300)
}
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) { await S.page.locator(`#${id} > summary`).scrollIntoViewIfNeeded(); await tryk(S, `#${id} > summary`) }
  await S.page.waitForTimeout(300)
}
const kendtKnap = (id) => `#kendte-partier-liste .kendt-parti-knap[data-parti="${id}"]`
const parti = (id) => KP.KENDTE_PARTIER.find((p) => p.id === id)

// ------------------------------------------------------------------------------------------------
for (const [bredde, hoejde] of [[360, 780], [390, 844], [1280, 800]]) {
  const S = await nySide(bredde, hoejde)
  const R = { k13: {}, net: 0, fejl: [] }
  // K13 1: et kendt parti i listen
  await aabnFold(S, 'fold-kendte-partier')
  R.k13.opera = await efterTryk(S, kendtKnap('opera-1858'))
  if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-k13-opera.png`) })
  // K14: kongejagten med O-O-O#
  await aabnFold(S, 'fold-kendte-partier')
  R.k13.kongejagt = await efterTryk(S, kendtKnap('lasker-thomas-1912'))
  const lasker = KP.kendtPartiOpgave(parti('lasker-thomas-1912'))
  await loes(S, lasker.solutionUci, 'e1c1')
  R.k14 = { ooo: await tekst(S, '#status'), historie: await synlig(S, '#kendt-parti-historie'), tekst: await tekst(S, '#kendt-parti-tekst') }
  if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-k14-ooo.png`) })
  // K13 2: "Naeste kendte parti"
  R.k13.naeste = await efterTryk(S, '#knap-kendt-naeste')
  // K14 igen med Kd2# og med hint foer sidste traek
  await aabnFold(S, 'fold-kendte-partier')
  await tryk(S, kendtKnap('lasker-thomas-1912')); await S.page.waitForTimeout(500)
  await loes(S, lasker.solutionUci)
  R.k14.kd2 = await tekst(S, '#status')
  await aabnFold(S, 'fold-kendte-partier')
  await tryk(S, kendtKnap('lasker-thomas-1912')); await S.page.waitForTimeout(500)
  await loes(S, lasker.solutionUci.slice(0, -1))
  if (await synlig(S, '#knap-gaade-hint')) { await tryk(S, '#knap-gaade-hint'); await S.page.waitForTimeout(400) }
  await uciTraek(S, 'e1c1'); await S.page.waitForTimeout(600)
  R.k14.oooHint = await tekst(S, '#status')
  // K15/K16: teksterne efter loesningen
  for (const id of ['steinitz-bardeleben-1895', 'reti-tartakower-1910']) {
    await aabnFold(S, 'fold-kendte-partier')
    await tryk(S, kendtKnap(id)); await S.page.waitForTimeout(500)
    await loes(S, KP.kendtPartiOpgave(parti(id)).solutionUci)
    R[id] = { status: await tekst(S, '#status'), tekst: await tekst(S, '#kendt-parti-tekst') }
  }
  // K13 3: "Oev gafler" i "Oev et tema"; 3 gafler, den foerste med et forkert traek (til Gentag og Mit bibliotek)
  await aabnFold(S, 'fold-gaade-temaer')
  R.k13.oevGafler = await efterTryk(S, '#gaade-temaer .gaade-tema-knap[data-tema="fork"]')
  if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-k13-oev-gafler.png`) })
  R.gafler = []
  for (let i = 0; i < 3; i++) {
    const g = await gaaden(S)
    if (!g) { R.gafler.push({ ukendt: true }); break }
    if (i === 0) {
      const c = new Chess(g.fen); const m = c.moves({ verbose: true }).find((x) => x.from + x.to !== g.solutionUci[0])
      await uciTraek(S, m.from + m.to); await S.page.waitForTimeout(500)
      if (await synlig(S, '#knap-gaade-fortryd')) await tryk(S, '#knap-gaade-fortryd')
      await S.page.waitForTimeout(400)
    }
    const f0 = await fen(S)
    await loes(S, g.solutionUci)
    R.gafler.push({ id: g.id, status: (await tekst(S, '#status'))?.slice(0, 80) })
    for (let k = 0; k < 60; k++) { if (placering(await fen(S)) !== placering(f0)) break; await S.page.waitForTimeout(150) }
    await S.page.waitForTimeout(300)
  }
  // K13 4: "Oev" i Mit bibliotek
  await aabnFold(S, 'fold-mit-bibliotek')
  const oevKnap = (await S.page.locator('#knap-mit-svageste').isVisible()) ? '#knap-mit-svageste' : '#mit-bibliotek-grupper .mit-bib-knap'
  R.k13.bibliotekKnap = oevKnap
  R.k13.bibliotek = await efterTryk(S, oevKnap)
  // K13 5: "Gentag nu" dagen efter
  await S.page.clock.setFixedTime(new Date(NU0 + DAG))
  await aabn(S, true)
  R.k13.gentagVist = await synlig(S, '#gentag-kort')
  if (R.k13.gentagVist) {
    R.k13.gentag = await efterTryk(S, '#knap-gentag')
    if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-k13-gentag.png`) })
  }
  R.vandret = await S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  R.net = S.net; R.fejl = S.fejl
  await S.ctx.close()
  // K13 paa en lav telefon
  if (bredde === 360) {
    const L = await nySide(360, 640)
    await aabnFold(L, 'fold-kendte-partier')
    R.k13.lavTelefonOpera = await efterTryk(L, kendtKnap('opera-1858'))
    await aabnFold(L, 'fold-gaade-temaer')
    R.k13.lavTelefonGafler = await efterTryk(L, '#gaade-temaer .gaade-tema-knap[data-tema="fork"]')
    await L.page.screenshot({ path: path.join(HERE, 'S-360x640-k13-gafler.png') })
    R.net.push(...L.net); R.fejl.push(...L.fejl)
    await L.ctx.close()
  }
  ud.sider[bredde] = R
  const k = R.k13
  skriv(`${bredde}: K13 ${['opera', 'kongejagt', 'naeste', 'oevGafler', 'bibliotek', 'gentag'].map((n) => `${n} ${k[n] ? (k[n].e1200.ok ? 'ok' : 'NEJ ' + JSON.stringify(k[n].e1200.braet)) : '-'}`).join(', ')}`)
}

// K17: 20 tryk pr. tema (en ny gaade pr. tryk) for en ny elev og en elev paa 1200.
for (const [bredde, hoejde, rating] of [[360, 780, null], [390, 844, null], [1280, 800, null], [390, 844, 1200], [1280, 800, 1200]]) {
  const S = await nySide(bredde, hoejde, { rating })
  const noegle = `${bredde}-${rating ?? 'ny'}`
  const R = (ud.k17[noegle] = { rating: await tekst(S, '#gaade-rating'), temaer: {} })
  await aabnFold(S, 'fold-gaade-temaer')
  for (const tema of SEKS) {
    const t = { lichess: 0, set: [], ratings: [], markeret: 0 }
    for (let i = 0; i < 20; i++) {
      await S.page.locator(`#gaade-temaer .gaade-tema-knap[data-tema="${tema}"]`).scrollIntoViewIfNeeded()
      await tryk(S, `#gaade-temaer .gaade-tema-knap[data-tema="${tema}"]`)
      await S.page.waitForTimeout(150)
      const pl = placering(await fen(S))
      const li = LI.get(pl)
      t.set.push(pl)
      if (li) { t.lichess++; t.ratings.push(li.rating) }
      if (li && (await S.page.locator('#braet .felt.sidst-fra, #braet .felt.sidst-til').count()) > 0) t.markeret++
    }
    R.temaer[tema] = { lichess: t.lichess, forskellige: new Set(t.set).size, liRating: t.ratings.length ? [Math.min(...t.ratings), Math.max(...t.ratings)] : null, markeret: t.markeret }
  }
  R.net = S.net.length; R.fejl = S.fejl
  skriv(`K17 ${noegle} (rating ${R.rating}): ${SEKS.map((x) => `${x} ${R.temaer[x].lichess}/20 (${R.temaer[x].forskellige} forsk.)`).join(', ')}`)
  await S.ctx.close()
}

// Dagens gaade paa en lige og en ulige dato, to elever hver
for (const [navn, tid] of [['lige 28/9', NU0], ['ulige 29/9', NU0 + DAG], ['lige 30/9', NU0 + 2 * DAG]]) {
  const res = []
  for (let e = 0; e < 2; e++) {
    const S = await nySide(390, 844, { tid })
    await S.page.locator('#knap-dagens-gaade').scrollIntoViewIfNeeded()
    await tryk(S, '#knap-dagens-gaade'); await S.page.waitForTimeout(700)
    const pl = placering(await fen(S))
    res.push({ lichess: LI.has(pl), rating: LI.get(pl)?.rating ?? ALLE.find((x) => placering(x.fen) === pl)?.rating ?? null, pl, titel: await tekst(S, '#gaade-titel'), dagNr: await S.page.evaluate(() => Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000)) })
    await S.ctx.close()
  }
  ud.dagens[navn] = { ...res[0], sammeForBegge: res[0].pl === res[1].pl }
  skriv(`dagens ${navn}: ${JSON.stringify(ud.dagens[navn]).slice(0, 200)}`)
}

// #13 "Med brikkerne" i "Find feltet": 10 felter med touch, tryk midt paa feltet
ud.brikker = {}
for (const [bredde, hoejde] of [[360, 780], [390, 844], [1280, 800]]) {
  const S = await nySide(bredde, hoejde)
  await tryk(S, '#fane-spil'); await S.page.waitForTimeout(300)
  await aabnFold(S, 'fold-koordinater')
  const valg = await synlig(S, '#koordinat-brikker-valg')
  await S.page.locator('#koordinat-brikker').check()
  await S.page.waitForTimeout(200)
  const r = { valg, brikker: await S.page.locator('#koordinat-braet .brik-svg').count(), hjaelp: await tekst(S, '#koordinat-hjaelp'), felter: [], feltPx: await S.page.evaluate(() => Math.round(document.querySelector('#koordinat-braet .felt').getBoundingClientRect().width)) }
  await S.page.locator('#knap-koordinat-start').scrollIntoViewIfNeeded()
  await tryk(S, '#knap-koordinat-start')
  await S.page.waitForTimeout(300)
  await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-13-efter-start.png`) })
  r.braetISyne = await S.page.evaluate(() => { const b = document.getElementById('koordinat-braet').getBoundingClientRect(); const f = document.getElementById('koordinat-felt').getBoundingClientRect(); return { braet: [Math.round(b.top), Math.round(b.bottom)], felt: [Math.round(f.top), Math.round(f.bottom)], vinduH: innerHeight, ok: b.top >= 0 && b.bottom <= innerHeight + 1 && f.top >= 0 && f.bottom <= innerHeight } })
  for (let i = 0; i < 10; i++) {
    const felt = (await tekst(S, '#koordinat-felt')) ?? ''
    const medBrik = await S.page.locator(`#koordinat-braet .felt[data-square="${felt}"] .brik-svg`).count()
    await tryk(S, `#koordinat-braet .felt[data-square="${felt}"]`)
    await S.page.waitForTimeout(120)
    r.felter.push({ felt, medBrik: medBrik > 0, fundet: await tekst(S, '#koordinat-fundet') })
  }
  r.fundetTil = await tekst(S, '#koordinat-fundet')
  r.medBrik = r.felter.filter((f) => f.medBrik).length
  if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, 'S-390-13-med-brikker.png') })
  r.net = S.net.length; r.fejl = S.fejl
  ud.brikker[bredde] = r
  skriv(`#13 ${bredde}: ${JSON.stringify({ ...r, felter: undefined })}`)
  await S.ctx.close()
}

// #13 klasseoevelsen i laerer.html: en hel runde, projektoren, skift mellem storm og koordinater
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const K = { net: [], fejl: [] }
  page.on('pageerror', (e) => K.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); K.net.push(u); return r.abort() })
  await page.clock.install({ time: new Date(NU0) })
  await page.goto(LAERER)
  await page.click('#fane-knap-storm')
  await page.click('.ks-oevelse[data-oevelse="storm"]')
  for (const [bord, n] of [[2, 11]]) { await page.fill('#ks-bord', String(bord)); await page.fill('#ks-loeste', String(n)); await page.click('#ks-tilfoej') }
  K.stormRaekker = await page.locator('.ks-tabel tbody tr').count()
  await page.click('.ks-oevelse[data-oevelse="koordinater"]')
  K.urKoordinater = await page.locator('#klassestorm [data-ks-ur]').first().textContent()
  K.fase = (await page.locator('#klassestorm [data-ks-fase]').first().textContent()).replace(/\s+/g, ' ').trim()
  K.koordinatRaekkerFoer = await page.locator('.ks-tabel tbody tr').count()
  await page.click('#ks-start')
  const ur = []
  for (const ms of [1000, 5000, 1000, 10000, 10000, 9000, 1000]) { await page.clock.runFor(ms); ur.push(await page.locator('#klassestorm [data-ks-ur]').first().textContent()) }
  K.ur = ur
  for (const [bord, n] of [[4, 17], [9, 22], [1, 9]]) { await page.fill('#ks-bord', String(bord)); await page.fill('#ks-loeste', String(n)); await page.click('#ks-tilfoej') }
  K.koordinatRaekker = await page.locator('.ks-tabel tbody tr').count()
  K.kolonne = (await page.locator('.ks-tabel thead').textContent()).replace(/\s+/g, ' ').trim()
  await page.click('#ks-projektor')
  await page.waitForTimeout(300)
  const lag = page.locator('#ks-projektor-lag')
  K.projektor = { titel: (await lag.locator('.proj-titel').textContent()).trim(), foerst: (await lag.locator('.ks-foerst').textContent()).replace(/\s+/g, ' ').trim(), tekst: (await lag.textContent()).replace(/\s+/g, ' ').trim().slice(0, 300) }
  await page.screenshot({ path: path.join(HERE, 'S-1280-13-klassens-koordinater.png') })
  await page.keyboard.press('Escape')
  await page.click('.ks-oevelse[data-oevelse="storm"]')
  K.tilbageStorm = { ur: await page.locator('#klassestorm [data-ks-ur]').first().textContent(), raekker: await page.locator('.ks-tabel tbody tr').count() }
  await page.click('.ks-oevelse[data-oevelse="koordinater"]')
  K.tilbageKoordinater = { raekker: await page.locator('.ks-tabel tbody tr').count() }
  await page.reload()
  await page.click('#fane-knap-storm')
  await page.click('.ks-oevelse[data-oevelse="koordinater"]').catch(() => {})
  K.efterGenindlaes = { raekker: await page.locator('.ks-tabel tbody tr').count() }
  K.lagret = await page.evaluate(() => Object.keys(localStorage).filter((k) => /storm|klasse|ks/i.test(k)).map((k) => ({ k, v: localStorage.getItem(k).slice(0, 300) })))
  ud.klasse = K
  skriv(`klasse: ${JSON.stringify(K).slice(0, 600)}`)
  await ctx.close()
}
await browser.close()

// --- K15/K16 paa braettet (chess.js) -------------------------------------------------------------
{
  const st = KP.kendtPartiOpgave(parti('steinitz-bardeleben-1895'))
  const c = new Chess(st.fen)
  const loesSan = parti('steinitz-bardeleben-1895').loesning
  // 22...Kxe7 og 22...Dxe7 efter 22.Txe7+ (foerste traek i loesningen)
  const efter22 = new Chess(st.fen); efter22.move(loesSan[0])
  const svar = efter22.moves({ verbose: true }).filter((m) => m.to === 'e7').map((m) => m.san)
  const dx = new Chess(efter22.fen()); let dxOk = false
  if (dx.moves().includes('Qxe7')) { dx.move('Qxe7'); const l = ['Rxc8+', 'Rxc8', 'Qxc8+']; dxOk = l.every((s) => { try { dx.move(s); return true } catch { return false } }) }
  const mat = { hvid: 0, sort: 0 }
  for (const p of dx.board().flat().filter(Boolean)) if (p.type !== 'k' && p.type !== 'p') mat[p.color === 'w' ? 'hvid' : 'sort'] += { q: 9, r: 5, b: 3, n: 3 }[p.type]
  ud.tekster.steinitz = { loesning: loesSan, sortKanSlaaE7Med: svar, dxe7Txc8Txc8Dxc8: dxOk, officererEfter: mat, foerste: c.fen() }
  const r = parti('reti-tartakower-1910')
  const rc = new Chess(); for (const s of r.traek.split(' ')) rc.move(s)
  const h0 = rc.history().length
  const lr = r.loesning.map((s) => rc.move(s))
  const alle = rc.history({ verbose: true })
  const traekNr = (i) => Math.floor(i / 2) + 1
  const dronningOffer = alle.findIndex((m) => m.piece === 'q' && m.to === 'd8' && m.color === 'w')
  const dob = alle.findIndex((m, i) => { if (m.color !== 'w' || !m.san.includes('+')) return false; const x = new Chess(); for (const y of alle.slice(0, i + 1)) x.move(y.san); const kong = x.board().flat().find((p) => p && p.type === 'k' && p.color === 'b').square; return x.attackers ? x.attackers(kong, 'w').length === 2 : false })
  ud.tekster.reti = { dronningOfferTraek: dronningOffer >= 0 ? traekNr(dronningOffer) : null, dobbeltskakTraek: dob >= 0 ? traekNr(dob) : null, dobbeltskakSan: dob >= 0 ? alle[dob].san : null, mat: rc.isCheckmate(), matSan: alle.at(-1).san, matTraek: traekNr(alle.length - 1), matBrik: alle.at(-1).piece, partiTraek: h0, loesning: lr.map((m) => m.san) }
  const la = KP.kendtPartiOpgave(parti('lasker-thomas-1912'))
  const lc = new Chess(la.fen); for (const u of la.solutionUci.slice(0, -1)) lc.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
  const matter = lc.moves().filter((m) => { const y = new Chess(lc.fen()); y.move(m); return y.isCheckmate() })
  ud.tekster.lasker = { sidsteILinjen: parti('lasker-thomas-1912').loesning.at(-1), matterISidsteStilling: matter }
}

// --- paastande -----------------------------------------------------------------------------------
const B = [360, 390, 1280]
for (const w of B) {
  const R = ud.sider[w]
  const k = R.k13
  for (const n of ['opera', 'kongejagt', 'naeste', 'oevGafler', 'bibliotek', 'gentag']) paastaa(`${w}: K13 "${n}": braet og statuslinje paa skaermen 1,2 s efter trykket`, k[n] && k[n].e1200.ok, k[n] && { foer: k[n].foer.braet, e100: k[n].e100.braet, e1200: k[n].e1200.braet, h: k[n].e1200.vinduH, s: k[n].e1200.statusTekst })
  paastaa(`${w}: K14 O-O-O# -> "Loest! Lasker spillede Kd2#, men O-O-O# er ogsaa mat." og historien vises`, R.k14.ooo === 'Løst! Lasker spillede Kd2#, men O-O-O# er også mat.' && R.k14.historie, R.k14.ooo)
  paastaa(`${w}: K14 Kd2# -> "Praecis saadan spillede Edward Lasker."`, /Præcis sådan spillede Edward Lasker/.test(R.k14.kd2 ?? ''), R.k14.kd2)
  paastaa(`${w}: K14 med hint -> "Loest (med hjaelp)! Lasker spillede Kd2#, men O-O-O# ..."`, /^Løst \(med hjælp\)! Lasker spillede Kd2#, men O-O-O# er også mat\./.test(R.k14.oooHint ?? ''), R.k14.oooHint)
  paastaa(`${w}: K15 Steinitz-teksten`, /slår kongen, bliver den jaget ud i et angreb, og slår dronningen, taber sort en officer/.test(R['steinitz-bardeleben-1895'].tekst) && !/sat mat/.test(R['steinitz-bardeleben-1895'].tekst), R['steinitz-bardeleben-1895'].tekst)
  paastaa(`${w}: K16 Reti-teksten`, /unge mestre på 21 og 23 år/.test(R['reti-tartakower-1910'].tekst) && /i 10\. træk og satte mat med løberen i 11\. træk/.test(R['reti-tartakower-1910'].tekst) && !/tidens stærkeste/.test(R['reti-tartakower-1910'].tekst), R['reti-tartakower-1910'].tekst)
  paastaa(`${w}: 0 netkald, 0 JS-fejl, ingen vandret rulning`, R.net.length === 0 && R.fejl.length === 0 && R.vandret <= 0, { n: R.net.length, f: R.fejl, v: R.vandret })
}
paastaa('K13 paa 360 x 640: braettet paa skaermen efter operaen og "Oev gafler"', ud.sider[360].k13.lavTelefonOpera.e1200.ok && ud.sider[360].k13.lavTelefonGafler.e1200.ok, [ud.sider[360].k13.lavTelefonOpera.e1200, ud.sider[360].k13.lavTelefonGafler.e1200])
const T = ud.tekster
paastaa('K15 paa braettet: sort kan slaa e7 med kongen og dronningen; Dxe7 Txc8+ Txc8 Dxc8+ gaar', T.steinitz.sortKanSlaaE7Med.includes('Kxe7') && T.steinitz.sortKanSlaaE7Med.includes('Qxe7') && T.steinitz.dxe7Txc8Txc8Dxc8, T.steinitz)
paastaa('K16 paa braettet: dronningen paa d8 i 9. traek, dobbeltskak i 10., mat med loeberen i 11.', T.reti.dronningOfferTraek === 9 && T.reti.dobbeltskakTraek === 10 && T.reti.mat && T.reti.matTraek === 11 && T.reti.matBrik === 'b', T.reti)
paastaa('K14 paa braettet: Kd2# og O-O-O# er begge mat i sidste stilling', T.lasker.matterISidsteStilling.includes('Kd2#') && T.lasker.matterISidsteStilling.includes('O-O-O#'), T.lasker)
for (const [n, R] of Object.entries(ud.k17)) {
  const sum = SEKS.reduce((a, t) => a + R.temaer[t].lichess, 0)
  const lav = SEKS.filter((t) => R.temaer[t].lichess < 10)
  paastaa(`K17 ${n}: ${sum} af 120 (${Math.round(sum / 1.2)} %) lichess over de seks temaer, mindst halvdelen i gennemsnit${lav.length ? '; under 10 af 20: ' + lav.map((t) => t + ' ' + R.temaer[t].lichess).join(', ') : ''}`, sum >= 60 && R.net === 0 && !R.fejl.length, Object.fromEntries(SEKS.map((t) => [t, R.temaer[t].lichess])))
  paastaa(`K17 ${n}: modstanderens traek markeret i hver lichess-gaade`, SEKS.every((t) => R.temaer[t].markeret === R.temaer[t].lichess), Object.fromEntries(SEKS.map((t) => [t, R.temaer[t].markeret + '/' + R.temaer[t].lichess])))
}
{
  const nyMaks = Math.max(...['360-ny', '390-ny', '1280-ny'].flatMap((n) => SEKS.map((t) => ud.k17[n].temaer[t].liRating?.[1] ?? 0)))
  const lavK = ['360-ny', '390-ny', '1280-ny', '390-1200', '1280-1200'].flatMap((n) => SEKS.filter((t) => ud.k17[n].temaer[t].lichess < 10).map((t) => `${n} ${t} ${ud.k17[n].temaer[t].lichess}`))
  ud.k17Fund = { nyMaksLichessRating: nyMaks, underHalvdelen: lavK }
  paastaa(`K17 fund: ny elev (800) fik lichess-gaader op til ${nyMaks} (rapporten: hoejst ca. 100 over), og ${lavK.length} af 30 tema-koersler gav under 10 af 20`, nyMaks > 900 && lavK.length >= 1, ud.k17Fund)
}
const nyAlle = ['360-ny', '390-ny', '1280-ny'].flatMap((n) => SEKS.map((t) => ud.k17[n].temaer[t].lichess))
ud.k17Resume = { nyMin: Math.min(...nyAlle), nyMaks: Math.max(...nyAlle), elev1200: ['390-1200', '1280-1200'].flatMap((n) => SEKS.map((t) => ud.k17[n].temaer[t].lichess)) }
paastaa('K17 dagens gaade: lichess paa de lige dage, samme for to elever paa samme dato', ud.dagens['lige 28/9'].lichess && ud.dagens['lige 30/9'].lichess && Object.values(ud.dagens).every((d) => d.sammeForBegge), ud.dagens)
for (const w of B) {
  const r = ud.brikker[w]
  paastaa(`${w}: #13 "Med brikkerne": 32 brikker, 10 af 10 felter fundet med tryk (${r.medBrik} med en brik paa)`, r.valg && r.brikker === 32 && /Fundet: 10/.test(r.fundetTil ?? '') && r.net === 0 && !r.fejl.length, { fundet: r.fundetTil, feltPx: r.feltPx })
  ud.brikker[w].feltetOverSkaermen = r.braetISyne.felt[0] < 0
}
paastaa('K26 fund: efter Start staar feltets navn helt eller delvis over skaermen, naar eleven har rullet ned til Start (360 og 1280 helt, 390 1 px)', ud.brikker[360].braetISyne.felt[1] <= 0 && ud.brikker[1280].braetISyne.felt[1] <= 0, Object.fromEntries(B.map((w) => [w, ud.brikker[w].braetISyne])))
const K = ud.klasse
paastaa('#13 klasseoevelsen: 0:30, faelles nedtaelling, 0:00, tre borde, projektoren "Klassens koordinater" med bord 9 foerst', K.urKoordinater === '0:30' && K.ur.includes('Start!') && K.ur.at(-1) === '0:00' && K.koordinatRaekker === 3 && /Klassens koordinater/.test(K.projektor.titel) && /22/.test(K.projektor.foerst) && !K.net.length && !K.fejl.length, { ur: K.ur, p: K.projektor.titel, f: K.projektor.foerst })
paastaa('#13 skift mellem oevelserne: stormens bord og koordinaternes tre bliver hvor de hoerer til', K.koordinatRaekkerFoer === 0 && K.tilbageStorm.raekker === K.stormRaekker && K.tilbageKoordinater.raekker === 3, { storm: [K.stormRaekker, K.tilbageStorm], koord: [K.koordinatRaekkerFoer, K.tilbageKoordinater] })

ud.tjek = tjek
writeFileSync(path.join(HERE, 'skak-568.json'), JSON.stringify(ud, null, 1))
writeFileSync(path.join(HERE, 'skak-568.log'), log.join('\n') + '\n')
const roede = tjek.filter((x) => !x.ok).length
console.log(`skak-568: ${tjek.length - roede}/${tjek.length} (skak main ${SHA})`)
