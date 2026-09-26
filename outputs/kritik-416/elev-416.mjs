// Ordre 416, blok 1: questbogen i matematikspillet set af en 10-aarig.
// Headless Chromium, 390 x 844, touch, 2x, flygtig profil, NY figur.
// Koerer mod en KOPI af matematik (git archive af matematik/main), aldrig mod
// matematik-mappen selv. Intet i spillet er rettet.
//
// Brug: node outputs/kritik-416/elev-416.mjs <matematik-kopi>
//   <matematik-kopi> = mappe med spil.html, src/ og node_modules (playwright).
// Skriver outputs/kritik-416/E-*.png og outputs/kritik-416/elev-416.json.
//
// Eleven faar intet at vide. Eleven er "en der kan regne": svarer rigtigt ud
// fra et facit-orakel (samme generatorer som spillet, i node). For at
// oraklet og siden faar de samme opgaver, laases spillets salt i test-
// browseren (Date.now og Math.random fastsat i en init-script). Det er
// den eneste indgriben, og den roerer kun hvilke tal der trækkes.
//
// Adfaerdsmodel (skrevet ned, saa den kan diskuteres):
//  - Eleven svarer paa den opgave, der staar foran hende, og trykker Videre.
//  - Kommer der et kort med en knap ("Se det paa kortet"), trykker eleven paa
//    den (det er den stoerste nye ting paa skaermen).
//  - Staar der et "!" INDEN FOR skaermen, trykker eleven paa det. Ellers ikke.
//  - "Questbogen N ny"-knappen trykkes kun, hvis den er paa skaermen OG der
//    ikke er andet nyt at trykke paa (den er en knap blandt flere).
//  - Tid: 20 s pr. opgave (laese, regne, trykke), 2 s pr. Videre, og al
//    anden tekst eleven faar foran sig laeses med 2,5 ord/s.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const mat = path.resolve(process.argv[2] ?? '')
const her = path.dirname(fileURLToPath(import.meta.url))
const kraev = createRequire(path.join(mat, 'package.json'))
const { chromium } = kraev('playwright')
const q = await import(pathToFileURL(path.join(mat, 'src/spil-quest.js')).href)
const bog = await import(pathToFileURL(path.join(mat, 'src/questbog.js')).href)
mkdirSync(her, { recursive: true })

// --- oraklet ---------------------------------------------------------------
const FAST_NU = 7000000 // Date.now i siden; Math.random = 0 -> salt = 7000000 % 1000003
const SALT = FAST_NU % 1000003
q.saetSpilSalt(SALT)
const facit = new Map() // opgavetekst -> rigtig svartekst
const laerFacit = (o) => {
  const r = o.svarmuligheder.find((s) => s.korrekt)
  if (r) facit.set(o.tekst, r.tekst)
}
for (const kaede of Object.values(q.QUEST_BANK)) for (const f of kaede) for (let runde = 0; runde < 6; runde++) f.lavOpgaver(runde).forEach(laerFacit)
for (const bq of bog.BOG_QUESTS) bog.bogOpgaver(bq, SALT, 0).forEach(laerFacit)

