// KRITIK 552 blok 1: skakken efter Chaturangas 544 som en elev paa 12 aar.
//   node outputs/kritik-552/skak-552.mjs
// skak.html og data/gaader-lichess.json fra C:\Users\Entropi\Desktop\skak @ main hentes med
// `git archive` (traeet staar paa en anden gren og roeres ikke) og aabnes som file://, headless
// Chromium uden net: 360 og 390 px med touch (tap), 1280 med mus som kontrol.
// Eleven (samme som 517-540): mat i 1, ellers stoerste slag, ellers skak, ellers tilfaeldigt.
//  - "Oev et tema": alle 13 knapper, forklaringen, licenslinjen; hvert af de 12 temaer vaelges,
//    gaaden paa braettet slaas op i lichess-filen (tema og rating), eleven proever foerst sit eget
//    traek og loeser den saa; "1 loest" ved knappen.
//  - "Kendte partier": HVERT parti aabnes; stillingen skal vaere partiets, eleven proever foerst sit
//    eget traek (og i kongejagten O-O-O# til sidst), saa loesningen; historien, fluebenet og
//    "Naeste kendte parti".
// Skriver outputs/kritik-552/skak-552.json og K-*.png.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k552-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main skak.html data src/kendtepartier.js src/lichesstemaer.js src/gaadebank-stor.js`)
execSync('tar -xf s.tar', { cwd: dir })
const CHESS = pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href
const { Chess } = await import(CHESS)
const kildeFil = path.join(dir, 'src', 'kendtepartier.js')
writeFileSync(kildeFil, readFileSync(kildeFil, 'utf8').replace("from 'chess.js'", `from '${CHESS}'`))
const { KENDTE_PARTIER, kendtPartiOpgave } = await import(pathToFileURL(kildeFil).href)
const { LICHESS_TEMAER } = await import(pathToFileURL(path.join(dir, 'src', 'lichesstemaer.js')).href)
const LICHESS = JSON.parse(readFileSync(path.join(dir, 'data', 'gaader-lichess.json'), 'utf8'))
// Alle banker, som appen laegger dem sammen (src/gaader.js): lichess-temaerne (544), den gamle
// lichess-bank (261, gzip), egne (278), lette (425) og slutspil (485).
const { GAADEBANK_STOR_GZIP_BASE64: B64 } = await import(pathToFileURL(path.join(dir, 'src', 'gaadebank-stor.js')).href)
const { gunzipSync } = await import('node:zlib')
const STOR = gunzipSync(Buffer.from(B64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => { const [id, fen, moves, rating, tema] = l.split('\t'); return { id, fen, solutionUci: moves.split(','), rating: Number(rating), tema, kilde: 'gammel lichess-bank (261)' } })
const egne = (f, kilde) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8')).map((g) => ({ ...g, rating: g.svaerhed, kilde }))
const ALLE = [...LICHESS.map((g) => ({ ...g, kilde: 'lichess-temaer (544)' })), ...STOR, ...egne('gaader.json', 'egne (278)'), ...egne('gaader-lette.json', 'lette (425)'), ...egne('gaader-slutspil.json', 'slutspil (485)')]
const URL_ = pathToFileURL(path.join(dir, 'skak.html')).href
const BREDDER = process.env.KUN_BREDDE ? [Number(process.env.KUN_BREDDE)] : [360, 390, 1280]

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }

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
const placering = (fen) => fen.split(' ')[0]

