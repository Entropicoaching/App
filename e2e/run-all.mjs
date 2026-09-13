// ORDRE 153 · commit 4 — én kommando: mock + vite startes ÉN gang, atletens
// rejse logger de tre sæt + parathed, og coach-gennemgangen læser dem fra
// SAMME kørende mock — det beviser at data skrevet i én browser-session
// (atleten) rent faktisk når frem til en anden (coachen) via den fælles
// backend-form. Rydder op bagefter uanset udfald.

import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { runAtletJourney } from './atlet.spec.mjs'
import { runCoachReview } from './coach.spec.mjs'

async function main() {
  const t0 = Date.now()
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  try {
    const athletePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    athletePage.on('pageerror', err => console.error('[atlet pageerror]', err))
    await runAtletJourney(athletePage, { appUrl: APP_URL, mockUrl, outDir: OUT_DIR })
    await athletePage.close()

    const coachPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    coachPage.on('pageerror', err => console.error('[coach pageerror]', err))
    await runCoachReview(coachPage, { appUrl: APP_URL, outDir: OUT_DIR })
    await coachPage.close()

    const seconds = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\nGRØN: atlet → coach, ende-til-ende, ${seconds}s.`)
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