// --- browseren -------------------------------------------------------------
const log = []
const note = (hvad, data = {}) => { log.push({ hvad, tid: Math.round(ur), ...data }); console.log(`[${fmt(ur)}] ${hvad}`, JSON.stringify(data)) }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
let ur = 0 // elevens simulerede tid i sekunder
let tryk = 0
const laes = (tekst) => { ur += (tekst ?? '').split(/\s+/).filter(Boolean).length / 2.5 }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' })
await ctx.addInitScript((nu) => { Date.now = () => nu; Math.random = () => 0 }, FAST_NU)
const page = await ctx.newPage()
const sidefejl = []
page.on('pageerror', (e) => sidefejl.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') sidefejl.push(m.text().slice(0, 160)) })
await page.goto(pathToFileURL(path.join(mat, 'spil.html')).href)
await page.waitForTimeout(400)

const vent = (ms) => page.waitForTimeout(ms)
let billedNr = 0
const billeder = []
async function skud(navn, { fuld = false } = {}) {
  billedNr++
  const fil = `E-${String(billedNr).padStart(2, '0')}-${navn}.png`
  await vent(250)
  await page.screenshot({ path: path.join(her, fil), fullPage: fuld })
  billeder.push(fil)
  return fil
}
const trykPaa = async (loc) => { await loc.tap(); tryk++; await vent(250) }
const iSkaermen = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => {
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2
  const inde = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
  const oeverst = inde ? (document.elementFromPoint(cx, cy) === el || el.contains(document.elementFromPoint(cx, cy))) : false
  return { tekst: el.textContent.trim(), quest: el.dataset?.quest ?? null, top: Math.round(r.top), venstre: Math.round(r.left), bredde: Math.round(r.width), inde, oeverst }
}), sel)
const tekstAf = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel)
const scrollY = () => page.evaluate(() => Math.round(scrollY))

// Hvad eleven ser lige nu: "!" og questbog-knappen.
async function udraabNu() {
  const u = await iSkaermen('.bog-udraab')
  const k = (await iSkaermen('#questbog-knap'))[0]
  return { udraab: u, knap: k ? { tekst: k.tekst, inde: k.inde } : null, scrollY: await scrollY() }
}

// Svar rigtigt paa den aktuelle opgave (eller forkert med vilje).
async function svar({ forkert = false } = {}) {
  const tekst = await tekstAf('.quest-opgave-tekst')
  const knapper = page.locator('#quest-svar button')
  const svarTekster = await knapper.allTextContents()
  const rigtig = facit.get(tekst)
  if (!rigtig) throw new Error(`oraklet kender ikke opgaven: ${tekst}`)
  const i = forkert ? svarTekster.findIndex((t) => t.trim() !== rigtig) : svarTekster.findIndex((t) => t.trim() === rigtig)
  ur += 20
  await trykPaa(knapper.nth(i))
  return { tekst, rigtig, valgt: svarTekster[i] }
}
async function videre() {
  ur += 2
  await trykPaa(page.locator('#quest-videre'))
  await vent(300)
}
// Loes den opgave-raekke, der staar i panelet, til den skifter (forloeb
// mestret / quest klaret). Giver opgaveteksterne.
async function loesAlt({ stop }) {
  const opgaver = []
  for (let n = 0; n < 40; n++) {
    if (await stop()) break
    if (await page.locator('#niveau-banner-luk').count()) {
      laes(await tekstAf('.niveau-banner'))
      await skud('niveau-banner')
      note('niveau-banner', { tekst: await tekstAf('.niveau-banner') })
      await trykPaa(page.locator('#niveau-banner-luk'))
      continue
    }
    if (!(await page.locator('#quest-svar').count())) break
    const s = await svar()
    opgaver.push(s.tekst)
    await videre()
  }
  return opgaver
}

const resultat = { salt: SALT, adfaerd: 'se kommentaren oeverst', forloeb: [], quests: [], udraab: [], genindlaest: null }

// --- 1. ny figur -----------------------------------------------------------
await skud('lav-figur')
await page.locator('#op-navn').fill('Ravn') // et fantasinavn, ingen elev
await trykPaa(page.locator('#op-udseender button').nth(1))
await trykPaa(page.locator('#op-start'))
await vent(400)
ur += 30
await skud('foerste-skaerm')
await skud('foerste-skaerm-hel', { fuld: true })
resultat.start = { ...(await udraabNu()), sted: await tekstAf('.quest-person'), forloeb: await tekstAf('.quest-kaede-tal'), replik: await tekstAf('.quest-replik') }
laes(resultat.start.replik)
note('ny figur', resultat.start)

