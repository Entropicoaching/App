// Kritik 525, blok 1: matematikspillet som en elev i 5. klasse i 30 minutter.
//
//   node outputs/kritik-525/elev-525.mjs            (390 og 1280 px)
//
// Spillet er Ganitas `main` (4bdda17, 505 merget) hentet med `git archive` til en
// midlertidig mappe; matematik-traeet (hvor Ganita arbejder paa liv-og-hak) roeres ikke.
// Eleven er syntetisk ("Tulle", et fantasinavn). Hun
//   - starter fra en tom browser (Lav din figur -> Start eventyret),
//   - svarer rigtigt i foerste forsoeg med 70 % (andet forsoeg 60 %, tredje 50 %),
//     trukket af en fast terning (samme elev paa begge bredder),
//   - to udgaver af samme elev (samme terning):
//     'travl': svarer paa den opgave, der staar i panelet, og ruller forbi kortet over den;
//     'foelger': laeser kortet efter et forloeb og trykker paa dets primaere knap
//       ("Hjaelp Ane"), ellers paa et "!" paa kortet, naar hun er mellem to opgaver,
//   - begge gaar til et andet aabent sted, naar der ikke er mere at lave.
// Tiden er en model, ikke et stopur: 0,4 s pr. ord, hun laeser (170 ord/min, en langsom
// laeser i 5. klasse), 10 s at taenke pr. opgave, 2 s pr. tryk og gaatur, 3 s pr. rul
// paa 390, naar det, hun skal trykke paa, ligger uden for skaermen. Hun spiller til
// modellens ur siger 30 minutter.
// Facit kommer fra spillets egne generatorer med laast salt (som Ganitas facit-479.mjs).
// Bagefter: Min helt, journalen, questbogen og kortet ses som hun ville se dem, og en
// anden "dag" med en gemt tilstand, hvor hun har spillet laenge nok til Bigaarden.
// Skriver elev-525.json og E-*.png i denne mappe.
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const UD = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const REF = process.env.MAT_REF || 'main'
const SPIL = mkdtempSync(path.join(tmpdir(), 'kritik-525-'))
execSync(`git -C "${MAT}" archive ${REF} | tar -x -C "${SPIL.replace(/\\/g, '/')}"`, { shell: 'bash' })
const hash = execSync(`git -C "${MAT}" rev-parse --short ${REF}`).toString().trim()
const imp = (f) => import(pathToFileURL(path.join(SPIL, f)).href)

// Fast tid: 28. sep 2026 kl. 10 (hoest, dag). Saltet er spillets eget: Date.now() % 1000003.
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const quest = await imp('src/spil-quest.js')
quest.saetSpilSalt(T % 1000003)
const bog = await imp('src/questbog.js')
const LISTE = []
for (const [sted, kaede] of Object.entries(quest.QUEST_BANK)) for (const q of kaede) for (let r = 0; r < 8; r++) LISTE.push(...q.lavOpgaver(r))
for (const q of bog.BOG_QUESTS) { try { for (let r = 0; r < 8; r++) LISTE.push(...bog.lavBogQuest(q.id).lavOpgaver(r)) } catch {} }
const norm = (t) => String(t ?? '').replace(/\s+/g, '').slice(0, 60)
const ord = (t) => String(t ?? '').split(/\s+/).filter(Boolean).length

function terning(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const P = [0.7, 0.6, 0.5]
const SEK = { ord: 0.4, taenk: 10, tryk: 2, rul: 3 }
const GRAENSE = 30 * 60

async function nySide(browser, bredde, gemt = null) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light' })
  await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
  await ctx.route(/^https?:/, (r) => r.abort())
  const page = await ctx.newPage()
  page.sidefejl = []
  page.on('pageerror', (e) => page.sidefejl.push(e.message))
  const url = pathToFileURL(path.join(SPIL, 'spil.html')).href
  await page.goto(url)
  if (gemt) { await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), gemt); await page.goto(url) }
  await page.waitForTimeout(400)
  return page
}

const synlig = async (page, sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible())
const tekstAf = async (page, sel) => ((await synlig(page, sel)) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim() : '')
// Ligger elementet uden for skaermen, skal hun rulle (tael det), foer hun kan trykke.
async function rulTil(page, loc, ur) {
  const i = await loc.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight })
  if (i) { ur.rul++; ur.s += SEK.rul }
  await loc.scrollIntoViewIfNeeded()
}

