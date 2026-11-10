// U6 "Data der beslutter": headless mod den ægte app og mock-backenden (port 8991).
// Kun syntetiske data. Virker både med og uden U6-flagene, så samme spec giver før- og efterbilleder.
// Kør: node e2e/u6-data.spec.mjs [billedmappe] [resultat.json]
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { todaySeed } from './u5-today.spec.mjs'

const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]

function danishToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const mondayOf = day => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

// Oven på U5's seed: coachens plan 87,5 kg på dagens squat (sidst 85 kg), readiness der
// falder de sidste 3 dage, og en sidste uge med mere tonnage end snittet af de 3 før.
export function u6Seed() {
  const data = todaySeed()
  const t = data.tables, today = danishToday(), monday = mondayOf(today)
  Object.assign(t.exercises[0], { recommended_weight: 87.5 })
  t.readiness_logs = []
  for (let i = 1; i <= 20; i++) t.readiness_logs.push({ id: uuid('e6000000', i), athlete_id: ATHLETE_ID, logged_date: addDays(today, -i), sleep_hours: 7.5,
    energy: i <= 3 ? 2 : 4, motivation: 4, stress: 2, soreness_level: 2, sore_zones: null, readiness_score: i <= 3 ? 55 + i : (i % 2 ? 72 : 68) })
  const benchId = uuid('e3000000', 1)
  t.exercises.push({ id: benchId, session_id: 'd2000000-0000-4000-8000-000000000001', name: 'Bænkpres', sets: 1, reps: '10', exercise_order: 2, recommended_weight: null })
  for (const [i, kg] of [110, 100, 120, 150].entries()) t.exercise_logs.push({ id: uuid('e4000000', i + 1), athlete_id: ATHLETE_ID, exercise_id: benchId,
    set_number: 1, weight: kg, reps_completed: 10, skipped: false, note: null, rpe_actual: 8, logged_at: `${addDays(monday, -28 + 7 * i + 1)}T17:00:00Z` })
  return data
}

async function login(page, user) {
  await page.addInitScript(id => {
    try { localStorage.setItem('entropi2:onboarding:v1', '1'); localStorage.setItem(`entropi2:onboarding:v1:athlete:${encodeURIComponent(id)}`, '1') } catch { /* syntetisk */ }
  }, ATHLETE_ID)
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function noSideScroll(page, width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > width + 1) throw new Error(`Vandret scroll på ${width} px: ${scroll}px`)
}

// Intet valgt element går ud over kanten eller ligger fast bag en fast bundmenu.
// first: de elementer, der skal ses over bundmenuen allerede ved åbning uden at rulle.
async function layout(page, width, selector, first = null) {
  const r = await page.evaluate(({ selector, width, first }) => {
    const vh = window.innerHeight
    const navs = [...document.querySelectorAll('body *')].filter(el => {
      const st = getComputedStyle(el), b = el.getBoundingClientRect()
      return (st.position === 'fixed' || st.position === 'sticky') && b.height > 0 && b.height < vh / 3 && b.bottom >= vh - 2 && b.top > vh / 2
    })
    const navTop = Math.min(vh, ...navs.map(n => n.getBoundingClientRect().top))
    const docH = document.documentElement.scrollHeight, cover = vh - navTop, out = []
    for (const el of document.querySelectorAll(selector)) {
      const b = el.getBoundingClientRect()
      if (!b.width || !el.checkVisibility({ visibilityProperty: true })) continue
      if (b.right > width + 1 || b.left < -1) out.push(`${el.tagName} ${[...el.attributes].map(a => a.name).join(' ')} går ud over kanten`)
      if (b.bottom + window.scrollY > docH - cover + 1) out.push(`${el.tagName} ${[...el.attributes].map(a => a.name).join(' ')} kan ikke rulles op over bundmenuen`)
    }
    const firstEl = first ? document.querySelector(first) : null
    const fb = firstEl?.getBoundingClientRect()
    return { out, navTop: Math.round(navTop), firstBottom: fb ? Math.round(fb.bottom) : null, firstVisible: fb ? fb.bottom <= navTop : null }
  }, { selector, width, first })
  if (r.out.length) throw new Error(`Layout på ${width} px: ${r.out.join('; ')}`)
  return r
}

