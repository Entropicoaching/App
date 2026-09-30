// ORDRE 806: Bhishaks elev-script (kopi af Ganitas elev-741). Kun maaling. Brug: node outputs/kritik-806/elev-800.mjs <mappe med spil.html> [tag]
// Headless Chromium (matematik-traeets playwright), 390 touch (844 hoej, x2) og 1280 mus (900 hoej), uden net, uret og
// Math.random laast, bevaegelse TIL (det er foelelsen, der doemmes). Syntetisk elev "Tulle". Kun maaling, intet roeres.
//   node outputs/kritik-717/mat-721.mjs <mappe med spil.html>   -> elev-${TAG}.json og E806-*.png
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const TAG = process.argv[3] ?? "nu"
const ROD = path.resolve(process.argv[2])
const URL_SPIL = pathToFileURL(path.join(ROD, 'spil.html')).href
const T = Date.UTC(2026, 8, 30, 8, 0, 0)
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
const fremdrift = (a) => Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (a[id] ?? 0))]))
const START = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 2, niveauPoint: 0, erfaring: 30, hoved: 2, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fremdrift({ moellen: 1 }), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }
const NY = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 1, niveauPoint: 0, erfaring: 0, hoved: 1, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fremdrift({}), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }

let net = 0
const res = { ver: path.basename(ROD), net: 0, fejl: [], m: {} }
const imp = (f) => import(pathToFileURL(path.join(ROD, f)).href)
const quest = await imp('src/spil-quest.js')
quest.saetSpilSalt(T % 1000003)
const bog = await imp('src/questbog.js')
const LISTE = []
for (const kaede of Object.values(quest.QUEST_BANK)) for (const q of kaede) for (let r = 0; r < 8; r++) LISTE.push(...q.lavOpgaver(r))
for (const q of bog.BOG_QUESTS) for (let r = 0; r < 8; r++) { try { LISTE.push(...bog.lavBogQuest(q.id).lavOpgaver(r)) } catch {} }
const norm = (t) => String(t ?? '').replace(/\s+/g, '').slice(0, 60)

