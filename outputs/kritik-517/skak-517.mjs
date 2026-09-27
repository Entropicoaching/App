// KRITIK 517 blok 2: skakken som en elev paa 12 aar en soendag hjemme.
//   node outputs/kritik-517/skak-517.mjs
// skak.html fra C:\Users\Entropi\Desktop\skak @ main (61f0dd6, 512 merget), dobbeltklikket
// (file://), headless Chromium uden net: 390 px med touch (tap) og 1280 px med mus.
// Eleven er et script: tager mat i 1, ellers det stoerste slag, ellers skak, ellers et
// tilfaeldigt traek (fast froe), og trykker sig frem som en elev (fane, knap, felt).
// Intet i skak roeres. Skriver outputs/kritik-517/skak-517.json og K-*.png.
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short HEAD`).toString().trim()
const { Chess } = await import(pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href)
const URL_ = pathToFileURL(`${SKAK}/skak.html`).href

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }
const vent = (ms) => new Promise((r) => setTimeout(r, ms))

// --- eleven -----------------------------------------------------------------------------------
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

const browser = await chromium.launch({ headless: true })
async function aabn(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  await page.goto(URL_)
  await page.waitForSelector('#braet .felt')
  await page.waitForTimeout(600)
  return { ctx, page, net, fejl, bredde, mobil }
}
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const felt = (S, f) => tryk(S, `#braet [data-square="${f}"]`)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
async function forfra(S) {
  await tryk(S, '#knap-spil-forfra'); await S.page.waitForTimeout(250)
  if (await S.page.locator('#spil-forfra-modal').isVisible()) { S.forfraSpurgt = (S.forfraSpurgt || 0) + 1; await tryk(S, '#knap-spil-forfra-bekraeft') }
  await S.page.waitForTimeout(400)
}
const status = (S) => S.page.locator('#status').textContent().then((t) => t.trim())
const synligTekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e && !e.hidden && e.offsetParent ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const rul = (S) => S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function spilTraek(S, m) {
  await felt(S, m.from); await felt(S, m.to)
  if (m.promotion) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').first().click() }
}
const ud = { skak: SHA, bredder: [390, 1280] }

