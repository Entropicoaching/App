// KRITIK 656, blok 2: skakken efter Chaturangas 649 (merget; skak main ea0e6f1), hentet med git archive; skak-traeet
// roeres ikke. Som elev paa 12 aar (360 x 740, 360 x 640 og 390 x 844 med touch) og som Marc foran klassen (1280 x 800,
// mus), headless, uden net, paa Playwrights ur (mandag 28. sep. 2026 10:00). Lageret er syntetisk (en elev med fem
// stormer bag sig og en Gafler-rekord paa 4), som Chaturangas eget tjek, saa tallene kan sammenlignes.
// Maalt:
//   A  Gaade-fanen: hvor stormens startkort og "Dagens storm" staar, naar fanen aabnes (uden at rulle).
//   B  Startkortet: al tekst, ord, tal, knapper, hoejde; "Alle:"-linjen og hvor mange linjer den fylder.
//   C  Soejlerne (#32): 22 x 44 px, tryk 6 px under den nyeste (boble, ingen storm), tryk midt mellem to soejler,
//      og "Dagens storm" 2 px under sin overkant.
//   D  En Gafler-storm med 5 (loest ved at slaa stillingen op i banken, traek med tryk): slutkortets ros, temalinjen
//      (#33: "rekord 5." alene paa anden linje?), "Alle:"-linjen, ord og tal paa slutkortet.
//   node outputs/kritik-656/skak-656.mjs     -> skak-656.json og S656-*.png her.
import path from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const REF = 'ea0e6f1'
const dir = mkdtempSync(path.join(tmpdir(), 'k656-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" ${REF}`)
execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const { ugeNummer } = await imp('src/kompetencer.js')
const GS = await imp('src/gaadestorm.js')
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js')
const { afkodGaadebankStor } = await imp('src/gaadedata.js')
const { Chess } = await import(pathToFileURL(path.join(SKAK, 'node_modules/chess.js/dist/esm/chess.js')).href)
const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(['gaader.json', 'gaader-lette.json'].flatMap((f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8'))))
const noegle = (fen) => fen.split(' ').slice(0, 2).join(' ')
const iBank = new Map(); for (const g of bank) if (!iBank.has(noegle(g.fen))) iBank.set(noegle(g.fen), g)

const MANDAG = new Date('2026-09-28T10:00:00')
const UGE = ugeNummer(MANDAG)
const DATO = '2026-09-28'
const LAGER = {
  'skak-gaade-storm-rekord-v1': { loeste: 20, kombo: 9, dato: '2026-09-14' },
  'skak-gaade-storm-tema-v1': 'blandet',
  [GS.STORM_PERIODE_NOEGLE]: { dag: { dato: DATO, loeste: 10 }, uge: { uge: UGE, loeste: 10 } },
  [GS.STORM_TEMA_PERIODE_NOEGLE]: { gaffel: { dag: { dato: DATO, loeste: 4 }, uge: { uge: UGE, loeste: 4 } } },
  [GS.STORM_TEMA_REKORD_NOEGLE]: { gaffel: 4 },
  [GS.STORM_TEMA_HISTORIK_NOEGLE]: { gaffel: [2, 4] },
  [GS.STORM_HISTORIK_NOEGLE]: [3, 6, 5, 2, 6],
}
const BREDDER = [
  { navn: '360', bredde: 360, hoejde: 740, mobil: true },
  { navn: '360x640', bredde: 360, hoejde: 640, mobil: true },
  { navn: '390', bredde: 390, hoejde: 844, mobil: true },
  { navn: '1280', bredde: 1280, hoejde: 800, mobil: false },
]
const res = { ver: { skak: execSync(`git -C "${SKAK}" rev-parse --short ${REF}`).toString().trim() }, bredder: {}, fejl: [], net: 0 }

// Al synlig tekst i et element: ord, tal, knapper.
const KORT = (id) => {
  const el = document.getElementById(id)
  if (!el || !el.checkVisibility()) return null
  const t = el.innerText.replace(/\s+/g, ' ').trim()
  const knapper = [...el.querySelectorAll('button, a[href], summary, select, input')].filter((b) => b.checkVisibility())
  const r = el.getBoundingClientRect()
  return { tekst: t, ord: t.split(' ').filter((x) => /[\p{L}\d]/u.test(x)).length, tal: (t.match(/\d+/g) || []).length, knapper: knapper.length, knapNavne: knapper.map((b) => (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 30)), hoejde: Math.round(r.height), top: Math.round(r.top + scrollY) }
}
const LINJE = (id) => {
  const el = document.getElementById(id)
  if (!el || !el.checkVisibility()) return null
  const r = document.createRange(); r.selectNodeContents(el)
  const rects = [...r.getClientRects()].filter((x) => x.width > 0)
  const toppe = [...new Set(rects.map((x) => Math.round(x.top)))]
  // Hvad staar paa sidste linje?
  const sidste = Math.max(...toppe)
  let sidsteTekst = ''
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    for (let i = 0; i < n.length; i++) { const rr = document.createRange(); rr.setStart(n, i); rr.setEnd(n, i + 1); const b = rr.getClientRects()[0]; if (b && Math.abs(Math.round(b.top) - sidste) <= 2) sidsteTekst += n.data[i] }
  }
  return { tekst: el.textContent.replace(/\s+/g, ' ').trim(), linjer: toppe.length, sidsteLinje: toppe.length > 1 ? sidsteTekst.trim() : null }
}
const SOEJLER = (id) => {
  const boks = document.getElementById(id)
  const knapper = [...boks.querySelectorAll('.storm-historik-soejle')].map((x) => x.getBoundingClientRect())
  const fyld = [...boks.querySelectorAll('.storm-historik-fyld')].map((x) => x.getBoundingClientRect())
  const boble = boks.querySelector('.storm-historik-boble')
  return {
    b: knapper.map((k) => Math.round(k.width)), h: knapper.map((k) => Math.round(k.height)),
    midter: fyld.map((x) => (x.left + x.right) / 2), mellemrum: knapper.slice(1).map((k, i) => Math.round(k.left - knapper[i].right)),
    fyldTop: Math.min(...fyld.map((x) => x.top)), fyldBund: Math.max(...fyld.map((x) => x.bottom)),
    boble: boble && !boble.hidden && boble.checkVisibility() ? boble.textContent : '',
  }
}
const hvem = (page, x, y) => page.evaluate(([px, py]) => {
  const el = document.elementFromPoint(px, py)
  if (!el) return 'intet'
  if (el.closest('.storm-historik-soejle')) return 'soejle'
  const k = el.closest('button')
  return (k ?? el).id || (k ?? el).textContent.trim().slice(0, 20)
}, [x, y])

async function storm(page, S, antal) {
  await page.waitForFunction(() => !document.querySelector('#knap-storm-start').disabled, null, { timeout: 30000 })
  await page.locator('#knap-storm-start').scrollIntoViewIfNeeded()
  let forrige = noegle(await page.inputValue('#fen-tekst'))
  if (S.mobil) await page.locator('#knap-storm-start').tap(); else await page.locator('#knap-storm-start').click()
  await page.waitForSelector('#storm-koerer:not([hidden])', { timeout: 10000 })
  await page.waitForTimeout(400)
  for (let n = 0; n < antal; n += 1) {
    let fen = ''; let g = null
    for (let f = 0; f < 40 && !g; f += 1) { fen = await page.inputValue('#fen-tekst'); g = noegle(fen) === forrige ? null : iBank.get(noegle(fen)) ?? null; if (!g) await page.waitForTimeout(250) }
    if (!g) { res.fejl.push(`${S.navn}: stormgaade ${n + 1} ikke i banken`); return false }
    forrige = noegle(fen)
    const c = new Chess(fen)
    for (let i = 0; i < g.solutionUci.length; i += 2) {
      const uci = g.solutionUci[i]
      for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) { const l = page.locator(`#braet .felt[data-square="${f}"]`); if (S.mobil) await l.tap(); else await l.click() }
      if (uci[4]) await page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).click()
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (i + 1 < g.solutionUci.length) {
        await page.waitForFunction((f) => document.getElementById('fen-tekst').value.split(' ').slice(0, 2).join(' ') !== f, noegle(c.fen()), { timeout: 5000 }).catch(() => {})
        c.move({ from: g.solutionUci[i + 1].slice(0, 2), to: g.solutionUci[i + 1].slice(2, 4), promotion: g.solutionUci[i + 1][4] })
      }
    }
    await page.waitForFunction((f) => document.getElementById('fen-tekst').value.split(' ').slice(0, 2).join(' ') !== f, noegle(c.fen()), { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
  await page.clock.runFor(200000)
  await page.waitForSelector('#storm-resultat:not([hidden])', { timeout: 10000 })
  await page.waitForTimeout(300)
  return true
}

const browser = await chromium.launch()
for (const S of BREDDER) {
  const ctx = await browser.newContext({ viewport: { width: S.bredde, height: S.hoejde }, isMobile: S.mobil, hasTouch: S.mobil, deviceScaleFactor: S.mobil ? 2 : 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => res.fejl.push(`${S.navn}: ${e.message}`))
  await page.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); res.net++; return r.abort() })
  await page.clock.install({ time: MANDAG })
  await page.addInitScript((l) => { if (sessionStorage.getItem('lagt-ind')) return; sessionStorage.setItem('lagt-ind', '1'); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }, LAGER)
  await page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
  await page.waitForSelector('#braet .felt')
  const fane = page.locator('#fane-gaader')
  if (S.mobil) await fane.tap(); else await fane.click()
  await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 30000 })
  await page.waitForTimeout(300)
  const R = { vandret: false }
  // A: uden at rulle efter fanen
  R.fane = await page.evaluate(() => {
    const y = (id) => { const e = document.getElementById(id); if (!e || !e.checkVisibility()) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bund: Math.round(r.bottom + scrollY) } }
    return { scrollY: Math.round(scrollY), skaerm: innerHeight, sideSkaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), startKort: y('storm-start-kort'), dagensStorm: y('knap-storm-dagens'), stormStart: y('knap-storm-start') }
  })
  await page.screenshot({ path: path.join(HER, `S656-${S.navn}-1-gaader.png`) })
  // B: startkortet
  await page.locator('#storm-start-kort').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  R.startKort = await page.evaluate(KORT, 'storm-start-kort')
  R.alleLinje = await page.evaluate(LINJE, 'storm-tema-perioder')
  await page.evaluate(() => document.getElementById('storm-start-kort').scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(HER, `S656-${S.navn}-2-startkort.png`) })
  // C: soejlerne
  const s = await page.evaluate(SOEJLER, 'storm-tema-historik')
  R.soejler = { b: s.b, h: s.h, mellemrum: s.mellemrum }
  const tap = async (x, y) => { if (S.mobil) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(200) }
  const n = s.midter.length
  await tap(s.midter[n - 1], s.fyldBund + 6)
  R.soejler.underNyeste = { boble: (await page.evaluate(SOEJLER, 'storm-tema-historik')).boble, stormStartet: await page.evaluate(() => document.getElementById('storm-koerer').checkVisibility()) }
  await page.screenshot({ path: path.join(HER, `S656-${S.navn}-3-boble.png`) })
  await tap(s.midter[n - 1], (s.fyldTop + s.fyldBund) / 2)
  R.soejler.mellemTo = await hvem(page, (s.midter[0] + s.midter[1]) / 2, (s.fyldTop + s.fyldBund) / 2)
  const k = await page.locator('#knap-storm-dagens').boundingBox()
  R.soejler.dagensKant = await hvem(page, k.x + k.width / 2, k.y + 2)
  R.soejler.luftTilDagens = Math.round(k.y - s.fyldBund)
  R.vandret ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  // D: en Gafler-storm med 5
  await page.locator('#segment-storm-tema [data-value="gaffel"]').scrollIntoViewIfNeeded()
  if (S.mobil) await page.locator('#segment-storm-tema [data-value="gaffel"]').tap(); else await page.locator('#segment-storm-tema [data-value="gaffel"]').click()
  await page.waitForTimeout(200)
  if (await storm(page, S, 5)) {
    R.slutKort = await page.evaluate(KORT, 'storm-resultat')
    R.ros = await page.evaluate(LINJE, 'storm-ny-periode')
    R.nyRekordAlle = await page.locator('#storm-ny-rekord').isVisible()
    R.temaLinje = await page.evaluate(LINJE, 'storm-resultat-tema-perioder')
    R.slutAlle = await page.evaluate(LINJE, 'storm-resultat-perioder')
    await page.evaluate(() => document.getElementById('storm-resultat').scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(HER, `S656-${S.navn}-4-slutkort.png`) })
    R.vandret ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  }
  res.bredder[S.navn] = R
  console.log(S.navn, JSON.stringify({ fane: R.fane, alle: R.alleLinje, soejler: R.soejler, ros: R.ros?.tekst, tema: R.temaLinje, start: [R.startKort.ord, R.startKort.tal, R.startKort.knapper, R.startKort.hoejde], slut: R.slutKort && [R.slutKort.ord, R.slutKort.tal, R.slutKort.knapper, R.slutKort.hoejde] }))
  await ctx.close()
}
// Laererens side paa 1280 (Marc foran klassen): foerste skaerm.
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await p.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); res.net++; return r.abort() })
  p.on('pageerror', (e) => res.fejl.push(`laerer: ${e.message}`))
  await p.goto(pathToFileURL(path.join(dir, 'laerer.html')).href).catch((e) => res.fejl.push(`laerer: ${e.message}`))
  await p.waitForTimeout(500)
  res.laerer = await p.evaluate(() => { const t = document.body.innerText.replace(/\s+/g, ' ').trim(); return { ord: t.split(' ').length, start: t.slice(0, 400), skaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2) } })
  await p.screenshot({ path: path.join(HER, 'S656-1280-5-laerer.png') })
  await p.close()
}
await browser.close()
res.bredder = Object.fromEntries(Object.entries(res.bredder).map(([k, v]) => [k === '360' ? 360 : k === '390' ? 390 : k === '1280' ? 1280 : k, v]))
writeFileSync(path.join(HER, 'skak-656.json'), JSON.stringify(res, null, 2))
console.log('net', res.net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
