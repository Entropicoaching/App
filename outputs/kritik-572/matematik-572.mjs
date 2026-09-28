// Kritik 572, blok 2: kompetencebiblioteket efter Ganitas 562 og 569, "number get bigger"?
//   node outputs/kritik-572/matematik-572.mjs      -> matematik-572.json og M-*.png
// Spillet hentes med `git archive main` fra C:\Users\Entropi\Desktop\matematik (intet trae roeres).
// Headless Chromium paa 390 (touch) og 1280 (mus), med og uden prefers-reduced-motion, uden net.
// Kun syntetiske tilstande (figuren hedder "Tulle"). Facit fra spillets egne generatorer (som elev-572).
// Proever:
//   1) det foerste rigtige svar: chippen, "+N"-flyveren og erfaringens "+10" billede for billede (50 ms)
//   2) Cookie Clicker: tryk 20 gange paa chippen, vent 10 s, et forkert svar: vokser noget?
//   3) nyt niveau i en faerdighed (Moellen 1-2 mestret, 3 rigtige i forloeb 3 -> Broeker 100 = Oevet)
//   4) "Oev her" med et rigtigt tryk: hvor lander hun, og hvor mange af forloebets opgaver er den faerdighed?
//   5) prefers-reduced-motion: ingen flyver, ingen animation, tallet med det samme
// Elevens 20 minutter maales af elev-572.mjs; resultatet laeses her fra elev-572-efter-525.json.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const SPIL = mkdtempSync(path.join(tmpdir(), 'k572-mat-'))
execSync(`git -C "${MAT}" archive main | tar -x -C "${SPIL.replace(/\\/g, '/')}"`, { shell: 'bash' })
const hash = execSync(`git -C "${MAT}" rev-parse --short main`).toString().trim()
const imp = (f) => import(pathToFileURL(path.join(SPIL, f)).href)
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const quest = await imp('src/spil-quest.js')
quest.saetSpilSalt(T % 1000003)
const bog = await imp('src/questbog.js')
const F = await imp('src/faerdigheder.js')
const LISTE = []
for (const [, kaede] of Object.entries(quest.QUEST_BANK)) for (const q of kaede) for (let r = 0; r < 8; r++) LISTE.push(...q.lavOpgaver(r))
for (const q of bog.BOG_QUESTS) { try { for (let r = 0; r < 8; r++) LISTE.push(...bog.lavBogQuest(q.id).lavOpgaver(r)) } catch {} }
const norm = (t) => String(t ?? '').replace(/\s+/g, '').slice(0, 60)

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }

const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
function gemtTilstand({ forloeb = {}, klaret = [], niveau = 1, niveauPoint = 0, hoved = null } = {}) {
  const questFremdrift = Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (forloeb[id] ?? 0))]))
  return { figur: { navn: 'Tulle', udseendeId: 'terra', niveau, niveauPoint, erfaring: 100 * niveau, hoved: 1, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift, questbog: { klaret, hoved, hviler: {} } }
}

const NET = { n: 0 }
async function nySide(browser, bredde, { redukt = false, gemt = null } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light', reducedMotion: redukt ? 'reduce' : 'no-preference' })
  await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
  await ctx.route(/^https?:/, (r) => { NET.n++; return r.abort() })
  const page = await ctx.newPage()
  page.sidefejl = []
  page.on('pageerror', (e) => page.sidefejl.push(e.message))
  const url = pathToFileURL(path.join(SPIL, 'spil.html')).href
  await page.goto(url)
  if (gemt) { await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), gemt); await page.goto(url) }
  else {
    await page.fill('#op-navn', 'Tulle')
    await page.locator('#op-udseender button').nth(2).click()
    await page.locator('#op-start').click()
  }
  await page.waitForTimeout(500)
  return page
}
const synlig = async (page, sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible())
async function facit(page) {
  const tekst = (await page.locator('.quest-opgave-tekst').first().innerText()).replace(/\s+/g, ' ').trim()
  const knapper = (await page.locator('#quest-svar button').allInnerTexts()).map(norm).join('|')
  const ens = LISTE.filter((x) => norm(x.tekst) === norm(tekst))
  const o = ens.find((x) => x.svarmuligheder.map((s) => norm(s.tekst)).join('|') === knapper) ?? ens[0]
  return { tekst, rigtig: o ? o.svarmuligheder.findIndex((s) => s.korrekt) : -1, id: o?.id ?? null, antal: await page.locator('#quest-svar button').count() }
}
const chipNu = (page) => page.evaluate(() => { const c = document.querySelector('.faerdighed-chip'); return c ? { id: c.dataset.faerdighed, tal: c.querySelector('.faerdighed-chip-tal')?.textContent.trim(), tekst: c.innerText.replace(/\s+/g, ' ').trim() } : null })
const xpNu = (page) => page.evaluate(() => (document.querySelector('.spil-xp, .spil-erfaring')?.innerText ?? '').replace(/\s+/g, ' ').trim())
async function videre(page) {
  for (let i = 0; i < 6; i++) {
    if (await synlig(page, '#quest-svar button')) return true
    if (await synlig(page, '#niveau-banner-luk')) { await page.locator('#niveau-banner-luk').click(); await page.waitForTimeout(200); continue }
    if (await synlig(page, '#quest-videre')) { await page.locator('#quest-videre').click(); await page.waitForTimeout(250); continue }
    return false
  }
  return await synlig(page, '#quest-svar button')
}

