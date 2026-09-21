#!/usr/bin/env node
// ORDRE 285 · commit 1 — "listen under vægt": afvigelseslisten fra 281 med
// tredive atleter i mocken. Måler (mod den ægte, ubyggede app via
// e2e/harness.mjs's vite-dev-server, samme konvention som 281's egen
// e2e/coach-afvigelse.spec.mjs bruger): hvor lang tid tager første visning
// (login → listen synlig), hvor lang tid tager sortering efter "Afvigelse
// denne uge" med 30 atleter, hvor mange netværkskald sker under første
// visning, og om listen ruller uden at hakke (rAF-sampling, headless CDP —
// ALDRIG OS-musen) på en telefon-profil (390×844, 4x CPU-nedsat, samme tal
// som scripts/maal-coach-telefon.mjs's THROTTLE).
//
// Kørsel: node scripts/maal-mandagsrunden.mjs [--label X]
// Skriver: outputs/_seneste/maal-mandagsrunden/<label|dato>.json + en tabel
// i terminalen. DÆKKER IKKE: rigtig Supabase (mock), rigtig netværksvej
// (localhost), rigtige atletdata (attrap-atleter).

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, COACH_USER } from '../e2e/fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from '../e2e/harness.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

const ATHLETE_COUNT = Number(process.env.MAAL_MANDAGSRUNDEN_N || 30)
const MOBILE_VIEWPORT = { width: 390, height: 844 }
const CPU_THROTTLE_RATE = 4 // samme tal som scripts/maal-coach-telefon.mjs's THROTTLE.cpuRate

function isoNow() { return new Date().toISOString() }
function todayStr() { return new Date().toISOString().slice(0, 10) }

