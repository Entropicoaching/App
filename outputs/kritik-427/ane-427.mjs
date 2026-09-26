// Ordre 427, blok 2: Anes kaede fra start til huen, med to fejl undervejs.
// Headless Chromium, 390 x 844, touch, 2x, flygtig profil, NY figur.
// Koerer mod en KOPI af matematik (git archive af matematik/main), aldrig mod
// matematik-mappen selv. Intet i spillet er rettet.
//
// Brug: node outputs/kritik-427/ane-427.mjs <matematik-kopi>
//   <matematik-kopi> = mappe med spil.html, src/ og node_modules (playwright).
// Skriver outputs/kritik-427/A-*.png og outputs/kritik-427/ane-427.json.
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
for (const bq of bog.BOG_QUESTS) for (let runde = 0; runde < 30; runde++) bog.bogOpgaver(bq, SALT, runde).forEach(laerFacit)

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
  const fil = `A-${String(billedNr).padStart(2, '0')}-${navn}.png`
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

// --- Anes kaede -------------------------------------------------------------
// Eleven regner rigtigt, bortset fra to fejl, ordren bestiller:
//   fejl 1: anden opgave i Moellens forloeb 1 (saa naar forloebet ikke 3 af 3)
//   fejl 2: foerste opgave i "Mel til bageren" (saa hviler Ane)
// Derefter gaar hun den vej, skaermen viser hende, til Bagerhuen.
// Hver tekst hun moeder, naar hun fejler eller skal hvile, gemmes med om den
// staar i skaermen; dommen (venlig / klar / siger hvad hun skal) er min og
// staar i DOMME nederst, skrevet efter at have laest teksterne.
const tekster = []
const hvil = []
let fejl = 0
async function synligt(sel) {
  return page.evaluate((s) => {
    const el = [...document.querySelectorAll(s)].pop()
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { tekst: el.textContent.replace(/\s+/g, ' ').trim(), inde: b.top < innerHeight && b.bottom > 0, top: Math.round(b.top) }
  }, sel)
}
async function gem(id, sel, billede) {
  const t = await synligt(sel)
  const fil = await skud(billede)
  tekster.push({ id, sel, ...(t ?? { tekst: null, inde: false }), billede: fil, uret: Math.round(ur) })
  if (t) laes(t.tekst)
  note(id, t ?? {})
  return t
}
// Svar paa en opgave; forkert en gang med vilje, saa rigtigt.
async function opgaveMedFejl(id) {
  await svar({ forkert: true })
  fejl++
  await gem(id, '.quest-besked--hint', id)
  await svar()
  await videre()
}
async function klarAlt(stop) { return loesAlt({ stop }) }
const klaretFelt = async () => Boolean(await page.locator('.quest-klaret').count())
const takkekort = async () => Boolean(await page.locator('.bog-tak').count())

await page.locator('#op-navn').fill('Ravn') // fantasinavn
await trykPaa(page.locator('#op-udseender button').nth(1))
await trykPaa(page.locator('#op-start'))
await vent(400)
ur += 30
await skud('start')

// Moellens forloeb 1 med fejl 1.
await svar(); await videre()
await opgaveMedFejl('fejl-1-hint')
await svar(); await videre()
await gem('forloeb-ikke-mestret', '.quest-besked--hint', 'forloeb-1-ikke-mestret')
await klarAlt(klaretFelt)
await gem('klaret-ny-quest-1', '.klaret-ny-quest', 'forloeb-1-mestret-hjaelp-ane')

// Ane: "Mel til bageren" med fejl 2.
await trykPaa(page.locator('#klaret-hjaelp'))
await vent(500)
await skud('mel-panel')
await opgaveMedFejl('fejl-2-hint')
for (let n = 0; n < 5 && !(await page.locator('.bog-hvile').count()) && !(await takkekort()); n++) { await svar(); await videre() }
const h = await gem('hvil', '.bog-hvile', 'ane-hviler')
hvil.push(h)
const efterHvil = await page.evaluate(() => ({
  panel: document.querySelector('#sted-panel .quest-kort h3')?.textContent.trim() ?? null,
  udraab: [...document.querySelectorAll('.bog-udraab')].map((e) => e.dataset.quest),
  anePaaKortet: [...document.querySelectorAll('.bog-person')].map((e) => e.dataset.giver ?? e.getAttribute('aria-label') ?? e.textContent.trim()),
  gemt: JSON.parse(localStorage.getItem('ganita:spil')).questbog,
}))
note('efter hvil', efterHvil)
await page.evaluate(() => window.scrollTo(0, 0))
await skud('kortet-mens-ane-hviler')
await trykPaa(page.locator('#questbog-knap'))
await vent(300)
await gem('questbog-mens-ane-hviler', '[data-bog-post="mel-til-bageren"]', 'questbog-mens-ane-hviler')
const bogAfsnit = await page.locator('.questbog h2').allTextContents()
await trykPaa(page.locator('#bog-tilbage'))
await vent(300)

