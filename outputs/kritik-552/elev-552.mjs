// Kritik 552, blok 2: min elev-536.mjs igen, foer (e085b2b) og efter (main) Ganitas 542.
//
//   MAT_REF=e085b2b TAG=foer  SEED=525 node outputs/kritik-552/elev-552.mjs
//   MAT_REF=main    TAG=efter SEED=525 node outputs/kritik-552/elev-552.mjs
//   BREDDER=390 kun telefonen (de ekstra terninger).
//
// Tilfoejet i 552 (resten er 536's elev uaendret):
//   - SEED: elevens terning (536: 525) OG spillets salt (dagen flyttes SEED-525 dage), saa en
//     anden terning ogsaa giver andre tal. SEED=525 er 536's koersel.
//   - 542's ankomst (.ankomst) laeses som historie (ordene taeller i uret), og det logges, om
//     ankomsten og foerste svarknap staar paa samme skaerm. Foer-koerslen har ingen ankomst.
//   - "dag 3": en gemt tilstand, hvor Landsbygaden, Kirken og Sporvognen er aabne, men ikke
//     besoegt; eleven gaar til hvert sted og laeser ankomsten (kun efter-koerslen har den).
//   - M5-taelling pr. koersel: hvor ofte 2/3 mod 2/5, og hvilke tal hun oftest ser.
//
// Herunder 536's beskrivelse:
//
// Samme elev, terning, tidsmodel og 30 minutter som 525. Kun tilfoejet, saa eleven kan
// komme videre i 527's nye panel (ellers ville hun sidde fast):
//   - aabningsscenen (.aabning) laeses og taelles som historie,
//   - 'travl' trykker "Fortsaet hos Moelleren" (#klaret-fortsaet), 'foelger' "Hjaelp Ane" som foer,
//   - 'foelger' trykker "Gaa til <sted>" (.nyt-sted-gaa), naar panelet siger et nyt sted og der
//     ikke er en person at hjaelpe; 'travl' goer som foer (gaar kun, naar hun sidder fast).
// Foer-koerslen har ingen af de tre ting, saa den er 525's elev uaendret.
// Spillet hentes med `git archive` til en midlertidig mappe; matematik-traeet roeres ikke.
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
const TAG = process.env.TAG || 'efter'
const SEED = Number(process.env.SEED || 525)
const BREDDER = (process.env.BREDDER || '390,1280').split(',').map(Number)
const SPIL = mkdtempSync(path.join(tmpdir(), 'kritik-552-'))
execSync(`git -C "${MAT}" archive ${REF} | tar -x -C "${SPIL.replace(/\\/g, '/')}"`, { shell: 'bash' })
const hash = execSync(`git -C "${MAT}" rev-parse --short ${REF}`).toString().trim()
const imp = (f) => import(pathToFileURL(path.join(SPIL, f)).href)

// Fast tid: 28. sep 2026 kl. 10 (hoest, dag). Saltet er spillets eget: Date.now() % 1000003.
const T = Date.UTC(2026, 8, 28, 8, 0, 0) + (SEED - 525) * 86400000
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
const NET = { n: 0 } // forsoeg paa net (alle afbrudt)

