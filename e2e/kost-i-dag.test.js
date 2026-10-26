// Local browser verification with fictional data. No .env files or live backend.
// Run: node e2e/kost-i-dag.test.js
import assert from 'node:assert/strict'
import process from 'node:process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_ID, ATHLETE_USER } from './fixtures.mjs'
import { calendarDay, addCalendarDays } from '../src/calendarDate.js'

const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const root = resolve(import.meta.dirname, '..')
const output = process.env.KOST_SCREENSHOT_DIR || join(root, 'work', 'kost-i-dag')
await mkdir(output, { recursive: true })
const date = calendarDay()
const day = offset => addCalendarDays(date, offset)
const meal = (offset, extra = {}) => ({
  id: `meal-${offset}`, athlete_id: ATHLETE_ID, date: day(offset),
  meal: offset === 0 ? 'Havregryn med mælk' : 'Tidligere måltid',
  kcal: 450, protein: 24, carb: 60, fat: 12, ...extra,
})
const seed = buildSeed()
Object.assign(seed.tables.athletes[0], { kcal_target: 2500, protein_target: 160 })
seed.tables.meal_logs = Array.from({ length: 6 }, (_, i) => meal(-i))
seed.tables.weight_logs = [0, -14].map(offset => ({ id: `weight-${offset}`, athlete_id: ATHLETE_ID, logged_at: day(offset), weight: 80 }))
const mock = createMockSupabase(seed)
await mock.listen(0)
const mockUrl = `http://127.0.0.1:${mock.server.address().port}`

