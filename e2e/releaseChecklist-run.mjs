import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { CASES, buildReleaseSeed, assertLocalUrl, runReleaseAthlete, runReleaseWeek, runReleaseCoach } from './releaseChecklist.test.js'

// Eksplicit tilvalg. Ingen ændring i run-all, scripts eller produktets flag.
export async function main() {
  if (!process.argv.includes('--run-e2e')) {
    console.log('OFF: brug node e2e/releaseChecklist-run.mjs --run-e2e ved integration')
    return
  }
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  assertLocalUrl(APP_URL)
  assertLocalUrl(mockUrl)
  let vite, browser
  try {
    vite = await startVite()
    browser = await launchBrowser()
    for (const c of CASES) {
      const mock = createMockSupabase(buildReleaseSeed(c))
      const contexts = []
      const errors = []
      try {
        await mock.listen(MOCK_PORT)
        const newPage = async viewport => {
          const context = await browser.newContext({ viewport, timezoneId: 'Europe/Copenhagen', locale: 'da-DK' })
          contexts.push(context)
          const page = await context.newPage()
          await page.clock.setFixedTime(new Date(c.now))
          page.on('pageerror', error => errors.push(error.message))
          return page
        }
        // Ugeprøven først, så fuldførte sæt ikke flytter appens aktive uge.
        const week = await newPage({ width: 390, height: 844 })
        await runReleaseWeek(week, { appUrl: APP_URL, mockUrl, c })
        await week.context().close()
        const athlete = await newPage({ width: 390, height: 844 })
        await runReleaseAthlete(athlete, { appUrl: APP_URL, mockUrl })
        await athlete.context().close()
        const coach = await newPage({ width: 1280, height: 900 })
        await runReleaseCoach(coach, { appUrl: APP_URL, mockUrl })
        assert.deepEqual(errors, [], `${c.name}: browserfejl`)
        console.log(`PASS: udgivelsestjek ${c.name}`)
      } finally {
        for (const context of contexts) await context.close()
        await mock.close()
      }
    }
  } finally {
    try { if (browser) await browser.close() }
    finally { if (vite) await vite.stop() }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