const browser = await chromium.launch()
async function nySide(bredde, { tilstand = null, set = true, hoejde } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde ?? (mobil ? 844 : 900) }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light', reducedMotion: 'no-preference' })
  await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
  await ctx.route(/^https?:/, (r) => { net++; return r.abort() })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => res.fejl.push(`${bredde}: ${e.message}`))
  await page.goto(URL_SPIL)
  await page.evaluate(([x, s]) => { localStorage.clear(); if (x) localStorage.setItem('ganita:spil', JSON.stringify(x)); if (s) localStorage.setItem('ganita:hhh-set', '1') }, [tilstand, set])
  await page.goto(URL_SPIL)
  await page.waitForTimeout(500)
  return page
}
const synlig = async (page, sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible())
const tekst = async (page, sel) => ((await synlig(page, sel)) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim() : '')
const gemt = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ganita:spil')))
const skud = (page, navn, hel = false) => page.screenshot({ path: path.join(HER, `E806-${TAG}-${navn}.png`), fullPage: hel })
async function rigtigKnap(page) {
  const t = await tekst(page, '.quest-opgave-tekst')
  const knapper = (await page.locator('#quest-svar button').allInnerTexts()).map(norm).join('|')
  const ens = LISTE.filter((x) => norm(x.tekst) === norm(t))
  const o = ens.find((x) => x.svarmuligheder.map((s) => norm(s.tekst)).join('|') === knapper) ?? ens[0]
  const rigtig = o ? o.svarmuligheder.findIndex((s) => s.korrekt) : -1
  if (rigtig < 0) throw new Error(`intet facit til: ${t}`)
  return page.locator(`#quest-svar button[data-i="${rigtig}"]`)
}
async function ryd(page) {
  for (let i = 0; i < 6; i++) {
    if (await synlig(page, '#niveau-banner-luk')) { await page.locator('#niveau-banner-luk').click(); await page.waitForTimeout(150); continue }
    if (await synlig(page, '#klaret-fortsaet')) { await page.locator('#klaret-fortsaet').click(); await page.waitForTimeout(250); continue }
    if (await synlig(page, '#quest-videre')) { await page.locator('#quest-videre').click(); await page.waitForTimeout(150); continue }
    if (await synlig(page, '#quest-svar button')) return
    { const gaa = page.getByRole('button', { name: /^Gå til / }); if (await gaa.count() && await gaa.first().isVisible()) { await gaa.first().click(); await page.waitForTimeout(400); continue } }
    if (await synlig(page, '#til-opgaven')) { await page.locator('#til-opgaven').click(); await page.waitForTimeout(400); continue }
  }
}
// aerlig: rigtigt foerste gang. gaetter: trykker paa knap 0, 1, 2 ... til det er rigtigt.
async function besvar(page, mode) {
  await ryd(page)
  if (mode === 'aerlig') { await (await rigtigKnap(page)).click({ timeout: 4000 }).catch(async () => { await skud(page, 'fejl-fast'); throw new Error('aerlig sad fast: ' + (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600)) }) } else {
    const n = await page.locator('#quest-svar button').count()
    for (let i = 0; i < n; i++) {
      if (await synlig(page, '#quest-videre')) break
      await page.locator(`#quest-svar button[data-i="${i}"]`).click({ timeout: 3000 }).catch(async () => { res.fejl.push('gaet: ' + (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)) })
      await page.waitForTimeout(40)
    }
  }
  await page.waitForTimeout(120)
  if (await synlig(page, '#quest-videre')) { await page.locator('#quest-videre').click(); await page.waitForTimeout(100) }
}
const MAAL = () => {
  const synligEl = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false } return true }
  let ord = 0, tal = 0
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim()
    if (!t || !synligEl(n.parentElement)) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    if (![...rg.getClientRects()].some((r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) continue
    ord += t.split(' ').filter((x) => /[\p{L}\d]/u.test(x)).length
    tal += (t.match(/\d+/g) || []).length
  }
  const knapper = [...document.querySelectorAll('button, a[href], summary, input:not([type=hidden])')].filter((e) => { const r = e.getBoundingClientRect(); return synligEl(e) && r.width > 1 && r.bottom > 0 && r.top < innerHeight }).length
  return { ord, tal, knapper, hoejdeSkaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), vandret: document.documentElement.scrollWidth > innerWidth }
}

