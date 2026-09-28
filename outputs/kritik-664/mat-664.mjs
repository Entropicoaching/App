// KRITIK 664, blok 1: matematikspillet efter Ganitas 658 (merget, main 04d25b3) og 660 (kun blok 1
// committet paa ordre-660 f78f354, ikke merget; blok 2 og 3 ligger ucommittet i Ganitas trae og er
// ikke maalt). Sammenlignet med 643 (main de17445), som ordren spoerger om ("mindre rodet efter 643?").
// Alle tre hentes med `git archive` til en midlertidig mappe; matematik-traeet roeres ikke.
// Headless Chromium (matematiks playwright), 390 touch (844 hoej, x2) og 1280 mus (900 hoej), uden net,
// uret og Math.random laast. Eleven er syntetisk ("Tulle", et fantasinavn). Kun maaling.
//   node outputs/kritik-664/mat-664.mjs     -> mat-664.json og M664-*.png
// A) De tre mest brugte skaerme (kortet oeverst, en opgave, Min helt) og Hoved/Haand/Hjerte, som i 648/656.
// B) MMORPG-foelelsen (658 og 660, med bevaegelse): et rigtigt svar i foerste forsoeg, et gaet (forkert,
//    saa rigtigt), et helt forloeb til nyt niveau, og Min helt bagefter. Pr. oejeblik: hvor mange ting
//    bevaeger sig (document.getAnimations + flyvere), hvad "+N" viser, og hvad der staar tilbage efter 2 s.
// C) Gaetteren mod den aerlige: spillets egen model (scripts/elev-model-420.mjs) over 150 opgaver.
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
const UDG = [{ tag: 'v643', ref: 'de17445' }, { tag: 'v658', ref: '04d25b3' }, { tag: 'v660', ref: 'f78f354' }]
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
const fremdrift = (a) => Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (a[id] ?? 0))]))
const START = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 2, niveauPoint: 0, erfaring: 30, hoved: 2, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fremdrift({ moellen: 1 }), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }
const STEDER = ['Møllen', 'Kirken', 'Sporvognen', 'Grusgraven', 'Landsbygaden']

let net = 0
const res = { ver: {}, skaerme: {}, hhh: {}, nyElev: {}, mmorpg: {}, model: {}, fejl: [] }

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

// Hvad bevaeger sig lige nu: CSS/Web-animationer i gang, flyvere og "+N" paa body, og deres tekst.
const BEVAEG = () => {
  const anim = document.getAnimations().filter((a) => a.playState === 'running')
  const flyv = [...document.querySelectorAll('.helt-slag, [class*="flyver"], [class*="flyder"]')].filter((e) => e.getClientRects().length)
  const navne = [...new Set(anim.map((a) => a.animationName || a.transitionProperty || a.constructor.name))]
  return { anim: anim.length, navne: navne.slice(0, 12), flyv: flyv.length, flyvTekst: flyv.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 6), banner: document.querySelector('.niveau-banner')?.innerText.replace(/\s+/g, ' ').trim() ?? null, scrollY: Math.round(scrollY) }
}
const norm = (t) => String(t ?? '').replace(/\s+/g, '').slice(0, 60)

