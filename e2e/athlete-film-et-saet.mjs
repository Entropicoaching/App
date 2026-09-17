// ORDRE 262 · commit 4 — "Film et sæt": atleten optager/vælger et klip,
// sporingen kører LOKALT (samme fredede tracker som coach-sporing.spec.mjs
// bruger), og hun ser reps/afvigelse/tid med det samme uden at noget er
// sendt endnu (se public/videocoach.html's showInstantResult). Denne prøve
// kører det RIGTIGE klik-igennem-flow (log ind → "Film et sæt" → vælg fil →
// sæt start → markér skiven → analysér → se tallene) to gange på SAMME
// genererede klip: én gang Kassér (intet må være gemt bagefter), én gang Gem
// (skal ramme den EKSISTERENDE video-vej — samme bucket/tabel som
// standardvejens "Send til coach", se e2e/video-upload.spec.mjs).
//
// Klippet er scripts/make-test-clip.mjs's egen, deterministiske "glat"-
// variant (samme klip coach-sporing.spec.mjs bruger, 5/5 reps sporet pålideligt
// ifølge docs/RAPPORT-225.md) — genereret her, ALDRIG committet, ingen
// atletdata (syntetisk skive, ingen rigtig krop).
//
// Kørsel: node e2e/athlete-film-et-saet.mjs

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { truePos, W as VIDEO_W, H as VIDEO_H } from '../scripts/make-test-clip.mjs'

const CLICK_AT_S = 1.8
const MAX_CALIBRATION_ATTEMPTS = 4

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

// Samme retry-mønster som e2e/coach-sporing.spec.mjs's calibrate() (klik
// #allBtn = fresh auto-forsøg, se public/videocoach.html's allBtn.onclick),
// kun ombygget til ATHLETE-fladens egne elementer/tilstande.
async function calibrateAthlete(frame, page, canvas, box) {
  const target = truePos(CLICK_AT_S)
  const basePos = { x: target.x * box.width / VIDEO_W, y: target.y * box.height / VIDEO_H }
  for (let attempt = 0; attempt <= MAX_CALIBRATION_ATTEMPTS; attempt++) {
    await frame.locator('#allBtn').click()
    await page.waitForTimeout(attempt === 0 ? 400 : 250)
    const jitter = attempt === 0 ? { x: 0, y: 0 }
      : { x: (attempt % 2 ? 6 : -6) * attempt, y: (attempt % 2 ? -5 : 5) * attempt }
    await canvas.click({ position: { x: basePos.x + jitter.x, y: basePos.y + jitter.y } })
    await page.waitForTimeout(500)
    const state = await frame.locator('body').getAttribute('data-athlete-state')
    if (state === 'confirm') return true
  }
  return false
}

// Ét gennemløb af "Film et sæt" op til (og inklusive) analysen — vælger klip,
// sætter start, kalibrerer, analyserer, venter til 'done' eller 'error'.
// Kaldes to gange på samme (genindlæste) iframe, se main().
async function filmSaetUpTilDone(frame, page, clipPath, shot) {
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)
  await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })
  // #liftSel's placeholder ("Øvelse?", value="") er IKKE et gyldigt løft —
  // runFullAnalysis kræver et valgt løft (session.lift), samme krav som
  // standardvejens sendeark. #vcAthleteLift er den synlige klon atleten ser.
  await frame.locator('#vcAthleteLift').selectOption({ label: 'Squat' })
  await shot('01-video-lastet')

  const video = frame.locator('video')
  await video.evaluate(
    (v, t) => new Promise(resolve => {
      if (Math.abs(v.currentTime - t) < 0.001) { resolve(); return }
      v.addEventListener('seeked', resolve, { once: true })
      v.currentTime = t
    }),
    CLICK_AT_S,
  )
  await frame.locator('#athleteMarkStartBtn').click()

  const canvas = frame.locator('#canvas')
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  assert.ok(box, 'canvas har ingen synlig boks — kan ikke beregne klik-position')
  await page.waitForTimeout(300)

  const calibrated = await calibrateAthlete(frame, page, canvas, box)
  assert.ok(calibrated, 'auto-kalibreringen fandt ikke skiven efter gentagne forsøg (atlet-flow)')
  await shot('02-skive-fundet')

  // Ringen er bekræftet ('confirm') — allBtn hedder nu "Start" og tager
  // plateConfirm-grenen i allBtn.onclick, som kalder runFullAnalysis.
  await frame.locator('#allBtn').click()

  let state = null
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000)
    state = await frame.locator('body').getAttribute('data-athlete-state')
    if (state === 'done' || state === 'error') break
  }
  await shot('03-analyse-faerdig')
  return state
}

