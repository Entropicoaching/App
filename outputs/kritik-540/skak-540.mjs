// KRITIK 540 blok 2: skakken efter Chaturangas 533 (K4, K6-K11) som en elev paa 12 aar paa
// telefonen.
//   node outputs/kritik-540/skak-540.mjs
// skak.html fra C:\Users\Entropi\Desktop\skak @ main hentes med `git archive` til en midlertidig
// mappe (traeet staar paa en anden gren og roeres ikke) og aabnes som file://, headless Chromium
// uden net: 360 og 390 px med touch (tap), 1280 med mus som kontrol.
// Eleven er et script (samme som 517 og 530): mat i 1, ellers stoerste slag, ellers skak, ellers
// tilfaeldigt. Eleven trykker sig frem med fanen, knapperne og felterne.
// Stormen koeres to gange pr. bredde: stoppet efter 25 s (K11) og til uret er ude (3 min plus bonustid, K9).
// Skriver outputs/kritik-540/skak-540.json og K-*.png.
import path from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k540-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main skak.html`)
execSync('tar -xf s.tar', { cwd: dir })
const { Chess } = await import(pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href)
const URL_ = pathToFileURL(path.join(dir, 'skak.html')).href
const BREDDER = process.env.KUN_BREDDE ? [Number(process.env.KUN_BREDDE)] : [360, 390, 1280]
const KUN = process.argv.includes('--hurtig') // uden de fulde storme (til udvikling)

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

const browser = await chromium.launch({ headless: true })
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const felt = (S, f) => tryk(S, `#braet [data-square="${f}"]`)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent) }, sel)
const rul = (S) => S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const boks = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), venstre: Math.round(r.left), hoejre: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width), vinduH: innerHeight } }, sel)
async function spilTraek(S, m) {
  await felt(S, m.from); await felt(S, m.to)
  if (m.promotion) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await tryk(S, '#forvandling-valg button') }
}
async function nySide(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? (bredde === 360 ? 780 : 844) : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const S = { ctx, mobil, bredde, net: [], fejl: [] }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => S.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  await page.goto(URL_)
  await page.waitForSelector('#braet .felt')
  await page.waitForTimeout(600)
  S.page = page
  return S
}
async function genindlaes(S, fane = 'spil') {
  await S.page.reload(); await S.page.waitForSelector('#braet .felt'); await S.page.waitForTimeout(500)
  await tryk(S, `#fane-${fane}`); await S.page.waitForTimeout(400)
}
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) await tryk(S, `#${id} > summary`)
  await S.page.waitForTimeout(250)
}
async function indlaes(S, pgn) {
  await tryk(S, '#fane-spil'); await S.page.waitForTimeout(250)
  await aabnFold(S, 'fold-del')
  await S.page.locator('#pgn-tekst').fill(pgn)
  await tryk(S, '#knap-pgn-indlaes'); await S.page.waitForTimeout(400)
  if (await S.page.locator('#pgn-indlaes-modal').isVisible()) await tryk(S, '#knap-pgn-indlaes-bekraeft')
  await S.page.waitForTimeout(500)
}
const venterAnalyse = async (S) => { try { await S.page.waitForFunction(() => !document.getElementById('partital-indhold').hidden && !document.getElementById('partital').hidden, null, { timeout: 90000 }); return true } catch { return false } }
const navneITabel = (S) => S.page.locator('#partital .partital-navn').allTextContents()

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

