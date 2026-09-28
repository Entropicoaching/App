// KRITIK 656, blok 1: matematikspillet foer og efter Ganitas 651 (Marc: "stadig lidt rodet",
// Hoved/Haand/Hjerte uforklaret). Foer = matematik main de17445 (643 merget). Efter = main 6e83254
// (651 merget). Begge hentes med `git archive` til en midlertidig mappe; matematik-traeet roeres ikke.
// Headless Chromium (matematiks playwright), 390 touch (844 hoej, x2) og 1280 mus (900 hoej), uden net,
// uret laast. Eleven er syntetisk ("Tulle", et fantasinavn). Kun maaling.
//   node outputs/kritik-656/mat-656.mjs            -> mat-656.json og M656-*.png
// Maalt pr. skaerm (kortet oeverst, en opgave, Min helt), som i 648:
//   - foerste skaerm (uden at rulle): ord, tal, knapper; hele siden: skaerme, ord, tal, knapper
//   - "Din opgave nu" (651): findes, y, tekst, og om et tryk bringer svarknapperne paa skaermen
// Hoved/Haand/Hjerte: gemt spil der aldrig har set forklaringen, en helt ny elev (tom browser ->
// Start eventyret -> Forstaaet), "?" (synlig og trykflade), ordene, og hvilke stednavne i forklaringen
// en elev paa niveau 2 kan se paa sin foerste skaerm.
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
const UDG = [{ tag: 'foer', ref: 'de17445' }, { tag: 'efter', ref: '6e83254' }]
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
const fremdrift = (a) => Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (a[id] ?? 0))]))
// Samme gemte spil som 648 (Moellens forloeb 1 mestret, niveau 2).
const START = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 2, niveauPoint: 0, erfaring: 30, hoved: 2, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fremdrift({ moellen: 1 }), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }
const STEDER = ['Møllen', 'Kirken', 'Sporvognen', 'Grusgraven', 'Landsbygaden']

let net = 0
const res = { ver: {}, skaerme: {}, hhh: {}, nyElev: {}, fejl: [] }

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
  const til = document.querySelector('#til-opgaven')
  const tr = til?.getBoundingClientRect()
  return {
    skaerm: tael(true), side: tael(false),
    skaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
    vandret: document.documentElement.scrollWidth > innerWidth,
    scrollY: Math.round(scrollY),
    foersteSvarY: svar ? Math.round(svar.top + scrollY) : null,
    opgaveY: opg ? Math.round(opg.top + scrollY) : null,
    tilOpgaven: tr ? { y: Math.round(tr.top + scrollY), bund: Math.round(tr.bottom + scrollY), h: Math.round(tr.height), b: Math.round(tr.width), tekst: til.innerText.replace(/\s+/g, ' ').trim() } : null,
    byNaeste: document.querySelector('.by-naeste')?.innerText.trim() ?? null,
  }
}
const HHH = () => {
  const b = document.querySelector('#hhh-forklaring')
  const s = document.querySelector('#hhh-spoerg')
  const r = b?.getBoundingClientRect()
  const sr = s?.getBoundingClientRect()
  const efter = s ? getComputedStyle(s, '::after') : null
  const tal = document.querySelector('.spil-egenskaber')?.getBoundingClientRect()
  return {
    findes: !!b, vises: !!b && !b.hidden && b.offsetParent !== null,
    top: r && r.height ? Math.round(r.top + scrollY) : null, hoejde: r ? Math.round(r.height) : null,
    helPaaSkaermen: r && r.height ? r.top >= 0 && r.bottom <= innerHeight : null,
    tekst: b && !b.hidden ? b.innerText.replace(/\s+/g, ' ').trim() : null,
    spoerg: sr ? { b: Math.round(sr.width), h: Math.round(sr.height), trykflade: efter && efter.content !== 'none' ? Math.round(sr.width) - 2 * parseFloat(efter.left) : Math.round(sr.width) } : null,
    talY: tal ? Math.round(tal.top + scrollY) : null,
    scrollY: Math.round(scrollY),
  }
}
// Hvilke stednavne staar synligt paa siden (kortets maerkater og tekst), uden forklaringen selv?
const STEDSYN = (steder) => {
  const b = document.querySelector('#hhh-forklaring')
  const tekst = [...document.querySelectorAll('body *')].filter((e) => !b?.contains(e) && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 || e.tagName === 'text') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent).join(' ')
  return Object.fromEntries(steder.map((s) => [s, tekst.includes(s)]))
}

