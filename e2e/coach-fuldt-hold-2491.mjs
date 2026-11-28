// ORDRE 2491 · maaling af coachens forside, sidemenu og indbakke med 15 syntetiske atleter. Kun syntetiske data, Chromium, fast tid loerdag 2026-11-28.
// Koersel: E2E_VITE_PORT=5491 E2E_MOCK_PORT=8991 VITE_SUPABASE_URL=http://127.0.0.1:8991 [E2E_BREDDE=1280] [E2E_TEMA=lys] node e2e/coach-fuldt-hold-2491.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, kostPakkeTilAtlet } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const DESKTOP = process.env.E2E_BREDDE === '1280'
const LYS = process.env.E2E_TEMA === 'lys'
const LABEL = `${DESKTOP ? 1280 : 390}${LYS ? '-lys' : '-moerk'}`
const FAST = Date.parse('2026-11-28T08:00:00Z')
const ago = min => new Date(FAST - min * 60000).toISOString()
const dag = n => ago(n * 1440)
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const MANDAG = '2026-11-23'
// 15 atleter: smerte 2, ingen log 3, video 2, programslut 2, kost 3, rolig 3
const TYPER = ['smerte', 'smerte', 'ingenlog', 'ingenlog', 'ingenlog', 'video', 'video', 'slut', 'slut', 'kost', 'kost', 'kost', 'rolig', 'rolig', 'rolig']
const FORNAVNE = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar']