const browser = await chromium.launch({ headless: true })
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent) }, sel)
const rul = (S) => S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const iSyne = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), vinduH: innerHeight, helt: r.top >= 0 && r.bottom <= innerHeight, delvist: r.top < innerHeight && r.bottom > 0 } }, sel)
async function braetPlacering(S) {
  const felter = await S.page.$$eval('#braet .felt', (els) => Object.fromEntries(els.map((el) => {
    const href = el.querySelector('.brik-svg use')?.getAttribute('href') ?? ''
    const m = href.match(/-([wb])([pnbrqk])$/i)
    return [el.dataset.square, m ? (m[1] === 'w' ? m[2].toUpperCase() : m[2].toLowerCase()) : null]
  })))
  const raekker = []
  for (let r = 8; r >= 1; r--) {
    let linje = ''; let tomme = 0
    for (const f of 'abcdefgh') { const b = felter[`${f}${r}`]; if (!b) { tomme++; continue } if (tomme) { linje += tomme; tomme = 0 } linje += b }
    if (tomme) linje += tomme
    raekker.push(linje)
  }
  return raekker.join('/')
}
async function uciTraek(S, uci) {
  await tryk(S, `#braet .felt[data-square="${uci.slice(0, 2)}"]`)
  await tryk(S, `#braet .felt[data-square="${uci.slice(2, 4)}"]`)
  if (uci.length > 4) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).evaluate((b) => b.click()) }
}
const uciAf = (m) => m.from + m.to + (m.promotion ?? '')
// Eleven proever sit eget traek (hvis det ikke er loesningen), laeser beskeden, tager det tilbage.
async function proevForkert(S, fen, rigtigt, rnd) {
  const c = new Chess(fen)
  let m = elevTraek(fen, rnd)
  for (let i = 0; i < 20 && m && uciAf(m) === rigtigt; i++) m = elevTraek(fen, rnd)
  if (!m || uciAf(m) === rigtigt) { const alle = c.moves({ verbose: true }).filter((x) => uciAf(x) !== rigtigt); m = alle[0] }
  if (!m) return null
  await uciTraek(S, uciAf(m))
  await S.page.waitForTimeout(500)
  const besked = await tekst(S, '#status')
  let tilbage = false
  for (const sel of ['#knap-gaade-fortryd', '#knap-opgave-fortryd']) if (await synlig(S, sel)) { await tryk(S, sel); tilbage = true; break }
  await S.page.waitForTimeout(400)
  return { san: m.san, besked, tilbage, efter: await tekst(S, '#status') }
}
async function loes(S, solutionUci) {
  for (let i = 0; i < solutionUci.length; i += 2) {
    await uciTraek(S, solutionUci[i])
    if (i + 1 < solutionUci.length) {
      // vent paa modstanderens svar
      const foer = await braetPlacering(S)
      for (let k = 0; k < 40; k++) { await S.page.waitForTimeout(100); if (/Din tur/.test(await tekst(S, '#status')) && (await braetPlacering(S)) !== foer) break }
      await S.page.waitForTimeout(150)
    }
  }
  await S.page.waitForTimeout(600)
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
  await page.waitForTimeout(500)
  S.page = page
  await tryk(S, '#fane-gaader'); await page.waitForTimeout(300)
  await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 20000 })
  return S
}
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) { await S.page.locator(`#${id} > summary`).scrollIntoViewIfNeeded(); await tryk(S, `#${id} > summary`) }
  await S.page.waitForTimeout(250)
}

