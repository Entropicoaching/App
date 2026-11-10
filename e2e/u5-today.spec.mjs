// U5 "I dag" og let logning: headless mod den ægte app og mock-backenden (port 8991).
// Kun syntetiske data. Måler tryk, tastede tal og tid for vægt, dagsform, sæt og mad
// fra forsiden, til rækken står i den tabel, appen bruger i dag. Virker både med og
// uden U5-flaget, så samme spec giver før- og eftertal.
// Kør: node e2e/u5-today.spec.mjs [billedmappe] [maaling.json]
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]
// Samme model som visionsdokumentet: 1,5 s pr. tryk og 3 s pr. tastet tal.
const effort = (taps, numbers) => Math.round((taps * 1.5 + numbers * 3) * 10) / 10

function danishToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// I går: vægt, dagsform og tre måltider. Dagens squat har ingen coachvægt, men sidste uges pas har 85 kg × 5.
export function todaySeed() {
  const data = buildSeed()
  const t = data.tables, today = danishToday()
  for (const name of ['weight_logs', 'meal_logs']) t[name] = t[name] ?? []
  Object.assign(t.exercises[0], { recommended_weight: null })
  const lastWeek = { id: 'd1000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Base', start_date: addDays(t.weeks[0].start_date, -7) }
  t.weeks.unshift(lastWeek)
  t.sessions.push({ id: 'd2000000-0000-4000-8000-000000000001', week_id: lastWeek.id, title: 'Dag 1', session_order: 1, weekday: t.sessions[0].weekday })
  t.exercises.push({ id: 'd3000000-0000-4000-8000-000000000001', session_id: 'd2000000-0000-4000-8000-000000000001', name: 'Squat', sets: 4, reps: '4-6', exercise_order: 1, recommended_weight: null })
  t.exercise_logs.push({ id: 'd4000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, exercise_id: 'd3000000-0000-4000-8000-000000000001',
    set_number: 1, weight: 85, reps_completed: 5, skipped: false, note: null, rpe_actual: 8, logged_at: `${addDays(today, -7)}T16:00:00Z` })
  for (let i = 1; i <= 3; i++) t.weight_logs.push({ id: `d5000000-0000-4000-8000-00000000000${i}`, athlete_id: ATHLETE_ID, logged_at: addDays(today, -i), weight: 82.5 + (i - 1) * 0.2, created_at: `${addDays(today, -i)}T07:00:00Z` })
  t.readiness_logs.push({ id: 'd6000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, logged_date: addDays(today, -1), sleep_hours: 7.5,
    energy: 3, motivation: 4, stress: 2, soreness_level: 2, sore_zones: null, readiness_score: 74 })
  for (const [i, [meal, kcal, protein, carb, fat]] of [['Havregrød med skyr', 520, 32, 70, 12], ['Kylling, ris og grønt', 720, 52, 85, 16], ['Laks og kartofler', 680, 42, 60, 26]].entries())
    t.meal_logs.push({ id: `d7000000-0000-4000-8000-00000000000${i + 1}`, athlete_id: ATHLETE_ID, date: addDays(today, -1), meal, kcal, protein, carb, fat, created_at: `${addDays(today, -1)}T1${i}:00:00Z` })
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

// Intet element i "I dag" må gå ud over kanten eller ligge fast bag bundmenuen.
async function freeOfNav(page, width, selector) {
  const problems = await page.evaluate(({ selector, width }) => {
    const vh = window.innerHeight
    const navs = [...document.querySelectorAll('body *')].filter(el => {
      const st = getComputedStyle(el), r = el.getBoundingClientRect()
      return (st.position === 'fixed' || st.position === 'sticky') && r.height > 0 && r.height < vh / 3 && r.bottom >= vh - 2 && r.top > vh / 2
    })
    const navTop = Math.min(vh, ...navs.map(n => n.getBoundingClientRect().top))
    const docH = document.documentElement.scrollHeight, cover = vh - navTop, out = []
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect()
      if (!r.width || !el.checkVisibility({ visibilityProperty: true })) continue
      if (r.right > width + 1 || r.left < -1) out.push(`${el.tagName} ${[...el.attributes].map(a => a.name).join(' ')} går ud over kanten`)
      if (r.bottom + window.scrollY > docH - cover + 1) out.push(`${el.tagName} ${[...el.attributes].map(a => a.name).join(' ')} kan ikke rulles op over bundmenuen`)
    }
    // I dag-kortet skal stå helt over bundmenuen uden at rulle.
    const card = document.querySelector('[data-u5-today]')
    const top = card ? card.getBoundingClientRect() : null
    const firstAction = card?.querySelector('button, input')?.getBoundingClientRect()
    return { out, cover: Math.round(cover), firstActionVisible: firstAction ? firstAction.bottom <= navTop : null, cardTop: top ? Math.round(top.top) : null }
  }, { selector, width })
  if (problems.out.length) throw new Error(`Layout på ${width} px: ${problems.out.join('; ')}`)
  return problems
}