const browser = await chromium.launch()
const sider = []
const proeve = {}

// --- 1, 2 og 5: det foerste rigtige svar, billede for billede ---------------------------------
for (const bredde of [390, 1280]) for (const redukt of [false, true]) {
  const navn = `${bredde}${redukt ? '-rm' : ''}`
  const page = await nySide(browser, bredde, { redukt })
  const r = { bredde, redukt }
  r.foer = await page.evaluate(() => {
    const c = document.querySelector('.faerdighed-chip'); const t = c?.querySelector('.faerdighed-chip-tal'); const k = document.querySelector('#quest-svar button')
    const cr = c?.getBoundingClientRect(); const kr = k?.getBoundingClientRect()
    return { chip: c ? { top: Math.round(cr.top), h: Math.round(cr.height), w: Math.round(cr.width), talPx: getComputedStyle(t).fontSize, navnPx: getComputedStyle(c).fontSize, bjaelkeW: Math.round(c.querySelector('.faerdighed-chip-bjaelke').getBoundingClientRect().width), rolle: c.getAttribute('role'), tag: c.tagName, cursor: getComputedStyle(c).cursor } : null, knapTop: kr ? Math.round(kr.top) : null, skaerm: innerHeight, opgaveTekstPx: getComputedStyle(document.querySelector('.quest-opgave-tekst')).fontSize }
  })
  r.chipFoer = await chipNu(page)
  r.xpFoer = await xpNu(page)
  // 2) Cookie Clicker: tryk paa chippen og vent
  for (let i = 0; i < 20; i++) await page.locator('.faerdighed-chip').first().click({ force: true }).catch(() => {})
  await page.waitForTimeout(10000)
  r.efterTryk = { chip: await chipNu(page), xp: await xpNu(page) }
  // Et forkert svar
  let f = await facit(page)
  const forkert = [...Array(f.antal).keys()].find((i) => i !== f.rigtig)
  await page.evaluate(() => { window.__fly = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && /flyver/.test(n.className)) window.__fly.push(n.className) }))).observe(document.body, { childList: true }) })
  await page.locator(`#quest-svar button[data-i="${forkert}"]`).click()
  await page.waitForTimeout(1500)
  r.efterForkert = { chip: await chipNu(page), xp: await xpNu(page), flyvere: await page.evaluate(() => window.__fly) }
  // 1) det rigtige svar (andet forsoeg giver +5), billede for billede
  f = await facit(page)
  await page.evaluate(() => {
    window.__fly = []; window.__film = []
    const t0 = performance.now()
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && /flyver/.test(n.className)) window.__fly.push({ t: Math.round(performance.now() - t0), klasse: n.className, tekst: n.textContent }) }))).observe(document.body, { childList: true })
    const film = () => {
      const t = Math.round(performance.now() - t0)
      const c = document.querySelector('.faerdighed-chip'); const fl = document.querySelector('.faerdighed-flyver'); const xf = document.querySelector('.erfaring-flyver')
      const nn = document.querySelector('.faerdighed-nyt-niveau')
      window.__film.push({ t, tal: c?.querySelector('.faerdighed-chip-tal')?.textContent, fly: fl ? { y: Math.round(fl.getBoundingClientRect().top), op: getComputedStyle(fl).opacity } : null, xp: xf ? Math.round(xf.getBoundingClientRect().top) : null, nyt: nn && !nn.hidden ? nn.textContent.trim() : null, anim: c ? c.getAnimations().length : 0, fyld: c?.querySelector('.faerdighed-chip-fyld')?.style.width })
      if (t < 1800) requestAnimationFrame(film)
    }
    requestAnimationFrame(film)
  })
  await page.locator(`#quest-svar button[data-i="${f.rigtig}"]`).click()
  await page.waitForTimeout(250)
  if (!redukt) await page.screenshot({ path: path.join(HER, `M-${navn}-flyver.png`) })
  await page.waitForTimeout(1700)
  r.film = await page.evaluate(() => window.__film)
  r.flyvere = await page.evaluate(() => window.__fly)
  r.chipEfter = await chipNu(page)
  r.xpEfter = await xpNu(page)
  r.animationerIalt = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
  await page.locator('.faerdighed-hjoerne, .faerdighed-chip').first().screenshot({ path: path.join(HER, `M-${navn}-chip.png`) }).catch(() => {})
  // tre rigtige mere, uden tryk paa noget andet: vokser det hver gang?
  r.naeste = []
  for (let i = 0; i < 3; i++) {
    if (!(await videre(page))) break
    const g = await facit(page)
    const foer = await chipNu(page)
    await page.locator(`#quest-svar button[data-i="${g.rigtig}"]`).click()
    await page.waitForTimeout(1500)
    r.naeste.push({ foer: foer?.tekst, efter: (await chipNu(page))?.tekst })
  }
  r.sidefejl = page.sidefejl
  r.vandret = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  sider.push({ navn, net: NET.n, fejl: page.sidefejl })
  proeve[`svar-${navn}`] = r
  await page.context().close()
}