1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Nf3 2... Nc6 3. Bc4 3... Bc5 4. d3 4... Nf6 5. Ng5?! 5... O-O 6. Nxf7?? 6... Rxf7 7. Bxf7+ 7... Kxf7 8. Qf3 8... d5 9. exd5 9... Nd4 10. Qd1 10... Bg4 11. f3 11... Nxf3+ 12. gxf3 12... Bxf3 13. Qd2 13... Bxh1 0-1
`
const LANG = '[Event "Frikvarter"]\n[White "Storebror der altid vinder over mig"]\n[Black "?"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'
const UDEN = '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 *'
const BRIK = { S: 'N', L: 'B', T: 'R', D: 'Q', K: 'K' }
const engelsk = (san) => san.replace(/^[SLTDK]/, (b) => BRIK[b]).replace(/=([SLTD])/, (_, b) => `=${BRIK[b]}`)

// Eleven i stormen: spiller til stormen slutter eller til `sek` er gaaet, og husker alle stillinger.
async function storm(S, { sek, stop, seed }) {
  const p = S.page
  await tryk(S, '#fane-gaader'); await p.waitForTimeout(400)
  await p.waitForFunction(() => !document.getElementById('knap-storm-start').disabled, null, { timeout: 20000 })
  await p.locator('#knap-storm-start').scrollIntoViewIfNeeded()
  await tryk(S, '#knap-storm-start'); await p.waitForTimeout(800)
  const rnd = froe(seed)
  const t0 = Date.now()
  const set = new Set()
  let sidst = '', traek = 0, tTraek = 0, haengt = 0
  while (Date.now() - t0 < sek * 1000) {
    if (await synlig(S, '#storm-resultat')) break
    const f = await fen(S)
    // Blev traekket ikke taget (fx en brik valgt forkert), proever eleven et andet efter 2,5 s.
    if (f === sidst) { if (Date.now() - tTraek > 2500) { sidst = ''; haengt++; if (await p.locator('#forvandling-modal').isVisible()) await tryk(S, '#forvandling-valg button') } else { await p.waitForTimeout(120); continue } }
    if (!(await synlig(S, '#storm-tur-tekst'))) { await p.waitForTimeout(150); continue }
    set.add(f.split(' ').slice(0, 2).join(' '))
    const m = elevTraek(f, rnd); if (!m) break
    sidst = f; await spilTraek(S, m); traek++; tTraek = Date.now(); await p.waitForTimeout(650)
  }
  if (stop && (await p.locator('#knap-storm-stop').isVisible())) await tryk(S, '#knap-storm-stop')
  await p.waitForFunction(() => { const r = document.getElementById('storm-resultat'); return r && !r.hidden }, null, { timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(600)
  const r = await p.evaluate(() => ({
    overskrift: document.getElementById('storm-resultat-overskrift')?.textContent.trim(),
    rekord: document.getElementById('storm-resultat-rekord')?.textContent.trim(),
    nyRekord: !document.getElementById('storm-ny-rekord').hidden,
    tal: [...document.querySelectorAll('#storm-resultat-tal li')].map((l) => l.textContent.trim()),
    galt: [...document.querySelectorAll('#storm-galt li > span')].map((l) => l.textContent.trim()),
    missede: [...document.querySelectorAll('.storm-missede-knap')].map((k) => k.textContent.trim()),
    missedeTitel: document.getElementById('storm-missede-titel')?.textContent.trim(),
  }))
  r.traek = traek
  r.haengt = haengt
  r.set = set
  return r
}
// Aabn en misset gaade som eleven, og tjek den mod det, eleven saa.
async function aabnMisset(S, i, set) {
  const p = S.page
  const knap = p.locator('.storm-missede-knap').nth(i)
  await knap.scrollIntoViewIfNeeded()
  const navn = (await knap.textContent()).trim()
  const knapBoks = await knap.evaluate((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) } })
  S.mobil ? await knap.tap() : await knap.click()
  await p.waitForTimeout(400)
  const l = await p.evaluate(() => {
    const b = document.getElementById('storm-loesning-braet')
    const felter = [...b.querySelectorAll(':scope > .felt')]
    const brikker = felter.map((f) => { const u = f.querySelector('use'); const h = u && (u.getAttribute('href') || u.getAttribute('xlink:href')); return h ? h.slice(-2) : null })
    const r = b.getBoundingClientRect()
    const boksR = document.getElementById('storm-loesning').getBoundingClientRect()
    return {
      aaben: !document.getElementById('storm-loesning').hidden,
      tekst: document.getElementById('storm-loesning-tekst').textContent.trim(),
      oeverst: b.querySelector('.rang-label')?.textContent.trim(),
      filer: [...b.querySelectorAll('.fil-label')].map((e) => e.textContent.trim()).join(''),
      brikker, antalFelter: felter.length, pile: b.querySelectorAll('.mini-pile g, .mini-pile line, .mini-pile path').length,
      braet: { venstre: Math.round(r.left), hoejre: Math.round(r.right), w: Math.round(r.width), top: Math.round(r.top), bund: Math.round(r.bottom) },
      boksBund: Math.round(boksR.bottom), vinduH: innerHeight,
    }
  })
  // Stillingen fra braettet (DOM-raekkefoelge som tegnMiniBraet, vendt naar sort trakker).
  const sort = /^Sort trækker/.test(l.tekst)
  const rows = []
  for (let r = 0; r < 8; r++) {
    let row = ''; let tom = 0
    for (let f = 0; f < 8; f++) {
      const idx = sort ? (7 - r) * 8 + (7 - f) : r * 8 + f
      const b = l.brikker[idx]
      if (!b) { tom++; continue }
      if (tom) { row += tom; tom = 0 }
      row += b[0] === 'w' ? b[1].toUpperCase() : b[1]
    }
    if (tom) row += tom
    rows.push(row)
  }
  const stilling = `${rows.join('/')} ${sort ? 'b' : 'w'}`
  const linje = l.tekst.replace(/^.*Løsningen: /, '').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)
  let lovlig = 0
  try { const c = new Chess(`${stilling} - - 0 1`); for (const san of linje) { c.move(engelsk(san)); lovlig++ } } catch { /* taeller kun de lovlige */ }
  const sluttil = (() => { try { const c = new Chess(`${stilling} - - 0 1`); for (const san of linje) c.move(engelsk(san)); return c.isCheckmate() ? 'mat' : 'ikke mat' } catch { return 'ulovlig' } })()
  return { navn, knapBoks, ...l, brikker: undefined, stilling, saaDenSelv: set.has(stilling), linje, lovlige: lovlig, slut: sluttil }
}

const ud = { skak: SHA, bredder: BREDDER }
for (const bredde of BREDDER) {
  const R = (ud[bredde] = {})
  const S = await nySide(bredde)
  const p = S.page

  // --- Spil foerste gang: startkortet, saa K6 ------------------------------------------------------
  await tryk(S, '#fane-spil'); await p.waitForTimeout(400)
  if (await synlig(S, '#spil-startkort')) { await tryk(S, '#spil-startkort button:has-text("computeren")'); await p.waitForTimeout(400) }
  else { await tryk(S, '#segment-spil-modus [data-value="computer"]'); await p.waitForTimeout(300) }
  const k6 = async () => ({ fold: await synlig(S, '#fold-makker-bord'), foldAaben: await p.evaluate(() => document.getElementById('fold-makker-bord')?.open ?? null), felt: await p.locator('#makker-bord').isVisible(), titel: await tekst(S, '#fold-makker-bord > summary') })
  R.k6 = { computer: await k6() }
  await tryk(S, '#segment-spil-modus [data-value="makker"]'); await p.waitForTimeout(300)
  R.k6.makkerHjemme = await k6()
  R.k6.makkerHjemme.foldY = await boks(S, '#fold-makker-bord')
  if (R.k6.makkerHjemme.fold) {
    await tryk(S, '#fold-makker-bord > summary'); await p.waitForTimeout(250)
    await tryk(S, '#makker-bord'); await p.keyboard.type('7'); await p.waitForTimeout(250)
    R.k6.skrevet = await p.evaluate(() => localStorage.getItem('skak-makker-bord-v1'))
    await genindlaes(S)
    R.k6.efterGenindlaes = { ...(await k6()), vaerdi: await p.locator('#makker-bord').inputValue().catch(() => null) }
    await tryk(S, '#makker-bord'); await p.locator('#makker-bord').fill(''); await p.locator('#makker-bord').dispatchEvent('input'); await p.waitForTimeout(250)
    await genindlaes(S)
    R.k6.slettetOgGenindlaest = await k6()
  }
  await tryk(S, '#segment-spil-modus [data-value="computer"]'); await p.waitForTimeout(300)

  // --- Et parti mod niveau 3 som hvid, 25 traek, saa giv op: K8 og K10 ------------------------------
  await tryk(S, '#segment-spiller-farve [data-value="w"]')
  await tryk(S, '#segment-niveau [data-value="3"]')
  await p.waitForTimeout(300)
  if ((await fen(S)).split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
    await tryk(S, '#knap-spil-forfra'); await p.waitForTimeout(250)
    if (await p.locator('#spil-forfra-modal').isVisible()) await tryk(S, '#knap-spil-forfra-bekraeft')
    await p.waitForTimeout(400)
  }
  const rnd = froe(540 + bredde)
  let n = 0
  while (n < 25) {
    const f = await fen(S)
    if (new Chess(f).isGameOver()) break
    if (f.split(' ')[1] !== 'w') { await p.waitForTimeout(100); continue }
    await spilTraek(S, elevTraek(f, rnd)); n++
    for (let i = 0; i < 200; i++) { const f2 = await fen(S); if (f2.split(' ')[1] === 'w' || new Chess(f2).isGameOver()) break; await p.waitForTimeout(50) }
  }
  if (!new Chess(await fen(S)).isGameOver()) { await tryk(S, '#knap-spil-giv-op'); await p.waitForTimeout(200); await tryk(S, '#knap-spil-giv-op-bekraeft') }
  R.parti = { traek: n, analyse: await venterAnalyse(S) }
  R.parti.navne = await navneITabel(S)
  R.k8 = await tekst(S, '#partital-noejagtighed-forklaring')
  R.k10 = { knap: await synlig(S, '#knap-partital-laer-fejl') }
  if (R.k10.knap) {
    await tryk(S, '#knap-partital-laer-fejl')
    await p.waitForFunction(() => !document.getElementById('laer-fejl-opgave').hidden, null, { timeout: 30000 }).catch(() => {})
    Object.assign(R.k10, await p.evaluate(() => ({
      filer: [...document.querySelectorAll('#laer-fejl-braet .fil-label')].map((e) => e.textContent.trim()).join(''),
      raekker: [...document.querySelectorAll('#laer-fejl-braet .rang-label')].map((e) => e.textContent.trim()).join(''),
      skrift: parseFloat(getComputedStyle(document.querySelector('#laer-fejl-braet .fil-label') ?? document.body).fontSize),
      opgave: document.getElementById('laer-fejl-opgave')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
    })))
    R.k10.braet = await boks(S, '#laer-fejl-braet')
    await p.locator('#laer-fejl').scrollIntoViewIfNeeded(); await p.locator('#laer-fejl').screenshot({ path: path.join(HERE, `K-${bredde}-1-laer-fejl-hvid.png`) })
  }

  // --- K4: navne fra PGN --------------------------------------------------------------------------
  await indlaes(S, LICHESS)
  R.k4 = { lichess: { analyse: await venterAnalyse(S) } }
  Object.assign(R.k4.lichess, { navne: await navneITabel(S), resume: await tekst(S, '#partital-resume'), rul: await rul(S) })
  await p.locator('#partital').scrollIntoViewIfNeeded(); await p.locator('#partital').screenshot({ path: path.join(HERE, `K-${bredde}-2-navne-lichess.png`) })
  await aabnFold(S, 'fold-del')
  if (await synlig(S, '#knap-pgn-vis')) { await tryk(S, '#knap-pgn-vis'); await p.waitForTimeout(250) }
  R.k4.delIgen = /\[White "ven123"\][\s\S]*\[Black "elev2014"\]/.test(await p.locator('#pgn-tekst').inputValue())
  await genindlaes(S)
  await venterAnalyse(S)
  R.k4.efterGenindlaes = await navneITabel(S)
  await indlaes(S, LANG)
  await venterAnalyse(S)
  R.k4.lang = { navne: await navneITabel(S), rul: await rul(S), tabel: await boks(S, '#partital'), resume: await tekst(S, '#partital-resume') }
  if (bredde === 360) { await p.locator('#partital').scrollIntoViewIfNeeded(); await p.locator('#partital').screenshot({ path: path.join(HERE, 'K-360-3-navne-langt.png') }) }
  // Laer af dine fejl med sort (partiet ovenfor: sort blev sat mat) - braettet vendt.
  R.k10.sort = { knap: await synlig(S, '#knap-partital-laer-fejl') }
  if (R.k10.sort.knap) {
    await tryk(S, '#knap-partital-laer-fejl')
    await p.waitForFunction(() => !document.getElementById('laer-fejl-opgave').hidden, null, { timeout: 30000 }).catch(() => {})
    Object.assign(R.k10.sort, await p.evaluate(() => ({
      filer: [...document.querySelectorAll('#laer-fejl-braet .fil-label')].map((e) => e.textContent.trim()).join(''),
      raekker: [...document.querySelectorAll('#laer-fejl-braet .rang-label')].map((e) => e.textContent.trim()).join(''),
    })))
    await tryk(S, '#laer-fejl-braet [data-square="d8"]'); await tryk(S, '#laer-fejl-braet [data-square="e7"]')
    R.k10.sort.bedoemt = await p.waitForFunction(() => /Rigtigt|Godt træk/.test(document.getElementById('laer-fejl-besked')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false)
    R.k10.sort.besked = await tekst(S, '#laer-fejl-besked')
    await p.locator('#laer-fejl').scrollIntoViewIfNeeded(); await p.locator('#laer-fejl').screenshot({ path: path.join(HERE, `K-${bredde}-4-laer-fejl-sort.png`) })
  }
  await indlaes(S, UDEN)
  await venterAnalyse(S)
  R.k4.udenNavne = await navneITabel(S)
  await indlaes(S, LICHESS)
  await venterAnalyse(S)
  // Et nyt makkerparti, der begynder som lichess-partiet (1. e4 e5 2. Sf3): navnene skal ikke foelge med.
  await tryk(S, '#knap-spil-forfra'); await p.waitForTimeout(250)
  if (await p.locator('#spil-forfra-modal').isVisible()) await tryk(S, '#knap-spil-forfra-bekraeft')
  await p.waitForTimeout(300)
  { const c = new Chess(); for (const san of 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#'.split(' ')) { const m = c.move(san); await felt(S, m.from); await felt(S, m.to); await p.waitForTimeout(120) } }
  R.k4.nytMakkerparti = { slut: await tekst(S, '#status'), analyse: await venterAnalyse(S), navne: await navneITabel(S) }

  // --- K7: "Storm" over braettet paa telefonen -----------------------------------------------------
  await genindlaes(S, 'gaader')
  await p.waitForFunction(() => !document.getElementById('gaade-oeverst').hidden, null, { timeout: 20000 }).catch(() => {})
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200)
  R.k7 = { knap: await boks(S, '#knap-storm-genvej'), braet: await boks(S, '#braet'), startKort: await boks(S, '#storm-start-kort'), rul: await rul(S), tekst: await tekst(S, '#knap-storm-genvej'), linje: await p.evaluate(() => { const k = document.getElementById('knap-storm-genvej'); const l = k?.parentElement; return l ? { tekst: l.textContent.replace(/\s+/g, ' ').trim().slice(0, 160), h: Math.round(l.getBoundingClientRect().height) } : null }) }
  if (S.mobil) await p.screenshot({ path: path.join(HERE, `K-${bredde}-5-gaader-storm-knap.png`) })
  if (R.k7.knap) {
    await tryk(S, '#knap-storm-genvej'); await p.waitForTimeout(500)
    R.k7.efterTryk = { startKort: await boks(S, '#storm-start-kort'), fokus: await p.evaluate(() => document.activeElement?.id) }
    if (R.k7.efterTryk.fokus === 'knap-storm-dagens') { await p.keyboard.press('Enter').catch(() => {}); await p.waitForTimeout(0) }
    await genindlaes(S, 'gaader')
  }

  // --- K11: stoppet storm efter 25 s ----------------------------------------------------------------
  const st = await storm(S, { sek: 25, stop: true, seed: 11 + bredde })
  R.k11 = { ...st, set: st.set.size }
  if (S.mobil) { await p.locator('#storm-resultat').scrollIntoViewIfNeeded(); await p.locator('#storm-resultat').screenshot({ path: path.join(HERE, `K-${bredde}-6-storm-stoppet.png`) }) }
  if (R.k11.missede.length) R.k11.foersteMisset = await aabnMisset(S, 0, st.set)

  // --- K9: en hel storm, til uret er ude -------------------------------------------------------------
  if (!KUN) {
    await genindlaes(S, 'gaader')
    const hel = await storm(S, { sek: 330, stop: false, seed: 9 + bredde })
    R.k9 = { ...hel, set: hel.set.size }
    R.k9.liste = await boks(S, '#storm-missede')
    R.k9.tilstand = await p.evaluate(() => ({ resultat: !document.getElementById('storm-resultat').hidden, koerer: !document.getElementById('storm-koerer')?.hidden, knapper: [...document.querySelectorAll('.storm-missede-knap')].map((k) => !!k.offsetParent) }))
    console.log('K9-tilstand', bredde, JSON.stringify({ o: hel.overskrift, m: hel.missede.length, t: R.k9.tilstand, traek: hel.traek }))
    R.k9.resultat = await boks(S, '#storm-resultat')
    R.k9.aabnet = []
    for (const i of [...new Set([0, Math.floor(hel.missede.length / 2), hel.missede.length - 1])].filter((i) => i >= 0 && i < hel.missede.length)) R.k9.aabnet.push(await aabnMisset(S, i, hel.set))
    if (R.k9.aabnet.length) {
      await p.locator('.storm-missede-knap').first().scrollIntoViewIfNeeded()
      S.mobil ? await p.locator('.storm-missede-knap').first().tap() : await p.locator('.storm-missede-knap').first().click()
      await p.waitForTimeout(300)
      await p.locator('#storm-loesning').scrollIntoViewIfNeeded().catch(() => {})
      await p.screenshot({ path: path.join(HERE, `K-${bredde}-7-storm-loesning.png`) })
      S.mobil ? await p.locator('.storm-missede-knap').first().tap() : await p.locator('.storm-missede-knap').first().click()
      await p.waitForTimeout(300)
      R.k9.lukket = await p.evaluate(() => document.getElementById('storm-loesning').hidden)
    }
    R.k9.rul = await rul(S)
  }
  R.rul = await rul(S)
  R.net = S.net; R.fejl = S.fejl
  await S.ctx.close()
}
await browser.close()

// --- tjek ----------------------------------------------------------------------------------------
const tlf = [360, 390].map((w) => ud[w])
const alle = BREDDER.map((w) => ud[w])
paastaa('K4: et lichess-parti viser "ven123" og "elev2014" i tabellen og resumeet, ogsaa efter en genindlaesning', alle.every((R) => R.k4.lichess.navne.join() === 'ven123,elev2014' && /^ven123: /.test(R.k4.lichess.resume) && R.k4.efterGenindlaes.join() === 'ven123,elev2014'), alle.map((R) => [R.k4.lichess.navne, R.k4.efterGenindlaes]))
paastaa('K4: navnene kommer med, naar partiet deles igen', alle.every((R) => R.k4.delIgen))
paastaa('K4: et langt navn klippes til 20 tegn, "?" bliver "Sort", og tabellen holder paa 360', alle.every((R) => R.k4.lang.navne[0].length <= 20 && R.k4.lang.navne[1] === 'Sort' && R.k4.lang.rul === 0), alle.map((R) => [R.k4.lang.navne, R.k4.lang.rul]))
paastaa('K4: et parti uden navne giver "Hvid/Sort", mod computeren "Du/Computeren"', alle.every((R) => R.k4.udenNavne.join() === 'Hvid,Sort' && R.parti.navne.join() === 'Du,Computeren'), alle.map((R) => [R.k4.udenNavne, R.parti.navne]))
paastaa('K4: et nyt makkerparti med samme aabning faar ikke lichess-navnene', alle.every((R) => !R.k4.nytMakkerparti.analyse || R.k4.nytMakkerparti.navne.join() === 'Hvid,Sort'), alle.map((R) => R.k4.nytMakkerparti))
paastaa('K6: mod computeren intet bordfelt; mod en makker hjemme en lukket fold "Klassens turnering"', alle.every((R) => !R.k6.computer.fold && !R.k6.computer.felt && R.k6.makkerHjemme.fold && !R.k6.makkerHjemme.foldAaben && !R.k6.makkerHjemme.felt), alle.map((R) => [R.k6.computer, R.k6.makkerHjemme.titel]))
paastaa('K6: bordet kan skrives, er aabent efter en genindlaesning og lukket igen, naar det er slettet', alle.every((R) => R.k6.skrevet === '7' && R.k6.efterGenindlaes.felt && R.k6.efterGenindlaes.vaerdi === '7' && !R.k6.slettetOgGenindlaest.foldAaben), alle.map((R) => [R.k6.skrevet, R.k6.efterGenindlaes, R.k6.slettetOgGenindlaest]))
paastaa('K7: paa 360 og 390 staar "Storm" (mindst 44 px) over braettet uden at rulle, og et tryk viser startkortet med fokus paa Dagens storm', tlf.every((R) => R.k7.knap && R.k7.knap.h >= 44 && R.k7.knap.bund <= R.k7.knap.vinduH && R.k7.knap.bund <= R.k7.braet.top + 2 && R.k7.startKort.top > R.k7.startKort.vinduH && R.k7.efterTryk.startKort.top >= 0 && R.k7.efterTryk.startKort.top < R.k7.efterTryk.startKort.vinduH && R.k7.efterTryk.fokus === 'knap-storm-dagens' && R.k7.rul === 0), tlf.map((R) => [R.k7.knap, R.k7.braet?.top, R.k7.linje, R.k7.efterTryk]))
paastaa('K7: paa 1280 ingen knap (stormen staar ved siden af)', !ud[1280].k7.knap)
paastaa('K8: forklaringen siger, at tallet ikke kan sammenlignes med lichess', alle.every((R) => /Tallet kan ikke sammenlignes med lichess/.test(R.k8 || '')), ud[390].k8)
paastaa('K10: "Laer af dine fejl" har bogstaver og tal, a-h fra hvid og h-a vendt fra sort, og et tryk-traek bedoemmes', alle.every((R) => R.k10.filer === 'abcdefgh' && R.k10.raekker === '87654321' && R.k10.sort.filer === 'hgfedcba' && R.k10.sort.raekker === '12345678' && R.k10.sort.bedoemt && R.k10.skrift >= 12), alle.map((R) => [R.k10.filer, R.k10.raekker, R.k10.sort.filer, R.k10.sort.bedoemt, R.k10.skrift]))
paastaa('K11: en stoppet storm siger "En stoppet storm taeller ikke som rekord" og ikke "Ingen rekord endnu"', alle.every((R) => /^Stormen er stoppet/.test(R.k11.overskrift) && /^En stoppet storm tæller ikke som rekord\. Lad uret løbe ud næste gang\./.test(R.k11.rekord) && !/Ingen rekord endnu/.test(R.k11.rekord)), alle.map((R) => [R.k11.overskrift, R.k11.rekord]))
if (!KUN) {
  const galtSum = (R) => R.galt.reduce((a, t) => a + Number(t.match(/: (\d+) af/)?.[1] ?? 0), 0)
  const fejlTal = (R) => Number(R.tal[0]?.match(/^(\d+)/)?.[1] ?? -1)
  paastaa('K9: en hel storm slutter med "Tiden er gaaet", og antallet af missede gaader = forkerte traek = summen i "gik galt"', alle.every((R) => /^Tiden er gået/.test(R.k9.overskrift) && R.k9.missede.length === fejlTal(R.k9) && galtSum(R.k9) === fejlTal(R.k9)), alle.map((R) => [R.k9.overskrift, R.k9.missede.length, fejlTal(R.k9), galtSum(R.k9)]))
  const aabnede = alle.flatMap((R) => [...R.k9.aabnet, ...(R.k11.foersteMisset ? [R.k11.foersteMisset] : [])])
  paastaa('K9: hver aabnet loesning staar paa en stilling, eleven selv fik, og hele linjen er lovlig', aabnede.length >= 6 && aabnede.every((a) => a.aaben && a.saaDenSelv && a.lovlige === a.linje.length && a.linje.length > 0), aabnede.map((a) => [a.tekst, a.saaDenSelv, a.lovlige, a.linje.length, a.slut]))
  paastaa('K9: braettet er vendt mod den, der trak, har koordinater og een pil og staar inden for skaermen; knappen er mindst 44 px', BREDDER.every((w) => ud[w].k9.aabnet.every((a) => a.antalFelter === 64 && a.oeverst === (/^Sort/.test(a.tekst) ? '1' : '8') && a.filer.length === 8 && a.pile >= 1 && a.braet.venstre >= 0 && a.braet.hoejre <= w && a.knapBoks.h >= 44)), BREDDER.map((w) => ud[w].k9.aabnet.map((a) => [a.oeverst, a.braet.w, a.knapBoks.h])))
  paastaa('K9: en aabnet mat-gaade ender i mat (Mat i 2, Mat i 1, Mat med ...)', aabnede.filter((a) => /: Mat /.test(a.navn)).every((a) => a.slut === 'mat') && aabnede.some((a) => /: Mat /.test(a.navn)), aabnede.map((a) => [a.navn, a.slut]))
  paastaa('K9: et tryk mere lukker loesningen', alle.every((R) => !R.k9.aabnet.length || R.k9.lukket))
}
paastaa('Intet net, ingen JS-fejl, ingen vandret rulning', alle.every((R) => R.net.length === 0 && R.fejl.length === 0 && R.rul === 0), alle.map((R) => [R.net.length, R.fejl.slice(0, 2), R.rul]))
ud.net = alle.reduce((a, R) => a + R.net.length, 0)
ud.jsFejl = alle.reduce((a, R) => a + R.fejl.length, 0)
ud.sha = SHA
ud.tjek = tjek
writeFileSync(path.join(HERE, 'skak-540.json'), JSON.stringify(ud, (k, v) => (v instanceof Set ? [...v] : v), 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length} tjek groenne (skak ${SHA})`)
if (tjek.some((t) => !t.ok)) process.exitCode = 1