async function home(page) {
  await login(page, ATHLETE_USER)
  await page.locator('[data-entropi2-home]').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('[data-home-quick-logs]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-u5-meal]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1200)
  return (await page.locator('[data-u6-plan-weight]').count()) > 0
}

async function athlete(page, vp, outDir, mode) {
  const u6 = await home(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await noSideScroll(page, vp.width)
  const fit = await layout(page, vp.width, '[data-u5-today], [data-u5-today] *', '[data-u5-meal] button')
  await page.screenshot({ path: join(outDir, `u6-${mode}-atlet-${vp.name}-1-forside.png`) })
  await page.screenshot({ path: join(outDir, `u6-${mode}-atlet-${vp.name}-2-hele-forsiden.png`), fullPage: true })
  const card = await page.locator('[data-u5-today]').textContent()
  if (/Testatlet/.test(card)) throw new Error('Navn i I dag-kortet')
  // Kortets bund lige over bundmenuen, som atleten ser det efter et lille ryk.
  await page.locator('[data-u5-today]').evaluate(el => { el.scrollIntoView({ block: 'end' }); window.scrollBy(0, 72) })
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(outDir, `u6-${mode}-atlet-${vp.name}-2b-i-dag-kort-bund.png`) })
  await page.evaluate(() => window.scrollTo(0, 0))
  let firstSet = null
  if (u6) {
    if (!/Squat 87,5 kg \(\+2,5\)/.test(card)) throw new Error('Planvægten mangler: ' + card)
    if (!fit.firstVisible) throw new Error(`Mad-knappen står under bundmenuen ved åbning: bund ${fit.firstBottom}, menu ${fit.navTop}`)
    await page.getByRole('button', { name: /^Start (dagens|næste) pas$/ }).first().click()
    const form = page.locator('form[aria-label="Registrer sæt"]').first()
    await form.waitFor({ state: 'visible', timeout: 20000 })
    firstSet = await form.locator('input[data-field="weight"]').inputValue()
    if (!/^87[.,]5$/.test(firstSet)) throw new Error('Første sæt har ikke planvægten: ' + firstSet)
    await page.screenshot({ path: join(outDir, `u6-${mode}-atlet-${vp.name}-3-foerste-saet.png`) })
  }
  return { u6, madOverMenu: fit.firstVisible, madBund: fit.firstBottom, menuTop: fit.navTop, firstSet }
}

async function coach(page, vp, outDir, mode, mock) {
  await login(page, COACH_USER)
  await page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('Readiness falder', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1500)
  const u6 = (await page.locator('[data-u6-draft]').count()) > 0
  if (u6) await page.locator('[data-u6-heavy-week]').first().waitFor({ state: 'visible', timeout: 20000 })
  await noSideScroll(page, vp.width)
  await layout(page, vp.width, '[data-u6-draft], [data-u6-draft] *, [data-u6-heavy-week]')
  const section = page.locator('section[aria-label="Atleter der kræver handling"]')
  await page.screenshot({ path: join(outDir, `u6-${mode}-coach-${vp.name}-1-forside.png`) })
  await section.screenshot({ path: join(outDir, `u6-${mode}-coach-${vp.name}-2-kraever-dit-blik.png`) })
  if (!u6) return { u6 }
  const draft = (await page.locator(`[data-u6-draft="${ATHLETE_ID}"]`).textContent()).replace(/^Udkast: /, '').replace(/Skriv$/, '')
  const heavy = await page.locator(`[data-u6-heavy-week="${ATHLETE_ID}"]`).textContent()
  if (!/^Tung uge\. Readiness \d+ de sidste 3 dage mod \d+ i ugerne før\. Tonnage [\d,]+ t i sidste uge mod [\d,]+ t i snit de 3 uger før\./.test(heavy))
    throw new Error('Forslaget mangler tal: ' + heavy)
  const sent = mock.table('messages').length
  await page.locator(`[data-u6-draft="${ATHLETE_ID}"] button`, { hasText: 'Skriv' }).click()
  const box = page.locator('section[aria-label="Samlet samtale"] textarea').first()
  await box.waitFor({ state: 'visible', timeout: 20000 })
  const start = Date.now()
  while (!(await box.inputValue()).trim() && Date.now() - start < 15000) await page.waitForTimeout(100)
  const value = await box.inputValue()
  if (value !== draft.trim()) throw new Error(`Feltet har ikke udkastet: "${value}" mod "${draft}"`)
  await page.waitForTimeout(2000)
  if (mock.table('messages').length !== sent) throw new Error('Der blev sendt en besked uden coachens tryk')
  await noSideScroll(page, vp.width)
  await box.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(outDir, `u6-${mode}-coach-${vp.name}-3-skriv-udkast.png`) })
  return { u6, draft: value.slice(0, 80), heavy: heavy.slice(0, 120), sendt: 0 }
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  const resultFile = process.argv[3]
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const results = []
  const fresh = async (vp, run) => {
    const mock = createMockSupabase(u6Seed())
    await mock.listen(MOCK_PORT)
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const result = await run(page, mock)
      if (errors.length) throw new Error(`browserfejl: ${errors.join('; ')}`)
      return result
    } finally { await page.close(); await mock.close?.() }
  }
  let mode = 'ukendt'
  try {
    // Første kørsel afgør, om U6 er tændt; billedernes navne følger det.
    const probe = await fresh(VIEWPORTS[0], page => home(page))
    mode = probe ? 'efter' : 'foer'
    for (const vp of VIEWPORTS) {
      results.push(['atlet', vp.width, await fresh(vp, page => athlete(page, vp, outDir, mode))])
      results.push(['coach', vp.width, await fresh(vp, (page, mock) => coach(page, vp, outDir, mode, mock))])
    }
    for (const r of results) console.log(`GRØN: ${r[0]} på ${r[1]} px ${JSON.stringify(r[2]).slice(0, 400)}`)
  } finally {
    await browser.close(); await vite.stop()
  }
  if (resultFile) writeFileSync(resultFile, JSON.stringify({ mode, results }, null, 2))
  console.log(`U6 e2e (${mode}): ${results.length} af 4 grønne`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
