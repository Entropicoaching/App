// KRITIK 664, blok 2: skakken efter Chaturangas 657 (merget, skak main 85a4236) og 663 (ordre-663 66bbcaf, tre
// blokke committet, ikke merget). Foer = 85a4236, efter = 66bbcaf, begge hentet med git archive; skak-traeet roeres
// ikke. Som elev paa 12 aar (360 x 740, 360 x 640 og 390 x 844 med touch) og som Marc foran klassen (1280 x 800, mus),
// headless, uden net, paa Playwrights ur (mandag 28. sep. 2026 10:00). Lageret er syntetisk (samme som 656: fem
// stormer bag sig, Gafler-rekord 4, rekord over alle 20).
// Maalt pr. version og skaerm:
//   A  Fanerne: hoejde, mellemrum, raekker; et tryk midt i mellemrummet mellem de to raekker rammer hvilken fane?
//   B  Braettet ved foerste visning i Gaader og i Spil: top og bund mod skaermen.
//   C  Startkortet (ord, tal, knapper) og temalinjen (#33) paa een linje.
//   D  Gafler-storm med 5 og 0 fejl (ny rekord): slutkortet (ord, tal, "rekord"/"bedst"-linjer, "(-0 s)").
//   E  Gafler-storm med 1 fejl foerst og saa 3 (ingen ny rekord): det 663 bad Bhishak proeve.
//   F  Knapper under 44 px paa den foerste skaerm i Gaader og Spil (360/390).
//   node outputs/kritik-664/skak-664.mjs     -> skak-664.json og S664-*.png her.
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
const UDG = [{ tag: 'foer', ref: '85a4236' }, { tag: 'efter', ref: '66bbcaf' }]
const noegle = (fen) => fen.split(' ').slice(0, 2).join(' ')
const { Chess } = await import(pathToFileURL(path.join(SKAK, 'node_modules/chess.js/dist/esm/chess.js')).href)
let iBank = new Map()
const MANDAG = new Date('2026-09-28T10:00:00')
const DATO = '2026-09-28'
const BREDDER = [
  { navn: '360', bredde: 360, hoejde: 740, mobil: true },
  { navn: '360x640', bredde: 360, hoejde: 640, mobil: true },
  { navn: '390', bredde: 390, hoejde: 844, mobil: true },
  { navn: '1280', bredde: 1280, hoejde: 800, mobil: false },
]
const res = { ver: {}, v: {}, fejl: [], net: 0 }

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