async function spil(browser, bredde, variant) {
  const rnd = terning(525)
  const page = await nySide(browser, bredde)
  const ur = { s: 0, rul: 0 }
  const log = []
  const haend = (art, data = {}) => log.push({ t: Math.round(ur.s), art, ...data })
  const billeder = []
  const skud = async (navn, sel = null) => {
    const fil = `E-${variant}-${bredde}-${navn}.png`
    if (sel && (await synlig(page, sel))) await page.locator(sel).first().screenshot({ path: path.join(UD, fil) })
    else await page.screenshot({ path: path.join(UD, fil), fullPage: false })
    billeder.push(fil)
  }

  // Lav din figur
  const opret = await tekstAf(page, 'body')
  ur.s += ord(opret) * SEK.ord
  await page.fill('#op-navn', 'Tulle'); ur.s += 8
  await page.locator('#op-udseender button').nth(2).click(); ur.s += SEK.tryk
  await skud('00-opret')
  await page.locator('#op-start').click(); ur.s += SEK.tryk
  await page.waitForTimeout(500)
  const foersteSkaerm = await page.evaluate(() => {
    const o = document.querySelector('.quest-opgave-tekst')?.getBoundingClientRect()
    return { opgaveTop: o ? Math.round(o.top + scrollY) : null, skaermHoejde: innerHeight, sideHoejde: document.documentElement.scrollHeight }
  })
  haend('start', foersteSkaerm)
  await skud('01-foerste-skaerm')

  const opg = { antal: 0, rigtigeFoerste: 0, loesning: 0, foresloeg: 0, ukendt: 0, ord: 0 }
  const historieOrd = { tak: 0, hvil: 0, replik: 0, mestring: 0, bogPanel: 0, niveau: 0 }
  let sidsteOpgaveTekst = null
  let forsoeg = 0
  let skridt = 0
  let fastloeb = 0
  let naesteFejl = null
  const sete = new Set()
  let efterForloeb = false
  // Hvor staar "!" paa kortet, og kan hun se det uden at rulle?
  const udraabStatus = () => page.evaluate(() => [...document.querySelectorAll('.bog-udraab')].map((e) => { const r = e.getBoundingClientRect(); return { quest: e.dataset.quest, iSyne: r.bottom > 0 && r.top < innerHeight, px: Math.round(r.top) } }).concat([{ questbogKnap: document.querySelector('#questbog-knap')?.innerText.replace(/\s+/g, ' ').trim() }]))
  const set1 = (noegle) => { if (sete.has(noegle)) return false; sete.add(noegle); return true }

  async function trykUdraab() {
    const u = page.locator('.bog-udraab').first()
    const id = await u.getAttribute('data-quest')
    haend('ser-udraab', { quest: id })
    await rulTil(page, u, ur); await u.click({ force: true }); ur.s += SEK.tryk
    await page.waitForTimeout(300)
    const bogTekst = await tekstAf(page, '#sted-panel .bog-quest, .questbog, #sted-panel')
    const n = Math.min(ord(bogTekst), 80)
    historieOrd.bogPanel += n; ur.s += n * SEK.ord
    if (set1('skud-bog')) await skud('30-questbog', null)
    const hjaelp = page.locator(`.bog-hjaelp[data-quest="${id}"], #bogsted-hjaelp`)
    if (await hjaelp.count()) {
      await rulTil(page, hjaelp.first(), ur); await hjaelp.first().click(); ur.s += SEK.tryk + 1.5
      await page.waitForTimeout(1700)
      const panel = await tekstAf(page, '#sted-panel')
      haend('hjaelper', { quest: id, panel: panel.slice(0, 400) })
      if (set1('skud-quest')) await skud('31-quest-i-panelet', '#sted-panel')
      return true
    }
    haend('udraab-uden-hjaelp', { quest: id, tekst: bogTekst.slice(0, 200) })
    if (await synlig(page, '#bog-tilbage')) { await page.locator('#bog-tilbage').click(); ur.s += SEK.tryk }
    return false
  }
  while (ur.s < GRAENSE && skridt++ < 900) {
    await page.waitForTimeout(60)
    // Niveau op-banneret
    if (await synlig(page, '#niveau-banner-luk')) {
      const t = await tekstAf(page, '.niveau-banner')
      historieOrd.niveau += ord(t); ur.s += ord(t) * SEK.ord
      haend('niveau-op', { tekst: t })
      if (set1('skud-niveau')) await skud('20-niveau-op', '.niveau-banner')
      await rulTil(page, page.locator('#niveau-banner-luk'), ur)
      await page.locator('#niveau-banner-luk').click(); ur.s += SEK.tryk
      continue
    }
    // Takkekort, hvil, mestringsbesked og replik laeses, naar de dukker op.
    for (const [sel, art] of [['.bog-tak', 'tak'], ['.bog-hvile', 'hvil'], ['.quest-mestring, .mestring-besked', 'mestring'], ['.klaret-replik, .quest-klaret', 'replik'], ['.by-vaagner', 'byVaagner']]) {
      if (await synlig(page, sel)) {
        const t = await tekstAf(page, sel)
        if (set1(`${art}:${t}`)) {
          historieOrd[art] = (historieOrd[art] ?? 0) + ord(t); ur.s += ord(t) * SEK.ord
          haend(art, { tekst: t, udraab: art === 'replik' || art === 'tak' ? await udraabStatus() : undefined })
          if (art === 'replik' || art === 'tak' || art === 'hvil') efterForloeb = true
          if (set1(`skud-${art}`)) await skud(`2x-${art}`, sel)
        }
      }
    }
    // Den nysgerrige: efter et forloeb gaar hun efter et "!", hvis der er et.
    if (variant === 'foelger' && efterForloeb && (await synlig(page, '#klaret-hjaelp'))) {
      efterForloeb = false
      const k = page.locator('#klaret-hjaelp')
      const id = await k.getAttribute('data-quest')
      if (set1('skud-klaret-panel')) await skud('25-kort-efter-forloeb', '#sted-panel')
      haend('klaret-hjaelp', { quest: id, iSyne: await k.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }) })
      await rulTil(page, k, ur); await k.click(); ur.s += SEK.tryk + 1.5
      await page.waitForTimeout(1700)
      haend('hjaelper', { quest: id, panel: (await tekstAf(page, '#sted-panel')).slice(0, 400) })
      if (set1('skud-quest')) await skud('31-quest-i-panelet', '#sted-panel')
      continue
    }
    if (variant === 'foelger' && efterForloeb && (await page.locator('.bog-udraab').count())) {
      efterForloeb = false
      if (await trykUdraab()) continue
    }
    if (variant === 'travl' && efterForloeb && set1('skud-travl-panel')) await skud('25-kort-efter-forloeb', '#sted-panel')
    efterForloeb = false
    // En opgave med svarknapper
    if (await synlig(page, '#quest-svar button')) {
      const tekst = await tekstAf(page, '.quest-opgave-tekst')
      if (tekst !== sidsteOpgaveTekst) {
        sidsteOpgaveTekst = tekst; forsoeg = 0; opg.antal++
        opg.ord += ord(tekst); ur.s += ord(tekst) * SEK.ord + SEK.taenk
        const panel = await tekstAf(page, '#sted-panel')
        const hvem = (await tekstAf(page, '#sted-panel .sted-under')) || ''
        haend('opgave', { nr: opg.antal, tekst: tekst.slice(0, 140), panel: panel.slice(0, 160), hvem })
        const igen = (await page.locator('#sted-panel .quest-besked--hint').allInnerTexts()).find((x) => /Du kom igennem/.test(x))
        if (igen && set1(`mestring:${opg.antal}`)) {
          historieOrd.mestring += ord(igen); ur.s += ord(igen) * SEK.ord
          haend('samme-forloeb-igen', { tekst: igen.replace(/\s+/g, ' ') })
          if (set1('skud-igen')) await skud('11-samme-forloeb-igen', '#sted-panel')
        }
        if (opg.antal === 1) await skud('02-foerste-opgave', '#sted-panel')
      }
      const knapper = (await page.locator('#quest-svar button').allInnerTexts()).map(norm).join('|')
      const ens = LISTE.filter((x) => norm(x.tekst) === norm(tekst))
      const o = ens.find((x) => x.svarmuligheder.map((s) => norm(s.tekst)).join('|') === knapper) ?? ens[0]
      const rigtig = o ? o.svarmuligheder.findIndex((s) => s.korrekt) : -1
      const n = await page.locator('#quest-svar button').count()
      let valg
      if (rigtig < 0) { opg.ukendt++; valg = 0 } else if (rnd() < P[Math.min(forsoeg, 2)]) valg = rigtig
      else { const forkerte = [...Array(n).keys()].filter((i) => i !== rigtig); valg = forkerte[Math.floor(rnd() * forkerte.length)] }
      if (forsoeg === 0 && valg === rigtig) opg.rigtigeFoerste++
      forsoeg++; opg.foresloeg++
      const knap = page.locator(`#quest-svar button[data-i="${valg}"]`)
      await rulTil(page, knap, ur)
      await knap.click(); ur.s += SEK.tryk
      await page.waitForTimeout(80)
      if (await synlig(page, '.quest-besked--hint')) {
        const h = await tekstAf(page, '.quest-besked--hint'); ur.s += ord(h) * SEK.ord
        if (set1('skud-hint')) await skud('10-hint', '#sted-panel')
        if (!naesteFejl) naesteFejl = h
      }
      if (await synlig(page, '.quest-besked--loesning')) { opg.loesning++; haend('loesning', { tekst: (await tekstAf(page, '.quest-besked--loesning')).slice(0, 160) }) }
      continue
    }
    if (await synlig(page, '#quest-videre')) {
      const v = page.locator('#quest-videre'); await rulTil(page, v, ur); await v.click(); ur.s += SEK.tryk; continue
    }
    // Mellem to opgaver: et "!" paa kortet?
    if ((await page.locator('.bog-udraab').count()) && (await trykUdraab())) continue
    // Takkekortets/stedets knapper, der foerer videre
    for (const sel of ['#bogsted-til-sted', '#bog-tilbage', '#min-helt-tilbage', '#journal-tilbage']) {
      if (await synlig(page, sel)) { await page.locator(sel).click(); ur.s += SEK.tryk; await page.waitForTimeout(1600); break }
    }
    if (await synlig(page, '#quest-svar button')) continue
    // Intet at svare paa her: gaa til et andet aabent sted.
    const steder = await page.evaluate(() => [...document.querySelectorAll('#kort-steder button, .kort-steder button')].map((b, i) => ({ i, t: b.innerText.replace(/\s+/g, ' ').trim(), laast: /🔒/.test(b.innerText) || b.disabled || b.getAttribute('aria-disabled') === 'true', sted: b.dataset.sted || b.dataset.id || null })))
    const aabne = steder.filter((s) => !s.laast)
    fastloeb++
    if (fastloeb > aabne.length + 2) { haend('fast', { steder, panel: (await tekstAf(page, '#sted-panel')).slice(0, 300) }); break }
    const s = aabne[fastloeb % Math.max(aabne.length, 1)]
    if (!s) { haend('fast', { steder }); break }
    const k = page.locator('#kort-steder button, .kort-steder button').nth(s.i)
    await rulTil(page, k, ur); await k.click({ force: true }); ur.s += SEK.tryk + 1.5
    await page.waitForTimeout(1700)
    // En foldet knap ("Kirken og Landsbygaden") aabner to nye knapper: tag den foerste.
    haend('gaar-til', { sted: s.t })
    if (await synlig(page, '#quest-svar button')) fastloeb = 0
  }
  haend('slut')
  await page.locator('.kort').scrollIntoViewIfNeeded().catch(() => {})
  await skud('40-kortet-efter-30-min', '.kort')

  // Hvad hun har, efter 30 minutter
  const tilstand = await page.evaluate(() => JSON.parse(localStorage.getItem('ganita:spil') || 'null'))
  const hoved = await tekstAf(page, '.spil-hoved, header')
  // Min helt
  let minHelt = null
  if (await synlig(page, '#min-helt-knap')) {
    await page.locator('#min-helt-knap').click(); await page.waitForTimeout(300)
    minHelt = { tekst: (await tekstAf(page, 'body')).slice(0, 1500), udstyr: await tekstAf(page, '.helt-maal'), graa: await page.locator('.helt-udstyr-post--mangler').count(), poster: await page.locator('.helt-udstyr-post').count() }
    await page.screenshot({ path: path.join(UD, `E-${variant}-${bredde}-50-min-helt.png`), fullPage: true }); billeder.push(`E-${variant}-${bredde}-50-min-helt.png`)
    if (await synlig(page, '#min-helt-tilbage')) await page.locator('#min-helt-tilbage').click()
  }
  // Questbogen
  let questbog = null
  if (await synlig(page, '#questbog-knap')) {
    await page.locator('#questbog-knap').click(); await page.waitForTimeout(300)
    questbog = (await tekstAf(page, 'body')).slice(0, 2500)
    await page.screenshot({ path: path.join(UD, `E-${variant}-${bredde}-51-questbog.png`), fullPage: true }); billeder.push(`E-${variant}-${bredde}-51-questbog.png`)
    if (await synlig(page, '#bog-tilbage')) await page.locator('#bog-tilbage').click()
  }
  // Journalen
  let journal = null
  if (await synlig(page, '#journal-knap')) {
    await page.locator('#journal-knap').click(); await page.waitForTimeout(300)
    journal = (await tekstAf(page, 'body')).slice(0, 2000)
    if (await synlig(page, '#journal-tilbage')) await page.locator('#journal-tilbage').click()
  }
  const vandret = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  const sidefejl = page.sidefejl
  await page.context().close()
  return { variant, bredde, ur: { s: Math.round(ur.s), rul: ur.rul }, opg, historieOrd, foersteSkaerm, naesteFejl, log, tilstand, hoved, minHelt, questbog, journal, vandret, sidefejl, billeder }
}