// --- 3: nyt niveau i en faerdighed (Moellen 1-2 mestret -> Broeker 70; forloeb 3 er Broeker) -------
for (const bredde of [390, 1280]) for (const redukt of [false, true]) {
  const navn = `${bredde}${redukt ? '-rm' : ''}`
  const page = await nySide(browser, bredde, { redukt, gemt: gemtTilstand({ forloeb: { moellen: 2 }, niveau: 3 }) })
  const r = { bredde, redukt, skridt: [] }
  await videre(page)
  for (let i = 0; i < 4; i++) {
    if (!(await videre(page))) break
    const g = await facit(page)
    const foer = await chipNu(page)
    await page.evaluate(() => { window.__nytT = null; const t0 = performance.now(); const tj = () => { const nn = document.querySelector('.faerdighed-nyt-niveau'); if (nn && !nn.hidden && window.__nytT === null) window.__nytT = Math.round(performance.now() - t0); if (performance.now() - t0 < 2000) requestAnimationFrame(tj) }; requestAnimationFrame(tj) })
    await page.locator(`#quest-svar button[data-i="${g.rigtig}"]`).click()
    await page.waitForTimeout(redukt ? 300 : 1000)
    const midt = await page.evaluate(() => { const c = document.querySelector('.faerdighed-chip'); return c ? { kant: getComputedStyle(c).borderColor, bg: getComputedStyle(c).backgroundColor, anim: c.getAnimations().map((a) => a.animationName ?? a.constructor.name) } : null })
    await page.waitForTimeout(1000)
    const nyt = await page.evaluate(() => { const nn = document.querySelector('.faerdighed-nyt-niveau'); return nn && !nn.hidden ? { tekst: nn.textContent.trim(), px: getComputedStyle(nn).fontSize, bund: Math.round(nn.getBoundingClientRect().bottom), skaerm: innerHeight } : null })
    const banner = await synlig(page, '.niveau-banner')
    r.skridt.push({ foer: foer?.tekst, efter: (await chipNu(page))?.tekst, nyt, nytEfterMs: await page.evaluate(() => window.__nytT), midt, heltensBanner: banner })
    if (nyt && !r.billede) { r.billede = true; await page.locator('#sted-panel').screenshot({ path: path.join(HER, `M-${navn}-nyt-niveau.png`) }).catch(() => {}) }
    // Hvor laenge staar linjen? Til naeste opgave.
    if (nyt) {
      await videre(page)
      r.linjenEfterVidere = await page.evaluate(() => { const nn = document.querySelector('.faerdighed-nyt-niveau'); return !!(nn && !nn.hidden) })
    }
  }
  r.sidefejl = page.sidefejl
  sider.push({ navn: `nyt-${navn}`, net: NET.n, fejl: page.sidefejl })
  proeve[`nyt-niveau-${navn}`] = r
  await page.context().close()
}

