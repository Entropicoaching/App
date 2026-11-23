// ORDRE 2053 (Marc 23. nov.): coachens vej fra en ny indsendt video til et svar, atleten kan se.
// Mock, 390 px, syntetisk atlet med ét indsendt klip (seedens MEASURED_VIDEO). Tæller tryk (klik, ikke tastning).
// Mocken har ingen RLS; databasens regler er prøvet i PGlite (src/videoCoachSvar2053.sql.test.mjs).
// Kørsel: node e2e/coach-video-svar-2053.spec.mjs   (E2E_VITE_PORT, E2E_MOCK_PORT, VITE_SUPABASE_URL, E2E_COLOR_SCHEME=dark)
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_USER, MEASURED_VIDEO_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MAX_TRYK = Number(process.env.E2E_MAX_TRYK_2053 || 3)
const SKAERM = process.env.E2E_COLOR_SCHEME === 'dark' ? 'moerk' : 'lys'
const SVAR = { works: 'god dybde i bunden', focus: 'hold brystet oppe', next_set: 'pres gulvet fra start' }

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function main() {
  const mock = createMockSupabase(buildSeed({ withMeasuredVideo: true }))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  const trin = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      colorScheme: SKAERM === 'moerk' ? 'dark' : 'light' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    let tryk = 0
    const tap = async (navn, locator) => { await locator.click(); tryk += 1; trin.push([navn, tryk]) }
    const shot = n => page.screenshot({ path: join(OUT_DIR, `coach-video-svar-2053-${SKAERM}-${n}.png`), fullPage: true })

    await login(page, COACH_USER)
    const opgave = page.getByRole('button', { name: /Video venter på feedback/ }).first()
    await opgave.waitFor({ state: 'visible', timeout: 15000 })
    await shot('01-forside')
    await tap('Opgaven "Video venter på feedback" på forsiden', opgave)
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText('Gennemgå måling').first().waitFor({ state: 'visible' })
    await dialog.getByText(/3 reps/).first().waitFor({ state: 'visible' })
    await shot('02-analyse')
    for (const [key, label] of [['works', 'Det fungerer'], ['focus', 'Atletens fokus'], ['next_set', 'Næste gang']]) {
      const felt = dialog.getByLabel(label, { exact: true }).first()
      await felt.fill(SVAR[key])
    }
    await shot('03-svar-skrevet')
    const knap = n => dialog.getByRole('button', { name: n })
    const ven = async n => { await knap(n).waitFor({ state: 'visible', timeout: 10000 }); await page.waitForFunction(x => [...document.querySelectorAll('[role=dialog] button')].some(b => x.test(b.textContent) && !b.disabled), n, { timeout: 10000 }) }
    // Findes den korte vej, bruges den; ellers gem, godkend, del.
    if (await knap(/Gem, godkend og del feedback/).count() > 0) {
      await ven(/Gem, godkend og del feedback/); await tap('Gem, godkend og del feedback', knap(/Gem, godkend og del feedback/))
    } else {
      await ven(/^Gem feedback$/); await tap('Gem feedback', knap(/^Gem feedback$/))
      await ven(/Godkend til baseline/); await tap('Godkend til baseline', knap(/Godkend til baseline/))
      await ven(/Del feedback med atlet/); await tap('Del feedback med atlet', knap(/Del feedback med atlet/))
    }
    await page.waitForFunction(id => fetch(`http://127.0.0.1:${new URL(location.href).searchParams.get('m') || ''}`).catch(() => 0) || true, MEASURED_VIDEO_ID).catch(() => {})
    const rows = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/table?name=video_analyses`)).json()
    const row = rows.find(r => r.id === MEASURED_VIDEO_ID)
    await shot('04-delt')
    const sharedOk = await page.waitForTimeout(500).then(async () => (await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/table?name=video_analyses`)).json()).find(r => r.id === MEASURED_VIDEO_ID))
    assert.equal(sharedOk.status, 'shared', 'rækken blev ikke delt')
    assert.match(JSON.stringify(sharedOk.athlete_feedback), /hold brystet oppe/, 'svaret blev ikke gemt')

    // Atleten ser svaret.
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      colorScheme: SKAERM === 'moerk' ? 'dark' : 'light' })
    const atlet = await ctx2.newPage()
    await login(atlet, ATHLETE_USER)
    // Atleten åbner Beskeder (1 tryk); dér står det delte svar.
    await atlet.getByRole('button', { name: /Beskeder/ }).last().click({ timeout: 15000 })
    await atlet.locator('text=hold brystet oppe >> visible=true').first().waitFor({ state: 'visible', timeout: 15000 })
    await atlet.screenshot({ path: join(OUT_DIR, `coach-video-svar-2053-${SKAERM}-05-atlet.png`), fullPage: true })
    console.log(JSON.stringify({ skaerm: SKAERM, tryk, trin, errors }))
    assert.deepEqual(errors, [], 'browserfejl')
    assert.ok(tryk <= MAX_TRYK, `coachens vej fra forside til delt svar tog ${tryk} tryk (grænse ${MAX_TRYK}): ${trin.map(t => t[0]).join(' > ')}`)
    console.log(`GRØN: ${tryk} tryk, svar delt og set af atleten (${SKAERM}).`)
  } catch (err) {
    console.error('FEJL:', err.message, JSON.stringify(trin))
    if (process.env.E2E_DEBUG_2053) console.error(JSON.stringify((await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/table?name=video_analyses`)).json()).map(r => [r.status, r.athlete_feedback])))
    if (process.env.E2E_DEBUG_2053) console.error(await browser.contexts()[0]?.pages()[0]?.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].map(b => (b.disabled ? '[x]' : '') + b.textContent.trim()).join(' | ') + ' || ' + document.body.innerText.split(String.fromCharCode(10)).filter(l => /kunne ikke|Godkendt|fejl|bekræft/i.test(l)).join(' ## ')).catch(() => ''))
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}
main()
