// ORDRE 419, blok 1: en uge som atlet paa telefonen, maalt.
// Headless Chromium 390x844 (touch, iPhone-UA) mod e2e-mocken med en
// syntetisk uge (se uge-faelles.mjs). Atleten logger ind, gennemfoerer alle
// 4 pas fra Dagens pas-kortet (log saet, spring et over, ret et tal,
// fortryd, RPE, noter), ser historik og fremskridt og uploader en video.
// Hvert tryk gaar gennem tryk(), som taeller det, og som ogsaa taeller en
// rulning, naar maalet ikke stod synligt over bundnavigationen foer trykket.
// Tid er maskintid (klik til naeste tilstand), ikke menneskelig tid.
//
// Atletens regel (saadan loefter en atlet efter Marcs program): staar der
// "Anbefalet: X kg" fra coachen, loeftes X kg. Staar feltet paa noget andet,
// trykkes +/- til det passer. Ellers godkendes det, der staar.
//
// Kørsel: node outputs/419/uge.mjs [--no-build]
//   UGE_UD=<mappe> skriver et andet sted hen end outputs/419/uge (bruges til
//   foer/efter). Resultat: <UD>/maaling.json + billeder <UD>/*.png
import path from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ROOT, MOCK_PORT, MOBILE_UA, startStaticServer, byg, hentChromium, bygSeed, PAS } from './uge-faelles.mjs'
import { ensureSyntheticClip } from '../../e2e/harness.mjs'

const UD = process.env.UGE_UD ? path.resolve(process.env.UGE_UD) : path.join(ROOT, 'outputs', '419', 'uge')
mkdirSync(UD, { recursive: true })
if (!process.argv.includes('--no-build')) { console.log('Bygger mod mocken ...'); byg() }
const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { seed } = bygSeed(fx.buildSeed, fx)
const mock = createMockSupabase(seed)
await mock.listen(MOCK_PORT)
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
const table = async (name) => (await fetch(`${mockUrl}/__e2e/table?name=${name}`)).json()
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
const page = await context.newPage()
const konsolFejl = []
page.on('pageerror', e => konsolFejl.push(String(e)))
page.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text().slice(0, 300)) })

// ---- maaling ----
const maaling = { afsnit: {}, doedeTryk: [], konsolFejl }
let cur = null
function afsnit(navn) {
  cur = { tryk: 0, rul: 0, tast: 0, ms: 0, t0: Date.now(), log: [] }
  maaling.afsnit[navn] = cur
}
function slut() { cur.ms = Date.now() - cur.t0; delete cur.t0 }
let navTop = 844
async function tryk(loc, hvad) {
  await loc.waitFor({ state: 'visible', timeout: 15000 })
  const box = await loc.boundingBox()
  const iNav = await loc.evaluate(e => !!e.closest('nav')).catch(() => false)
  const synlig = iNav || (box && box.y >= 0 && box.y + box.height <= navTop)
  if (!synlig) { cur.rul++; cur.log.push(`(rul) ${hvad}`) }
  await loc.click()
  cur.tryk++
  cur.log.push(hvad)
}
async function tast(loc, tekst, hvad) {
  await tryk(loc, hvad)
  await loc.fill(tekst)
  cur.tast += tekst.length
}
const shot = (navn) => page.screenshot({ path: path.join(UD, `${navn}.png`) })

// Dagens pas-kortet: laes oevelse, saet og feltets vaegt.
async function kortet() {
  return page.evaluate(() => {
    const lbl = [...document.querySelectorAll('div')].find(d => d.textContent === 'Dagens pas' && d.children.length === 0)
    if (!lbl) return null
    let card = lbl
    while (card && !card.querySelector('input[aria-label^="Vægt, sæt"]')) card = card.parentElement
    if (!card) return { tekst: lbl.parentElement?.parentElement?.innerText || '' }
    const tekst = card.innerText
    const saet = tekst.match(/Sæt (\d+)\/(\d+)/)
    const navn = card.querySelector('div[style*="Playfair"]')?.textContent?.trim()
    const anb = tekst.match(/Anbefalet: ([\d.]+)kg/)
    const vaegt = card.querySelector('input[aria-label^="Vægt, sæt"]')?.value
    const reps = card.querySelector('input[aria-label^="Reps, sæt"]')?.value ?? null
    return { navn, saet: saet && Number(saet[1]), af: saet && Number(saet[2]), anbefalet: anb ? Number(anb[1]) : null, vaegt, reps, tekst }
  })
}
const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })

// Log et saet fra kortet efter atletens regel. ekstra: foer Godkendt.
async function logSaet(forventNavn, n, { ekstra } = {}) {
  await page.waitForFunction(([navn, n]) => {
    const t = document.body.innerText
    return t.includes(`Sæt ${n}/`) && t.includes(navn)
  }, [forventNavn, n], { timeout: 15000 })
  // Et menneske ser paa kortet et oejeblik foer det trykker; forudfyldningen
  // naar at lande (den venter paa historikken).
  await page.waitForTimeout(600)
  const k = await kortet()
  assert.equal(k.navn, forventNavn, `kortet viser ${k.navn}, ventede ${forventNavn}`)
  assert.equal(k.saet, n)
  cur.felter = cur.felter || []
  cur.felter.push(`${forventNavn} s${n}: felt ${k.vaegt || '(tomt)'}${k.anbefalet != null ? `, anbefalet ${k.anbefalet}` : ''}`)
  if (k.anbefalet != null) {
    for (let i = 0; i < 80; i++) {
      const v = Number((await kortet()).vaegt || 0)
      if (v === k.anbefalet) break
      await tryk(page.getByRole('button', { name: v < k.anbefalet ? '2,5 kg mere' : '2,5 kg mindre', exact: true }), `${forventNavn} s${n}: vaegt ${v < k.anbefalet ? '+' : '-'} (felt ${k.vaegt || 'tomt'}, anbefalet ${k.anbefalet})`)
      cur.justeringer = (cur.justeringer || 0) + 1
    }
  }
  if (ekstra) await ekstra(k)
  const t = Date.now()
  await tryk(godkendt(), `${forventNavn} s${n}: Godkendt`)
  cur.godkendtMs = cur.godkendtMs || []
  await page.waitForFunction(([navn, n]) => !document.body.innerText.includes(`Sæt ${n}/`) || !document.body.innerText.includes(navn) || document.body.innerText.includes(`Sæt ${n + 1}/`), [forventNavn, n], { timeout: 15000 }).catch(() => {})
  cur.godkendtMs.push(Date.now() - t)
  return k
}

async function gaaTilFane(navn) {
  await tryk(page.locator('nav').getByText(navn, { exact: true }), `fane ${navn}`)
  await page.waitForTimeout(800)
}