// Tilbage til Moellen: forloeb 2, saa er Ane der igen med nye tal.
await page.locator('#sted-panel').scrollIntoViewIfNeeded()
await klarAlt(klaretFelt)
await gem('klaret-ny-quest-2', '.klaret-ny-quest', 'forloeb-2-mestret-ane-igen')
await trykPaa(page.locator('#klaret-hjaelp'))
await vent(500)
await klarAlt(takkekort)
await vent(1300)
await gem('tak-mel', '.bog-tak', 'tak-mel-til-bageren')

// Broed til alle: den vej, skaermen viser.
let vej = null
if (await page.locator('.bog-tak #klaret-hjaelp, .bog-tak [data-quest="broed-til-alle"]').count()) {
  vej = 'knap paa takkekortet'
  await trykPaa(page.locator('.bog-tak [data-quest="broed-til-alle"]').first())
} else {
  vej = '"!" paa kortet'
  await page.evaluate(() => window.scrollTo(0, 0))
  await trykPaa(page.locator('.bog-udraab[data-quest="broed-til-alle"]'))
  await vent(300)
  await trykPaa(page.locator('.bog-hjaelp[data-quest="broed-til-alle"]'))
}
await vent(500)
await klarAlt(takkekort)
await vent(1300)
const tak = await gem('tak-broed', '.bog-tak', 'tak-broed-til-alle-huen')
const hue = await page.evaluate(() => ({
  paaTakkekort: document.querySelectorAll('.bog-tak .figur-pynt--ny, .bog-tak .figur-hue').length,
  portraet: document.querySelectorAll('.spil-portræt .figur-hue').length,
  gemt: JSON.parse(localStorage.getItem('ganita:spil')).questbog,
}))
await page.locator('.bog-tak').scrollIntoViewIfNeeded()
await skud('huen-paa-takkekortet')

// Min dom over hver tekst (skrevet efter foerste koersel, se KRITIK-questbog-2).
const DOMME = {
  'fejl-1-hint': 'venlig, men ikke klar: to hint-grunde til samme svar 2/2 modsiger hinanden (N3); siger hvad hun skal (proev igen).',
  'forloeb-ikke-mestret': 'klar, men lang og i tal: "2 af 3 ... mindst 3"; siger hvad der sker (samme forloeb, nye tal). Venlig nok.',
  'klaret-ny-quest-1': 'klar: hvem, hvor, og en knap.',
  'fejl-2-hint': 'venlig og klar, som fejl 1.',
  'hvil': 'hoeflig, men foeles som et nej: hun har loest alle tre, og "jeg skal se 3, foer det holder" siger at een fejl ikke er godt nok. "Mestr et forloeb mere" siger ikke hvilket eller hvor.',
  'questbog-mens-ane-hviler': 'klar nok, men samme ord ("mestret et forloeb mere") uden sted.',
  'klaret-ny-quest-2': 'klar: Ane er der igen, med knap.',
  'tak-mel': 'varm og klar ("Du fik ...", "Hvad nu?").',
  'tak-broed': 'varm; huen er belønningen, hun kan se den.',
}
for (const t of tekster) t.dom = DOMME[t.id] ?? null

const ud = {
  salt: SALT, fejl, hvil, efterHvil, bogAfsnit, vejTilBroed: vej,
  huen: hue.gemt.hoved === 'bagerhue' && hue.gemt.klaret.includes('broed-til-alle'), hue,
  tekster, sidefejl, uret: Math.round(ur), tryk, billeder,
}
await browser.close()
writeFileSync(path.join(her, 'ane-427.json'), JSON.stringify(ud, null, 2) + '\n', 'utf8')
console.log(`faerdig: ${billeder.length} billeder, ${fejl} fejl, ${hvil.length} hvil, huen ${ud.huen}, ${sidefejl.length} sidefejl, ${fmt(ur)} elevtid`)
