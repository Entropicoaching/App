// Real VideoReviewModal, synthetic props; no login, env or database.
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const out = resolve('outputs/1139')
mkdirSync(out, { recursive: true })
const fixture = JSON.parse(readFileSync('test/fixtures/analyse-pakke/syntetisk.json', 'utf8'))
const vite = await createServer({ configFile: false, envDir: false, root: process.cwd(), plugins: [react()], optimizeDeps: { entries: ['test/analyse-pakke/index.html'] }, resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 5197, strictPort: true, watch: { ignored: ['**/outputs/**'] } } })
await vite.listen()
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    const page = await context.newPage()
    const errors = [], external = [], writes = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => {
      if (!r.url().startsWith('http://127.0.0.1:5197/')) external.push(r.url())
      if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.method())
    })
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new Error('Unexpected persistence') }
      window.indexedDB.open = () => { throw new Error('Unexpected IndexedDB') }
    })
    await page.goto('http://127.0.0.1:5197/test/analyse-pakke/index.html', { timeout: 30000 })
    const section = page.getByRole('region', { name: 'Lokal analyse-pakke' })
    const input = section.locator('input[type=file]')
    const load = p => input.setInputFiles({ name: 'syntetisk.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(p)) })
    await load(fixture)
    await section.getByText('Forslag · Lav sikkerhed', { exact: true }).waitFor()
    assert.match(await section.innerText(), /Rå skala/)
    assert.match(await section.innerText(), /15,0 %/)
    assert.match(await section.innerText(), /Hofte og dybde/)
    assert.deepEqual(await section.locator('tbody tr').nth(1).locator('td').allTextContents(), ['-', '-', '-'])
    assert.equal(await section.locator('tbody tr').first().locator('td').last().innerText(), '0,0')
    assert.notEqual(await section.getByText(fixture.fund[0].linje).evaluate(e => getComputedStyle(e.parentElement).color), await section.getByText(fixture.fund[1].linje).evaluate(e => getComputedStyle(e.parentElement).color))
    assert.equal(await section.evaluate(e => e.scrollWidth <= e.clientWidth), true)
    await section.screenshot({ path: join(out, `pakke-${width}.png`) })
    await page.getByRole('button', { name: 'Godkend til baseline', exact: true }).click()
    const calls = await page.evaluate(() => window.reviewCalls)
    assert.equal(calls[0].row.reps_count, 1)
    assert.deepEqual(calls[0].row.findings, [])
    assert.ok(!('reps' in calls[0].row))
    const multi = structuredClone(fixture)
    multi.saet.push({ reps: [4], tabPct: null }); multi.fund = []; multi.kvalitet.skala = 'meta'
    await load(multi)
    await section.getByText('Ingen fund i pakken.', { exact: false }).waitFor()
    assert.match(await section.innerText(), /Sættab 2 \(reps 4\): -/)
    assert.match(await section.innerText(), /Skala fra afstand/)
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') })
    await section.getByRole('alert').waitFor()
    assert.equal(await section.locator('table').count(), 0)
    await input.setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(512 * 1024 + 1) })
    await section.getByText('Pakken blev ikke indlæst: Vælg en JSON-pakke på højst 512 KB.').waitFor()
    await load(fixture)
    await section.locator('table').waitFor()
    await section.getByRole('button', { name: 'Fjern lokal pakke' }).click()
    assert.equal(await section.locator('table').count(), 0)
    await load(fixture)
    await section.locator('table').waitFor()
    await page.evaluate(() => window.openSyntheticReview('synthetic-b'))
    await section.locator('table').waitFor({ state: 'detached' })
    await load(fixture)
    await section.locator('table').waitFor()
    await page.getByRole('button', { name: 'Luk', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.evaluate(() => window.openSyntheticReview('synthetic-b'))
    await section.waitFor()
    assert.equal(await section.locator('table').count(), 0)
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    assert.deepEqual(writes, [])
    // A slow earlier selection must not overwrite a newer file, or reappear after removal.
    await page.evaluate(() => {
      window.originalFileText = File.prototype.text
      File.prototype.text = function () {
        if (this.name === 'slow.json') return new Promise(resolve => { window.releaseSlowFile = resolve })
        return window.originalFileText.call(this)
      }
    })
    await input.setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
    await section.getByRole('status').waitFor()
    await load(fixture)
    await section.locator('table').waitFor()
    await page.evaluate(() => window.releaseSlowFile('{}'))
    await section.getByText('Forslag · Lav sikkerhed', { exact: true }).waitFor()
    assert.equal(await section.getByRole('alert').count(), 0)
    await input.setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
    await section.getByRole('button', { name: 'Fjern lokal pakke' }).click()
    await page.evaluate(p => window.releaseSlowFile(JSON.stringify(p)), fixture)
    await page.waitForFunction(() => !document.querySelector('section table') && !document.querySelector('section [role=alert]'))
    assert.equal(await section.locator('table').count(), 0)
    assert.deepEqual(errors, [])
    results.push({ width, assertions: 21, errors: 0, externalRequests: 0, writes: 0, overflow: false })
    await context.close()
  }
  writeFileSync(join(out, 'browser.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify(results))
} finally {
  await browser.close()
  await vite.close()
}