// En anden dag: en gemt tilstand, hvor hun har mestret Moellens forloeb 1-6, Grusgravens
// 1-2 og klaret Anes og Niels' kaeder (1, 2, 3, 26, 27, 28). Biavleren skal staa med "!".
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
function gemtTilstand({ forloeb, klaret, niveau, niveauPoint = 0, hoved = null, bogSted } = {}) {
  const questFremdrift = Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (forloeb[id] ?? 0))]))
  const t = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau, niveauPoint, erfaring: 900, hoved: 4, haand: 2, hjerte: 3 }, sted: 'moellen', questFremdrift, questbog: { klaret, hoved, hviler: {} } }
  if (bogSted !== undefined) t.bogSted = bogSted
  return t
}

async function bigaarden(browser, bredde) {
  const gemt = gemtTilstand({ forloeb: { moellen: 6, stenbrud: 2 }, klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver'], niveau: 7, niveauPoint: 1, hoved: 'bagerhue' })
  const page = await nySide(browser, bredde, gemt)
  const ud = { bredde }
  ud.bi = await page.evaluate(() => { const e = document.querySelector('.bog-udraab[data-quest="bistaderne"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
  await page.locator('.kort').scrollIntoViewIfNeeded()
  await page.locator('.kort').screenshot({ path: path.join(UD, `E-${bredde}-60-kort-dag-2.png`) })
  if (ud.bi) {
    await page.locator('.bog-udraab[data-quest="bistaderne"]').click({ force: true })
    await page.waitForTimeout(1800)
    ud.panel = await tekstAf(page, '#sted-panel')
    await page.screenshot({ path: path.join(UD, `E-${bredde}-61-bigaarden.png`), fullPage: false })
    const h = page.locator('#bogsted-hjaelp')
    if (await h.count()) { await h.click(); await page.waitForTimeout(400); ud.foersteOpgave = await tekstAf(page, '.quest-opgave-tekst'); ud.questPanel = (await tekstAf(page, '#sted-panel')).slice(0, 600) }
  }
  // Min helt paa dag 2
  await page.locator('#min-helt-knap').click(); await page.waitForTimeout(300)
  ud.minHelt = { udstyr: await tekstAf(page, '.helt-maal'), graa: await page.locator('.helt-udstyr-post--mangler').count(), tekst: (await tekstAf(page, 'body')).slice(0, 1800) }
  await page.screenshot({ path: path.join(UD, `E-${bredde}-62-min-helt-dag-2.png`), fullPage: true })
  ud.sidefejl = page.sidefejl
  await page.context().close()
  return ud
}

const browser = await chromium.launch()
const koersler = []
for (const v of ['travl', 'foelger']) for (const b of [390, 1280]) koersler.push(await spil(browser, b, v))
const dag2 = []
for (const b of [390, 1280]) dag2.push(await bigaarden(browser, b))
await browser.close()
const ud = { spil: hash, T, model: { P, SEK, GRAENSE }, koersler, dag2 }
writeFileSync(path.join(UD, 'elev-525.json'), JSON.stringify(ud, null, 2) + '\n')
for (const k of koersler) console.log(k.variant, k.bredde, 'opgaver', k.opg.antal, 'rigtige foerste', k.opg.rigtigeFoerste, 'ukendt', k.opg.ukendt, 'ur', k.ur, 'fejl', k.sidefejl.length, 'haendelser', k.log.length)
