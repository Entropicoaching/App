// KRITIK 530 blok 2: skakken efter Chaturangas 523 (K1-K10 og koordinattraeningen) som en elev
// paa 12 aar paa telefonen.
//   node outputs/kritik-530/skak-530.mjs
// skak.html fra C:\Users\Entropi\Desktop\skak @ main (e460aa7, 523 merget), aabnet som file://,
// headless Chromium uden net: 360 og 390 px med touch (tap), 1280 med mus som kontrol.
// Eleven er et script (samme som 517): mat i 1, ellers stoerste slag, ellers skak, ellers
// tilfaeldigt. I koordinattraeningen trykker eleven rigtigt i 8 af 10 og ellers et nabofelt
// (en typisk forveksling), med ca. 0,9 s mellem trykkene, i en rigtig runde paa 30 s.
// Intet i skak roeres. Skriver outputs/kritik-530/skak-530.json og K-*.png.
import path from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short HEAD`).toString().trim()
const { Chess } = await import(pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href)
const URL_ = pathToFileURL(`${SKAK}/skak.html`).href
const BREDDER = [360, 390, 1280]

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 360) : ''}`) }

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
async function nyKontekst(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? (bredde === 360 ? 780 : 844) : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1, acceptDownloads: true })
  return { ctx, mobil, bredde, net: [], fejl: [] }
}
async function aabn(K) {
  const page = await K.ctx.newPage()
  page.on('pageerror', (e) => K.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); K.net.push(u); return r.abort() })
  await page.goto(URL_)
  await page.waitForSelector('#braet .felt')
  await page.waitForTimeout(600)
  K.page = page
  return page
}
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const felt = (S, f) => tryk(S, `#braet [data-square="${f}"]`)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
const status = (S) => S.page.locator('#status').textContent().then((t) => t.trim())
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e && !e.hidden && e.offsetParent ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const yAf = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bund: Math.round(r.bottom + scrollY), h: Math.round(r.height), w: Math.round(r.width) } }, sel)
const rul = (S) => S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function spilTraek(S, m) {
  await felt(S, m.from); await felt(S, m.to)
  if (m.promotion) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').first().click() }
}
async function forfra(S) {
  await tryk(S, '#knap-spil-forfra'); await S.page.waitForTimeout(250)
  if (await S.page.locator('#spil-forfra-modal').isVisible()) await tryk(S, '#knap-spil-forfra-bekraeft')
  await S.page.waitForTimeout(400)
}
const venterPaaHvid = async (S) => { for (let i = 0; i < 200 && (await fen(S)).split(' ')[1] !== 'w'; i++) await S.page.waitForTimeout(50) }
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) await tryk(S, `#${id} > summary`)
  await S.page.waitForTimeout(250)
}
async function indlaes(S, tekst, { svar = 'ja' } = {}) {
  await aabnFold(S, 'fold-del')
  await S.page.locator('#pgn-tekst').fill(tekst)
  await tryk(S, '#knap-pgn-indlaes'); await S.page.waitForTimeout(400)
  const spurgt = await S.page.locator('#pgn-indlaes-modal').isVisible()
  const spoergsmaal = spurgt ? (await S.page.locator('#pgn-indlaes-modal').textContent()).replace(/\s+/g, ' ').trim() : null
  if (spurgt) await tryk(S, svar === 'ja' ? '#knap-pgn-indlaes-bekraeft' : '#knap-pgn-indlaes-annuller')
  await S.page.waitForTimeout(800)
  return { spurgt, spoergsmaal, besked: await synlig(S, '#del-besked'), fen: await fen(S), status: await status(S) }
}
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
const ud = { skak: SHA, bredder: BREDDER }