async function home(page) {
  await login(page, ATHLETE_USER)
  await page.locator('[data-entropi2-home]').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('[data-home-quick-logs]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1200)
  return (await page.locator('[data-u5-today]').count()) > 0
}

const rows = (mock, table, today, key) => mock.table(table).filter(r => r.athlete_id === ATHLETE_ID && String(r[key]).slice(0, 10) === today)
async function until(check, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) { if (check()) return true; await new Promise(r => setTimeout(r, 50)) }
  throw new Error('Rækken blev ikke gemt')
}

// Hver måling: fra forsiden er klar, til rækken står i mock-tabellen.
const FLOWS = {
  async weight(page, mock, u5, today) {
    let taps = 0, numbers = 0
    const t0 = Date.now()
    if (u5) {
      const save = page.locator('[data-u5-weight] button', { hasText: /^Gem .* kg$/ })
      await save.click(); taps++
    } else {
      await page.getByRole('button', { name: 'Vægt i dag', exact: true }).click(); taps++
      const input = page.locator('[data-home-quick-logs] input[inputmode="decimal"]')
      if (!(await input.inputValue()).trim()) { await input.fill('82,5'); numbers++ }
      await page.locator('[data-home-quick-logs] button[type="submit"]').click(); taps++
    }
    await until(() => rows(mock, 'weight_logs', today, 'logged_at').length === 1)
    return { taps, numbers, seconds: (Date.now() - t0) / 1000 }
  },
  async readiness(page, mock, u5, today) {
    let taps = 0, numbers = 0
    const t0 = Date.now()
    if (u5) {
      await page.locator('[data-u5-readiness] button[aria-label="Energi 4"]').click(); taps++
    } else {
      // Den gamle hurtigrække vises kun uden værtens forudfyldning; ellers den fulde formular.
      if (await page.locator('[data-home-readiness-fast]').count()) {
        await page.locator('[data-home-readiness-fast] button[aria-label="Energi 4"]').click(); taps++
        await page.locator('[data-home-readiness-fast] button[type="submit"]').click(); taps++
      } else {
        await page.getByRole('button', { name: 'Dagsform', exact: true }).click(); taps++
        await page.locator('[data-home-quick-logs] button[aria-label="Energi 4"]').click(); taps++
        await page.locator('[data-home-quick-logs] button[type="submit"]').click(); taps++
      }
    }
    await until(() => rows(mock, 'readiness_logs', today, 'logged_date').length === 1, 20000)
    return { taps, numbers, seconds: (Date.now() - t0) / 1000 }
  },
  async set(page, mock, u5, today) {
    let taps = 0, numbers = 0
    const before = mock.table('exercise_logs').length
    const t0 = Date.now()
    await page.getByRole('button', { name: /^Start (dagens|næste) pas$/ }).first().click(); taps++
    const form = page.locator('form[aria-label="Registrer sæt"]').first()
    await form.waitFor({ state: 'visible', timeout: 20000 })
    for (const [field, value] of [['weight', '85'], ['reps', '5']]) {
      const input = form.locator(`input[data-field="${field}"]`)
      if (!(await input.inputValue()).trim()) { await input.fill(value); numbers++ }
    }
    const prefilled = { weight: await form.locator('input[data-field="weight"]').inputValue(), reps: await form.locator('input[data-field="reps"]').inputValue() }
    await form.locator('button.approve').click(); taps++
    await until(() => mock.table('exercise_logs').length === before + 1)
    return { taps, numbers, seconds: (Date.now() - t0) / 1000, prefilled }
  },
  async meal(page, mock, u5, today) {
    let taps = 0, numbers = 0
    const t0 = Date.now()
    if (u5) {
      await page.locator('[data-u5-meal] button', { hasText: /Jeg spiste som i går/ }).click(); taps++
    } else {
      await page.locator('nav[aria-label="Genveje"]').getByRole('button', { name: 'Kost', exact: true }).click(); taps++
      const repeat = page.getByRole('button', { name: /Jeg spiste som i går/ }).first()
      await repeat.waitFor({ state: 'visible', timeout: 20000 })
      await repeat.click(); taps++
    }
    await until(() => rows(mock, 'meal_logs', today, 'date').length === 3)
    return { taps, numbers, seconds: (Date.now() - t0) / 1000 }
  },
}

