// KRITIK 648, blok 1: matematikspillet foer og efter Ganitas 643 ("stadig lidt rodet", Hoved/Haand/Hjerte).
// Foer = matematik main 31d22fd (642 merget). Efter = ordre-643 471784d (blok 1 og 2 committet, ikke merget).
// Begge hentes med `git archive` til en midlertidig mappe; matematik-traeet roeres ikke.
// Headless Chromium (playwrights), 390 touch (844 hoej, x2) og 1280 mus (900 hoej), uden net, uret laast.
// Eleven er syntetisk ("Tulle", et fantasinavn). Kun maaling.
//   node outputs/kritik-648/mat-648.mjs            -> mat-648.json og M648-*.png
// Maalt pr. skaerm (kortet oeverst, en opgave, Min helt):
//   - hvad der staar paa den foerste skaerm (uden at rulle): ord, tal (cifre), knapper
//   - hele siden: hoejde i skaerme, ord, tal, knapper
//   - hvor den foerste svarknap staar (y), og hvor "Tilbage" staar paa Min helt, Journalen og Questbogen
// Og Hoved/Haand/Hjerte: en elev med gemt spil, der aldrig har set forklaringen (efter 643 vises den
// aaben), en helt ny elev (tom browser, Lav din figur -> Start), "?" (stoerrelse, overlap), ordene
// og laererens ark.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const UDG = [{ tag: 'foer', ref: '31d22fd' }, { tag: 'efter', ref: '471784d' }]
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
const fremdrift = (a) => Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (a[id] ?? 0))]))
// Samme gemte spil som Ganitas skud-643 (Moellens forloeb 1 mestret), men med mit fantasinavn.
const START = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 2, niveauPoint: 0, erfaring: 30, hoved: 2, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fremdrift({ moellen: 1 }), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }

let net = 0
const res = { ver: {}, skaerme: {}, hhh: {}, nyElev: {}, fejl: [] }

// Alt, der kan ses: tekstknuder med en boks > 0 og synlige forfaedre.
const MAAL = () => {
  const iSyne = (r, kunSkaerm) => r.width > 1 && r.height > 1 && (!kunSkaerm || (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth))
  const synligEl = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false } return true }
  const tael = (kunSkaerm) => {
    let ord = 0
    let tal = 0
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const tekster = []
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.replace(/\s+/g, ' ').trim()
      if (!t || !synligEl(n.parentElement)) continue
      const rg = document.createRange()
      rg.selectNodeContents(n)
      if (![...rg.getClientRects()].some((r) => iSyne(r, kunSkaerm))) continue
      ord += t.split(' ').filter((x) => /[\p{L}\d]/u.test(x)).length
      tal += (t.match(/\d+/g) || []).length
      tekster.push(t)
    }
    const knapper = [...document.querySelectorAll('button, a[href], summary, [role=button], input:not([type=hidden]), select')]
      .filter((el) => synligEl(el) && iSyne(el.getBoundingClientRect(), kunSkaerm))
      .map((el) => (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40))
    return { ord, tal, knapper: knapper.length, knapNavne: knapper, tekst: tekster.join(' | ').slice(0, 2500) }
  }
  const svar = document.querySelector('#quest-svar button')?.getBoundingClientRect()
  const opg = document.querySelector('.quest-opgave-tekst')?.getBoundingClientRect()
  return {
    skaerm: tael(true), side: tael(false),
    skaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
    vandret: document.documentElement.scrollWidth > innerWidth,
    scrollY: Math.round(scrollY),
    foersteSvarY: svar ? Math.round(svar.top + scrollY) : null,
    opgaveY: opg ? Math.round(opg.top + scrollY) : null,
  }
}
const HHH = () => {
  const b = document.querySelector('#hhh-forklaring')
  const s = document.querySelector('#hhh-spoerg')
  const r = b?.getBoundingClientRect()
  const sr = s?.getBoundingClientRect()
  const svar = document.querySelector('#quest-svar button')?.getBoundingClientRect()
  const tal = document.querySelector('.spil-egenskaber')?.getBoundingClientRect()
  const andre = s ? [...document.querySelectorAll('button, a[href], summary')].filter((e) => e !== s && e.offsetParent).map((e) => e.getBoundingClientRect()) : []
  const ramt = sr ? andre.filter((a) => a.left < sr.right && a.right > sr.left && a.top < sr.bottom && a.bottom > sr.top).length : 0
  return {
    findes: !!b, vises: !!b && !b.hidden && b.offsetParent !== null,
    top: r && r.height ? Math.round(r.top + scrollY) : null, hoejde: r ? Math.round(r.height) : null,
    helPaaFoersteSkaerm: r && r.height ? r.top >= 0 && r.bottom <= innerHeight : null,
    tekst: b && !b.hidden ? b.innerText.replace(/\s+/g, ' ').trim() : null,
    spoerg: sr ? { b: Math.round(sr.width), h: Math.round(sr.height), x: Math.round(sr.left), y: Math.round(sr.top + scrollY), overlapperKnap: ramt } : null,
    talY: tal ? Math.round(tal.top + scrollY) : null,
    foersteSvarY: svar ? Math.round(svar.top + scrollY) : null,
    skaermHoejde: innerHeight,
  }
}