async function nySide(browser, bredde, gemt = null) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light' })
  await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
  await ctx.route(/^https?:/, (r) => { NET.n++; return r.abort() })
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
  const rnd = terning(SEED)
  const page = await nySide(browser, bredde)
  const ur = { s: 0, rul: 0 }
  const log = []
  const haend = (art, data = {}) => log.push({ t: Math.round(ur.s), art, ...data })
  const billeder = []
  const skud = async (navn, sel = null) => {
    const fil = `E-${TAG}-${SEED}-${variant}-${bredde}-${navn}.png`
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
    // 527: aabningsscenen. Kan hun se scenen og den foerste svarknap paa samme skaerm?
    if ((await synlig(page, '.aabning')) && set1('aabning')) {
      const t = await tekstAf(page, '.aabning')
      historieOrd.aabning = ord(t); ur.s += ord(t) * SEK.ord
      const syn = await page.evaluate(() => { const a = document.querySelector('.aabning').getBoundingClientRect(); const k = document.querySelector('#quest-svar button')?.getBoundingClientRect(); return { aabningTop: Math.round(a.top), knapBund: k ? Math.round(k.bottom) : null, skaerm: innerHeight } })
      haend('aabning', { tekst: t, ...syn })
      await skud('03-aabning')
    }
    // 542: ankomsten til et nyt sted. Hun laeser den; staar den og foerste svarknap paa een skaerm?
    if (await synlig(page, '.ankomst')) {
      const t = await tekstAf(page, '.ankomst')
      if (set1(`ankomst:${t}`)) {
        historieOrd.ankomst = (historieOrd.ankomst ?? 0) + ord(t); ur.s += ord(t) * SEK.ord
        const syn = await page.evaluate(() => { const a = document.querySelector('.ankomst').getBoundingClientRect(); const k = document.querySelector('#quest-svar button')?.getBoundingClientRect(); return { ankomstTop: Math.round(a.top), ankomstBund: Math.round(a.bottom), knapBund: k ? Math.round(k.bottom) : null, skaerm: innerHeight } })
        haend('ankomst', { tekst: t, ...syn })
        if (set1('skud-ankomst')) await skud('28-ankomst', '#sted-panel')
      }
    }
    // 527: et nyt sted siges i panelet.
    if (await synlig(page, '.nyt-sted')) {
      const t = await tekstAf(page, '.nyt-sted')
      if (set1(`nytSted:${t}`)) { historieOrd.nytSted = (historieOrd.nytSted ?? 0) + ord(t); ur.s += ord(t) * SEK.ord; haend('nyt-sted', { tekst: t }); if (set1('skud-nyt-sted')) await skud('26-nyt-sted', '.nyt-sted') }
    }
    // 527: valget efter et forloeb. Den travle vil videre; foelgeren tager "Hjaelp" nedenfor.
    if ((await synlig(page, '#klaret-fortsaet')) && (variant === 'travl' || !(await synlig(page, '#klaret-hjaelp')))) {
      if (set1(`skud-valg-${variant}`)) await skud('25-kort-efter-forloeb', '#sted-panel')
      const k = page.locator('#klaret-fortsaet')
      haend('fortsaet', { tekst: await k.innerText() })
      await rulTil(page, k, ur); await k.click(); ur.s += SEK.tryk
      await page.waitForTimeout(300)
      efterForloeb = false
      continue
    }
    // 527: foelgeren gaar til det nye sted, naar der ikke er en person at hjaelpe.
    if (variant === 'foelger' && !(await synlig(page, '#klaret-hjaelp')) && (await synlig(page, '.nyt-sted-gaa'))) {
      const k = page.locator('.nyt-sted-gaa').first()
      const sted = await k.getAttribute('data-sted')
      if (!sete.has(`besoegt:${sted}`)) {
        sete.add(`besoegt:${sted}`)
        haend('gaar-til', { sted, via: 'nyt-sted' })
        await rulTil(page, k, ur); await k.click(); ur.s += SEK.tryk + 1.5
        await page.waitForTimeout(1700)
        if (set1('skud-nyt-sted-besoeg')) await skud('27-nyt-sted-besoegt', '#sted-panel')
        continue
      }
    }
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
    await page.screenshot({ path: path.join(UD, `E-${TAG}-${SEED}-${variant}-${bredde}-50-min-helt.png`), fullPage: true }); billeder.push(`E-${TAG}-${SEED}-${variant}-${bredde}-50-min-helt.png`)
    if (await synlig(page, '#min-helt-tilbage')) await page.locator('#min-helt-tilbage').click()
  }
  // Questbogen
  let questbog = null
  if (await synlig(page, '#questbog-knap')) {
    await page.locator('#questbog-knap').click(); await page.waitForTimeout(300)
    questbog = (await tekstAf(page, 'body')).slice(0, 2500)
    await page.screenshot({ path: path.join(UD, `E-${TAG}-${SEED}-${variant}-${bredde}-51-questbog.png`), fullPage: true }); billeder.push(`E-${TAG}-${SEED}-${variant}-${bredde}-51-questbog.png`)
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
  await page.locator('.kort').screenshot({ path: path.join(UD, `E-${TAG}-${bredde}-60-kort-dag-2.png`) })
  if (ud.bi) {
    await page.locator('.bog-udraab[data-quest="bistaderne"]').click({ force: true })
    await page.waitForTimeout(1800)
    ud.panel = await tekstAf(page, '#sted-panel')
    await page.screenshot({ path: path.join(UD, `E-${TAG}-${bredde}-61-bigaarden.png`), fullPage: false })
    const h = page.locator('#bogsted-hjaelp')
    if (await h.count()) { await h.click(); await page.waitForTimeout(400); ud.foersteOpgave = await tekstAf(page, '.quest-opgave-tekst'); ud.questPanel = (await tekstAf(page, '#sted-panel')).slice(0, 600) }
  }
  // Min helt paa dag 2
  await page.locator('#min-helt-knap').click(); await page.waitForTimeout(300)
  ud.minHelt = { udstyr: await tekstAf(page, '.helt-maal'), graa: await page.locator('.helt-udstyr-post--mangler').count(), tekst: (await tekstAf(page, 'body')).slice(0, 1800) }
  await page.screenshot({ path: path.join(UD, `E-${TAG}-${bredde}-62-min-helt-dag-2.png`), fullPage: true })
  ud.sidefejl = page.sidefejl
  await page.context().close()
  return ud
}