async function athleteShots(page, vp, outDir, mode) {
  const u5 = await home(page)
  await noSideScroll(page, vp.width)
  const layout = u5 ? await freeOfNav(page, vp.width, '[data-u5-today], [data-u5-today] *') : null
  await page.screenshot({ path: join(outDir, `u5-${mode}-atlet-${vp.name}-1-forside.png`) })
  await page.screenshot({ path: join(outDir, `u5-${mode}-atlet-${vp.name}-2-hele-forsiden.png`), fullPage: true })
  if (u5) {
    const text = await page.locator('[data-u5-today]').textContent()
    if (!/Mangler i dag: vægt, dagsform, træning og mad/.test(text)) throw new Error('Overskriften mangler noget: ' + text)
    if (/Testatlet/.test(text)) throw new Error('Navn i I dag-kortet')
    // Skærmbillede med kortets bund lige over bundmenuen, som atleten ser det efter et lille ryk.
    await page.locator('[data-u5-today]').evaluate(el => { el.scrollIntoView({ block: 'end' }); window.scrollBy(0, 72) })
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(outDir, `u5-${mode}-atlet-${vp.name}-3-i-dag-kort-bund.png`) })
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  return { u5, layout }
}

async function athleteDone(page, vp, outDir, mode, mock) {
  const u5 = await home(page)
  if (!u5) return { u5 }
  const today = danishToday()
  await FLOWS.weight(page, mock, u5, today)
  await FLOWS.readiness(page, mock, u5, today)
  await FLOWS.meal(page, mock, u5, today)
  await page.waitForTimeout(500)
  const text = await page.locator('[data-u5-today]').textContent()
  if (!/Mangler i dag: træning/.test(text) || !/Klaret: vægt, dagsform og mad/.test(text)) throw new Error('Efter logning: ' + text)
  await noSideScroll(page, vp.width)
  await freeOfNav(page, vp.width, '[data-u5-today], [data-u5-today] *')
  await page.screenshot({ path: join(outDir, `u5-${mode}-atlet-${vp.name}-4-efter-tre-logninger.png`) })
  return { u5, text }
}

async function coach(page, vp, outDir, mode) {
  await login(page, COACH_USER)
  await page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1500)
  if (await page.locator('[data-u5-today]').count()) throw new Error('I dag-kortet vises hos coachen')
  await noSideScroll(page, vp.width)
  await page.screenshot({ path: join(outDir, `u5-${mode}-coach-${vp.name}-1-forside.png`) })
  return { coach: 'uden I dag-kort' }
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  const measureFile = process.argv[3]
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const results = [], measured = {}
  let mode = 'ukendt'
  const fresh = async (vp, run) => {
    const mock = createMockSupabase(todaySeed())
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
  try {
    // Målingerne på 390 px, hver logning på en frisk forside.
    for (const [key, flow] of Object.entries(FLOWS)) {
      const r = await fresh(VIEWPORTS[0], async (page, mock) => {
        const u5 = await home(page)
        mode = u5 ? 'efter' : 'foer'
        return flow(page, mock, u5, danishToday())
      })
      measured[key] = { ...r, effortSeconds: effort(r.taps, r.numbers) }
      console.log(`MÅLT ${mode} ${key}: ${JSON.stringify(measured[key])}`)
    }
    for (const vp of VIEWPORTS) {
      results.push(['atlet', vp.width, await fresh(vp, page => athleteShots(page, vp, outDir, mode))])
      results.push(['atlet-efter-logning', vp.width, await fresh(vp, (page, mock) => athleteDone(page, vp, outDir, mode, mock))])
      results.push(['coach', vp.width, await fresh(vp, page => coach(page, vp, outDir, mode))])
    }
    for (const r of results) console.log(`GRØN: ${r[0]} på ${r[1]} px ${JSON.stringify(r[2]).slice(0, 300)}`)
  } finally {
    await browser.close(); await vite.stop()
  }
  if (measureFile) writeFileSync(measureFile, JSON.stringify({ mode, measured, results }, null, 2))
  console.log(`U5 e2e (${mode}): ${results.length} af 6 grønne, 4 målinger`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