const ud = { skak: SHA, bredder: BREDDER }
for (const bredde of BREDDER) {
  const R = (ud[bredde] = { temaer: [], partier: [] })
  const S = await nySide(bredde)
  const p = S.page
  const rnd = froe(552 + bredde)

  // --- licens og "Oev et tema" -----------------------------------------------------------------
  R.kilde = await tekst(S, '#gaade-kilde')
  R.kildeSynlig = await synlig(S, '#gaade-kilde')
  R.licensTekst = await p.evaluate(() => /lichess/i.test(document.getElementById('licens-tekst')?.textContent ?? ''))
  await aabnFold(S, 'fold-gaade-temaer')
  R.knapper = await p.$$eval('#gaade-temaer .gaade-tema-knap', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { tema: e.dataset.tema, tekst: e.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(r.height), w: Math.round(r.width) } }))
  R.foldTitel = await tekst(S, '#fold-gaade-temaer > summary')
  await p.locator('#fold-gaade-temaer').scrollIntoViewIfNeeded()
  await p.locator('#fold-gaade-temaer').screenshot({ path: path.join(HERE, `K-${bredde}-1-temaer.png`) })
  for (const t of LICHESS_TEMAER) {
    const knap = `#gaade-temaer .gaade-tema-knap[data-tema="${t.tag}"]`
    await p.locator(knap).scrollIntoViewIfNeeded()
    await tryk(S, knap); await p.waitForTimeout(500)
    const T = { tag: t.tag, knap: await tekst(S, knap), forklaring: await tekst(S, '#gaade-tema-forklaring'), duOever: await tekst(S, '#gaade-tema-valgt'), status: await tekst(S, '#status') }
    const pl = await braetPlacering(S)
    const g = ALLE.find((x) => placering(x.fen) === pl)
    T.lichess = g ? { id: g.id, kilde: g.kilde, tema: g.tema, rating: g.rating, traek: Math.ceil(g.solutionUci.length / 2) } : null
    T.markeret = await p.$$eval('#braet .felt.sidst-fra, #braet .felt.sidst-til', (els) => els.map((el) => el.dataset.square).sort().join(','))
    if (g) {
      T.forTraekMarkeret = g.forTraek ? T.markeret === [g.forTraek.slice(0, 2), g.forTraek.slice(2, 4)].sort().join(',') : null
      if (R.temaer.length < 3) T.forkert = await proevForkert(S, g.fen, g.solutionUci[0], rnd)
      await loes(S, g.solutionUci)
      T.loest = await tekst(S, '#status')
      T.knapEfter = await tekst(S, knap)
    }
    R.temaer.push(T)
  }
  R.temaRul = await rul(S)
  await tryk(S, '#gaade-temaer .gaade-tema-knap[data-tema="alle"]'); await p.waitForTimeout(300)

  // --- Kendte partier: hvert parti ----------------------------------------------------------------
  await aabnFold(S, 'fold-kendte-partier')
  R.kendteFoer = await tekst(S, '#kendte-partier-antal')
  R.kendteKnapper = await p.$$eval('#kendte-partier-liste .kendt-parti-knap', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.parti, tekst: e.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(r.height) } }))
  await p.locator('#fold-kendte-partier').screenshot({ path: path.join(HERE, `K-${bredde}-2-kendte-liste.png`) })
  for (const parti of KENDTE_PARTIER) {
    const o = kendtPartiOpgave(parti)
    const knap = `#kendte-partier-liste .kendt-parti-knap[data-parti="${parti.id}"]`
    if (!(await synlig(S, knap))) await aabnFold(S, 'fold-kendte-partier')
    await p.locator(knap).scrollIntoViewIfNeeded()
    await tryk(S, knap); await p.waitForTimeout(500)
    const P = { id: parti.id, titel: await tekst(S, '#gaade-titel'), start: await tekst(S, '#status'), duOeverSkjult: !(await synlig(S, '#gaade-tema-valgt')) }
    P.stilling = (await braetPlacering(S)) === placering(o.fen)
    P.historieSkjult = !(await synlig(S, '#kendt-parti-historie'))
    P.braetISyne = await iSyne(S, '#braet')
    P.forkert = await proevForkert(S, o.fen, o.solutionUci[0], rnd)
    let taps = 0
    if (parti.id === 'lasker-thomas-1912') {
      // Hele jagten, men sidste traek som O-O-O# (ogsaa mat).
      await loes(S, o.solutionUci.slice(0, -1)); taps = o.solutionUci.length - 1
      await p.waitForTimeout(300)
      await uciTraek(S, 'e1c1'); await p.waitForTimeout(800)
      P.lang = 'O-O-O#'
    } else {
      await loes(S, o.solutionUci)
    }
    P.elevTraek = Math.ceil(o.solutionUci.length / 2)
    P.slut = await tekst(S, '#status')
    P.historie = { synlig: await synlig(S, '#kendt-parti-historie'), overskrift: await tekst(S, '#kendt-parti-overskrift'), tekst: await tekst(S, '#kendt-parti-tekst'), iSyne: await iSyne(S, '#kendt-parti-historie') }
    P.historieRigtig = P.historie.tekst === parti.historie
    P.flueben = /✓/.test(await tekst(S, knap))
    P.naeste = { synlig: await synlig(S, '#knap-kendt-naeste'), parti: await p.locator('#knap-kendt-naeste').getAttribute('data-parti') }
    P.rul = await rul(S)
    if (['opera-1858', 'lasker-thomas-1912', 'larsen-spassky-1970'].includes(parti.id)) {
      await p.locator('#kendt-parti-historie').scrollIntoViewIfNeeded().catch(() => {})
      await p.screenshot({ path: path.join(HERE, `K-${bredde}-3-${parti.id}.png`) })
    }
    R.partier.push(P)
    void taps
  }
  R.kendteEfter = await tekst(S, '#kendte-partier-antal')
  // Efter genindlaesning: flueben husket
  await p.reload(); await p.waitForSelector('#braet .felt'); await p.waitForTimeout(400)
  await tryk(S, '#fane-gaader'); await p.waitForTimeout(300)
  await aabnFold(S, 'fold-kendte-partier')
  R.kendteGenindlaest = await tekst(S, '#kendte-partier-antal')
  R.net = S.net
  R.fejl = S.fejl
  await S.ctx.close()
}
await browser.close()