const browser = await chromium.launch()
for (const { tag, ref } of UDG) {
  const dir = mkdtempSync(path.join(tmpdir(), `kritik-648-${tag}-`))
  execSync(`git -C "${MAT}" archive ${ref} | tar -x -C "${dir.replace(/\\/g, '/')}"`, { shell: 'bash' })
  res.ver[tag] = execSync(`git -C "${MAT}" rev-parse --short ${ref}`).toString().trim()
  const URL = pathToFileURL(path.join(dir, 'spil.html')).href
  for (const bredde of [390, 1280]) {
    const mobil = bredde < 500
    const nyCtx = async ({ set }) => {
      const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light', reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
      if (set) await ctx.addInitScript(() => localStorage.setItem('ganita:hhh-set', '1'))
      await ctx.route(/^https?:/, (r) => { net++; return r.abort() })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => res.fejl.push(`${tag} ${bredde}: ${e.message}`))
      return page
    }
    const skud = (page, navn, hel = false) => (hel && !mobil) ? null : page.screenshot({ path: path.join(HER, `M648-${tag}-${bredde}-${navn}.png`), fullPage: hel }) // hele siden kun paa 390
    const k = `${tag}-${bredde}`

    // 1) Den almindelige dag: gemt spil, forklaringen set foer.
    let page = await nyCtx({ set: true })
    await page.goto(URL)
    await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), START)
    await page.goto(URL)
    await page.waitForTimeout(500)
    const kortet = await page.evaluate(MAAL)
    await skud(page, '1-kortet')
    await skud(page, '1-kortet-hel', true)
    await page.locator('.quest-opgave-tekst').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    const opgave = await page.evaluate(MAAL)
    await skud(page, '2-opgave')
    await page.locator('#min-helt-knap').first().click()
    await page.waitForTimeout(400)
    await page.evaluate(() => scrollTo(0, 0))
    const helt = await page.evaluate(MAAL)
    await skud(page, '3-helten')
    await skud(page, '3-helten-hel', true)
    const tilbage = {}
    const findTilbage = () => page.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find((b) => /Tilbage/.test(b.innerText) && b.offsetParent); if (!t) return null; const r = t.getBoundingClientRect(); return { tekst: t.innerText.trim(), y: Math.round(r.top + scrollY), x: Math.round(r.left) } })
    tilbage['min-helt'] = await findTilbage()
    for (const [knap, id] of [['#journal-knap', 'journal'], ['#questbog-knap', 'questbog']]) {
      const t = page.locator('button, a').filter({ hasText: /Tilbage/ }).first()
      if (await t.count()) { await t.click(); await page.waitForTimeout(250) }
      if (await page.locator(knap).count()) { await page.locator(knap).first().click(); await page.waitForTimeout(300) }
      await page.evaluate(() => scrollTo(0, 0))
      tilbage[id] = await findTilbage()
    }
    res.skaerme[k] = { kortet, opgave, helt, tilbage }
    await page.context().close()

    // 2) Gemt spil, forklaringen aldrig set: den foerste dag efter 643 for alle, der allerede spiller.
    page = await nyCtx({ set: false })
    await page.goto(URL)
    await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), START)
    await page.goto(URL)
    await page.waitForTimeout(500)
    const h = await page.evaluate(HHH)
    if (h.vises) await skud(page, '4-hhh-foerste-gang')
    h.maal = await page.evaluate(MAAL)
    if (h.spoerg) {
      await page.locator('#hhh-forklaring-luk').click().catch(() => {})
      await page.locator('#min-helt-knap').click()
      await page.waitForTimeout(300)
      await page.locator('#hhh-spoerg').click()
      await page.waitForTimeout(200)
      h.minHelt = await page.evaluate(HHH)
      await skud(page, '4-hhh-min-helt-spoerg')
    }
    res.hhh[k] = h
    await page.context().close()

    // 3) En helt ny elev: tom browser -> Lav din figur -> Start eventyret.
    page = await nyCtx({ set: false })
    await page.goto(URL)
    await page.waitForTimeout(400)
    const ny = { opret: await page.evaluate(MAAL) }
    await page.fill('#op-navn', 'Tulle').catch(() => {})
    await page.locator('#op-udseender button').nth(2).click().catch(() => {})
    await page.locator('#op-start').click().catch(() => {})
    await page.waitForTimeout(600)
    ny.foersteSkaerm = await page.evaluate(MAAL)
    ny.hhh = await page.evaluate(HHH)
    ny.aabning = await page.evaluate(() => { const a = document.querySelector('.aabning'); if (!a) return null; const r = a.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), hoejde: Math.round(r.height) } })
    ny.flag = await page.evaluate(() => localStorage.getItem('ganita:hhh-set'))
    await skud(page, '6-ny-foerste-skaerm')
    // Genindlaes uden at trykke "Forstaaet": kommer forklaringen igen?
    await page.reload()
    await page.waitForTimeout(500)
    ny.efterGenindlaes = await page.evaluate(() => { const b = document.querySelector('#hhh-forklaring'); return b ? !b.hidden && b.offsetParent !== null : null })
    res.nyElev[k] = ny
    await page.context().close()
    console.log(k, 'kortet', kortet.skaerm.ord, 'ord', kortet.skaerm.tal, 'tal', kortet.skaerm.knapper, 'knapper,', kortet.skaerme, 'skaerme; helt', helt.skaerm.ord, '/', helt.side.ord, 'ord,', helt.skaerme, 'skaerme')
  }
  if (tag === 'efter') {
    const m = await import(pathToFileURL(path.join(dir, 'src/hhh-forklaring.js')).href)
    res.forklaring = m.HHH_FORKLARING.map((d) => ({ navn: d.navn, tekst: d.tekst, ord: m.antalOrd(d.tekst) }))
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await p.route(/^https?:/, (r) => { net++; return r.abort() })
    await p.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
    await p.waitForTimeout(300)
    res.laerer = await p.evaluate(() => [...document.querySelectorAll('#ark-hhh li')].map((li) => li.textContent.trim()))
    await p.close()
  }
}
await browser.close()
res.net = net
writeFileSync(path.join(HER, 'mat-648.json'), JSON.stringify(res, null, 2))
console.log('net', net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