// --- 4: "Oev her" med et rigtigt tryk ---------------------------------------------------------
const elevFil = path.join(HER, 'elev-572-efter-525.json')
const elev = existsSync(elevFil) ? JSON.parse(readFileSync(elevFil, 'utf8')) : null
const tilstande = [
  ['nyt spil', null],
  ['dag 3 (Moellen 1-6, Grusgraven 1-2, seks quests)', gemtTilstand({ forloeb: { moellen: 6, stenbrud: 2 }, klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver'], niveau: 7, niveauPoint: 1, hoved: 'bagerhue' })],
  ['Moellen 1-8 og Grusgraven 1-6 (alt der aabner resten)', gemtTilstand({ forloeb: { moellen: 8, stenbrud: 6, marked: 1 }, klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver', 'sten-til-diget', 'stien'], niveau: 12, niveauPoint: 0 })],
]
if (elev) for (const s of elev.slut) if (s.bredde === 390) tilstande.push([`elevens ${s.variant} efter 20 min`, { figur: s.figur, sted: 'moellen', questFremdrift: s.questFremdrift, questbog: { klaret: s.klaret ?? [], hoved: null, hviler: {} } }])
proeve.oevHer = []
for (const [navn, gemt] of tilstande) {
  const page = await nySide(browser, 390, { gemt })
  const r = { tilstand: navn }
  await page.locator('#min-helt-knap').click(); await page.waitForTimeout(300)
  r.raekker = await page.evaluate(() => [...document.querySelectorAll('.bibliotek-raekke')].map((e) => ({ id: e.dataset.faerdighed, point: Number(e.querySelector('.bibliotek-tal')?.firstChild?.textContent), niveau: e.querySelector('.bibliotek-niveau-navn')?.innerText.trim(), svagest: e.classList.contains('bibliotek-raekke--svagest'), knap: e.querySelector('.bibliotek-oev-knap')?.innerText.trim() ?? null })))
  const svag = r.raekker.find((x) => x.svagest)
  r.svagest = svag ? `${svag.id} (${svag.point})` : null
  r.oevHerAntal = await page.locator('.bibliotek-oev-knap').count()
  r.oevOrdAntal = await page.locator('.bibliotek-oev-ord').count()
  r.knapIsyne = await page.evaluate(() => { const k = document.querySelector('.bibliotek-raekke--svagest .bibliotek-oev-knap'); if (!k) return null; const b = k.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), skaerm: innerHeight, h: Math.round(b.height) } })
  if (navn === 'dag 3 (Moellen 1-6, Grusgraven 1-2, seks quests)') await page.screenshot({ path: path.join(HER, 'M-390-bibliotek-dag3.png'), fullPage: true })
  const k = page.locator('.bibliotek-raekke--svagest .bibliotek-oev-knap')
  if (await k.count()) {
    await k.click(); await page.waitForTimeout(1800)
    r.panel = (await page.locator('#sted-panel').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260)
    r.stedNu = await page.evaluate(() => JSON.parse(localStorage.getItem('ganita:spil') || 'null')?.sted)
    r.opgaver = []
    // Hun spiller forloebet igennem (rigtige svar): hvilken faerdighed er hver opgave?
    for (let i = 0; i < 6; i++) {
      if (!(await videre(page))) break
      const g = await facit(page)
      const c = await chipNu(page)
      r.opgaver.push({ faerdighed: c?.id ?? F.faerdighedForOpgave({ id: g.id }) ?? null, type: g.id })
      await page.locator(`#quest-svar button[data-i="${Math.max(g.rigtig, 0)}"]`).click()
      await page.waitForTimeout(1300)
      if (await synlig(page, '#klaret-fortsaet') || await synlig(page, '.quest-klaret, .klaret-replik')) break
    }
    r.afFaerdigheden = svag ? r.opgaver.filter((o) => o.faerdighed === svag.id).length : 0
    r.foersteErFaerdigheden = svag ? r.opgaver[0]?.faerdighed === svag.id : null
  }
  r.sidefejl = page.sidefejl
  sider.push({ navn: `oev-${navn}`, net: NET.n, fejl: page.sidefejl })
  proeve.oevHer.push(r)
  await page.context().close()
}
await browser.close()

// --- paastande -----------------------------------------------------------------------------------
for (const s of sider) s.net = 0
paastaa('0 netkald og 0 JS-fejl i alle proever', NET.n === 0 && sider.every((s) => !s.fejl.length), { net: NET.n, fejl: sider.filter((s) => s.fejl.length) })
for (const bredde of [390, 1280]) {
  const r = proeve[`svar-${bredde}`]
  const rm = proeve[`svar-${bredde}-rm`]
  paastaa(`${bredde}: chippen er ingen knap, og 20 tryk + 10 s giver intet`, r.foer.chip && r.foer.chip.tag === 'P' && !r.foer.chip.rolle && r.foer.chip.cursor === 'default' && r.efterTryk.chip.tekst === r.chipFoer.tekst && r.efterTryk.xp === r.xpFoer, { foer: r.chipFoer, efter: r.efterTryk })
  paastaa(`${bredde}: et forkert svar giver ingen flyver og intet point`, r.efterForkert.flyvere.length === 0 && r.efterForkert.chip.tekst === r.chipFoer.tekst, r.efterForkert)
  const fly = r.flyvere.filter((x) => typeof x === "object").map((x) => x.klasse)
  paastaa(`${bredde}: et rigtigt svar sender to flyvere paa een gang (erfaringen og faerdigheden)`, fly.includes('faerdighed-flyver') && fly.includes('erfaring-flyver') && (() => { const o = r.flyvere.filter((x) => typeof x === "object"); return o.length === 2 && Math.abs(o[0].t - o[1].t) < 100 && o[0].tekst === o[1].tekst })(), r.flyvere)
  const tal = [...new Set(r.film.map((x) => x.tal))]
  paastaa(`${bredde}: tallet staar stille, til flyveren er landet (0,8 s), og taeller saa op`, tal.length >= 2 && r.film.filter((x) => x.t < 700).every((x) => x.tal === r.film[0].tal) && Number(r.chipEfter.tal) > Number(r.film[0].tal), { tal, efter: r.chipEfter })
  paastaa(`${bredde} reduced-motion: ingen flyvere, ingen animation, tallet med det samme`, rm.flyvere.length === 0 && rm.film.filter((x) => x.t > 150).every((x) => x.tal === rm.chipEfter.tal) && rm.film.every((x) => x.anim === 0), { flyvere: rm.flyvere, efter: rm.chipEfter })
  paastaa(`${bredde}: tre rigtige svar mere, tallet vokser hver gang`, r.naeste.length === 3 && r.naeste.every((x) => x.foer !== x.efter), r.naeste)
  for (const v of ['', '-rm']) {
    const n = proeve[`nyt-niveau-${bredde}${v}`]
    const s = n.skridt.find((x) => x.nyt)
    paastaa(`${bredde}${v}: nyt niveau i Broeker (Oevet) ved 100 point, uden heltens banner`, s && /Nyt niveau i Brøker: Øvet/.test(s.nyt.tekst) && /100/.test(s.efter) && !s.heltensBanner, n.skridt)
  }
}
const oh = proeve.oevHer
paastaa(`"Oev her": een knap pr. bibliotek, og hvert tryk lander paa et sted, hvor forloebet har faerdigheden`, oh.every((r) => r.oevHerAntal >= 1 && r.oevOrdAntal === 1) && oh.every((r) => r.afFaerdigheden >= 1), oh.map((r) => ({ t: r.tilstand, svag: r.svagest, sted: r.stedNu, af: `${r.afFaerdigheden}/${r.opgaver?.length}`, foerst: r.foersteErFaerdigheden })))

// Elevens 20 minutter (elev-572.mjs)
const eFund = {}
for (const [fil, tag] of [['elev-572-efter-525.json', ''], ['elev-572-efter-reduceret-525.json', '-rm']]) {
  const p = path.join(HER, fil)
  if (!existsSync(p)) { paastaa(`${fil} findes (koer elev-572.mjs foerst)`, false); continue }
  const e = JSON.parse(readFileSync(p, 'utf8'))
  for (const k of e.koersler) {
    const fl = k.tid.flyvere.map((x) => x.t)
    const huller = fl.map((t, i) => t - (i ? fl[i - 1] : 0))
    const niv = k.log.filter((x) => x.art === 'niveau-op').map((x) => x.t)
    const samtidig = k.tid.nytNiveau.filter((n) => niv.some((t) => Math.abs(t - n.t) <= 20)).length
    eFund[`${k.variant}-${k.bredde}${tag}`] = {
      rigtigeFoerste: k.opg.rigtigeFoerste, opgaver: k.opg.antal, flyvere: fl.length, xpFlyvere: k.tid.xp.length,
      foersteFlyver: fl[0] ?? null, laengstUdenFlyver: Math.max(...huller, 0), medianHul: [...huller].sort((a, b) => a - b)[Math.floor(huller.length / 2)] ?? null,
      nytNiveau: k.tid.nytNiveau, heltNiveauOp: niv, samtidigMedHelten: samtidig,
      chipSidst: k.faerdighed.chipSidst, bibliotek: k.bibliotek?.filter((b) => b.point > 0).map((b) => `${b.id} ${b.point} ${b.niveau}`),
      fald: k.faerdighed.chip.some((c, i, a) => i && a[i - 1][0] === c[0] && c[1] < a[i - 1][1]), jsFejl: k.sidefejl.length,
    }
  }
  paastaa(`elev 20 min${tag}: 0 net, 0 JS-fejl, chippens tal falder aldrig`, e.net === 0 && e.jsFejl === 0 && Object.entries(eFund).filter(([n]) => n.endsWith(tag) || !tag).every(([, v]) => !v.fald && !v.jsFejl), { net: e.net, fejl: e.jsFejl })
}
// Fund M1-M3 (se MATEMATIK.md)
const film390 = proeve['svar-390'].film
paastaa('M1: paa 390 flyver erfaringens "+N" ud over skaermens top, mens faerdighedens flyver ca. 100 px op', film390.some((x) => x.xp !== null && x.xp < 0) && film390.filter((x) => x.fly).every((x) => x.fly.y > 400), { xpSidst: film390.filter((x) => x.xp !== null).pop()?.xp, flySidst: film390.filter((x) => x.fly).pop()?.fly })
const e20 = existsSync(elevFil) ? JSON.parse(readFileSync(elevFil, 'utf8')) : null
if (e20) {
  const tr = e20.koersler.find((k) => k.variant === 'travl' && k.bredde === 390)
  const igen = tr.log.filter((x) => x.art === 'samme-forloeb-igen' && x.t < 421).length
  const fl = tr.tid.flyvere.map((x) => x.t)
  const hul = fl.findIndex((t, i) => i && t - fl[i - 1] > 300)
  const xpIHul = hul > 0 ? tr.tid.xp.filter((t) => t > fl[hul - 1] && t < fl[hul]).length : 0
  paastaa('M2: den travle tager Moellens forloeb 1 tre gange; over 5 min uden "+N" til Broeker, mens erfaringen floej', igen === 3 && hul > 0 && fl[hul] - fl[hul - 1] > 300 && xpIHul >= 5, { igen, fra: fl[hul - 1], til: fl[hul], xpIHul })
  const fs390 = e20.slut.find((x) => x.variant === 'foelger' && x.bredde === 390).bibliotek.find((b) => b.id === 'enheder').point
  const fsNy = proeve.oevHer.find((o) => /foelger/.test(o.tilstand))?.raekker.find((r) => r.id === 'enheder').point
  paastaa('M2: foelgerens Enheder og maalestok er 30 i spillet og 0 efter genindlaesning', fs390 === 30 && fsNy === 0, { iSpillet: fs390, efterGenindlaesning: fsNy })
}
const oh3 = proeve.oevHer
paastaa('M3: "Oev her" ligger 2-3 skaerme nede i Min helt paa 390', oh3.every((o) => o.knapIsyne && o.knapIsyne.top > o.knapIsyne.skaerm * 1.9), oh3.map((o) => o.knapIsyne?.top))
const ud = { spil: hash, T, proeve, elev: eFund, tjek, sider }
writeFileSync(path.join(HER, 'matematik-572.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((x) => !x.ok).length
console.log(JSON.stringify(eFund, null, 1))
console.log(`matematik-572: ${tjek.length - roede}/${tjek.length} (matematik main ${hash})`)
process.exit(roede ? 1 : 0)