// Et mestret Moellen-forloeb og hvad eleven ser bagefter.
async function mestrForloeb(nr) {
  const titel = await tekstAf('.quest-kort h3')
  const opgaver = await loesAlt({ stop: async () => Boolean(await page.locator('.quest-klaret').count()) })
  const efter = await udraabNu()
  const klaret = await tekstAf('.quest-klaret')
  const byVaagner = await tekstAf('.by-vaagner')
  laes(klaret); laes(byVaagner)
  const r = { nr, titel, opgaver: opgaver.length, uret: Math.round(ur), tryk, klaretTekst: klaret, byVaagner, efter }
  await skud(`moellen-${nr}-mestret-det-eleven-ser`)
  note(`Moellens forloeb ${nr} mestret`, r)
  resultat.forloeb.push(r)
  return r
}

// Fra kortet/panelet: find "!" som eleven ville (se modellen).
async function findUdraab(hvornaar) {
  const foer = await udraabNu()
  let vej = null
  if (foer.udraab.some((u) => u.inde && u.oeverst)) vej = 'straks'
  else if (await page.locator('#by-se-kortet').count()) {
    ur += 2
    await trykPaa(page.locator('#by-se-kortet'))
    await vent(700)
    if ((await udraabNu()).udraab.some((u) => u.inde && u.oeverst)) vej = '"Se det paa kortet"'
  }
  const nu = await udraabNu()
  const fil = await skud(`udraab-${hvornaar}`)
  const r = { hvornaar, foer, nu, vej, uret: Math.round(ur), tryk, billede: fil }
  note(`"!" ${hvornaar}`, r)
  resultat.udraab.push(r)
  return r
}

async function hjaelp(questId, { viaUdraab = true } = {}) {
  const r = { questId }
  if (viaUdraab) {
    const u = page.locator(`.bog-udraab[data-quest="${questId}"]`)
    ur += 2
    await trykPaa(u)
  } else {
    await trykPaa(page.locator('#questbog-knap'))
  }
  await vent(300)
  const post = page.locator(`[data-bog-post="${questId}"]`)
  r.bogAaben = await page.locator('.questbog').count() === 1
  r.fokus = await page.locator(`.bog-post--fokus[data-bog-post="${questId}"]`).count() === 1
  r.hvorforIBog = await post.locator('.bog-post-hvorfor').evaluate((el) => { const b = el.getBoundingClientRect(); return { tekst: el.textContent.trim(), inde: b.top >= 0 && b.bottom <= innerHeight } })
  r.infoIBog = await post.locator('.bog-post-info').textContent()
  r.afsnit = await page.locator('.questbog h2').allTextContents()
  laes(r.hvorforIBog.tekst); laes(r.infoIBog)
  await skud(`bog-${questId}`)
  ur += 2
  await trykPaa(page.locator(`.bog-hjaelp[data-quest="${questId}"]`))
  await vent(800)
  r.panel = await page.evaluate(() => {
    const m = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { tekst: el.textContent.trim(), top: Math.round(b.top), inde: b.top >= 0 && b.bottom <= innerHeight } }
    return { person: m('.bog-quest-person'), hvorfor: m('#sted-panel .quest-replik'), beloenning: m('.bog-quest-beloenning'), opgave: m('.quest-opgave-tekst'), svar: m('#quest-svar') }
  })
  await skud(`panel-${questId}`)
  r.opgaver = []
  let foer = r.panel.opgave?.tekst
  for (let n = 0; n < 10; n++) {
    if (await page.locator('.bog-tak').count()) break
    if (await page.locator('#niveau-banner-luk').count()) { await trykPaa(page.locator('#niveau-banner-luk')); continue }
    if (!(await page.locator('#quest-svar').count())) break
    const s = await svar()
    r.opgaver.push(s.tekst)
    if (n === 0) await skud(`panel-${questId}-rigtigt`)
    await videre()
    foer = s.tekst
  }
  await vent(200)
  r.lige = { scrollY: await scrollY(), kortTop: await page.locator('.kort').evaluate((el) => Math.round(el.getBoundingClientRect().top)) }
  await skud(`beloenning-${questId}-straks`)
  await vent(1300)
  r.ny = await page.evaluate(() => ({
    ting: [...document.querySelectorAll('.bog-ting--ny')].map((e) => e.dataset.beloenning),
    ring: document.querySelectorAll('.bog-ny-ring').length,
    hueNed: document.querySelectorAll('.spil-portræt .figur-pynt--ny').length,
  }))
  await skud(`beloenning-${questId}-efter-pop`)
  const tak = page.locator('.bog-tak')
  if (await tak.count()) {
    r.tak = await tak.evaluate((el) => { const b = el.getBoundingClientRect(); return { tekst: el.innerText.replace(/\s+/g, ' ').trim(), top: Math.round(b.top), inde: b.top < innerHeight && b.bottom > 0 } })
    laes(r.tak.tekst)
    await tak.scrollIntoViewIfNeeded()
    await skud(`tak-${questId}`)
  }
  r.uret = Math.round(ur)
  r.tryk = tryk
  note(`quest ${questId} klaret`, r)
  resultat.quests.push(r)
  // Eleven ruller op til kortet igen (sådan som hun kom).
  await page.evaluate(() => window.scrollTo(0, 0))
  return r
}