// En storm, hvor foerste gaade faar et forkert (lovligt) traek; derefter `antal` rigtige.
async function stormMedFejl(page, S, antal) {
  await page.waitForFunction(() => !document.querySelector('#knap-storm-start').disabled, null, { timeout: 30000 })
  await page.locator('#knap-storm-start').scrollIntoViewIfNeeded()
  if (S.mobil) await page.locator('#knap-storm-start').tap(); else await page.locator('#knap-storm-start').click()
  await page.waitForSelector('#storm-koerer:not([hidden])', { timeout: 10000 })
  await page.waitForTimeout(400)
  const trk = async (f) => { const l = page.locator(`#braet .felt[data-square="${f}"]`); if (S.mobil) await l.tap(); else await l.click() }
  let fen = await page.inputValue('#fen-tekst')
  const g0 = iBank.get(noegle(fen))
  if (!g0) { res.fejl.push(`${S.navn}: fejlstorm gaade 1 ikke i banken`); return false }
  const c0 = new Chess(fen)
  const forkert = c0.moves({ verbose: true }).find((m) => m.from + m.to !== g0.solutionUci[0].slice(0, 4) && !m.promotion)
  await trk(forkert.from); await trk(forkert.to)
  await page.waitForTimeout(900)
  let forrige = noegle(fen)
  // Gaaden kan staa endnu (proev igen) eller vaere skiftet; loes derfra.
  for (let n = 0; n < antal; n += 1) {
    let g = null
    for (let f = 0; f < 40 && !g; f += 1) { fen = await page.inputValue('#fen-tekst'); g = iBank.get(noegle(fen)) ?? null; if (!g || (n > 0 && noegle(fen) === forrige)) { g = null; await page.waitForTimeout(250) } }
    if (!g) { res.fejl.push(`${S.navn}: fejlstorm gaade ${n + 1} ikke i banken`); return false }
    forrige = noegle(fen)
    const c = new Chess(fen)
    for (let i = 0; i < g.solutionUci.length; i += 2) {
      const uci = g.solutionUci[i]
      await trk(uci.slice(0, 2)); await trk(uci.slice(2, 4))
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
// Slutkortet: synlig tekst, linjer med "rekord"/"bedst", "(-0 s)".
const SLUT = () => {
  const el = document.getElementById('storm-resultat')
  const linjer = [...el.querySelectorAll('p, h2, h3, li, div')].filter((e) => e.checkVisibility() && !e.querySelector('p, div, li') && e.innerText.trim()).map((e) => e.innerText.replace(/\s+/g, ' ').trim())
  return { linjer, rekordLinjer: linjer.filter((l) => /rekord|bedst/i.test(l)).length, nulS: /[-−]0 s/.test(el.innerText) }
}
const FANER = () => {
  const k = [...document.querySelectorAll('.fane')].filter((e) => e.checkVisibility()).map((e) => ({ id: e.id, r: e.getBoundingClientRect() }))
  const toppe = [...new Set(k.map((x) => Math.round(x.r.top)))].sort((a, b) => a - b)
  const r1 = k.filter((x) => Math.round(x.r.top) === toppe[0])
  const r2 = k.filter((x) => Math.round(x.r.top) === toppe[1])
  const mellem = r2.length ? r2[0].r.top - r1[0].r.bottom : null
  return { antal: k.length, h: k.map((x) => Math.round(x.r.height * 10) / 10), b: k.map((x) => Math.round(x.r.width)), raekker: toppe.length, mellem: mellem == null ? null : Math.round(mellem * 10) / 10, midtY: r2.length ? (r1[0].r.bottom + r2[0].r.top) / 2 : null, xer: r1.map((x) => (x.r.left + x.r.right) / 2), bund: Math.round(Math.max(...k.map((x) => x.r.bottom))) }
}
const SMAA = () => [...document.querySelectorAll('button, a[href], summary, select, input:not([type=hidden]), [role=button]')]
  .filter((e) => e.checkVisibility()).map((e) => ({ e, r: e.getBoundingClientRect() }))
  .filter(({ r }) => r.width > 0 && r.bottom > 0 && r.top < innerHeight && (r.height < 44 || r.width < 44))
  .map(({ e, r }) => `${(e.getAttribute('aria-label') || e.innerText || e.id || e.className).replace(/\s+/g, ' ').trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`)
const BRAET = () => { const q = document.getElementById('braet').getBoundingClientRect(); return { top: Math.round(q.top), bund: Math.round(q.bottom), h: innerHeight, over: Math.round(innerHeight - q.bottom) } }

const browser = await chromium.launch()
for (const { tag, ref } of UDG) {
  const dir = mkdtempSync(path.join(tmpdir(), `k664-skak-${tag}-`))
  execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" ${ref}`)
  execSync('tar -xf s.tar', { cwd: dir })
  symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
  res.ver[tag] = execSync(`git -C "${SKAK}" rev-parse --short ${ref}`).toString().trim()
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
  const { ugeNummer } = await imp('src/kompetencer.js')
  const GS = await imp('src/gaadestorm.js')
  const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js')
  const { afkodGaadebankStor } = await imp('src/gaadedata.js')
  const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(['gaader.json', 'gaader-lette.json'].flatMap((f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8'))))
  iBank = new Map(); for (const g of bank) if (!iBank.has(noegle(g.fen))) iBank.set(noegle(g.fen), g)
  const UGE = ugeNummer(MANDAG)
  const lager = (gafRekord) => ({
    'skak-gaade-storm-rekord-v1': { loeste: 20, kombo: 9, dato: '2026-09-14' },
    'skak-gaade-storm-tema-v1': 'blandet',
    [GS.STORM_PERIODE_NOEGLE]: { dag: { dato: DATO, loeste: 10 }, uge: { uge: UGE, loeste: 10 } },
    [GS.STORM_TEMA_PERIODE_NOEGLE]: { gaffel: { dag: { dato: DATO, loeste: gafRekord }, uge: { uge: UGE, loeste: gafRekord } } },
    [GS.STORM_TEMA_REKORD_NOEGLE]: { gaffel: gafRekord },
    [GS.STORM_TEMA_HISTORIK_NOEGLE]: { gaffel: [2, gafRekord] },
    [GS.STORM_HISTORIK_NOEGLE]: [3, 6, 5, 2, 6],
  })
  res.v[tag] = {}
  for (const S of BREDDER) {
    const aabn = async (gafRekord = 4) => {
      const ctx = await browser.newContext({ viewport: { width: S.bredde, height: S.hoejde }, isMobile: S.mobil, hasTouch: S.mobil, deviceScaleFactor: S.mobil ? 2 : 1 })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => res.fejl.push(`${tag} ${S.navn}: ${e.message}`))
      await page.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); res.net++; return r.abort() })
      await page.clock.install({ time: MANDAG })
      await page.addInitScript((l) => { if (sessionStorage.getItem('lagt-ind')) return; sessionStorage.setItem('lagt-ind', '1'); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }, lager(gafRekord))
      await page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
      await page.waitForSelector('#braet .felt')
      return page
    }
    const tryk = async (page, sel) => { if (S.mobil) await page.locator(sel).tap(); else await page.locator(sel).click() }
    const skud = (page, navn) => (tag === 'efter' || navn.startsWith('1')) ? page.screenshot({ path: path.join(HER, `S664-${tag}-${S.navn}-${navn}.png`) }) : null
    const R = { vandret: false }
    let page = await aabn()
    // A: fanerne
    R.faner = await page.evaluate(FANER)
    if (S.mobil && R.faner.midtY) {
      R.faner.trykMellem = []
      for (const x of R.faner.xer) {
        const hit = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e?.closest('.fane')?.id ?? (e?.id || e?.className || e?.tagName) }, [x, R.faner.midtY])
        R.faner.trykMellem.push(hit)
      }
    }
    // B: braettet ved foerste visning, Gaader og Spil; F: smaa knapper paa foerste skaerm
    await tryk(page, '#fane-gaader')
    await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 30000 })
    await page.waitForTimeout(300)
    R.gaader = { braet: await page.evaluate(BRAET), smaa: await page.evaluate(SMAA), scrollY: await page.evaluate(() => Math.round(scrollY)) }
    await skud(page, '1-gaader')
    await page.evaluate(() => scrollTo(0, 0))
    await tryk(page, '#fane-spil')
    await page.waitForTimeout(400)
    R.spil = { braet: await page.evaluate(BRAET), smaa: await page.evaluate(SMAA), scrollY: await page.evaluate(() => Math.round(scrollY)), overBraettet: await page.evaluate(() => { const q = document.getElementById('braet').getBoundingClientRect(); return [...document.querySelectorAll('h2, h3, legend, .kort-titel')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().bottom < q.top && e.getBoundingClientRect().top >= 0).map((e) => e.innerText.trim().slice(0, 40)) }) }
    await skud(page, '1-spil')
    R.vandret ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    // C: startkortet og temalinjen (Gafler valgt)
    await tryk(page, '#fane-gaader')
    await page.waitForTimeout(300)
    await page.locator('#segment-storm-tema [data-value="gaffel"]').scrollIntoViewIfNeeded()
    await tryk(page, '#segment-storm-tema [data-value="gaffel"]')
    await page.waitForTimeout(200)
    R.startKort = await page.evaluate(KORT, 'storm-start-kort')
    R.temaLinje = await page.evaluate(LINJE, 'storm-tema-perioder')
    await page.evaluate(() => document.getElementById('storm-start-kort').scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(200)
    await skud(page, '2-startkort')
    // D: Gafler-storm med 5 og 0 fejl (ny Gafler-rekord)
    if (await storm(page, S, 5)) {
      R.slutD = { kort: await page.evaluate(KORT, 'storm-resultat'), ...(await page.evaluate(SLUT)) }
      await page.evaluate(() => document.getElementById('storm-resultat').scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(300)
      await skud(page, '3-slutkort-0-fejl')
      R.vandret ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    }
    await page.context().close()
    // E: Gafler-storm med 1 fejl og 3 rigtige, Gafler-rekord 12 (ingen ny rekord)
    page = await aabn(12)
    await tryk(page, '#fane-gaader')
    await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 30000 })
    await page.locator('#segment-storm-tema [data-value="gaffel"]').scrollIntoViewIfNeeded()
    await tryk(page, '#segment-storm-tema [data-value="gaffel"]')
    await page.waitForTimeout(200)
    if (await stormMedFejl(page, S, 3)) {
      R.slutE = { kort: await page.evaluate(KORT, 'storm-resultat'), ...(await page.evaluate(SLUT)) }
      await page.evaluate(() => document.getElementById('storm-resultat').scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(300)
      await skud(page, '4-slutkort-1-fejl')
      R.vandret ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    }
    await page.context().close()
    res.v[tag][S.navn] = R
    console.log(tag, S.navn, JSON.stringify({ faner: [R.faner.h[0], R.faner.mellem, R.faner.trykMellem], gaader: R.gaader.braet, spil: R.spil.braet, D: R.slutD && [R.slutD.rekordLinjer, R.slutD.nulS, R.slutD.kort.ord, R.slutD.kort.tal], E: R.slutE && R.slutE.linjer }))
  }
}
await browser.close()
writeFileSync(path.join(HER, 'skak-664.json'), JSON.stringify(res, null, 2))
console.log('net', res.net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
