import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { CASES, FLOWS, buildRelease3Seed, localUrl } from './release3Flows.test.js'

// Import og standardkoersel er passive. Kun Dhurvas eksplicitte integration starter runtime.
export async function runRelease3Suite(runtime, { cases = CASES, flows = FLOWS, report = console.log } = {}) {
  const { createMockSupabase, startVite, launchBrowser, APP_URL, MOCK_PORT } = runtime
  localUrl(APP_URL)
  assert.ok(Number.isInteger(MOCK_PORT) && MOCK_PORT > 0 && MOCK_PORT <= 65535)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  let vite, browser
  try {
    vite = await startVite()
    browser = await launchBrowser()
    for (const c of cases) for (const [scenario, run, width] of flows) {
      const mock = createMockSupabase(buildRelease3Seed(c, scenario))
      let context
      const errors = []
      try {
        await mock.listen(MOCK_PORT)
        context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Europe/Copenhagen', locale: 'da-DK' })
        const page = await context.newPage()
        await page.clock.setFixedTime(new Date(c.now))
        page.on('pageerror', error => errors.push(error.message))
        const read = async name => structuredClone(mock.table(name))
        await run(page, { c, read, appUrl: APP_URL, mockUrl })
        assert.deepEqual(errors, [], `${c.name}/${scenario}: browserfejl`)
        report(`PASS: APP-REL3 ${c.name}/${scenario}`)
      } finally {
        try { if (context) await context.close() }
        finally { await mock.close() }
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
  if (!args.includes('--run-e2e')) return false
  await runRelease3Suite(await load())
  return true
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(ran => { if (!ran) console.log('OFF: node e2e/release3-run.mjs --run-e2e ved integration') })
    .catch(error => { console.error(error); process.exitCode = 1 })
}