for (const bredde of BREDDER) {
  const R = (ud[bredde] = {})
  const S = await nyKontekst(bredde)
  const p = await aabn(S)

  // --- K1: foerste gang i Spil ------------------------------------------------------------------
  await tryk(S, '#fane-spil'); await p.waitForTimeout(400)
  R.k1 = await p.evaluate(() => {
    const k = document.getElementById('spil-startkort')
    const r = k && !k.hidden && k.offsetParent ? k.getBoundingClientRect() : null
    const br = document.getElementById('braet').getBoundingClientRect()
    return { kort: r ? { top: Math.round(r.top), bund: Math.round(r.bottom), tekst: k.textContent.replace(/\s+/g, ' ').trim(), knapper: [...k.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) })) } : null, braetTop: Math.round(br.top), vindueH: innerHeight, valgtModus: document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.textContent.trim() }
  })
  await p.screenshot({ path: path.join(HERE, `K-${bredde}-1-spil-foerste-gang.png`) })
  if (R.k1.kort) {
    await tryk(S, '#spil-startkort button:has-text("computeren")'); await p.waitForTimeout(500)
  } else {
    await tryk(S, '#segment-spil-modus [data-value="computer"]'); await p.waitForTimeout(300)
  }
  R.k1.efterValg = { modus: await p.evaluate(() => document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.textContent.trim()), kortVaek: await p.evaluate(() => { const k = document.getElementById('spil-startkort'); return !k || k.hidden || !k.offsetParent }), status: await status(S) }
  // K6: klassens bord hjemme?
  const bordSynligt = () => p.evaluate(() => { const e = document.getElementById('makker-bord'); const l = e && e.closest('label, div, p'); return e && e.offsetParent ? (l ? l.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : 'feltet') : null })
  R.k6 = { modComputeren: await bordSynligt() }
  await tryk(S, '#segment-spil-modus [data-value="makker"]'); await p.waitForTimeout(300)
  R.k6.modMakker = await bordSynligt()
  await tryk(S, '#segment-spil-modus [data-value="computer"]'); await p.waitForTimeout(300)

  // --- Et parti mod computeren (niveau 3, hvid), op til 25 af elevens traek, ellers giv op --------
  await tryk(S, '#segment-spiller-farve [data-value="w"]')
  await tryk(S, '#segment-niveau [data-value="3"]')
  await p.waitForTimeout(300)
  if ((await fen(S)).split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') await forfra(S)
  const rnd = froe(530 + bredde)
  let n = 0, slut = null
  while (n < 25) {
    const f = await fen(S)
    if (new Chess(f).isGameOver()) { slut = 'braettet'; break }
    if (f.split(' ')[1] !== 'w') { await p.waitForTimeout(100); continue }
    await spilTraek(S, elevTraek(f, rnd)); n++
    for (let i = 0; i < 200; i++) { const f2 = await fen(S); if (f2.split(' ')[1] === 'w' || new Chess(f2).isGameOver()) break; await p.waitForTimeout(50) }
  }
  if (!slut) { await tryk(S, '#knap-spil-giv-op'); await p.waitForTimeout(200); await tryk(S, '#knap-spil-giv-op-bekraeft'); slut = 'gav op' }
  R.parti = { traek: n, slut, status: await status(S) }
  try { await p.waitForFunction(() => !document.getElementById('partital-indhold').hidden, null, { timeout: 90000 }) } catch { /* maales nedenfor */ }
  // K8: noejagtigheden og forklaringen.
  R.k8 = await p.evaluate(() => ({ tal: [...document.querySelectorAll('#partital-tal > *')].map((e) => e.textContent.trim()), forklaring: document.getElementById('partital-noejagtighed-forklaring')?.textContent.replace(/\s+/g, ' ').trim() || null }))
  // K10: Laer af dine fejl, har oevebraettet koordinater?
  R.k10 = { knap: await p.locator('#knap-laer-fejl-start').isVisible() }
  if (R.k10.knap) {
    await tryk(S, '#knap-laer-fejl-start'); await p.waitForTimeout(1500)
    R.k10 = { ...R.k10, ...(await p.evaluate(() => {
      const b = document.getElementById('laer-fejl-braet')
      const hoved = document.getElementById('braet')
      const koord = (el) => el ? [...el.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^[a-h1-8]$/.test(e.textContent.trim()) && e.offsetParent).length : 0
      return { koordOevebraet: koord(b), koordHovedbraet: koord(hoved), tekst: document.getElementById('laer-fejl')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) }
    })) }
    await p.locator('#laer-fejl').scrollIntoViewIfNeeded(); await p.locator('#laer-fejl').screenshot({ path: path.join(HERE, `K-${bredde}-2-laer-fejl.png`) })
  }

  // --- K1: husker Spil computeren efter en genindlaesning? -------------------------------------
  await p.reload(); await p.waitForSelector('#braet .felt'); await p.waitForTimeout(600)
  await tryk(S, '#fane-spil'); await p.waitForTimeout(400)
  R.k1.efterGenindlaes = await p.evaluate(() => ({ modus: document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.textContent.trim(), niveau: document.querySelector('#segment-niveau [aria-pressed="true"]')?.textContent.trim() || null, kort: (() => { const k = document.getElementById('spil-startkort'); return k && !k.hidden && k.offsetParent ? k.textContent.replace(/\s+/g, ' ').trim() : null })() }))

  // --- K2: et parti i gang, saa "Indlaes parti" ---------------------------------------------------
  await tryk(S, '#segment-spil-modus [data-value="computer"]')
  await tryk(S, '#segment-niveau [data-value="2"]')
  await forfra(S)
  for (const [a, b] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4']]) { await venterPaaHvid(S); await felt(S, a); await felt(S, b) }
  await venterPaaHvid(S)
  const iGang = await fen(S)
  R.k2 = { annuller: await indlaes(S, '1. d4 d5 2. c4 e6 *', { svar: 'annuller' }) }
  R.k2.annuller.partietBlev = R.k2.annuller.fen === iGang
  R.k2.ja = await indlaes(S, '1. d4 d5 2. c4 e6 *', { svar: 'ja' })
  R.k2.ja.erstattet = R.k2.ja.fen !== iGang

  // --- K3 og K4: remis, "*" og et lichess-parti fra PGN --------------------------------------------
  const venterAnalyse = async () => { try { await p.waitForFunction(() => !document.getElementById('partital-indhold').hidden && !document.getElementById('partital').hidden, null, { timeout: 30000 }); return true } catch { return false } }
  R.k3 = {}
  R.k3.remis = await indlaes(S, '[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2')
  R.k3.remis.analyse = await venterAnalyse()
  R.k3.stjerne = await indlaes(S, '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 *')
  R.k3.stjerne.analyse = await venterAnalyse()
  R.k3.tom = await indlaes(S, '[Event "tom"]\n\n*')
  R.k4 = await indlaes(S, LICHESS)
  R.k4.analyse = await venterAnalyse()
  R.k4.navne = await p.evaluate(() => ({ tabel: [...document.querySelectorAll('#partital-tal > *')].slice(0, 3).map((e) => e.textContent.trim()), side: /ven123|elev2014/.test(document.body.innerText) }))
  if (bredde === 390) { await p.locator('#partital').scrollIntoViewIfNeeded(); await p.locator('#partital').screenshot({ path: path.join(HERE, 'K-390-3-lichess-analyse.png') }) }

  // --- Koordinattraeningen ----------------------------------------------------------------------
  await tryk(S, '#fane-spil'); await p.waitForTimeout(300)
  const fenFoerKoord = await fen(S)
  R.koord = { foldY: await yAf(S, '#fold-koordinater > summary'), vindueH: await p.evaluate(() => innerHeight), foldTitel: await p.locator('#fold-koordinater > summary').textContent().then((t) => t.replace(/\s+/g, ' ').trim()) }
  await aabnFold(S, 'fold-koordinater')
  R.koord.hjaelp = await p.evaluate(() => document.getElementById('fold-koordinater').textContent.replace(/\s+/g, ' ').trim().slice(0, 400))
  R.koord.sider = []
  for (const side of ['w', 'b']) {
    let lay0 = null
    await tryk(S, `#segment-koordinat-side [data-value="${side}"]`)
    // Eleven ruller ned til Start (under braettet) og trykker; saa staar Start nederst paa skaermen.
    await p.evaluate(() => { const r = document.getElementById('knap-koordinat-start').getBoundingClientRect(); window.scrollBy(0, r.bottom - innerHeight + 12) })
    if (S.mobil) await p.touchscreen.tap(...(await p.evaluate(() => { const r = document.getElementById('knap-koordinat-start').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }))); else await p.evaluate(() => document.getElementById('knap-koordinat-start').click())
    await p.waitForTimeout(300)
    lay0 = await p.evaluate(() => { const f = document.getElementById('koordinat-felt').getBoundingClientRect(), b = document.getElementById('koordinat-braet').getBoundingClientRect(); return { feltTopSkaerm: Math.round(f.top), braetBundSkaerm: Math.round(b.bottom), vindueH: innerHeight } })
    // Kan eleven se feltets navn og hele braettet paa een skaerm?
    const lay = await p.evaluate(() => {
      const pg = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, height: r.height, width: r.width } }
      const f = pg('koordinat-felt'), b = pg('koordinat-braet'), t = pg('koordinat-tid'), st = pg('knap-koordinat-start')
      const felt1 = document.querySelector('#koordinat-braet .felt').getBoundingClientRect()
      return { feltTop: Math.round(f.top), feltH: Math.round(f.height), feltFont: parseFloat(getComputedStyle(document.getElementById('koordinat-felt')).fontSize), braetTop: Math.round(b.top), braetBund: Math.round(b.bottom), braetW: Math.round(b.width), tidTop: Math.round(t.top), startBund: Math.round(st.bottom), feltPx: Math.round(felt1.width), vindueH: innerHeight, hjoerne: document.querySelector('#koordinat-braet .felt').dataset.square, koordTegn: [...document.querySelectorAll('#koordinat-braet *')].filter((e) => e.children.length === 0 && /^[a-h1-8]$/.test(e.textContent.trim())).length }
    })
    // Sidekoordinater (uafhaengige af rul): kan feltets navn, braettet og Start staa paa een skaerm?
    lay.spaendPx = lay.startBund - lay.feltTop
    lay.enSkaerm = lay.spaendPx <= lay.vindueH
    lay.efterStartTryk = lay0
    const krnd = froe(77 + bredde + side.charCodeAt(0))
    const t0 = Date.now()
    let rigtige = 0, forkerte = 0, gentaget = 0, sidste = null, felterSet = []
    while (Date.now() - t0 < 31500) {
      const maal = await p.evaluate(() => { const e = document.getElementById('koordinat-felt'); return e.hidden ? null : e.textContent.trim() })
      if (!maal) break
      if (maal === sidste && felterSet.length && felterSet[felterSet.length - 1].rigtig) gentaget++
      let tryk_ = maal
      const rigtig = krnd() < 0.8
      if (!rigtig) { const f = maal.charCodeAt(0), r = +maal[1]; tryk_ = krnd() < 0.5 ? String.fromCharCode(f === 104 ? f - 1 : f + 1) + r : String.fromCharCode(f) + (r === 8 ? 7 : r + 1) }
      if (S.mobil) { const c = await p.evaluate((sq) => { const r = document.querySelector(`#koordinat-braet [data-square="${sq}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, tryk_); await p.touchscreen.tap(c[0], c[1]) } else await tryk(S, `#koordinat-braet [data-square="${tryk_}"]`)
      felterSet.push({ maal, tryk: tryk_, rigtig })
      if (rigtig) rigtige++; else forkerte++
      sidste = maal
      if (felterSet.length === 4 && bredde !== 1280) await p.screenshot({ path: path.join(HERE, `K-${bredde}-4-koordinater-${side}.png`) })
      await p.waitForTimeout(900)
    }
    await p.waitForTimeout(1200)
    const slutR = await p.evaluate(() => ({ besked: document.getElementById('koordinat-besked').textContent.trim(), fundet: document.getElementById('koordinat-fundet').textContent.trim(), rekord: document.getElementById('koordinat-rekord').textContent.trim(), feltSkjult: document.getElementById('koordinat-felt').hidden, knap: document.getElementById('knap-koordinat-start').textContent.trim() }))
    R.koord.sider.push({ side, lay, rigtige, forkerte, gentagetEfterRigtig: gentaget, tryk: felterSet.length, ...slutR })
  }
  if (bredde !== 1280) { await p.locator('#fold-koordinater').scrollIntoViewIfNeeded(); await p.locator('#fold-koordinater').screenshot({ path: path.join(HERE, `K-${bredde}-5-koordinater-slut.png`) }) }
  R.koord.partietUroert = (await fen(S)) === fenFoerKoord
  await p.reload(); await p.waitForSelector('#braet .felt'); await p.waitForTimeout(500)
  await tryk(S, '#fane-spil'); await p.waitForTimeout(300)
  R.koord.rekordEfterGenindlaes = await p.evaluate(() => document.getElementById('koordinat-rekord').textContent.trim())
  // Lukkes folden midt i en runde, stopper runden.
  await aabnFold(S, 'fold-koordinater')
  await tryk(S, '#knap-koordinat-start'); await p.waitForTimeout(400)
  await tryk(S, '#fold-koordinater > summary'); await p.waitForTimeout(400)
  await aabnFold(S, 'fold-koordinater')
  R.koord.lukketMidtI = await p.evaluate(() => ({ feltSkjult: document.getElementById('koordinat-felt').hidden, tid: document.getElementById('koordinat-tid').textContent.trim() }))

  // --- K7 og K9: stormen --------------------------------------------------------------------------
  await tryk(S, '#fane-gaader'); await p.waitForTimeout(400)
  await p.waitForFunction(() => !document.getElementById('knap-storm-start').disabled, null, { timeout: 20000 })
  R.k7 = { startKort: await yAf(S, '#storm-start-kort'), vindueH: await p.evaluate(() => innerHeight) }
  await tryk(S, '#knap-storm-start'); await p.waitForTimeout(800)
  const srnd = froe(9 + bredde)
  const tS = Date.now()
  let sf = ''
  while (Date.now() - tS < 25000) {
    const f = await fen(S)
    if (f === sf) { await p.waitForTimeout(120); continue }
    if (!(await synlig(S, '#storm-tur-tekst'))) break
    const m = elevTraek(f, srnd); if (!m) break
    sf = f; await spilTraek(S, m); await p.waitForTimeout(700)
  }
  if (await p.locator('#knap-storm-stop').isVisible()) await tryk(S, '#knap-storm-stop')
  await p.waitForTimeout(800)
  R.k9 = await p.evaluate(() => {
    const r = document.getElementById('storm-resultat')
    if (!r || r.hidden) return null
    return { tekst: r.textContent.replace(/\s+/g, ' ').trim().slice(0, 500), knapper: [...r.querySelectorAll('button, a')].map((b) => b.textContent.trim()).slice(0, 12), smaaBraet: r.querySelectorAll('[data-square], canvas, svg').length }
  })
  if (bredde !== 1280 && R.k9) { await p.locator('#storm-resultat').scrollIntoViewIfNeeded(); await p.locator('#storm-resultat').screenshot({ path: path.join(HERE, `K-${bredde}-6-storm-slut.png`) }) }

  R.rul = await rul(S)
  R.net = S.net; R.fejl = S.fejl
  await S.ctx.close()
}
await browser.close()

// --- tjek ----------------------------------------------------------------------------------------
const tlf = [360, 390].map((w) => ud[w])
const d = ud[1280]
const html = readFileSync(`${SKAK}/skak.html`, 'utf8')
paastaa('K1 lukket: paa telefonen staar "Hvem vil du spille mod?" over braettet ved foerste besoeg, synligt uden at rulle', tlf.every((R) => R.k1.kort && /Hvem vil du spille mod/.test(R.k1.kort.tekst) && R.k1.kort.bund <= R.k1.braetTop + 2 && R.k1.kort.bund <= R.k1.vindueH), tlf.map((R) => R.k1.kort && [R.k1.kort.top, R.k1.kort.bund, R.k1.braetTop, R.k1.kort.knapper]))
paastaa('K1: et tryk paa "Mod computeren" vaelger computeren, og kortet gaar vaek; paa 1280 er der intet kort', tlf.every((R) => R.k1.efterValg.modus === 'Mod computeren' && R.k1.efterValg.kortVaek) && !d.k1.kort, tlf.map((R) => R.k1.efterValg))
paastaa('K1: efter en genindlaesning staar Spil stadig paa computeren (sidste niveau)', ud[390].k1.efterGenindlaes.modus === 'Mod computeren' && ud[360].k1.efterGenindlaes.modus === 'Mod computeren', [ud[360].k1.efterGenindlaes, ud[390].k1.efterGenindlaes])
paastaa('K2 lukket: "Indlaes parti" spoerger, naar et parti er i gang; Annuller lader partiet vaere, Ja indlaeser', BREDDER.every((w) => ud[w].k2.annuller.spurgt && ud[w].k2.annuller.partietBlev && ud[w].k2.ja.erstattet), ud[390].k2.annuller.spoergsmaal)
paastaa('K3 lukket: remis og "*" fra PGN analyseres; et parti uden traek siger hvorfor ikke', BREDDER.every((w) => ud[w].k3.remis.analyse && ud[w].k3.stjerne.analyse) && /ingen træk|intet at analysere/i.test(JSON.stringify(ud[390].k3.tom)), [ud[390].k3.remis.status, ud[390].k3.stjerne.status, ud[390].k3.tom.besked || ud[390].k3.tom.status])
paastaa('K4 aaben: spillernes navne fra PGN vises ikke (ven123/elev2014)', BREDDER.every((w) => !ud[w].k4.navne.side), ud[390].k4.navne)
paastaa('K5 lukket: "Spid" staar ingen steder, eleven kan se det (kun den interne noegle "spid")', !/Spid(?!s)[^a-zæøå]/.test(html.replace(/bedsteErSpid/g, '')) && !/Spiddet/.test(html) && />Spyd</.test(html))
paastaa('K6 delvis: bordfeltet staar kun i "Mod en makker"; den, der vaelger computeren (K1), ser det ikke', tlf.every((R) => !R.k6.modComputeren && R.k6.modMakker), ud[390].k6)
paastaa('K7 aaben: paa telefonen staar stormens startkort under skaermens kant', tlf.every((R) => R.k7.startKort.top > R.k7.vindueH), tlf.map((R) => [R.k7.startKort.top, R.k7.vindueH]))
paastaa('K8 aaben: forklaringen siger ikke, at noejagtigheden ikke kan sammenlignes med lichess', BREDDER.every((w) => !/lichess/i.test(ud[w].k8.forklaring || '')), ud[390].k8.forklaring)
paastaa('K9 aaben: stormens slutkort viser ikke de missede gaader', BREDDER.every((w) => !ud[w].k9 || ud[w].k9.smaaBraet === 0), ud[390].k9 && ud[390].k9.knapper)
paastaa('K10 aaben: "Laer af dine fejl"-braettet har ingen koordinater (hovedbraettet har)', BREDDER.filter((w) => ud[w].k10.knap).every((w) => ud[w].k10.koordOevebraet === 0 && ud[w].k10.koordHovedbraet > 0), BREDDER.map((w) => [ud[w].k10.knap, ud[w].k10.koordOevebraet, ud[w].k10.koordHovedbraet]))
const ks = tlf.flatMap((R) => R.koord.sider)
paastaa('Koordinater: en rigtig runde paa 30 s fra begge sider paa 360 og 390; hvert rigtigt tryk taeller, forkerte taelles, slutbesked og rekord', ks.every((s) => s.feltSkjult && new RegExp(`Fundet: ${s.rigtige}`).test(s.fundet) && /Tiden er gået/.test(s.besked) && new RegExp(`${s.forkerte} forkert`).test(s.besked)), ks.map((s) => [s.side, s.rigtige, s.forkerte, s.besked]))
paastaa('Koordinater: aldrig samme felt to gange i traek efter et rigtigt tryk', ks.every((s) => s.gentagetEfterRigtig === 0))
paastaa('Koordinater: braettet har ingen bogstaver og tal, og fra sort staar h1 oeverst til venstre', ks.every((s) => s.lay.koordTegn === 0) && ks.filter((s) => s.side === 'b').every((s) => s.lay.hjoerne === 'h1') && ks.filter((s) => s.side === 'w').every((s) => s.lay.hjoerne === 'a8'))
paastaa('Koordinater: rekorden staar efter en genindlaesning, og partiet i Spil er uroert', tlf.every((R) => R.koord.partietUroert && /Rekord: [1-9]\d* som hvid, [1-9]\d* som sort/.test(R.koord.rekordEfterGenindlaes)), tlf.map((R) => R.koord.rekordEfterGenindlaes))
paastaa('Koordinater: lukkes folden midt i en runde, stopper den', tlf.every((R) => R.koord.lukketMidtI.feltSkjult))
paastaa('Koordinater paa telefonen: feltets navn, braettet og Start fylder under een skaerm, og efter tryk paa Start staar navnet og hele braettet paa skaermen', ks.every((s) => s.lay.enSkaerm && s.lay.efterStartTryk.feltTopSkaerm >= 0 && s.lay.efterStartTryk.braetBundSkaerm <= s.lay.efterStartTryk.vindueH) && ks.every((s) => s.lay.feltPx >= 38 && s.lay.feltFont >= 30), ks.map((s) => ({ side: s.side, spaend: s.lay.spaendPx, felt: s.lay.feltPx, efterStart: s.lay.efterStartTryk })))
paastaa('Intet net, ingen JS-fejl, ingen vandret rulning', BREDDER.every((w) => ud[w].net.length === 0 && ud[w].fejl.length === 0 && ud[w].rul === 0), BREDDER.map((w) => [ud[w].fejl.slice(0, 2), ud[w].rul]))
ud.tjek = tjek
writeFileSync(path.join(HERE, 'skak-530.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length} tjek groenne (skak ${SHA})`)
if (tjek.some((t) => !t.ok)) process.exitCode = 1