// Compare the flag-off markup with the exact legacy source from the base commit.
const baseline = execFileSync('git', ['show', `${process.env.KOST_BASE_REF || 'origin/main'}:src/athlete/KostTab.jsx`], { cwd: root, encoding: 'utf8' })
const baselinePath = join(root, 'src/athlete/KostTabBaseline.jsx')
const compareSource = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Before from '/src/athlete/KostTabBaseline.jsx';
import After from '/src/athlete/KostTab.jsx';
export function compare() {
  const noop = () => {};
  const base = new Proxy({
    athlete: {kcal_target:2500,protein_target:160}, kostDate:'${date}',
    logs:[], frequentFoods:[], mealTemplates:[], searchResults:[], selectedFood:null,
    createFood:{}, editMacros:{}, tdeeEstimate:{ready:false,missingKcalDays:7},
    showTemplates:false, showCreateFood:false, showSaveTemplate:false,
    progressBars:React.createElement('div',{},'Dagens tal'),
    totKcal:0,totProtein:0,totCarb:0,totFat:0,pLen:0,cLen:0,fLen:0,circ:300,pKcal:0,cKcal:0,fKcal:0,macroTotal:1,
  }, {get:(obj,key)=>key in obj?obj[key]:noop});
  const variants = [{}, {logs:[{id:'test',meal:'Mad',kcal:450,protein:24,carb:60,fat:12}],totKcal:450,parseLoggedGrams:()=>null},
    {showTemplates:true,showCreateFood:true}, {kostDate:'${day(-1)}'},
    {tdeeEstimate:{ready:true,tdee:2500,confidence:'lav',kcalDays:7,daySpan:14},showTdee:true}];
  return variants.map(extra=>{ const props={...base,...extra};return [renderToStaticMarkup(React.createElement(Before,props)),renderToStaticMarkup(React.createElement(After,props))] });
}`
let vite, browser
const errors = []
try {
  vite = await createServer({
    root, envDir: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(mockUrl), 'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify('local-mock-key') },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'kost-baseline-test', enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/KostTabBaseline.jsx')) return baselinePath
        if (id === '/kost-compare.js') return id
      },
      load(id) {
        if (id === baselinePath) return baseline
        if (id === '/kost-compare.js') return compareSource
      },
    }],
  })
  await vite.listen()
  const url = `http://127.0.0.1:${vite.httpServer.address().port}`
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })

  async function login(page, enabled = true, failDaily = false) {
    page.on('pageerror', error => errors.push(error.message))
    // Keep every request local, including font/image requests from the existing UI.
    await page.route('**/*', route => route.request().url().startsWith(url) || route.request().url().startsWith(mockUrl)
      ? route.continue() : route.abort())
    if (failDaily) await page.route('**/rest/v1/meal_logs*', route => new URL(route.request().url()).searchParams.has('date') && new URL(route.request().url()).searchParams.get('date').startsWith('eq.')
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Syntetisk læsefejl' }) }) : route.fallback())
    if (enabled) await page.addInitScript(() => localStorage.setItem('entropi:kost-i-dag', 'true'))
    await page.goto(url)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind', exact: true }).click()
    await page.getByRole('button', { name: 'Kost', exact: true }).click()
  }

  const legacy = await browser.newPage()
  await login(legacy, false)
  await legacy.getByRole('heading', { name: 'Kostlog.', exact: true }).waitFor()
  assert.equal(await legacy.getByRole('heading', { name: 'Kost i dag', exact: true }).count(), 0)
  const pairs = await legacy.evaluate(async () => (await import('/kost-compare.js')).compare())
  for (const [before, after] of pairs) assert.equal(after, before, 'Flag off preserves legacy markup')
  await legacy.close()

  for (const width of [390, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'Europe/Copenhagen' })
    const page = await context.newPage()
    await login(page)
    const view = page.locator('.kost-i-dag')
    await page.getByText('Havregryn med mælk', { exact: true }).waitFor()
    assert.match(await view.innerText(), /Mål: 2.500 kcal/)
    assert.match(await view.innerText(), /450/)
    assert.equal(await view.locator('svg, table').count(), 0)
    assert.equal(await page.getByText('Estimeret TDEE', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Kopier i går', exact: true }).count(), 0)
    assert.ok(!(await view.innerText()).includes('—'))
    for (const color of await view.locator('h1, h2').evaluateAll(headings => headings.map(heading => getComputedStyle(heading).color))) {
      assert.equal(color, 'rgb(237, 234, 226)', 'Readable headings on the dark background')
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: join(output, `kost-i-dag-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Historik og detaljer', exact: true }).click()
    await page.getByRole('heading', { name: 'Kosthistorik', exact: true }).waitFor()
    assert.equal(await page.getByText('Estimeret TDEE', { exact: true }).count(), 0, 'Six days show raw history only')
    await page.getByRole('button', { name: '←', exact: true }).click()
    await page.getByText('I går', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: '← Tilbage til i dag', exact: true }).click()
    await page.getByText('Havregryn med mælk', { exact: true }).waitFor()
    assert.equal(await page.getByText('Tidligere måltid', { exact: true }).count(), 0)
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await login(page)
  await page.getByText('Havregryn med mælk', { exact: true }).waitFor()
  const count = mock.table('meal_logs').length
  for (const amount of ['125,5', '125.5']) {
    await page.getByLabel('Søg efter en fødevare', { exact: true }).fill('havregryn')
    await page.getByRole('button', { name: /Havregryn/ }).first().click()
    await page.getByLabel('Mængde', { exact: true }).fill(amount)
    await page.getByRole('button', { name: 'Log mad', exact: true }).click()
    await page.getByLabel('Mængde', { exact: true }).waitFor({ state: 'detached' })
  }
  assert.equal(mock.table('meal_logs').length, count + 2)
  const last = mock.table('meal_logs').slice(-2)
  assert.equal(last[0].kcal, last[1].kcal)
  assert.equal(last[0].protein, last[1].protein)
  assert.ok(last.every(log => log.date === date && log.athlete_id === ATHLETE_ID))

  await fetch(`${mockUrl}/__e2e/fault`, { method: 'POST', body: JSON.stringify({ pathPrefix: '/rest/v1/meal_logs', method: 'POST', times: 1 }) })
  await page.getByLabel('Søg efter en fødevare', { exact: true }).fill('havregryn')
  await page.getByRole('button', { name: /Havregryn/ }).first().click()
  await page.getByLabel('Mængde', { exact: true }).fill('50,5')
  await page.getByRole('button', { name: 'Log mad', exact: true }).click()
  await page.getByText('Fødevaren blev ikke logget.', { exact: false }).waitFor()
  assert.equal(await page.getByLabel('Mængde', { exact: true }).inputValue(), '50,5')
  assert.equal(mock.table('meal_logs').length, count + 2)

  mock.table('meal_logs').push(meal(-6))
  await page.getByRole('button', { name: 'Historik og detaljer', exact: true }).click()
  await page.getByText('Estimeret TDEE', { exact: true }).waitFor()
  assert.ok(!(await page.locator('.kost-i-dag').innerText()).includes('—'))
  await context.close()

  // A failed daily read must not look like a successfully loaded empty day.
  const failedContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const failed = await failedContext.newPage()
  await login(failed, true, true)
  await failed.getByText('Dagens kostlog kunne ikke hentes.', { exact: true }).waitFor()
  assert.equal(await failed.getByText('Ingen mad logget i dag endnu.', { exact: true }).count(), 0)
  await failed.unroute('**/rest/v1/meal_logs*')
  await failed.getByRole('button', { name: 'Prøv igen', exact: true }).click()
  await failed.getByText('Havregryn med mælk', { exact: true }).waitFor()
  await failedContext.close()

  mock.table('meal_logs').splice(0)
  Object.assign(mock.table('athletes')[0], { kcal_target: null, protein_target: null })
  const emptyContext = await browser.newContext({ viewport: { width: 360, height: 780 } })
  const empty = await emptyContext.newPage()
  await login(empty)
  await empty.getByText('Ingen mad logget i dag endnu.', { exact: true }).waitFor()
  assert.equal(await empty.getByText('Mål ikke angivet', { exact: true }).count(), 2)
  assert.ok(!(await empty.locator('.kost-i-dag').innerText()).includes('NaN'))
  await emptyContext.close()
  assert.deepEqual(errors, [])
  console.log('PASS: flag off matches legacy, mobile 390/360, daily logging, decimal input, failed writes/reads, history return, 6/7 day gate.')
} finally {
  await browser?.close()
  await vite?.close()
  await mock.close()
}