export function seed() {
  const data = buildSeed({ now: new Date(FAST) }), t = data.tables
  t.athletes = []; t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []; t.messages = []; t.video_analyses = []
  TYPER.forEach((type, i) => {
    const n = String(i + 1).padStart(12, '0'), m = String(i + 1).padStart(3, '0')
    const userId = `24910000-0000-4000-8000-${n}`, athleteId = `24911111-1111-4111-8111-${n}`
    t.profiles.push({ id: userId, role: 'athlete', email: `h${i + 1}@e2e.test`, last_seen: null })
    t.athletes.push({ id: athleteId, user_id: userId, name: `Atlet ${FORNAVNE[i]}`, coach_id: COACH_USER.id, email: `h${i + 1}@e2e.test`,
      status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: '2026-09-01T08:00:00Z' })
    const starter = type === 'slut' ? [MANDAG] : [MANDAG, addDays(MANDAG, 7)]
    if (type !== 'kost') starter.forEach((start, w) => {
      const wk = `${m}${w + 1}`
      t.weeks.push({ id: `24912222-2222-4222-8222-000000000${wk}`, athlete_id: athleteId, week_number: w + 1, block_name: 'Base', start_date: start })
      t.sessions.push({ id: `24913333-3333-4333-8333-000000000${wk}`, week_id: `24912222-2222-4222-8222-000000000${wk}`, title: 'Dag 1 · Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
      t.exercises.push({ id: `24914444-4444-4444-8444-000000000${wk}`, session_id: `24913333-3333-4333-8333-000000000${wk}`, name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
    })
    const exId = `24914444-4444-4444-8444-000000000${m}1`
    const log = (dageSiden, note) => t.exercise_logs.push({ id: `24915555-5555-4555-8555-${n}`, exercise_id: exId, athlete_id: athleteId, set_number: 1, weight: 100, reps_completed: 5,
      note, rpe_actual: 7, rpe_planned: null, skipped: false, logged_at: dag(dageSiden) })
    if (type === 'smerte') log(1, 'Syntetisk note: knæet gør ondt')
    else if (type === 'ingenlog') log(5, null)
    else if (type === 'kost') kostPakkeTilAtlet(t, { athleteId, now: new Date(FAST) })
    else log(0, null)
    if (type === 'video') t.video_analyses.push({ id: `24916666-6666-4666-8666-${n}`, athlete_id: athleteId, lift: 'squat', variation: 'competition_squat', load_kg: 100, reps_count: null,
      status: 'draft', source_mode: 'athlete_submission', analysis_state: null, created_at: ago(60) })
    if (i < 8) t.messages.push({ id: `24917777-7777-4777-8777-${n}`, athlete_id: athleteId, sender_role: 'athlete', content: 'Syntetisk besked', category: 'besked', read_by_coach: false, read_at: null, created_at: ago(30 + i * 40) })
  })
  const planer = t.kostplan_v1_plans ?? []
  planer.forEach((p, i) => { p.id = `24918888-8888-4888-8888-${String(i + 1).padStart(12, '0')}` })
  return data
}

const taet = s => s.replace(/\s+/g, ' ').trim()
async function main() {
  const mock = createMockSupabase(seed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite(), browser = await launchBrowser()
  const maal = { label: LABEL }
  try {
    const page = await browser.newPage({ viewport: DESKTOP ? { width: 1280, height: 800 } : { width: 390, height: 844 }, colorScheme: LYS ? 'light' : 'dark' })
    const fejl = []
    page.on('pageerror', err => fejl.push(err.message))
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fejl.push(m.text()) })
    await page.clock.setFixedTime(new Date(FAST))
    await page.goto(APP_URL)
    if (LYS) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    const t0 = Date.now()
    await page.getByRole('button', { name: 'Log ind' }).click()
    const idag = page.locator('[data-coach-idag]')
    await idag.waitFor({ state: 'visible', timeout: 30000 })
    await idag.locator('[data-coach-action]').first().waitFor({ state: 'visible', timeout: 30000 })
    maal.forsideFoersteRaekkeMs = Date.now() - t0
    await page.waitForTimeout(2500)
    maal.perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      return { domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0), load: Math.round(nav?.loadEventEnd ?? 0) }
    })
    maal.raekkerIdag = await idag.locator('[data-coach-action]').count()
    maal.raekkerSynlige = await page.evaluate(() => {
      const vh = window.innerHeight
      return [...document.querySelectorAll('[data-coach-idag] [data-coach-action]')].filter(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh }).length
    })
    maal.raekkeTekster = (await idag.locator('[data-coach-action]').allInnerTexts()).map(taet)
    maal.forsideHoejde = await page.evaluate(() => document.documentElement.scrollHeight)
    maal.overskrifter = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).slice(0, 30))
    await page.screenshot({ path: join(process.env.E2E_2491_OUT || OUT_DIR, `coach-fuldt-hold-2491-forside-${LABEL}.png`), fullPage: false })
    // Hvem der kræver coachen set fra forsiden uden tryk (rækker i Kræver dig i dag og Mangler ny uge)
    const KRAEVER = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India']
    const forsideTekst = taet(await page.locator('main').first().innerText())
    const raekkeNavne = (await page.locator('[data-coach-action]').allInnerTexts()).join(' ')
    maal.kraeverIAlt = KRAEVER.length
    maal.kraeverSetPaaForsiden = KRAEVER.filter(n => raekkeNavne.includes(`Atlet ${n} ·`)).length
    maal.kraeverIkkeSet = KRAEVER.filter(n => !raekkeNavne.includes(`Atlet ${n} ·`))
    // Sidemenu: ved 390 px bag Menu-knappen, ved 1280 altid synlig
    // Ved 390 px har Menu-arket ingen Atleter-knap (kun med coachRyd); sidemenuen er derfor kun nået ved 1280 px. Vi tæller Menu-arkets knapper i stedet.
    if (!DESKTOP) { await page.getByRole('button', { name: /^MENU$/i }).click(); await page.waitForTimeout(500); maal.menuArkKnapper = (await page.locator('div[style*="z-index: 210"] button').allInnerTexts()).map(taet); await page.screenshot({ path: join(process.env.E2E_2491_OUT || OUT_DIR, `coach-fuldt-hold-2491-menu-${LABEL}.png`) }); await page.locator('div[style*="z-index: 205"]').click({ position: { x: 190, y: 100 } }); await page.waitForTimeout(300) }
    maal.sidemenu = await page.evaluate(() => {
      const aside = document.querySelector('aside'), nav = aside?.querySelector('nav')
      const r = el => el ? Math.round(el.getBoundingClientRect().height) : null
      const navAtleter = [...(nav?.children ?? [])].filter(b => /Uge \d|Intet program/.test(b.innerText))
      return { asideHoejde: r(aside), navHoejde: r(nav), navScrollHoejde: nav?.scrollHeight ?? null, atleterIMenu: navAtleter.length,
        enAtletHoejde: navAtleter[0] ? r(navAtleter[0]) : null, soegefelt: aside?.querySelectorAll('input').length ?? 0,
        saaMangeUdenAtRulle: navAtleter.filter(b => { const q = b.getBoundingClientRect(); return q.top >= 0 && q.bottom <= window.innerHeight }).length }
    })
    await page.screenshot({ path: join(process.env.E2E_2491_OUT || OUT_DIR, `coach-fuldt-hold-2491-sidemenu-${LABEL}.png`), fullPage: false })
    if (!DESKTOP) { await page.evaluate(() => document.querySelector('aside') && [...document.querySelectorAll('div')].find(d => getComputedStyle(d).position === 'fixed' && d.style.zIndex === '199')?.click()); await page.waitForTimeout(400) }
    // Soegning i Dine atleter
    const soeg = page.locator('input').first()
    maal.soegefeltFindes = await soeg.count()
    if (maal.soegefeltFindes) {
      await soeg.scrollIntoViewIfNeeded().catch(() => {})
      await soeg.fill('Oscar'); await page.waitForTimeout(400)
      maal.soegOscarTekst = taet(await page.locator('[aria-label="Dine atleter"]').innerText()).slice(0, 160)
      await soeg.fill('')
    }
    // Indbakke
    const t1 = Date.now()
    const briefing = DESKTOP ? page.locator('aside').getByText(/COACH BRIEFING/i).first() : page.getByRole('button', { name: /COACH BRIEFING/i }).last()
    await briefing.click()
    await page.getByRole('heading', { name: 'Indbakke' }).waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('[data-coach-inbox-count]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
    maal.indbakkeMs = Date.now() - t1
    maal.indbakkeTaelling = taet(await page.locator('[data-coach-inbox-count]').innerText().catch(() => ''))
    maal.indbakkeRaekker = await page.locator('[data-coach-action]').count()
    maal.indbakkeSynlige = await page.evaluate(() => [...document.querySelectorAll('[data-coach-action]')].filter(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight }).length)
    maal.indbakkeTekster = (await page.locator('[data-coach-action]').allInnerTexts()).map(taet)
    maal.indbakkeBadge = taet(await briefing.innerText())
    await page.screenshot({ path: join(process.env.E2E_2491_OUT || OUT_DIR, `coach-fuldt-hold-2491-indbakke-${LABEL}.png`), fullPage: false })
    maal.bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    maal.fejl = fejl
    console.log(JSON.stringify(maal, null, 1))
    if (process.env.E2E_2491_DUMP) {
      console.log((await page.evaluate(() => document.body.innerText)).slice(0, 5000))
      console.log(await page.evaluate(() => [...document.querySelectorAll('button,a,input,[role=tab]')].map(e => `${e.tagName}:${(e.innerText || e.placeholder || e.ariaLabel || '').replace(/\s+/g, ' ').slice(0, 40)}`).join('\n')))
    }
  } catch (err) { await browser.contexts()[0]?.pages()[0]?.screenshot({ path: '../2491-tmp/fejl.png' }).catch(() => {}); console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-fuldt-hold-2491.mjs')) main()