try {
  // ---- log ind ----
  afsnit('log ind')
  await page.goto(`http://127.0.0.1:${port}/`)
  await tast(page.locator('#athlete-auth-email'), fx.ATHLETE_USER.email, 'email')
  await tast(page.locator('#athlete-auth-password'), fx.ATHLETE_USER.password, 'kodeord')
  await tryk(page.getByRole('button', { name: 'Log ind' }), 'Log ind')
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  navTop = await page.evaluate(() => { const n = document.querySelector('nav'); return n ? n.getBoundingClientRect().top : innerHeight })
  await page.waitForTimeout(1500)
  slut()
  await shot('01-hjem')
  maaling.navTop = navTop

  // ---- pas 1: log alle saet, fortryd et, og log det igen ----
  afsnit('pas 1 (squat): log + fortryd')
  const p1 = PAS[0].oevelser
  const foerste = await kortet()
  maaling.foersteKort = { navn: foerste.navn, vaegt: foerste.vaegt, anbefalet: foerste.anbefalet, sidsteGang: (foerste.tekst.match(/Sidste gang: [^\n]+/) || [null])[0] }
  await shot('02-pas1-foer-justering')
  for (let n = 1; n <= p1[0].saet; n++) {
    await logSaet('Squat', n)
    if (n === 1) await shot('03-pas1-efter-saet1')
    if (n === 3) {
      // Fortryd: sæt 3 var forkert, fortryd og log igen.
      await tryk(page.getByRole('button', { name: '↺ Fortryd sidste sæt' }).first(), 'Squat s3: fortryd')
      await page.getByText('Sæt 3/4', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await shot('04-pas1-fortrudt')
      await logSaet('Squat', 3)
    }
  }
  for (const o of p1.slice(1)) for (let n = 1; n <= o.saet; n++) await logSaet(o.navn, n)
  await page.waitForTimeout(800)
  slut()
  await shot('05-pas1-faerdig')

  // ---- pas 2: spring et over, ret et tal ----
  afsnit('pas 2 (baenk): spring over + ret')
  const p2 = PAS[1].oevelser
  await logSaet('Bænkpres', 1)
  await logSaet('Bænkpres', 2)
  // Ret et tal: sæt 1 var 5 reps, ikke det der stod.
  await tryk(page.getByRole('button', { name: /^Vis \d+ klarede sæt$/ }), 'vis klarede saet')
  await tryk(page.getByRole('button', { name: 'Ret sæt 1', exact: true }), 'Ret saet 1')
  await tryk(page.getByRole('button', { name: '1 rep mere (ret)', exact: true }), 'ret: 1 rep mere')
  await shot('06-pas2-ret')
  await tryk(page.getByRole('button', { name: 'Godkendt, ret sæt 1', exact: true }), 'ret: Godkendt')
  await logSaet('Bænkpres', 3)
  // Spring sæt 4 over.
  await page.getByText('Sæt 4/4', { exact: true }).waitFor({ state: 'visible' })
  await tryk(page.getByRole('button', { name: 'Spring over', exact: true }), 'Baenkpres s4: Spring over')
  for (const o of p2.slice(1)) for (let n = 1; n <= o.saet; n++) await logSaet(o.navn, n)
  await page.waitForTimeout(800)
  slut()
  await shot('07-pas2-faerdig')

  // ---- pas 3: RPE og note ----
  // Doedloeft s3 foeltes tungere end planlagt: atleten vil skrive RPE 9 og
  // en note ("ryg stram"). Foerst proever atleten RPE-feltet paa kortet.
  afsnit('pas 3 (doedloeft): RPE + note')
  const p3 = PAS[2].oevelser
  await logSaet('Dødløft', 1)
  await logSaet('Dødløft', 2)
  await page.getByText('Sæt 3/3', { exact: true }).waitFor({ state: 'visible' })
  const rpeKort = page.locator('span', { hasText: /^RPE \d/ }).first()
  if (await rpeKort.count()) {
    const foerTekst = await page.evaluate(() => document.body.innerText)
    await tryk(rpeKort, 'RPE-feltet paa kortet (proev)')
    await page.waitForTimeout(500)
    const efterTekst = await page.evaluate(() => document.body.innerText)
    if (foerTekst === efterTekst) maaling.doedeTryk.push('RPE-feltet paa Dagens pas-kortet ser ud som en knap, men et tryk goer intet')
  }
  const noteKort = page.getByPlaceholder(/note/i)
  maaling.noteFeltPaaKortet = await noteKort.count() > 0 && await noteKort.first().isVisible()
  await shot('08-pas3-rpe-paa-kortet')
  const tRpe = Date.now()
  const trykFoerRpe = cur.tryk
  const rulFoerRpe = cur.rul
  if (maaling.noteFeltPaaKortet || !maaling.doedeTryk.length) {
    // Efter rettelsen: RPE og note paa selve kortet (se blok 2).
    await tryk(page.getByRole('button', { name: /^RPE/ }).first(), 'RPE paa kortet')
    await tryk(page.getByRole('button', { name: '9', exact: true }).first(), 'RPE 9')
    await tast(page.getByPlaceholder(/note/i).first(), 'ryg stram', 'note paa kortet')
    await shot('09-pas3-rpe-note')
    await logSaet('Dødløft', 3)
  } else {
    // Foer: Program-fanen, aabn passet, find saet 3, RPE-vaelger, note, Log.
    await gaaTilFane('Program')
    await tryk(page.getByText(/^Dag 3 — Dødløft/), 'aabn Dag 3 i Program')
    // Doedloeft er foerste oevelse i Dag 3, saa foerste "Vaegt, saet 3" i
    // det aabne pas er doedloeftets saet 3; raekken er naermeste div med note-feltet.
    const saet3 = page.getByLabel('Vægt, sæt 3', { exact: true }).first().locator('xpath=ancestor::div[.//input[@placeholder="Tilføj note..."]][1]')
    await tryk(saet3.getByRole('button', { name: /^RPE/ }), 'RPE-vaelger saet 3')
    await tryk(page.getByRole('button', { name: '9', exact: true }).first(), 'RPE 9')
    await tast(saet3.getByPlaceholder('Tilføj note...'), 'ryg stram', 'note saet 3')
    await shot('09-pas3-rpe-note')
    await tryk(saet3.getByRole('button', { name: 'Log', exact: true }), 'Log saet 3 (Program)')
    await page.waitForTimeout(800)
    await gaaTilFane('Hjem')
  }
  maaling.rpeNote = { tryk: cur.tryk - trykFoerRpe, rul: cur.rul - rulFoerRpe, ms: Date.now() - tRpe }
  for (const o of p3.slice(1)) for (let n = 1; n <= o.saet; n++) await logSaet(o.navn, n)
  await page.waitForTimeout(800)
  slut()
  await shot('10-pas3-faerdig')

  // ---- pas 4: log alt, giv passet en vurdering ----
  afsnit('pas 4 (volumen): log + feedback')
  for (const o of PAS[3].oevelser) for (let n = 1; n <= o.saet; n++) await logSaet(o.navn, n)
  await page.waitForTimeout(800)
  await shot('11-pas4-faerdig')
  const tFb = Date.now()
  const trykFoerFb = cur.tryk
  const rulFoerFb = cur.rul
  const fbPaaHjem = page.getByText('Hvordan gik træningen?', { exact: false })
  if (!(await fbPaaHjem.count())) {
    await gaaTilFane('Program')
    await tryk(page.getByText(/^Dag 4 — Volumen/), 'aabn Dag 4 i Program')
  }
  await tryk(page.getByRole('button', { name: '4', exact: true }).last(), 'vurdering 4')
  await tryk(page.getByRole('button', { name: 'Gem feedback' }), 'Gem feedback')
  await page.waitForTimeout(800)
  maaling.feedback = { tryk: cur.tryk - trykFoerFb, rul: cur.rul - rulFoerFb, ms: Date.now() - tFb, paaHjem: (await fbPaaHjem.count()) > 0 }
  await shot('12-pas4-feedback')
  slut()

  // ---- historik: hvad loeftede jeg i sidste uge paa Dag 1? ----
  afsnit('historik: sidste uges Dag 1')
  if (!(await page.locator('nav').getByText('Program', { exact: true }).evaluate(e => e.closest('button')?.getAttribute('aria-current') === 'page').catch(() => false))) await gaaTilFane('Program')
  await tryk(page.getByRole('button', { name: /Forrige uge/ }), 'forrige uge')
  await tryk(page.getByText(/^Dag 1 — Squat/), 'aabn Dag 1')
  await page.waitForTimeout(500)
  await shot('13-historik')
  slut()

  // ---- fremskridt ----
  afsnit('fremskridt: Fremgang-fanen')
  await gaaTilFane('Fremgang')
  await page.waitForTimeout(1000)
  await shot('14-fremgang')
  maaling.fremgangTekst = (await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).slice(0, 600)
  slut()

  // ---- upload en video ----
  afsnit('video: upload og send')
  const clip = ensureSyntheticClip()
  await gaaTilFane('Hjem')
  const mere = page.getByRole('button', { name: 'Mere', exact: true })
  if (await mere.getAttribute('aria-expanded') !== 'true') await tryk(mere, 'Mere')
  await tryk(page.getByText('VideoCoach', { exact: true }), 'VideoCoach')
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 15000 })
  cur.tryk++; cur.log.push('vaelg video (filvaelger)')
  await frame.locator('#fileInput').setInputFiles(clip)
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 15000 })
  cur.tryk++; cur.log.push('vaelg loeft')
  await frame.locator('#liftSel').selectOption({ label: 'Squat' })
  await shot('15-video-sendeark')
  cur.tryk++; cur.log.push('Send')
  await frame.locator('#saveBtn').click()
  await page.waitForFunction(async ([u, a]) => (await (await fetch(`${u}/__e2e/table?name=video_analyses`)).json()).some(r => r.athlete_id === a && r.analysis_state === 'awaiting_analysis'), [mockUrl, fx.ATHLETE_ID], { timeout: 20000 })
  await shot('16-video-sendt')
  slut()

  // ---- data: intet tabt ----
  const logs = (await table('exercise_logs')).filter(r => r.athlete_id === fx.ATHLETE_ID && new Date(r.logged_at) > new Date(Date.now() - 3600000))
  maaling.ugensRaekker = logs.length
  maaling.sprungetOver = logs.filter(r => r.skipped).length
  maaling.medNote = logs.filter(r => r.note).map(r => ({ note: r.note, rpe: r.rpe_actual }))
  const forventet = PAS.reduce((a, p) => a + p.oevelser.reduce((b, o) => b + o.saet, 0), 0)
  assert.equal(logs.length, forventet, `en raekke pr. saet i ugen (${forventet}), fik ${logs.length}`)
  maaling.groen = true
} catch (e) {
  maaling.groen = false
  maaling.fejl = String(e?.stack || e)
  await shot('fejl').catch(() => {})
  console.error(e)
} finally {
  writeFileSync(path.join(UD, 'maaling.json'), JSON.stringify(maaling, null, 2) + '\n')
  // Anslaaet menneske-tid (KLM-agtig, ikke maalt): 1,2 s pr. tryk, 1,5 s pr.
  // rulning, 0,3 s pr. tegn. Maskintiden (ms) er klik til naeste tilstand.
  for (const a of Object.values(maaling.afsnit)) a.anslaaetS = Math.round((a.tryk * 1.2 + a.rul * 1.5 + a.tast * 0.3) * 10) / 10
  for (const [navn, a] of Object.entries(maaling.afsnit)) console.log(`${navn.padEnd(38)} tryk ${String(a.tryk).padStart(3)}  rul ${String(a.rul).padStart(2)}  tast ${String(a.tast).padStart(3)}  ${(a.ms / 1000).toFixed(1)} s maskine, ~${a.anslaaetS} s menneske${a.justeringer ? `  (+/- for at naa anbefalet: ${a.justeringer})` : ''}`)
  console.log('doede tryk:', maaling.doedeTryk, 'rpe/note:', maaling.rpeNote, 'feedback:', maaling.feedback)
  await browser.close(); server.close(); await mock.close()
  if (!maaling.groen) process.exit(1)
}