async function main() {
  const shot = (page, name) => page.screenshot({ path: join(OUT_DIR, `athlete-film-et-saet-${name}.png`), fullPage: true })
  const { path: clipPath } = ensureCoachSporingClip('glat')

  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const vite = await startVite()
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })

    const consoleErrors = []
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })
    await page.getByText('Film et sæt', { exact: true }).click()
    const frame = page.frameLocator('iframe[title="VideoCoach"]')

    // ---- Gennemløb 1: analysér, se tallene, KASSÉR — intet må gemmes ----
    const rowsBefore = await readTable(mockUrl, 'video_analyses')
    const state1 = await filmSaetUpTilDone(frame, page, clipPath, name => shot(page, `kasser-${name}`))
    assert.equal(state1, 'done', `sporingen blev ikke færdig med et brugbart rep (kassér-forsøget), tilstand: ${state1}`)

    const headText = (await frame.locator('#athleteInstantResult .athInstantHead').textContent() || '').trim()
    assert.match(headText, /^\d+ reps? fundet$/, `uventet overskrift på resultatpanelet: "${headText}"`)
    const repCount = Number(headText.match(/^(\d+)/)[1])
    assert.ok(repCount > 0, 'resultatpanelet viser 0 reps — intet at vise atleten')
    const rowTexts = await frame.locator('#athleteInstantResult .athInstantRow span').allTextContents()
    assert.equal(rowTexts.length, repCount, 'antal rep-rækker matcher ikke det oplyste rep-antal')
    for (const t of rowTexts) assert.match(t, /·\s*[\d.]+s$/, `rep-række mangler tid: "${t}"`)
    await shot(page, 'kasser-04-tallene')

    await frame.locator('#athleteInstantDiscardBtn').click()
    // Kassér genindlæser iframet (location.reload) — vent til dropHint'en er
    // tilbage (tom, klar til en ny video), samme "klar"-signal som ved åbning.
    await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 15000 })
    await frame.locator('#dropHint:not([hidden])').waitFor({ state: 'visible', timeout: 15000 })
    await shot(page, 'kasser-05-nulstillet')

    const rowsAfterDiscard = await readTable(mockUrl, 'video_analyses')
    assert.equal(rowsAfterDiscard.length, rowsBefore.length,
      'Kassér skulle IKKE oprette nogen video_analyses-række, men antallet ændrede sig')

    // ---- Gennemløb 2: samme klip igen, denne gang GEM ----
    const state2 = await filmSaetUpTilDone(frame, page, clipPath, name => shot(page, `gem-${name}`))
    assert.equal(state2, 'done', `sporingen blev ikke færdig med et brugbart rep (gem-forsøget), tilstand: ${state2}`)
    await shot(page, 'gem-04-tallene')

    await frame.locator('#athleteInstantSaveBtn').click()
    await page.waitForFunction(
      async ([url, athleteId]) => {
        const res = await fetch(`${url}/__e2e/table?name=video_analyses`)
        const rows = await res.json()
        return rows.some(r => r.athlete_id === athleteId && r.analysis_state === 'awaiting_analysis')
      },
      [mockUrl, ATHLETE_ID],
      { timeout: 20000 },
    )
    await shot(page, 'gem-05-gemt')

    const rowsAfterSave = await readTable(mockUrl, 'video_analyses')
    const savedRow = rowsAfterSave.find(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
    assert.ok(savedRow, 'Gem skulle oprette en awaiting_analysis-række via den EKSISTERENDE video-vej, men ingen blev fundet')
    assert.equal(savedRow.source_mode, 'athlete_submission')

    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(consoleErrors)}`)

    console.log(`\nGRØN: "Film et sæt" — kalibreret, sporet, ${repCount} rep(s) vist uden dom, Kassér gemte intet, Gem ramte den eksisterende video-vej (video_analyses-række ${savedRow.id}, source_mode=${savedRow.source_mode}).`)
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

main()