for (const bredde of [390, 1280]) {
  const R = (ud[bredde] = {})
  const S = await aabn(bredde)
  const p = S.page

  // --- 1. Foerste indtryk ------------------------------------------------------------------------
  R.startFane = await p.evaluate(() => document.querySelector('[id^=fane-][aria-selected="true"], [id^=fane-].aktiv')?.textContent.trim() ?? [...document.querySelectorAll('[id^=fane-]')].find((e) => getComputedStyle(e).color !== getComputedStyle(document.getElementById('fane-bibliotek')).color)?.textContent.trim())
  R.startStatus = await synligTekst(S, '#status')
  await p.screenshot({ path: path.join(HERE, `K-${bredde}-1-start.png`) })
  await tryk(S, '#fane-spil'); await p.waitForTimeout(400)
  R.spil = await p.evaluate(() => {
    const y = (s) => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; return Math.round(e.getBoundingClientRect().top + scrollY) }
    return { modComputerY: y('#segment-spil-modus [data-value="computer"]'), valgtModus: document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.textContent.trim(), bordNrSynlig: !!document.querySelector('label[for="bord-nr"], #bord-nr')?.offsetParent, bordTekst: [...document.querySelectorAll('.hjaelp')].find((e) => /klassens turnering/.test(e.textContent) && e.offsetParent)?.textContent.trim() ?? null, vindueH: innerHeight }
  })

  // --- 2. Spil mod computeren (niveau 3, hvid) ---------------------------------------------------
  await tryk(S, '#segment-spil-modus [data-value="computer"]'); await p.waitForTimeout(300)
  R.spil.niveauSynligEfterValg = await p.locator('#segment-niveau').isVisible()
  await tryk(S, '#segment-spiller-farve [data-value="w"]')
  await tryk(S, '#segment-niveau [data-value="3"]')
  await p.waitForTimeout(300)
  if ((await fen(S)).split(' ')[5] !== '1' || (await fen(S)).split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') await forfra(S)
  R.spil.statusFoer = await status(S)
  const rnd = froe(517 + bredde)
  const svartider = []
  let plies = 0, slut = null, aabningsnavne = new Set()
  while (plies < 70) {
    const f = await fen(S)
    const c = new Chess(f)
    if (c.isGameOver()) { slut = 'partiet sluttede paa braettet'; break }
    if (c.turn() !== 'w') { await p.waitForTimeout(100); continue }
    const m = elevTraek(f, rnd)
    const t0 = Date.now()
    await spilTraek(S, m)
    plies++
    for (let i = 0; i < 200; i++) { const f2 = await fen(S); if (f2.split(' ')[1] === 'w' || new Chess(f2).isGameOver()) break; await p.waitForTimeout(50) }
    svartider.push(Date.now() - t0)
    const st = await status(S)
    const navn = st.match(/[A-ZÆØÅ][^.]*(?:parti|forsvar|gambit|åbning|angreb|variant)[^.]*/i)?.[0]
    if (navn) aabningsnavne.add(navn)
  }
  R.spil.statusEfter = await status(S)
  R.spil.traek = plies
  R.spil.svartiderMs = { median: svartider.sort((a, b) => a - b)[Math.floor(svartider.length / 2)], max: svartider[svartider.length - 1], antal: svartider.length }
  R.spil.aabningsnavne = [...aabningsnavne].slice(0, 5)
  if (!slut) {
    await tryk(S, '#knap-spil-giv-op'); await p.waitForTimeout(200)
    await tryk(S, '#knap-spil-giv-op-bekraeft'); slut = 'eleven gav op'
  }
  R.spil.slut = slut
  R.spil.statusSlut = await status(S)
  const tA = Date.now()
  let analyseMs = null
  try { await p.waitForFunction(() => !document.getElementById('partital-indhold').hidden, null, { timeout: 90000 }); analyseMs = Date.now() - tA } catch { analyseMs = null }
  R.analyse = await p.evaluate(() => ({
    tal: [...document.querySelectorAll('#partital-tal > *')].map((e) => e.textContent.trim()),
    forklaring: document.getElementById('partital-noejagtighed-forklaring')?.textContent.trim(),
    status: document.getElementById('partital-status')?.textContent.trim(),
    graf: (document.querySelector('#partigraf')?.getBoundingClientRect().height ?? 0) > 20,
    laerFejl: !!document.getElementById('knap-laer-fejl-start')?.offsetParent,
    laerFejlTekst: document.getElementById('laer-fejl')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
    vendepunkter: [...document.querySelectorAll('[id*=vendepunkt]')].filter((e) => e.offsetParent).map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 160)).slice(0, 2),
    trakliste: document.getElementById('traekliste')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
    yGraf: Math.round((document.querySelector('#partigraf')?.getBoundingClientRect().top ?? 0) + scrollY), yBraetBund: Math.round(document.getElementById('braet').getBoundingClientRect().bottom + scrollY),
  }))
  R.analyse.ventetidMs = analyseMs
  R.analyse.rul = await rul(S)
  if (await p.locator('#partital').isVisible()) { await p.locator('#partital').scrollIntoViewIfNeeded(); await p.locator('#partital').screenshot({ path: path.join(HERE, `K-${bredde}-2-analyse.png`) }) }
  // Laer af dine fejl
  if (R.analyse.laerFejl) {
    await tryk(S, '#knap-laer-fejl-start'); await p.waitForTimeout(1500)
    R.laerFejl = await p.evaluate(() => document.getElementById('laer-fejl')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 400))
    // Eleven proever et traek paa oevebraettet: foerste lovlige traek med en af egne brikker.
    const oeveFen = await p.evaluate(() => { const b = document.getElementById('laer-fejl-braet'); return b?.dataset.fen || null })
    R.laerFejlOeveFen = oeveFen
    const m1 = R.laerFejl.match(/Du spillede \d+\. ([^ ]+)/)
    R.laerFejlSpillet = m1 ? m1[1] : null
    await p.locator('#laer-fejl').scrollIntoViewIfNeeded(); await p.locator('#laer-fejl').screenshot({ path: path.join(HERE, `K-${bredde}-3-laer-fejl.png`) })
  }

  // --- 3. Gennemse partiet -------------------------------------------------------------------------
  const fenSlut = await fen(S)
  await tryk(S, '#knap-gennemse-tilbage'); await tryk(S, '#knap-gennemse-tilbage'); await tryk(S, '#knap-gennemse-tilbage'); await p.waitForTimeout(300)
  const stTilbage = await status(S)
  const braetTekst = () => p.evaluate(() => [...document.querySelectorAll('#braet [data-square]')].map((e) => e.querySelector('.brik-svg') ? 1 : 0).join(''))
  const braetTilbage = await braetTekst()
  R.gennemse = { statusTilbage: stTilbage, tilbageVirker: /Du ser/.test(stTilbage) }
  if (!S.mobil) { await p.locator('body').click({ position: { x: 5, y: 5 } }); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); R.gennemse.statusPilHoejre = await status(S); R.gennemse.pilHoejre = R.gennemse.statusPilHoejre !== stTilbage }
  await tryk(S, '#knap-gennemse-nu'); await p.waitForTimeout(300)
  R.gennemse.statusNu = await status(S)
  R.gennemse.braetSkiftede = braetTilbage !== (await braetTekst())
  R.gennemse.tilbageTilNu = !/Du ser/.test(R.gennemse.statusNu)

  // --- 4. Del og indlaes (PGN) ----------------------------------------------------------------------
  const fold = p.locator('#fold-del')
  if (!(await fold.evaluate((d) => d.open))) await tryk(S, '#fold-del summary')
  await p.waitForTimeout(200)
  await tryk(S, '#knap-pgn-kopier'); await p.waitForTimeout(300)
  let klip = ''
  try { klip = await p.evaluate(() => navigator.clipboard.readText()) } catch (e) { klip = `(kunne ikke laese: ${e.message.slice(0, 60)})` }
  R.pgn = { besked: await synligTekst(S, '#del-besked'), kopieret: klip.slice(0, 600), kopieretHeaders: (klip.match(/^\[\w+ /gm) || []).map((h) => h.slice(1, -1)) }
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), tryk(S, '#knap-pgn-gem')])
  R.pgn.filnavn = dl ? dl.suggestedFilename() : null
  // Et parti fra lichess, som en elev kopierer det fra "Share & export" (med ur og vurdering i kommentarer).
  const LICHESS = `[Event "Rated Blitz game"]
[Site "https://lichess.org/AbCdEfGh"]
[Date "2026.09.26"]
[White "ven123"]
[Black "elev2014"]
[Result "0-1"]
[WhiteElo "1180"]
[BlackElo "1215"]
[TimeControl "180+0"]
[ECO "C50"]
[Opening "Italian Game: Giuoco Pianissimo"]
[Termination "Normal"]

1. e4 { [%eval 0.36] [%clk 0:03:00] } 1... e5 { [%eval 0.3] [%clk 0:03:00] } 2. Nf3 { [%clk 0:02:58] } 2... Nc6 { [%clk 0:02:57] } 3. Bc4 { [%clk 0:02:55] } 3... Bc5 { [%clk 0:02:54] } 4. d3 { [%clk 0:02:50] } 4... Nf6 { [%clk 0:02:50] } 5. Ng5?! { [%clk 0:02:45] } 5... O-O { [%clk 0:02:44] } 6. Nxf7?? { [%clk 0:02:40] } 6... Rxf7 { [%clk 0:02:40] } 7. Bxf7+ { [%clk 0:02:38] } 7... Kxf7 { [%clk 0:02:37] } 8. Qf3 { [%clk 0:02:30] } 8... d5 { [%clk 0:02:25] } 9. exd5 { [%clk 0:02:20] } 9... Nd4 { [%clk 0:02:15] } 10. Qd1 { [%clk 0:02:10] } 10... Bg4 { [%clk 0:02:05] } 11. f3 { [%clk 0:02:00] } 11... Nxf3+ { [%clk 0:01:55] } 12. gxf3 { [%clk 0:01:50] } 12... Bxf3 { [%clk 0:01:45] } 13. Qd2 { [%clk 0:01:40] } 13... Bxh1 { [%clk 0:01:35] } 0-1

`
  const INDLAES = async (tekst) => {
    if (!(await fold.evaluate((d) => d.open))) await tryk(S, '#fold-del summary')
    await p.locator('#pgn-tekst').fill(tekst)
    await tryk(S, '#knap-pgn-indlaes'); await p.waitForTimeout(800)
    return { besked: await synligTekst(S, '#del-besked'), fen: await fen(S), status: await status(S), fane: await p.evaluate(() => document.querySelector('#fane-spil')?.getAttribute('aria-selected')), analyse: await p.evaluate(() => !document.getElementById('partital')?.hidden) }
  }
  R.pgn.lichess = await INDLAES(LICHESS)
  R.pgn.lichess.forventetFen = (() => { const c = new Chess(); c.loadPgn(LICHESS); return c.fen() })()
  try { await p.waitForFunction(() => !document.getElementById('partital-indhold').hidden, null, { timeout: 60000 }); R.pgn.lichess.analyseTal = await p.evaluate(() => [...document.querySelectorAll('#partital-tal > *')].map((e) => e.textContent.trim())) } catch { R.pgn.lichess.analyseTal = null }
  await p.locator('#status').scrollIntoViewIfNeeded()
  await p.screenshot({ path: path.join(HERE, `K-${bredde}-4-lichess-pgn.png`) })
  await tryk(S, '#knap-gennemse-nu'); await p.waitForTimeout(300)
  R.pgn.lichess.aabning = await synligTekst(S, '#spil-aabning')
  R.pgn.lichess.navne = await p.evaluate(() => [...document.querySelectorAll('#partital-tal > *')].slice(1, 3).map((e) => e.textContent.trim()))
  R.pgn.medVariant = await INDLAES('1. e4 e5 2. Nf3 (2. f4 exf4) 2... Nc6 3. Bb5 a6 *')
  R.pgn.dansk = await INDLAES('1. e4 e5 2. Sf3 Sc6 3. Lb5 a6 4. La4 Sf6 5. O-O Le7 *')
  R.pgn.forkert = await INDLAES('1. e4 e5 2. Ke3 Ke6 3. Qh5 *')
  R.pgn.forkertTraeksliste = await synligTekst(S, '#traekliste')
  R.pgn.remis = await INDLAES('[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2')
  await p.waitForTimeout(4000)
  R.pgn.remis.analyseEfter4s = await p.evaluate(() => !document.getElementById('partital-indhold').hidden && !document.getElementById('partital').hidden)
  // Et parti mod computeren i gang, og saa indlaeses en vens parti: spoerger siden?
  await tryk(S, '#fane-spil'); await p.waitForTimeout(200)
  await tryk(S, '#segment-spil-modus [data-value="computer"]')
  await tryk(S, '#segment-niveau [data-value="2"]')
  await forfra(S)
  for (const [a, b] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4']]) { for (let i = 0; i < 100 && (await fen(S)).split(' ')[1] !== 'w'; i++) await p.waitForTimeout(50); await felt(S, a); await felt(S, b) }
  for (let i = 0; i < 100 && (await fen(S)).split(' ')[1] !== 'w'; i++) await p.waitForTimeout(50)
  const iGang = await fen(S)
  let dialog = false
  p.once('dialog', (d) => { dialog = true; d.dismiss() })
  const ov = await INDLAES('1. d4 d5 2. c4 e6 *')
  R.pgn.overskriver = { iGangFoer: iGang, besked: ov.besked, fenEfter: ov.fen, modalSynlig: await p.evaluate(() => [...document.querySelectorAll('.modal')].some((m) => !m.hidden)), dialog, modstanderEfter: await p.evaluate(() => document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.textContent.trim()) }

  // --- 5. Forhaandstraek i rigtig tid mod computeren (niveau 1 og 8) --------------------------------
  R.forhaand = {}
  for (const niveau of ['1', '8']) {
    await tryk(S, '#fane-spil'); await p.waitForTimeout(200)
    await tryk(S, '#segment-spil-modus [data-value="computer"]')
    await tryk(S, '#segment-spiller-farve [data-value="w"]')
    await tryk(S, `#segment-niveau [data-value="${niveau}"]`)
    await forfra(S)
    const tider = []
    let lagt = 0, spillet = 0, naaede = 0
    const plan = [['e2', 'e4', 'g1', 'f3'], ['g1', 'f3', 'f1', 'c4'], ['f1', 'c4', 'b1', 'c3'], ['b1', 'c3', 'd2', 'd3']]
    for (const [a, b, fa, fb] of plan) {
      const f0 = await fen(S)
      if (f0.split(' ')[1] !== 'w') break
      const c = new Chess(f0)
      if (!c.moves({ verbose: true }).some((m) => m.from === a && m.to === b)) continue
      const t0 = Date.now()
      await felt(S, a); await felt(S, b)
      // Eleven vil straks laegge naeste traek som forhaandstraek.
      await felt(S, fa); await felt(S, fb)
      const lin = await synligTekst(S, '#forhaand-linje')
      const f1 = await fen(S)
      const computerAlleredeSvaret = f1.split(' ')[1] === 'w'
      if (lin && /Forhåndstræk/.test(lin)) lagt++
      if (!computerAlleredeSvaret) naaede++
      for (let i = 0; i < 200; i++) { const f2 = await fen(S); if (f2.split(' ')[1] === 'w' && f2 !== f1) break; if (f2.split(' ')[1] === 'b' && f2 !== f1 && f1.split(' ')[1] === 'w') break; await p.waitForTimeout(40) }
      tider.push(Date.now() - t0)
      await p.waitForTimeout(700)
      const f3 = await fen(S)
      if (new Chess(f3).get(fb)?.color === 'w' && !new Chess(f3).get(fa)) spillet++
      // Er forhaandstraekket spillet, er det nu computerens tur; vent paa svaret.
      for (let i = 0; i < 200 && (await fen(S)).split(' ')[1] !== 'w'; i++) await p.waitForTimeout(40)
    }
    R.forhaand[niveau] = { forsoeg: plan.length, naaedeAtLaegge: naaede, lagt, spillet, tider }
  }
  await tryk(S, '#fane-spil'); await p.waitForTimeout(200)
  await p.screenshot({ path: path.join(HERE, `K-${bredde}-5-forhaand.png`) })

  // --- 6. Storm (tilfaeldig, 60 sekunder, saa stop) --------------------------------------------------
  await tryk(S, '#fane-gaader'); await p.waitForTimeout(400)
  await p.waitForFunction(() => !document.getElementById('knap-storm-start').disabled, null, { timeout: 20000 })
  R.storm = { startKortY: await p.evaluate(() => Math.round(document.getElementById('storm-start-kort').getBoundingClientRect().top + scrollY)), vindueH: await p.evaluate(() => innerHeight), hjaelp: await synligTekst(S, '#storm-dagens-hjaelp'), rekordFoer: await synligTekst(S, '#storm-rekord') }
  await tryk(S, '#knap-storm-start'); await p.waitForTimeout(800)
  R.storm.barSynlig = await p.locator('#storm-bar').isVisible()
  R.storm.barOverBraet = await p.evaluate(() => { const b = document.getElementById('storm-bar').getBoundingClientRect(); const br = document.getElementById('braet').getBoundingClientRect(); return { bar: Math.round(b.top), braetTop: Math.round(br.top), braetBund: Math.round(br.bottom), vindueH: innerHeight } })
  const srnd = froe(9 + bredde)
  const tStorm = Date.now()
  let stormTraek = 0, sidsteFen = ''
  const tidsspor = []
  while (Date.now() - tStorm < 60000) {
    const f = await fen(S)
    if (f === sidsteFen) { await p.waitForTimeout(120); continue }
    const c = new Chess(f)
    const barTur = await synligTekst(S, '#storm-tur-tekst')
    if (!barTur) break
    const m = elevTraek(f, srnd)
    if (!m) break
    sidsteFen = f
    await spilTraek(S, m); stormTraek++
    await p.waitForTimeout(250)
    tidsspor.push({ tid: await synligTekst(S, '#storm-tid'), aendring: await synligTekst(S, '#storm-aendring'), loeste: await synligTekst(S, '#storm-loeste') })
    await p.waitForTimeout(500)
    if (stormTraek === 3) await p.screenshot({ path: path.join(HERE, `K-${bredde}-6-storm.png`) })
  }
  R.storm.traek = stormTraek
  R.storm.spor = tidsspor.slice(0, 12)
  if (await p.locator('#knap-storm-stop').isVisible()) await tryk(S, '#knap-storm-stop')
  await p.waitForTimeout(800)
  R.storm.resultat = await synligTekst(S, '#storm-resultat')
  if (await p.locator('#storm-resultat').isVisible()) { await p.locator('#storm-resultat').scrollIntoViewIfNeeded(); await p.locator('#storm-resultat').screenshot({ path: path.join(HERE, `K-${bredde}-7-storm-resultat.png`) }) }
  R.storm.rekordEfter = await synligTekst(S, '#storm-rekord')

  R.forfraSpurgt = S.forfraSpurgt || 0
  R.rul = await rul(S)
  R.net = S.net; R.fejl = S.fejl
  await S.ctx.close()
}
await browser.close()