// --- tredive atleter, tre lige store grupper (samme tre tilstande som
// 281's egen e2e-prøve, blot i skala): skredet, på sporet, ingen plan. ----
function buildTredive(seed) {
  const { tables } = seed
  for (let i = 0; i < ATHLETE_COUNT; i++) {
    const group = i % 3 // 0=skredet, 1=paa sporet, 2=ingen plan
    const userId = `f0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    const athleteId = `f1111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`
    // Meget langt navn på én atlet (blok 2-overlap: listen skal ikke
    // knække layoutet ved 30 atleter heller).
    const name = i === 0
      ? 'Ø Kristoffer-Alexander Skovgaard-Rasmussen-Andersen'
      : `Ø Atlet ${String(i + 1).padStart(2, '0')}`
    tables.profiles.push({ id: userId, role: 'athlete', email: `atlet${i + 1}@maal.test`, last_seen: null })
    tables.athletes.push({
      id: athleteId, user_id: userId, name, email: `atlet${i + 1}@maal.test`,
      status: 'active', hidden: false, snooze_until: null, competition_date: null,
      onboarding_completed_at: isoNow(),
    })
    if (group === 2) continue // ingen plan: ingen uger/sessioner/øvelser
    const weekId = `f2222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`
    const sessionId = `f3333333-3333-4333-8333-${String(i + 1).padStart(12, '0')}`
    const exerciseId = `f4444444-4444-4444-8444-${String(i + 1).padStart(12, '0')}`
    const sets = group === 0 ? 10 : 6
    const recommendedWeight = 80
    tables.weeks.push({ id: weekId, athlete_id: athleteId, week_number: 1, block_name: 'Base', start_date: todayStr() })
    tables.sessions.push({ id: sessionId, week_id: weekId, title: 'Dag 1 — Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
    tables.exercises.push({ id: exerciseId, session_id: sessionId, name: 'Squat', sets, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: recommendedWeight })
    const loggedSets = group === 0 ? 2 : sets // skredet: kun 2 af 10 · på sporet: alle
    for (let s = 1; s <= loggedSets; s++) {
      tables.exercise_logs.push({
        id: `f5555555-${String(i + 1).padStart(4, '0')}-4555-8555-${String(s).padStart(12, '0')}`,
        exercise_id: exerciseId, athlete_id: athleteId, set_number: s, weight: recommendedWeight,
        reps_completed: 1, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: isoNow(),
      })
    }
  }
  return seed
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function measureScroll(page, client) {
  // Programmatisk scroll over ~1200ms, samplet med requestAnimationFrame —
  // headless CDP, ingen OS-mus. Rapporterer antal frames over 16,7ms-budget
  // (droppede frames ved 60fps) og det længste enkelt-frame-gab.
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE })
  const result = await page.evaluate(() => new Promise(resolve => {
    const deltas = []
    let last = performance.now()
    let scrolled = 0
    const targetScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const start = performance.now()
    function step(now) {
      deltas.push(now - last)
      last = now
      const elapsed = now - start
      const t = Math.min(1, elapsed / 1200)
      window.scrollTo(0, targetScroll * t)
      scrolled++
      if (t < 1) requestAnimationFrame(step)
      else resolve({ deltas, scrolled })
    }
    requestAnimationFrame(step)
  }))
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const frameDeltas = result.deltas.slice(1) // første delta er opstart, ikke et reelt frame-gab
  const droppedFrames = frameDeltas.filter(d => d > 16.7).length
  const longestFrameMs = Math.round(Math.max(0, ...frameDeltas))
  return { frames: frameDeltas.length, droppedFrames, longestFrameMs, jankFrit: droppedFrames === 0 || longestFrameMs < 50 }
}

async function main() {
  const label = process.argv.includes('--label') ? process.argv[process.argv.indexOf('--label') + 1] : null
  const outName = label || new Date().toISOString().slice(0, 10)
  const outDir = path.join(repoRoot, 'outputs', '_seneste', 'maal-mandagsrunden')
  mkdirSync(outDir, { recursive: true })

  console.log(`Bygger mock med ${ATHLETE_COUNT} atleter...`)
  const mock = createMockSupabase(buildTredive(buildSeed()))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()

  const rows = {}
  try {
    const page = await browser.newPage({ viewport: MOBILE_VIEWPORT, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    const client = await page.context().newCDPSession(page)
    await client.send('Network.enable')
    let reqCount = 0
    let apiCallCount = 0
    // Vite-dev serverer ubundlede ES-moduler (mange småkald) — det tal siger
    // intet om selve listens datavej. Skelner derfor fra kald der reelt går
    // til mocken (/rest/v1 · /auth/v1 — se e2e/mock-supabase.mjs), som er
    // det tal der beviser (eller modbeviser) et N+1-problem pr. atlet.
    client.on('Network.requestWillBeSent', (e) => {
      reqCount++
      if (/:8991\/(rest|auth)\/v1\//.test(e.request.url)) apiCallCount++
    })

    // ---- Første visning: login → listen synlig ----
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    const t0 = Date.now()
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Ø Atlet 02/ }).waitFor({ state: 'visible', timeout: 20000 })
    const t1 = Date.now()
    rows.foersteVisningMs = t1 - t0
    rows.netvaerkskaldFoersteVisningTotal = reqCount
    rows.apiKaldFoersteVisning = apiCallCount

    // ---- "Vis alle" (30 > ATHLETE_LIST_LIMIT=25) ----
    const visAlleKnap = page.getByRole('button', { name: /Vis alle 3\d/ })
    if (await visAlleKnap.count()) {
      await visAlleKnap.click()
      await page.getByRole('button', { name: /Ø Kristoffer-Alexander/ }).waitFor({ state: 'visible', timeout: 10000 })
    }

    // ---- Sortér efter "Afvigelse denne uge", 30 atleter ----
    const t2 = Date.now()
    await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('div[role="button"]')].map(el => el.textContent || '')
      return rows.some(t => t.includes('Ingen plan'))
    }, { timeout: 10000 })
    const t3 = Date.now()
    rows.sorteringMs = t3 - t2

    // ---- Ruller den uden at hakke? ----
    rows.scroll = await measureScroll(page, client)

    await page.close()
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }

  writeFileSync(path.join(outDir, `${outName}.json`), JSON.stringify(rows, null, 2), 'utf8')
  console.log('\n| Måling | Værdi |')
  console.log('| --- | --- |')
  console.log(`| Første visning (login → liste synlig, ${ATHLETE_COUNT} atleter) | ${rows.foersteVisningMs}ms |`)
  console.log(`| API-kald til mocken under første visning (/rest+auth/v1) | ${rows.apiKaldFoersteVisning} |`)
  console.log(`| Alle netværkskald (inkl. vite-devs ubundlede JS-moduler) | ${rows.netvaerkskaldFoersteVisningTotal} |`)
  console.log(`| Sortering "Afvigelse denne uge" (klik → sorteret DOM) | ${rows.sorteringMs}ms |`)
  console.log(`| Scroll: frames | ${rows.scroll.frames} |`)
  console.log(`| Scroll: droppede frames (>16,7ms) | ${rows.scroll.droppedFrames} |`)
  console.log(`| Scroll: længste frame-gab | ${rows.scroll.longestFrameMs}ms |`)
  console.log(`| Ruller uden at hakke? | ${rows.scroll.jankFrit ? 'ja' : 'nej'} |`)
  console.log(`\nSkrevet: outputs/_seneste/maal-mandagsrunden/${outName}.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
