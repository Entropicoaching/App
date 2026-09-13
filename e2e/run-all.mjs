// ORDRE 153 · commit 4 / ORDRE 155 — én kommando: mock + vite startes ÉN
// gang, og hvert spec-skridt kører i sin egen friske browserside (egen
// login), men mod SAMME kørende mock — det beviser at data skrevet i én
// browser-session (atleten) rent faktisk når frem til en anden (coachen) via
// den fælles backend-form. Rydder op bagefter uanset udfald.

import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { runAtletJourney } from './atlet.spec.mjs'
import { runCoachReview } from './coach.spec.mjs'
import { runVideoUpload } from './video-upload.spec.mjs'
import { runVideoReview, runAthleteSeesFeedback } from './video-review.spec.mjs'
import { runOfflineSetLog, runRejectedUploadRetry } from './fejl.spec.mjs'

async function main() {
  const t0 = Date.now()
  const mock = createMockSupabase(buildSeed({ withAnalyzedVideo: true }))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const opts = { appUrl: APP_URL, mockUrl, outDir: OUT_DIR }

  // Hvert skridt får sin egen side (egen login) — se e2e/fejl.spec.mjs og
  // e2e/beskeder.spec.mjs's kommentarer (ordre 155) for hvorfor: enklere og
  // mere robust end at dele én browserside/session-tilstand hen over flere
  // skridt.
  async function step(name, viewport, fn) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', err => errors.push(err))
    try {
      const result = await fn(page)
      if (errors.length) throw new Error(`${name}: ${errors.length} browser-fejl: ${errors.map(e => e.message).join('; ')}`)
      return result
    } finally {
      await page.close()
    }
  }

  const MOBILE = { width: 390, height: 844 }
  const DESKTOP = { width: 1280, height: 900 }

  try {
    // Den glatte rejse (ordre 153).
    await step('atlet-rejse', MOBILE, page => runAtletJourney(page, opts))
    await step('coach-gennemgang', DESKTOP, page => runCoachReview(page, opts))

    // Video op og gå + coachens gennemgang (ordre 155 · commit 1-2).
    const awaitingRow = await step('video-upload', MOBILE, page => runVideoUpload(page, opts))
    const feedback = await step('video-review', DESKTOP, page => runVideoReview(page, { ...opts, awaitingRow }))
    await step('atlet-ser-feedback', MOBILE, page => runAthleteSeesFeedback(page, { ...opts, feedback }))

    // Det der går galt (ordre 155 · commit 3).
    await step('offline-saet-log', MOBILE, page => runOfflineSetLog(page, opts))
    await step('afvist-upload-igen', MOBILE, page => runRejectedUploadRetry(page, opts))

    const seconds = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\nGRØN: atlet → coach → video op → coach gennemgår → det der går galt, ende-til-ende, ${seconds}s.`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

main()