// --- 2. Moellens forloeb 1 -> foerste "!" -----------------------------------
await mestrForloeb(1)
const foerste = await findUdraab('efter-moellen-1')
resultat.foersteUdraab = { uret: foerste.uret, tryk: foerste.tryk, vej: foerste.vej }
if (!foerste.vej) note('eleven ser ikke "!" af sig selv')
await hjaelp('mel-til-bageren')

// Efter questen: tilbage til Moellen, forloeb 2.
await page.locator('#sted-panel').scrollIntoViewIfNeeded()
resultat.efterQuest1 = { forloeb: await tekstAf('.quest-kaede-tal'), fremdrift: await tekstAf('.quest-fremdrift') }
await mestrForloeb(2)
await findUdraab('efter-moellen-2')
const u2 = (await udraabNu()).udraab
resultat.udraabEfter2 = u2
await hjaelp('broed-til-alle')

await page.locator('#sted-panel').scrollIntoViewIfNeeded()
await mestrForloeb(3)
await findUdraab('efter-moellen-3')
resultat.udraabEfter3 = (await udraabNu()).udraab
await hjaelp('aenderne')

// --- 3. genindlaes ---------------------------------------------------------
await page.reload()
await vent(600)
if (await page.locator('#niveau-banner-luk').count()) await trykPaa(page.locator('#niveau-banner-luk'))
resultat.genindlaest = await page.evaluate(() => ({
  ting: [...document.querySelectorAll('.bog-ting')].map((e) => e.dataset.beloenning),
  hue: document.querySelectorAll('.spil-portræt .figur-hue').length,
  hueKort: document.querySelectorAll('.kort-figur-token .figur-hue').length,
  udraab: [...document.querySelectorAll('.bog-udraab')].map((e) => e.dataset.quest),
  knap: document.querySelector('#questbog-knap')?.textContent.trim(),
  sidenSidst: document.querySelector('.siden-sidst')?.textContent.trim() ?? null,
  gemt: JSON.parse(localStorage.getItem('ganita:spil')).questbog,
}))
await skud('genindlaest')
await page.locator('.kort').scrollIntoViewIfNeeded()
await skud('genindlaest-kortet')
await trykPaa(page.locator('#questbog-knap'))
await skud('genindlaest-questbog', { fuld: true })
resultat.genindlaest.bog = await page.locator('.questbog h2').allTextContents()
note('genindlaest', resultat.genindlaest)

resultat.sidefejl = sidefejl
resultat.slutUr = Math.round(ur)
resultat.slutTryk = tryk
resultat.billeder = billeder
await browser.close()
writeFileSync(path.join(her, 'elev-416.json'), JSON.stringify({ resultat, log }, null, 2) + '\n', 'utf8')
console.log(`faerdig: ${billeder.length} billeder, ${sidefejl.length} sidefejl, ${fmt(ur)} elevtid`)