// --- paastande --------------------------------------------------------------------------------
for (const b of BREDDER) {
  const R = ud[b]
  paastaa(`${b}: licenslinjen under gaaderne (lichess.org, CC0) og i licensteksten`, R.kildeSynlig && /lichess\.org/.test(R.kilde) && /CC0/.test(R.kilde) && R.licensTekst, R.kilde)
  paastaa(`${b}: 13 temaknapper, alle paa dansk`, R.knapper.length === 13 && R.knapper.every((k) => !/\b(fork|pin|skewer|mate|sacrifice|endgame|promotion|intermezzo)\b/i.test(k.tekst)), R.knapper.map((k) => k.tekst))
  if (b < 500) paastaa(`${b}: temaknapperne er mindst 44 px hoeje`, R.knapper.every((k) => k.h >= 44), Math.min(...R.knapper.map((k) => k.h)))
  const lich = R.temaer.filter((t) => t.lichess)
  paastaa(`${b}: hvert tema giver en gaade med det tema (fundet i en af bankerne)`, R.temaer.every((t) => t.lichess && t.lichess.tema === t.tag), R.temaer.map((t) => `${t.tag}:${t.lichess?.tema ?? '-'} ${t.lichess?.kilde ?? ''} ${t.lichess?.rating ?? ''}`))
  paastaa(`${b}: "Du øver: ..." staar over braettet med temaets navn`, R.temaer.every((t) => t.duOever && t.duOever.includes(LICHESS_TEMAER.find((x) => x.tag === t.tag).navn)), R.temaer.map((t) => t.duOever))
  paastaa(`${b}: modstanderens traek foer gaaden er markeret (kun lichess-temaerne har det)`, lich.every((t) => t.forTraekMarkeret !== false), lich.map((t) => `${t.tag}:${t.forTraekMarkeret}`))
  paastaa(`${b}: alle 12 gaader loest, "1 løst" ved knappen`, lich.every((t) => /løst/i.test(t.loest) && /1 løst/.test(t.knapEfter)), lich.map((t) => t.knapEfter))
  paastaa(`${b}: et forkert traek giver "Ikke den vej" og kan tages tilbage`, lich.filter((t) => t.forkert).every((t) => /Ikke den vej/.test(t.forkert.besked) && t.forkert.tilbage))
  paastaa(`${b}: ingen vandret rulning`, R.temaRul <= 0 && R.partier.every((x) => x.rul <= 0))
  paastaa(`${b}: 10 kendte partier, stillingen = partiet, "Du øver" skjult, historien skjult til loest`, R.partier.length === 10 && R.partier.every((x) => x.stilling && x.duOeverSkjult && x.historieSkjult), R.partier.filter((x) => !(x.stilling && x.duOeverSkjult && x.historieSkjult)).map((x) => x.id))
  paastaa(`${b}: hvert parti loest, historien vises ordret, flueben`, R.partier.every((x) => /Løst/.test(x.slut) && x.historie.synlig && x.historieRigtig && x.flueben), R.partier.filter((x) => !(/Løst/.test(x.slut) && x.historieRigtig && x.flueben)).map((x) => [x.id, x.slut]))
  paastaa(`${b}: kongejagten godtager O-O-O# til sidst`, /Løst/.test(R.partier.find((x) => x.id === 'lasker-thomas-1912').slut))
  paastaa(`${b}: "10 af 10 løst" og husket efter genindlaesning`, /10 af 10/.test(R.kendteEfter) && /10 af 10/.test(R.kendteGenindlaest), [R.kendteFoer, R.kendteEfter, R.kendteGenindlaest])
  paastaa(`${b}: uden net og uden fejl paa siden`, !R.net.length && !R.fejl.length, { net: R.net.length, fejl: R.fejl })
}
ud.tjek = tjek
writeFileSync(path.join(HERE, 'skak-552.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nskak-552: ${tjek.length - roede.length}/${tjek.length} ok (skak main ${SHA})`)
