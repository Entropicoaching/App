// ORDRE 1890v (Marc 19. nov.): atleten filmer et sæt ved 390 px, markerer skiven, skriver et notat
// med mellemrum, kører stangbanen, folder resultatpanelet sammen og sender videoen. Mod mocken,
// med det tegnede klip fra scripts/make-test-clip.mjs (ingen rigtige videoer).
//
// Kørsel: node e2e/video-send-1890v.spec.mjs
// (E2E_VITE_PORT, E2E_MOCK_PORT og VITE_SUPABASE_URL kan sættes, hvis standardportene er optaget;
// OUT_1890V vælger mappen til skærmbilleder.)

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { calibrateAthlete, CLICK_AT_S } from './athlete-film-et-saet.mjs'

const NOTE = 'god dybde i bunden'

async function main() {
  const out = process.env.OUT_1890V || OUT_DIR
  const tag = process.env.TAG_1890V || 'video-send-1890v'
  const { path: clipPath } = ensureCoachSporingClip('glat')
  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const vite = await startVite()
  const browser = await launchBrowser()
  console.log(`egne processer: node ${process.pid}, vite ${vite.child.pid}`)
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    const shot = name => page.screenshot({ path: join(out, `${tag}-${name}.png`) })

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Mere i dag', { exact: true }).click({ timeout: 15000 })
    await page.getByText('Film et sæt til videocoach', { exact: true }).click()
    const frame = page.frameLocator('iframe[title="VideoCoach"]')
    await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
    await frame.locator('#fileInput').setInputFiles(clipPath)
    await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })
    await frame.locator('#vcAthleteLift').selectOption({ label: 'Squat' })
    await frame.locator('video').first().evaluate((v, t) => new Promise(resolve => {
      v.addEventListener('seeked', resolve, { once: true }); v.currentTime = t
    }), CLICK_AT_S)
    await frame.locator('#athleteMarkStartBtn').click()
    const canvas = frame.locator('#canvas')
    const box = await canvas.boundingBox()
    await page.waitForTimeout(300)
    assert.ok(await calibrateAthlete(frame, page, canvas, box), 'skiven blev ikke fundet')

    // Ordre 2135: analysen starter selv efter skivevalget; notatet skrives i resultatpanelet før send.
    await frame.locator('body[data-athlete-state="done"]').waitFor({ state: 'attached', timeout: 90000 })
    const panel = frame.locator('#athleteInstantResult')
    await panel.waitFor({ state: 'visible', timeout: 5000 })
    await page.waitForTimeout(6000) // banneret "Din stangbane er klar" forsvinder efter 5,5 s

    // 1. Mellemrum i notatet: teksten står uændret, fokus bliver, og afspilningen ændres ikke af mellemrummet.
    const note = frame.locator('#athleteNoteInput')
    const pausedBefore = await frame.locator('video').first().evaluate(v => v.paused)
    await note.click()
    await page.keyboard.type(NOTE, { delay: 30 })
    await page.waitForTimeout(300)
    const typed = await frame.locator('body').evaluate(body => ({
      value: document.getElementById('athleteNoteInput').value,
      focus: document.activeElement?.id, state: body.dataset.athleteState,
      paused: document.querySelector('video').paused }))
    assert.deepEqual(typed, { value: NOTE, focus: 'athleteNoteInput', state: 'done', paused: pausedBefore },
      'mellemrum i notatet må ikke ændre afspilningen eller nulstille resultatet')
    await shot('01-notat-med-mellemrum')

    // 2. Panelet foldet sammen og åbnet igen.
    const open = await panel.boundingBox()
    await frame.locator('#athleteInstantFoldBtn').click()
    const folded = await panel.boundingBox()
    assert.ok(folded.height <= 64, `foldet bjælke er ${folded.height} px høj`)
    assert.ok(open.height - folded.height >= 150, `foldningen frigav kun ${open.height - folded.height} px`)
    assert.equal(await frame.locator('#athleteInstantSaveBtn').isVisible(), false)
    assert.equal(await frame.locator('#barPathHUD').isVisible(), false, 'stangbane-kortet dækker stadig videoen')
    const free = await frame.locator('body').evaluate(() => document.getElementById('athleteInstantResult').getBoundingClientRect().top - document.getElementById('canvas').getBoundingClientRect().top)
    assert.ok(free >= 560, `kun ${Math.round(free)} px af videoen er fri over bjælken`)
    assert.match(await frame.locator('#athleteInstantFoldBtn').innerText(), /reps? fundet/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
    await shot('02-panel-foldet')
    await frame.locator('#athleteInstantFoldBtn').click()
    assert.equal((await panel.boundingBox()).height, open.height, 'panelet åbner i samme størrelse')
    assert.equal(await frame.locator('#barPathHUD').isVisible(), true)
    assert.equal(await note.inputValue(), NOTE, 'notatet er bevaret efter foldning')

    // 3. Send: rækken findes hos coachen med notatet og atletens stangbane.
    await frame.locator('#athleteInstantSaveBtn').click()
    await frame.locator('body[data-athlete-state="sent"]').waitFor({ state: 'attached', timeout: 20000 })
    const rows = await (await fetch(`${mockUrl}/__e2e/table?name=video_analyses`)).json()
    const row = rows.find(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
    assert.ok(row, 'video_analyses mangler en awaiting_analysis-række')
    assert.equal(row.source_mode, 'athlete_submission')
    assert.equal(row.session_context?.athlete_note, NOTE)
    assert.ok(row.bar_path && Array.isArray(row.bar_path.dx), 'atletens stangbane fulgte ikke med')
    const keys = await (await fetch(`${mockUrl}/__e2e/storage-keys`)).json()
    assert.ok(keys.includes(`videocoach-uploads/${row.video_path}`), 'klippet ligger ikke i lageret')
    assert.match(await frame.locator('#athleteStatus').innerText(), /Sendt til din coach ✓/)
    await shot('03-sendt')
    assert.deepEqual(errors, [], `kastede fejl: ${JSON.stringify(errors)}`)
    console.log(`\nGRØN: notat med mellemrum bevaret, panel foldet (${Math.round(open.height)} til ${Math.round(folded.height)} px) og åbnet, video sendt med notat og stangbane`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('video-send-1890v.spec.mjs')) main()
