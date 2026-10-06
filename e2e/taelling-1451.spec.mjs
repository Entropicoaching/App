// Ordre 1451 fund 1: een taelling paa Dagens pas-kortet. Dagens foerste oevelse er Baenkpres topsaet (2) + backoff (2):
// headeren siger "Top · Saet 1/4", og kortet gentager ikke en anden total ("2 saet"). Skaermbillede i outputs/1451.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, SESSION_ID, buildSeed } from './fixtures.mjs'
const OUT_DIR = process.env.E2E_OUT || join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1451')
mkdirSync(OUT_DIR, { recursive: true })
const pre = process.env.FREMGANG_FOER ? 'foer' : 'efter'
const seed = buildSeed()
const uuid = n => `${n}0000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
seed.tables.exercises.forEach(e => { e.exercise_order += 10 })
seed.tables.exercises.push(
  { id: uuid(1), session_id: SESSION_ID, name: 'Bænkpres top set', sets: 2, reps: '3', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 },
  { id: uuid(2), session_id: SESSION_ID, name: 'Bænkpres - backoff', sets: 2, reps: '8', intensity: 'RPE 7', note: null, exercise_order: 2, recommended_weight: 85 })
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
const mock = createMockSupabase(seed); await mock.listen(MOCK_PORT)
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(OUT_DIR, `${pre}-dagens-pas-taelling-390.png`), fullPage: true })
  const tekst = await page.evaluate(() => document.body.innerText)
  console.log(tekst.split('\n').filter(l => /s[æe]t/i.test(l)).slice(0, 6).join(' | '))
  if (pre === 'efter') {
    assert.match(tekst, /Top · Sæt 1\/4/i)
    assert.ok(!/\b2 sæt\b/i.test(tekst.split('Næste øvelse')[0]), 'kortet maa ikke vise "2 sæt" ved siden af "Sæt 1/4"')
    console.log('GRØN: een taelling paa kortet.')
  }
} catch (e) { console.error('FEJL:', e.message); process.exitCode = 1 } finally { await browser.close(); await mock.close(); await vite.stop() }