// 552: dag 3. Moellen 1-6 og Grusgraven 1-2 mestret, niveau 7: Landsbygaden, Kirken og Sporvognen
// er aabne, men ikke besoegt. Hun gaar til hvert sted fra kortet og laeser det, der staar.
async function dag3(browser, bredde) {
  const gemt = gemtTilstand({ forloeb: { moellen: 6, stenbrud: 2 }, klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver'], niveau: 7, niveauPoint: 1, hoved: 'bagerhue' })
  const page = await nySide(browser, bredde, gemt)
  const ud = { bredde, knapper: await page.locator('#kort-steder button, .kort-steder button').allInnerTexts(), steder: [] }
  for (const navn of ['Landsbygaden', 'Kirken', 'Sporvognen']) {
    const alle = page.locator('#kort-steder button, .kort-steder button')
    const tekster = (await alle.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
    // Helst en knap med kun dette sted; ellers den foldede ("Kirken og Landsbygaden"), der aabner to.
    let i = tekster.findIndex((t) => t.includes(navn) && !/ og /.test(t))
    if (i < 0) {
      const j = tekster.findIndex((t) => t.includes(navn))
      if (j >= 0) { await alle.nth(j).click({ force: true }); await page.waitForTimeout(800) }
      const t2 = (await alle.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
      i = t2.findIndex((t) => t.includes(navn) && !/ og /.test(t))
      if (i < 0) i = j
    }
    const a = { sted: navn, fundet: i >= 0 }
    if (i >= 0) { await alle.nth(i).scrollIntoViewIfNeeded(); await alle.nth(i).click({ force: true }); await page.waitForTimeout(1700) }
    a.ankomst = await tekstAf(page, '.ankomst')
    a.panel = (await tekstAf(page, '#sted-panel')).slice(0, 500)
    a.syn = await page.evaluate(() => { const e = document.querySelector('.ankomst'); const kk = document.querySelector('#quest-svar button'); if (!e) return null; const r = e.getBoundingClientRect(); const kr = kk?.getBoundingClientRect(); return { ankomstTop: Math.round(r.top + scrollY), knapBund: kr ? Math.round(kr.bottom + scrollY) : null, skaerm: innerHeight } })
    if (await synlig(page, '#sted-panel')) await page.locator('#sted-panel').screenshot({ path: path.join(UD, `E-${TAG}-${bredde}-7${ud.steder.length}-ankomst-${navn}.png`) })
    // Hun svarer rigtigt paa foerste opgave: er ankomsten saa vaek?
    if (await synlig(page, '#quest-svar button')) {
      const tekst = await tekstAf(page, '.quest-opgave-tekst')
      const kn = (await page.locator('#quest-svar button').allInnerTexts()).map(norm).join('|')
      const ens = LISTE.filter((x) => norm(x.tekst) === norm(tekst))
      const o = ens.find((x) => x.svarmuligheder.map((s) => norm(s.tekst)).join('|') === kn) ?? ens[0]
      const rigtig = o ? o.svarmuligheder.findIndex((s) => s.korrekt) : 0
      a.foersteOpgave = tekst
      await page.locator(`#quest-svar button[data-i="${Math.max(rigtig, 0)}"]`).click(); await page.waitForTimeout(400)
      a.ankomstEfterSvar = await synlig(page, '.ankomst')
    }
    ud.steder.push(a)
  }
  ud.vandret = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  ud.sidefejl = page.sidefejl
  await page.context().close()
  return ud
}

const browser = await chromium.launch()
const koersler = []
for (const v of ['travl', 'foelger']) for (const b of BREDDER) koersler.push(await spil(browser, b, v))
const dag2 = []
const d3 = []
if (SEED === 525) for (const b of BREDDER) { dag2.push(await bigaarden(browser, b)); d3.push(await dag3(browser, b)) }
await browser.close()
// Opsummering pr. koersel (samme maal som tabellen i 525).
const NYT = new Set(['niveau-op', 'tak', 'byVaagner', 'nyt-sted', 'hjaelper', 'aabning', 'gaar-til', 'klaret-hjaelp', 'ankomst'])
const mmss = (s) => (s == null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
function opsummer(k) {
  const L = k.log
  const foerst = (f) => L.find(f)
  const opgFoer = (t) => L.filter((e) => e.art === 'opgave' && e.t < t).length
  const niv = foerst((e) => e.art === 'niveau-op')
  const person = foerst((e) => ['aabning', 'klaret-hjaelp', 'hjaelper'].includes(e.art))
  const hjaelp = foerst((e) => e.art === 'hjaelper')
  const igen = L.filter((e) => e.art === 'samme-forloeb-igen')
  const nyt = L.filter((e) => NYT.has(e.art)).map((e) => e.t)
  const punkter = [0, ...nyt, L[L.length - 1].t]
  let laengst = 0
  for (let i = 1; i < punkter.length; i++) laengst = Math.max(laengst, punkter[i] - punkter[i - 1])
  const steder = new Set(['moellen', ...L.filter((e) => e.art === 'gaar-til').map((e) => e.sted)])
  const alleOrd = Object.values(k.historieOrd).reduce((a, b) => a + b, 0)
  const aab = foerst((e) => e.art === 'aabning')
  return {
    opgaver: k.opg.antal, rigtigeFoerste: k.opg.rigtigeFoerste, ukendt: k.opg.ukendt,
    foersteNiveauOp: niv ? { t: mmss(niv.t), opgaverFoer: opgFoer(niv.t) } : null,
    foerstePerson: person ? { t: mmss(person.t), art: person.art, opgaverFoer: opgFoer(person.t) } : null,
    foersteHjaelp: hjaelp ? { t: mmss(hjaelp.t), opgaverFoer: opgFoer(hjaelp.t) } : null,
    aabning: aab ? { ord: k.historieOrd.aabning, scenenOgKnappenPaaEenSkaerm: aab.aabningTop >= 0 && aab.knapBund !== null && aab.knapBund <= aab.skaerm, aabningTop: aab.aabningTop, knapBund: aab.knapBund } : null,
    sammeForloebIgen: igen.length, laerer: igen.filter((e) => /lærer/.test(e.tekst)).length, taetPaa: igen.filter((e) => /Tæt på/.test(e.tekst)).length,
    igenTekster: igen.map((e) => (e.tekst.match(/(\d+) af (\d+) var rigtige/) || ['', '?', '?']).slice(1).join(' af ') + (/lærer/.test(e.tekst) ? ' + laerer' : /Tæt på/.test(e.tekst) ? ' + taet paa' : '')),
    quests: (k.tilstand?.questbog?.klaret || []).length, klaret: k.tilstand?.questbog?.klaret || [],
    niveau: k.tilstand?.figur?.niveau, hoved: k.tilstand?.figur?.hoved, haand: k.tilstand?.figur?.haand, hjerte: k.tilstand?.figur?.hjerte,
    udstyr: k.minHelt?.udstyr || null,
    steder: [...steder], nytStedSagt: L.filter((e) => e.art === 'nyt-sted').length, fortsaet: L.filter((e) => e.art === 'fortsaet').length,
    historieAndel: Math.round((100 * alleOrd) / (alleOrd + k.opg.ord)),
    laengstUdenNyt: mmss(laengst), rul: k.ur.rul, jsFejl: k.sidefejl.length, vandretOk: k.vandret,
    ...m5(L),
    ankomster: L.filter((e) => e.art === 'ankomst').map((e) => ({ t: mmss(e.t), tekst: e.tekst.slice(0, 220), sammeSkaerm: e.knapBund !== null && e.ankomstTop >= 0 && e.knapBund <= e.skaerm, ankomstTop: e.ankomstTop, knapBund: e.knapBund })),
    grusgraven: (() => { const g = L.find((e) => e.art === 'gaar-til' && /stenbrud|Grusgrav/i.test(e.sted)); return g ? mmss(g.t) : null })(),
    hansSagt: (() => { const g = L.find((e) => (e.art === 'ankomst' && /Hans/.test(e.tekst)) || (['hjaelper', 'klaret-hjaelp'].includes(e.art) && /hans|sten-til-diget/i.test(`${e.quest} ${e.panel ?? ''}`))); return g ? { t: mmss(g.t), art: g.art } : null })(),
    hansQuest: (() => { const g = L.find((e) => e.art === 'hjaelper' && e.quest === 'sten-til-diget'); return g ? mmss(g.t) : null })(),
  }
}
// M5: 2/3 mod 2/5 (begge broeker i samme opgave), de tal hun oftest ser (talmaengden i opgaven),
// og hvor mange opgaver der stod ordret foer.
function m5(L) {
  const opg = L.filter((e) => e.art === 'opgave')
  const mod = opg.filter((e) => /(^|\D)2\/3(\D|$)/.test(e.tekst) && /(^|\D)2\/5(\D|$)/.test(e.tekst)).length
  const taelle = new Map()
  for (const e of opg) { const tal = [...new Set(e.tekst.match(/\d+(\/\d+)?/g) ?? [])].sort().join(' og '); if (tal) taelle.set(tal, (taelle.get(tal) ?? 0) + 1) }
  const top = [...taelle.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  const tekster = new Map()
  for (const e of opg) tekster.set(e.tekst, (tekster.get(e.tekst) ?? 0) + 1)
  const igen = [...tekster.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0)
  return { m5: { toTredjeModToFemtedele: mod, oftestTal: top[0], oftestAntal: top[1], sammeTekstIgen: igen } }
}
const udgaver = { travl: {}, foelger: {} }
for (const k of koersler) udgaver[k.variant][k.bredde] = opsummer(k)
const ud = { spil: hash, ref: REF, tag: TAG, seed: SEED, T, model: { P, SEK, GRAENSE }, bredder: BREDDER, udgaver, jsFejl: [...koersler, ...dag2, ...d3].reduce((a, k) => a + k.sidefejl.length, 0), net: NET.n, koersler: koersler.map((k) => ({ ...k, tilstand: undefined, minHelt: undefined, questbog: undefined, journal: undefined })), dag2, dag3: d3 }
writeFileSync(path.join(UD, `elev-552-${TAG}-${SEED}.json`), JSON.stringify(ud, null, 1) + '\n')
console.log(JSON.stringify(udgaver, null, 1))
for (const k of koersler) console.log(k.variant, k.bredde, 'opgaver', k.opg.antal, 'rigtige foerste', k.opg.rigtigeFoerste, 'ukendt', k.opg.ukendt, 'ur', k.ur, 'fejl', k.sidefejl.length, 'haendelser', k.log.length)