// --- tjek (adfaerd, ikke tal der afhaenger af computerens tilfaeldige traek) ----------------------
const B = [390, 1280].map((w) => ud[w])
const [m, d] = B
paastaa('Start: siden aabner i Gaader (niveau-test), ikke i Spil', B.every((R) => R.startFane === 'Gåder'), B.map((R) => R.startStatus))
paastaa('K: Spil staar paa "Mod en makker"; paa 390 er "Mod computeren" under skaermens kant', B.every((R) => R.spil.valgtModus === 'Mod en makker') && m.spil.modComputerY > m.spil.vindueH && d.spil.modComputerY < d.spil.vindueH, [m.spil.modComputerY, m.spil.vindueH, d.spil.modComputerY])
paastaa('K: klassens "Bord nr." staar i Spil hjemme', B.every((R) => /klassens turnering/.test(R.spil.bordTekst || '')))
paastaa('Spil mod computeren (niveau 3): partiet spillet til ende med tryk/klik, computeren svarer paa 0,5-2,5 s', B.every((R) => R.spil.traek >= 10 && /vinder|remis|gav op/i.test(R.spil.statusSlut) && R.spil.svartiderMs.median < 2500), B.map((R) => [R.spil.traek, R.spil.statusSlut, R.spil.svartiderMs]))
paastaa('Analyse: graf, noejagtighed for begge sider og taelling inden for 10 s', B.every((R) => R.analyse.graf && R.analyse.tal[3] === 'Nøjagtighed' && /%$/.test(R.analyse.tal[4]) && /%$/.test(R.analyse.tal[5]) && R.analyse.ventetidMs !== null && R.analyse.ventetidMs < 10000), B.map((R) => [R.analyse.tal.slice(3, 6), R.analyse.ventetidMs]))
paastaa('Laer af dine fejl: knappen og en opgave med "Find et bedre træk"', B.every((R) => !R.analyse.laerFejl || /Find et bedre træk/.test(R.laerFejl || '')), B.map((R) => (R.laerFejl || '').slice(0, 90)))
paastaa('Gennemse: tilbage viser en tidligere stilling, og "nu" kommer tilbage; pil hoejre virker paa 1280', B.every((R) => R.gennemse.tilbageVirker && R.gennemse.braetSkiftede && R.gennemse.tilbageTilNu) && d.gennemse.pilHoejre, B.map((R) => R.gennemse.statusTilbage))
paastaa('PGN ud: kopieret med syv koder og gemt som skak-DATO.pgn', B.every((R) => R.pgn.kopieret.startsWith('[Event') && R.pgn.kopieretHeaders.length === 7 && /^skak-\d{4}-\d{2}-\d{2}\.pgn$/.test(R.pgn.filnavn)), B.map((R) => R.pgn.filnavn))
paastaa('PGN ind: et lichess-parti med ur og vurdering i kommentarer giver samme slutstilling, aabningsnavnet og analysen', B.every((R) => R.pgn.lichess.fen === R.pgn.lichess.forventetFen && /Italiensk parti/.test(R.pgn.lichess.aabning || '') && R.pgn.lichess.analyseTal), B.map((R) => R.pgn.lichess.aabning))
paastaa('PGN ind: sidevariant springes over, danske bogstaver virker, et ulovligt traek siges med traeknummer', B.every((R) => /6 halvtræk/.test(R.pgn.medVariant.besked) && /10 halvtræk/.test(R.pgn.dansk.besked) && /2\. Ke3 er ikke et lovligt træk/.test(R.pgn.forkert.besked)))
paastaa('K: spillernes navne fra PGN vises ikke (Hvid/Sort)', B.every((R) => R.pgn.lichess.navne.join() === 'Hvid,Sort'))
paastaa('K: et remis-parti fra PGN faar ingen analyse og ingen besked om hvorfor', B.every((R) => !R.pgn.remis.analyseEfter4s && !/analyse/i.test(R.pgn.remis.besked)))
paastaa('K: "Indlaes parti" erstatter et parti mod computeren i gang uden at spoerge ("Start forfra" spoerger)', B.every((R) => R.pgn.overskriver.fenEfter !== R.pgn.overskriver.iGangFoer && !R.pgn.overskriver.modalSynlig && !R.pgn.overskriver.dialog && R.pgn.overskriver.modstanderEfter === 'Mod en makker' && R.forfraSpurgt > 0))
paastaa('Forhaandstraek i rigtig tid mod computeren, niveau 1 og 8: lagt og spillet hver gang eleven naaede det', B.every((R) => ['1', '8'].every((n) => R.forhaand[n].lagt >= 1 && R.forhaand[n].spillet === R.forhaand[n].lagt)), B.map((R) => R.forhaand))
paastaa('Storm: uret over braettet, -10 s ved forkert, slutkort med traening i biblioteket og ny rekord', B.every((R) => R.storm.barSynlig && R.storm.spor.some((x) => x.aendring === '−10 s') && /Tiden er gået! Du løste \d+ gåder/.test(R.storm.resultat || '') && /træn det i biblioteket/.test(R.storm.resultat || '')), B.map((R) => (R.storm.resultat || '').slice(0, 40)))
paastaa('K: paa 390 staar stormens startkort under skaermens kant (under dagens gaade)', m.storm.startKortY > m.storm.vindueH, [m.storm.startKortY, m.storm.vindueH])
const html = (await import('node:fs')).readFileSync(`${SKAK}/skak.html`, 'utf8')
paastaa('K: to ord for samme motiv: "Spyd" (stormens og gaadernes knapper) og "Spid" (biblioteket, "Træn: Spid")', />Spyd</.test(html) && /titel:"Spid"/.test(html))
paastaa('Intet net, ingen JS-fejl, ingen vandret rulning paa 390 og 1280', B.every((R) => R.net.length === 0 && R.fejl.length === 0 && R.rul === 0))
ud.tjek = tjek
writeFileSync(path.join(HERE, 'skak-517.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length} tjek groenne (skak ${SHA})`)