const browser = await chromium.launch()
for (const { tag, ref } of UDG) {
  const dir = mkdtempSync(path.join(tmpdir(), `kritik-664-${tag}-`))
  execSync(`git -C "${MAT}" archive ${ref} | tar -x -C "${dir.replace(/\\/g, '/')}"`, { shell: 'bash' })
  res.ver[tag] = execSync(`git -C "${MAT}" rev-parse --short ${ref}`).toString().trim()
  const URL = pathToFileURL(path.join(dir, 'spil.html')).href
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
  // Facit som Ganitas scripts/ordre-660.mjs: alle opgaver fra spillets egne moduler, samme salt.
  const quest = await imp('src/spil-quest.js')
  quest.saetSpilSalt(T % 1000003)
  const bog = await imp('src/questbog.js')
  const LISTE = []
  for (const kaede of Object.values(quest.QUEST_BANK)) for (const q of kaede) for (let r = 0; r < 8; r++) LISTE.push(...q.lavOpgaver(r))
  for (const q of bog.BOG_QUESTS ?? []) for (let r = 0; r < 8; r++) { try { LISTE.push(...bog.lavBogQuest(q.id).lavOpgaver(r)) } catch {} }
  const rigtigIndeks = async (page) => {
    const t = (await page.locator('.quest-opgave-tekst').first().innerText()).replace(/\s+/g, ' ').trim()
    const knapper = (await page.locator('#quest-svar button').allInnerTexts()).map(norm).join('|')
    const ens = LISTE.filter((x) => norm(x.tekst) === norm(t))
    const o = ens.find((x) => x.svarmuligheder.map((s) => norm(s.tekst)).join('|') === knapper) ?? ens[0]
    const i = o ? o.svarmuligheder.findIndex((s) => s.korrekt) : -1
    if (i < 0) throw new Error(`intet facit: ${t}`)
    return i
  }
  const synlig = async (page, sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible())

  for (const bredde of [390, 1280]) {
    const mobil = bredde < 500
    const nyCtx = async ({ set, bevaegelse = false }) => {
      const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light', reducedMotion: bevaegelse ? 'no-preference' : 'reduce' })
      await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
      if (set) await ctx.addInitScript(() => localStorage.setItem('ganita:hhh-set', '1'))
      await ctx.route(/^https?:/, (r) => { net++; return r.abort() })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => res.fejl.push(`${tag} ${bredde}: ${e.message}`))
      return page
    }
    const skud = (page, navn, hel = false) => (hel && !mobil) ? null : page.screenshot({ path: path.join(HER, `M664-${tag}-${bredde}-${navn}.png`), fullPage: hel })
    const k = `${tag}-${bredde}`
    const medSpil = async (page) => { await page.goto(URL); await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), START); await page.goto(URL); await page.waitForTimeout(500) }
    const billeder = tag !== 'v658'

    // A1) Den almindelige dag: gemt spil, forklaringen set foer.
    let page = await nyCtx({ set: true })
    await medSpil(page)
    const kortet = await page.evaluate(MAAL)
    kortet.steder = await page.evaluate(STEDSYN, STEDER)
    if (billeder) { await skud(page, '1-kortet'); await skud(page, '1-kortet-hel', true) }
    let tryk = null
    if (await page.locator('#til-opgaven').count()) {
      await page.locator('#til-opgaven').click()
      await page.waitForTimeout(400)
      tryk = await page.evaluate(() => {
        const sv = [...document.querySelectorAll('#quest-svar button')].map((b) => b.getBoundingClientRect())
        const helt = document.querySelector('#figur-token')?.getBoundingClientRect()
        return { scrollY: Math.round(scrollY), svarPaaSkaermen: sv.length > 0 && sv.every((r) => r.top >= 0 && r.bottom <= innerHeight), heltPaaSkaermen: helt ? helt.top >= 0 && helt.bottom <= innerHeight : null }
      })
    } else {
      // 643 har ingen "Din opgave nu": eleven ruller selv ned til opgaven (som i 656).
      await page.locator('.quest-opgave-tekst').first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
    }
    const opgave = await page.evaluate(MAAL)
    if (billeder) await skud(page, '2-opgave')
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator('#min-helt-knap').first().click()
    await page.waitForTimeout(400)
    await page.evaluate(() => scrollTo(0, 0))
    const helt = await page.evaluate(MAAL)
    if (billeder) { await skud(page, '3-helten'); await skud(page, '3-helten-hel', true) }
    res.skaerme[k] = { kortet, tryk, opgave, helt }
    await page.context().close()

    // A2) Gemt spil, forklaringen aldrig set.
    page = await nyCtx({ set: false })
    await medSpil(page)
    res.hhh[k] = await page.evaluate(HHH)
    if (res.hhh[k].vises && billeder) await skud(page, '4-hhh-foerste-gang')
    await page.context().close()

    // A3) En helt ny elev: tom browser -> Lav din figur -> Start eventyret.
    page = await nyCtx({ set: false })
    await page.goto(URL)
    await page.waitForTimeout(400)
    await page.fill('#op-navn', 'Tulle').catch(() => {})
    await page.locator('#op-udseender button').nth(2).click().catch(() => {})
    await page.locator('#op-start').click().catch(() => {})
    await page.waitForTimeout(600)
    res.nyElev[k] = { foersteSkaerm: await page.evaluate(MAAL), hhh: await page.evaluate(HHH), steder: await page.evaluate(STEDSYN, STEDER) }
    if (billeder) await skud(page, '6-ny-foerste-skaerm')
    await page.context().close()
    // Min helts "?" (Hjertes forklaring bag spoergsmaalstegnet), som eleven finder den.
    if (tag !== 'v643') {
      page = await nyCtx({ set: true })
      await medSpil(page)
      await page.locator('#min-helt-knap').first().click()
      await page.waitForTimeout(400)
      const sp = page.locator('#hhh-spoerg')
      if (await sp.count() && await sp.first().isVisible()) {
        await sp.first().click()
        await page.waitForTimeout(300)
        res.hhh[k].minHeltSpoerg = await page.evaluate(HHH)
        if (billeder) await skud(page, '5-hhh-bag-spoerg')
      }
      await page.context().close()
    }

    // B) MMORPG-foelelsen, med bevaegelse (kun 658 og 660).
    if (tag === 'v643') continue
    const mm = {}
    const film = async (page, navn, ms, skudVed) => {
      const ud = []
      let forrige = 0
      for (const t of ms) {
        await page.waitForTimeout(t - forrige)
        forrige = t
        const b = await page.evaluate(BEVAEG)
        b.ms = t
        ud.push(b)
        if (skudVed.includes(t) && tag === 'v660') await page.screenshot({ path: path.join(HER, `M664-${tag}-${bredde}-${navn}-${t}ms.png`) })
      }
      return ud
    }
    const TIDER = [0, 120, 350, 700, 1000, 2200]
    // B1) Et rigtigt svar i foerste forsoeg, efter "Din opgave nu".
    page = await nyCtx({ set: true, bevaegelse: true })
    await medSpil(page)
    if (await synlig(page, '#til-opgaven')) { await page.locator('#til-opgaven').click(); await page.waitForTimeout(900) }
    mm.foerSvar = await page.evaluate(() => { const r = document.querySelector('#figur-token')?.getBoundingClientRect(); const s = document.querySelector('#quest-svar')?.getBoundingClientRect(); return { heltTop: r ? Math.round(r.top) : null, heltPaaSkaermen: r ? r.top >= 0 && r.bottom <= innerHeight : null, svarBund: s ? Math.round(s.bottom) : null, h: innerHeight } })
    if (tag === 'v660') await page.screenshot({ path: path.join(HER, `M664-${tag}-${bredde}-B1-foer-svar.png`) })
    let ri = await rigtigIndeks(page)
    await page.locator(`#quest-svar button[data-i="${ri}"]`).click()
    mm.rigtigt = await film(page, 'B1-rigtigt', TIDER, [120, 350, 1000])
    await page.context().close()

    // B2) Gaetteren: foerst en forkert knap, saa den rigtige.
    page = await nyCtx({ set: true, bevaegelse: true })
    await medSpil(page)
    if (await synlig(page, '#til-opgaven')) { await page.locator('#til-opgaven').click(); await page.waitForTimeout(900) }
    ri = await rigtigIndeks(page)
    const antal = await page.locator('#quest-svar button').count()
    const forkert = [...Array(antal).keys()].find((i) => i !== ri)
    await page.locator(`#quest-svar button[data-i="${forkert}"]`).click()
    mm.forkert = await film(page, 'B2-forkert', [0, 120, 350, 1000], [350])
    if (await synlig(page, `#quest-svar button[data-i="${ri}"]`)) {
      await page.locator(`#quest-svar button[data-i="${ri}"]`).click()
      mm.rigtigtEfterGaet = await film(page, 'B2-rigtigt-efter-gaet', TIDER, [350])
    }
    await page.context().close()

    // B3) Et helt forloeb til nyt niveau, derefter Min helt ("Siden sidst").
    page = await nyCtx({ set: true, bevaegelse: true })
    await medSpil(page)
    if (await synlig(page, '#til-opgaven')) { await page.locator('#til-opgaven').click(); await page.waitForTimeout(700) }
    const gemt = () => page.evaluate(() => JSON.parse(localStorage.getItem('ganita:spil')))
    const niv0 = (await gemt()).figur.niveau
    let svar = 0
    for (let i = 0; i < 40; i++) {
      // Eleven trykker sig frem (Videre, Fortsaet), men lukker ikke selv "Niveau op!".
      for (let j = 0; j < 6; j++) {
        if (await synlig(page, '#klaret-fortsaet')) { await page.locator('#klaret-fortsaet').click(); await page.waitForTimeout(200); continue }
        if (await synlig(page, '#quest-svar button')) break
        if (await synlig(page, '#quest-videre')) { await page.locator('#quest-videre').click(); await page.waitForTimeout(150); continue }
      }
      if (!(await synlig(page, '#quest-svar button'))) break
      ri = await rigtigIndeks(page)
      await page.locator(`#quest-svar button[data-i="${ri}"]`).click()
      svar++
      const steget = (await gemt()).figur.niveau > niv0
      if (steget) mm.niveauOp = await film(page, 'B3-niveau-op', TIDER, [120, 700, 2200])
      if (await synlig(page, '#quest-videre')) await page.locator('#quest-videre').click()
      if (steget || await synlig(page, '.niveau-banner')) {
        // Erfaringen gives ved "Videre"; "Niveau op!" kommer foerst da.
        mm.efterVidere = await film(page, 'B3b-efter-videre', TIDER, [120, 700, 2200])
        mm.efterVidereMaal = await page.evaluate(() => { const b = document.querySelector('.niveau-banner')?.getBoundingClientRect(); const h = document.querySelector('#figur-token')?.getBoundingClientRect(); return { banner: b ? { top: Math.round(b.top), bund: Math.round(b.bottom), paaSkaermen: b.top >= 0 && b.bottom <= innerHeight } : null, heltPaaSkaermen: h ? h.top >= 0 && h.bottom <= innerHeight : null, bannerTekst: document.querySelector('.niveau-banner')?.innerText.replace(/\s+/g, ' ').trim() ?? null } })
        mm.efterVidereSkaerm = await page.evaluate(MAAL)
        break
      }
      await page.waitForTimeout(1100)
    }
    mm.forloeb = { svar, niveau: `${niv0} -> ${(await gemt()).figur.niveau}` }
    mm.efterNiveauOp = await page.evaluate(MAAL)
    for (let j = 0; j < 4; j++) {
      if (await synlig(page, '#niveau-banner-luk')) { await page.locator('#niveau-banner-luk').click(); await page.waitForTimeout(100) }
      if (await synlig(page, '#klaret-fortsaet')) { await page.locator('#klaret-fortsaet').click(); await page.waitForTimeout(200) }
    }
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator('#min-helt-knap').first().click()
    mm.minHelt = await film(page, 'B4-min-helt', [0, 350, 1000, 2200], [1000])
    mm.minHeltMaal = await page.evaluate(MAAL)
    mm.sidenSidst = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.childElementCount).map((e) => e.textContent).find((t) => /Siden sidst/.test(t)) ?? null)
    await page.context().close()
    res.mmorpg[k] = mm
    console.log(k, 'rigtigt', JSON.stringify(mm.rigtigt.map((b) => [b.ms, b.anim, b.flyv, b.flyvTekst.join(',')])), 'niveau', mm.forloeb.niveau)
  }
  // C) Gaetteren mod den aerlige med spillets egen model (findes i 658 og 660).
  if (tag !== 'v643') {
    try {
      const m = await imp('scripts/elev-model-420.mjs')
      const salte = Array.from({ length: 200 }, (_, i) => i + 1)
      res.model[tag] = { gaetter: m.maal({ salte, elev: 'gaetter' }), regner75: m.maal({ salte, elev: { p: 0.75 } }), regner90: m.maal({ salte, elev: { p: 0.9 } }) }
    } catch (e) { res.model[tag] = { fejl: String(e.message).slice(0, 200) } }
  }
}
await browser.close()
res.net = net
writeFileSync(path.join(HER, 'mat-664.json'), JSON.stringify(res, null, 2))
console.log('net', net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
