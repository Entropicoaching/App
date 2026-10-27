import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { FRIDAY_CASES, buildFridaySeed, runFridayMobility, runFridayAnalysis, runFridayCopy,
  runFridayInbox, runFridayWeek, runFridayOff, runFridayCoachOff } from './fridayFeatures.test.js'
import { assertLocalUrl } from './releaseChecklist.test.js'

export const FRIDAY_FLOWS = [
  ['off', runFridayOff, 390], ['off', runFridayCoachOff, 1280],
  ['mobility', runFridayMobility, 390], ['analysis', runFridayAnalysis, 1280],
  ['copy', runFridayCopy, 1280], ['inbox', runFridayInbox, 390], ['week', runFridayWeek, 390],
]

// Testbar livscyklus. Ingen runtime indlaeses ved import eller uden testflag.
export async function runFridaySuite({ createMockSupabase, startVite, launchBrowser, APP_URL, MOCK_PORT },
  { cases = FRIDAY_CASES, flows = FRIDAY_FLOWS, report = console.log } = {}) {
  assertLocalUrl(APP_URL)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  assertLocalUrl(mockUrl)
  let vite, browser
  try {
    vite = await startVite()
    browser = await launchBrowser()
    for (const c of cases) {
      for (const [scenario, run, width] of flows) {
        const mock = createMockSupabase(buildFridaySeed(c, scenario))
        let context, listening = false
        const errors = []
        try {
          await mock.listen(MOCK_PORT)
          listening = true
          context = await browser.newContext({ viewport: { width, height: 900 },
            timezoneId: 'Europe/Copenhagen', locale: 'da-DK' })
          const page = await context.newPage()
          await page.clock.setFixedTime(new Date(c.now))
          page.on('pageerror', error => errors.push(error.message))
          // Stabile kopier: senere mock-mutationer maa ikke aendre et foer-billede.
          const read = async name => structuredClone(mock.table(name))
          await run(page, { appUrl: APP_URL, mockUrl, c, read })
          assert.deepEqual(errors, [], `${c.name}/${scenario}: browserfejl`)
          report(`PASS: APP-E2E2 ${c.name}/${scenario}/${width}`)
        } finally {
          try { if (context) await context.close() }
          finally { if (listening) await mock.close() }
        }
      }
    }
  } finally {
    try { if (browser) await browser.close() }
    finally { if (vite) await vite.stop() }
  }
}

export async function main(args = process.argv.slice(2), load = async () => {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  return { createMockSupabase, ...await import('./harness.mjs') }
}) {
  if (!args.includes('--run-e2e')) {
    console.log('OFF: brug node e2e/fridayFeatures-run.mjs --run-e2e ved integration')
    return false
  }
  await runFridaySuite(await load())
  return true
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