const browser = await chromium.launch()
for (const { tag, ref } of UDG) {
  const dir = mkdtempSync(path.join(tmpdir(), `kritik-656-${tag}-`))
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
    const skud = (page, navn, hel = false) => (hel && !mobil) ? null : page.screenshot({ path: path.join(HER, `M656-${tag}-${bredde}-${navn}.png`), fullPage: hel })
    const k = `${tag}-${bredde}`

    // 1) Den almindelige dag: gemt spil, forklaringen set foer.
    let page = await nyCtx({ set: true })
    await page.goto(URL)
    await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), START)
    await page.goto(URL)
    await page.waitForTimeout(500)
    const kortet = await page.evaluate(MAAL)
    kortet.steder = await page.evaluate(STEDSYN, STEDER)
    await skud(page, '1-kortet')
    await skud(page, '1-kortet-hel', true)
    let tryk = null
    if (await page.locator('#til-opgaven').count()) {
      await page.locator('#til-opgaven').click()
      await page.waitForTimeout(400)
      tryk = await page.evaluate(() => {
        const sv = [...document.querySelectorAll('#quest-svar button')].map((b) => b.getBoundingClientRect())
        const opg = document.querySelector('.quest-opgave-tekst')?.getBoundingClientRect()
        return { scrollY: Math.round(scrollY), svarPaaSkaermen: sv.length > 0 && sv.every((r) => r.top >= 0 && r.bottom <= innerHeight), opgaveTop: opg ? Math.round(opg.top) : null, fokus: document.activeElement?.innerText?.trim().slice(0, 30) ?? null }
      })
      await skud(page, '2-efter-tryk')
    } else {
      await page.locator('.quest-opgave-tekst').first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
    }
    const opgave = await page.evaluate(MAAL)
    await skud(page, '2-opgave')
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator('#min-helt-knap').first().click()
    await page.waitForTimeout(400)
    await page.evaluate(() => scrollTo(0, 0))
    const helt = await page.evaluate(MAAL)
    await skud(page, '3-helten')
    await skud(page, '3-helten-hel', true)
    res.skaerme[k] = { kortet, tryk, opgave, helt }
    await page.context().close()

    // 2) Gemt spil, forklaringen aldrig set.
    page = await nyCtx({ set: false })
    await page.goto(URL)
    await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), START)
    await page.goto(URL)
    await page.waitForTimeout(500)
    const h = await page.evaluate(HHH)
    h.flagFoerLuk = await page.evaluate(() => localStorage.getItem('ganita:hhh-set'))
    h.steder = await page.evaluate(STEDSYN, STEDER)
    if (h.vises) await skud(page, '4-hhh-foerste-gang')
    h.maal = await page.evaluate(MAAL)
    res.hhh[k] = h
    await page.context().close()

    // 3) En helt ny elev: tom browser -> Lav din figur -> Start eventyret -> Forstaaet.
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
    ny.steder = await page.evaluate(STEDSYN, STEDER)
    ny.flag = await page.evaluate(() => localStorage.getItem('ganita:hhh-set'))
    await skud(page, '6-ny-foerste-skaerm')
    await page.reload()
    await page.waitForTimeout(500)
    ny.efterGenindlaes = await page.evaluate(() => { const b = document.querySelector('#hhh-forklaring'); return b ? !b.hidden && b.offsetParent !== null : null })
    if (await page.locator('#hhh-forklaring-luk').isVisible().catch(() => false)) {
      // Efter genindlaesning ruller Forstaaet ikke til Moelleren (kun lige efter Start); maal begge veje:
      await page.context().close()
      page = await nyCtx({ set: false })
      await page.goto(URL)
      await page.waitForTimeout(400)
      await page.fill('#op-navn', 'Tulle').catch(() => {})
      await page.locator('#op-udseender button').nth(2).click().catch(() => {})
      await page.locator('#op-start').click().catch(() => {})
      await page.waitForTimeout(600)
      await page.locator('#hhh-forklaring-luk').click()
      await page.waitForTimeout(500)
      ny.efterForstaaet = await page.evaluate(() => {
        const a = document.querySelector('.aabning')?.getBoundingClientRect()
        const til = document.querySelector('#til-opgaven')?.getBoundingClientRect()
        return { scrollY: Math.round(scrollY), aabningTop: a ? Math.round(a.top) : null, flag: localStorage.getItem('ganita:hhh-set'), tilOpgavenPaaSkaermen: til ? til.bottom > 0 && til.top < innerHeight : null }
      })
      ny.efterForstaaetMaal = await page.evaluate(MAAL)
      await skud(page, '7-ny-efter-forstaaet')
    }
    res.nyElev[k] = ny
    await page.context().close()
    console.log(k, 'kortet', kortet.skaerm.ord, 'ord', kortet.skaerm.tal, 'tal', kortet.skaerm.knapper, 'knapper,', kortet.skaerme, 'skaerme; til-opgaven', kortet.tilOpgaven?.y, '; helt', helt.skaerm.ord, '/', helt.side.ord)
  }
  const m = await import(pathToFileURL(path.join(dir, 'src/hhh-forklaring.js')).href)
  res[`forklaring-${tag}`] = m.HHH_FORKLARING.map((d) => ({ navn: d.navn, tekst: d.tekst, ord: m.antalOrd ? m.antalOrd(d.tekst) : d.tekst.split(/\s+/).length }))
  if (tag === 'efter') {
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
writeFileSync(path.join(HER, 'mat-656.json'), JSON.stringify(res, null, 2))
console.log('net', net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