for (const bredde of [390, 1280]) {
  const b = String(bredde)
  const m = (res.m[b] = {})
  // 1) Helt ny elev: opret, start, foerste skaerm, forklaringen aaben.
  let page = await nySide(bredde, { set: false })
  await page.waitForSelector('#op-navn')
  await skud(page, `${b}-1-opret`)
  await page.fill('#op-navn', 'Tulle')
  await page.locator('.opret-udseende').nth(1).click()
  await page.click('#op-start')
  await page.waitForSelector('#min-helt-knap')
  await page.waitForTimeout(700)
  m.nyElevFoerst = await page.evaluate(MAAL)
  m.nyElevHhh = await tekst(page, '#hhh-forklaring')
  m.nyElevSide = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1800)
  await skud(page, `${b}-2-ny-foerste`)
  await skud(page, `${b}-2-ny-foerste-hel`, true)
  await page.context().close()

  // 2) Den almindelige dag: gemt spil, forklaringen set.
  page = await nySide(bredde, { tilstand: START })
  m.kort = await page.evaluate(MAAL)
  m.kortSide = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1800)
  await skud(page, `${b}-3-kort`)
  await skud(page, `${b}-3-kort-hel`, true)
  await ryd(page)
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(200)
  m.opgave = await page.evaluate(MAAL)
  m.opgaveSide = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1800)
  await skud(page, `${b}-4-opgave`)
  // Rigtigt svar: fang det, eleven ser, foer, midt i og efter taellingen.
  await (await rigtigKnap(page)).click()
  await page.waitForTimeout(150); await skud(page, `${b}-5-svar-150ms`)
  await page.waitForTimeout(500); await skud(page, `${b}-5-svar-650ms`)
  await page.waitForTimeout(900); await skud(page, `${b}-5-svar-slut`)
  m.svarTekst = await tekst(page, '.quest-besked')
  // Spil til Niveau op (banneret).
  let banner = false
  for (let i = 0; i < 40 && !banner; i++) { await besvar(page, 'aerlig'); if (await synlig(page, '.niveau-banner')) banner = true }
  m.banner = banner
  if (banner) {
    await page.waitForTimeout(300); await skud(page, `${b}-6-niveauop-300ms`)
    await page.waitForTimeout(1200); await skud(page, `${b}-6-niveauop`)
    m.bannerTekst = await tekst(page, '.niveau-banner')
    m.bannerMaal = await page.evaluate(MAAL)
    await skud(page, `${b}-6-niveauop-hel`, true)
    if (await synlig(page, '#niveau-banner-luk')) await page.locator('#niveau-banner-luk').click(); await page.waitForTimeout(500)
    await skud(page, `${b}-7-efter-banner`)
  }
  await page.evaluate(() => scrollTo(0, 0))
  // Min helt.
  await page.locator('#min-helt-knap').first().click().catch(async () => { await page.locator('#min-helt-portraet').click() })
  await page.waitForTimeout(700)
  await page.evaluate(() => scrollTo(0, 0))
  m.helt = await page.evaluate(MAAL)
  await page.waitForTimeout(3500); m.heltHvile = await page.evaluate(MAAL); await skud(page, `${b}-8-helt-ro`)
  m.heltSide = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 2500)
  await skud(page, `${b}-8-helt`)
  await skud(page, `${b}-8-helt-hel`, true)
  await page.context().close()

  // 2b) Et klaret forloeb: svar rigtigt til klaret-teksten staar der.
  page = await nySide(bredde, { tilstand: START })
  let klaret = false
  for (let i = 0; i < 40 && !klaret; i++) {
    await ryd(page)
    if (await synlig(page, '.quest-klaret')) { klaret = true; break }
    await (await rigtigKnap(page)).click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(1300)
    if (await synlig(page, '.quest-klaret')) klaret = true
  }
  m.klaret = klaret
  if (klaret) {
    await page.waitForTimeout(500)
    m.klaretMaal = await page.evaluate(MAAL)
    m.klaretSide = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1800)
    await skud(page, `${b}-10-klaret`)
    await skud(page, `${b}-10-klaret-hel`, true)
  }
  await page.context().close()

  // 3) Gaetter mod aerlig (kun paa 390): 60 opgaver hver, samme start (helt ny elev).
  if (bredde === 390) {
    m.sim = {}
    for (const mode of ['aerlig', 'gaetter']) {
      const p = await nySide(bredde, { tilstand: NY })
      const spor = []
      for (let i = 1; i <= 60; i++) {
        await besvar(p, mode)
        if (i % 10 === 0) { const g = await gemt(p); spor.push({ opgaver: i, niveau: g.figur.niveau, erfaring: g.figur.erfaring, hoved: g.figur.hoved, haand: g.figur.haand, mestret: Object.values(g.questFremdrift).flat().filter(Boolean).length }) }
      }
      m.sim[mode] = spor
      if (mode === 'gaetter') await skud(p, `${b}-9-gaetter-efter-60`)
      else await skud(p, `${b}-9-aerlig-efter-60`)
      await p.context().close()
    }
  }
}
res.net = net
await browser.close()
writeFileSync(path.join(HER, `elev-${TAG}.json`), JSON.stringify(res, null, 1))
console.log(JSON.stringify({ net: res.net, fejl: res.fejl, sim: res.m['390']?.sim, banner: [res.m['390'].banner, res.m['1280'].banner], klaret: [res.m['390'].klaret, res.m['1280'].klaret] }, null, 1))

