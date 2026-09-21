// ORDRE 301 · commit 2 — "Indbakken viser automatiseringsfejl uden atlet":
// bevist, ikke antaget. Mock-tabellen automation_alerts har to uløste fejl og
// een løst (kun metadata, ingen atletdata). I den ÆGTE, ubuildede app (npm run
// dev) mod den lokale mock logger coachen ind og går til Indbakken (via
// forsidens "Kræver dit blik"):
//   1. de to uløste rækker vises ("Automatisering fejlede", workflow, node,
//      dansk relativ tid), den løste gør ikke - ingen overlap og ingen
//      vandret rulning, på 390x844 og på desktop;
//   2. "Markeret som set" fjerner rækken, og mockens resolved_at er sat;
//   3. når RPC'en ikke findes (SQL-filen er ikke koert) bliver rækken stående
//      og fejlen vises ved rækken - aldrig stille; næste forsøg lykkes;
//   4. en Indbakke uden fejl er ordret den samme som en Indbakke hvor
//      tabellen aldrig har haft rækker.
// Hvert skridt venter på det faktiske DOM-/tabeludfald, ikke et banner.
//
// Kørsel: node e2e/coach-automation-alerts.spec.mjs (npm run e2e:coach-automation-alerts)

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844, label: 'mobil-390' }
const DESKTOP = { width: 1280, height: 900, label: 'desktop-1280' }

const FEJL_NYERE = 'aaaaaaaa-0301-4301-8301-aaaaaaaaaaa1'
const FEJL_AELDRE = 'aaaaaaaa-0301-4301-8301-aaaaaaaaaaa2'
const FEJL_LOEST = 'aaaaaaaa-0301-4301-8301-aaaaaaaaaaa3'

const agoIso = ms => new Date(Date.now() - ms).toISOString()
const HOUR = 3600 * 1000

function seedMedFejl({ medRaekker = true } = {}) {
  const seed = buildSeed()
  if (!medRaekker) return seed
  seed.tables.automation_alerts = [
    { id: FEJL_NYERE, workflow_id: 'wf-check-in', workflow_name: 'Ugentlig check-in mail', failed_node: 'Send mail til atleter', execution_id: '4711', mode: 'trigger', occurred_at: agoIso(2 * HOUR + 60000), resolved_at: null },
    { id: FEJL_AELDRE, workflow_id: 'wf-backup', workflow_name: 'Natlig backup af programmer og en ret lang workflow-titel der skal ombrydes pænt', failed_node: 'Upload til lager', execution_id: '4690', mode: 'trigger', occurred_at: agoIso(2 * 24 * HOUR + 60000), resolved_at: null },
    { id: FEJL_LOEST, workflow_id: 'wf-gammel', workflow_name: 'Allerede løst workflow', failed_node: 'Gammel node', execution_id: '4001', mode: 'trigger', occurred_at: agoIso(5 * 24 * HOUR), resolved_at: agoIso(4 * 24 * HOUR) },
  ]
  return seed
}

async function loginOgAabnIndbakke(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
}

async function tilIndbakken(page) {
  await page.getByRole('button', { name: /Kræver dit blik/ }).click()
  await page.getByText('Coach Briefing', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
}

// Ingen overlap: rækkernes bokse er indbyrdes disjunkte, hvert barn ligger i
// sin række, og intet stikker ud over viewportens bredde (ingen vandret rulning).
async function maalLayout(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-automation-alert]')]
    const boxes = rows.map(row => ({ id: row.getAttribute('data-automation-alert'), r: row.getBoundingClientRect() }))
    const overlaps = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push([boxes[i].id, boxes[j].id])
    }
    const udenfor = []
    rows.forEach(row => {
      const rr = row.getBoundingClientRect()
      row.querySelectorAll('span, button, div').forEach(el => {
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        if (r.left < rr.left - 0.5 || r.right > rr.right + 0.5 || r.top < rr.top - 0.5 || r.bottom > rr.bottom + 0.5) {
          udenfor.push((el.textContent || '').trim().slice(0, 40))
        }
      })
    })
    return {
      count: rows.length,
      overlaps,
      udenfor,
      vandretRulning: document.documentElement.scrollWidth > window.innerWidth + 1,
      hoejre: Math.max(0, ...boxes.map(b => b.r.right)),
      vinduesbredde: window.innerWidth,
    }
  })
}

export async function runCoachAutomationAlerts(page, { appUrl, outDir, mock, viewport }) {
  const shot = name => page.screenshot({ path: join(outDir, `coach-automation-${viewport.label}-${name}.png`), fullPage: true })
  const raekke = id => page.locator(`[data-automation-alert="${id}"]`)

  await loginOgAabnIndbakke(page, appUrl)

  // Forsiden tæller de to uløste fejl med i "Kræver dit blik".
  await page.getByText('2 åbne ting', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 })
  await shot('01-forside')

  await tilIndbakken(page)

  // ---- 1) rækkerne vises; den løste gør ikke ----
  // Den ældste fejl er "Næste opgave"; den anden ligger under "Vis 1 øvrige".
  await raekke(FEJL_AELDRE).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Vis 1 øvrige opgave', { exact: true }).click()
  await raekke(FEJL_NYERE).waitFor({ state: 'visible', timeout: 10000 })
  assert.equal(await raekke(FEJL_LOEST).count(), 0, 'den løste fejl må ikke vises')

  const body = await page.locator('body').innerText()
  assert.ok(!body.includes('Allerede løst workflow'), 'den løste fejls workflow-navn må ikke stå i Indbakken')
  assert.equal((body.match(/Automatisering fejlede/gi) || []).length, 2, 'to rækker med typen "Automatisering fejlede"')
  await raekke(FEJL_NYERE).getByText('Ugentlig check-in mail', { exact: true }).waitFor({ state: 'visible' })
  await raekke(FEJL_NYERE).getByText('Node: Send mail til atleter · for 2 timer siden', { exact: true }).waitFor({ state: 'visible' })
  await raekke(FEJL_AELDRE).getByText('Node: Upload til lager · for 2 dage siden', { exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('button', { name: 'Markeret som set' }).count(), 2, 'een "Markeret som set" pr. række')

  const layout = await maalLayout(page)
  assert.equal(layout.count, 2)
  assert.deepEqual(layout.overlaps, [], `rækkerne overlapper (${viewport.label})`)
  assert.deepEqual(layout.udenfor, [], `indhold stikker ud af rækken (${viewport.label}): ${JSON.stringify(layout.udenfor)}`)
  assert.equal(layout.vandretRulning, false, `vandret rulning på ${viewport.label} (højre kant ${layout.hoejre}px af ${layout.vinduesbredde}px)`)
  await shot('02-to-fejl')

  // ---- 2) "Markeret som set" fjerner rækken ----
  await raekke(FEJL_AELDRE).getByRole('button', { name: 'Markeret som set' }).click()
  await raekke(FEJL_AELDRE).waitFor({ state: 'detached', timeout: 10000 })
  await raekke(FEJL_NYERE).waitFor({ state: 'visible' })
  const efterEn = Object.fromEntries(mock.table('automation_alerts').map(r => [r.id, r.resolved_at]))
  assert.ok(efterEn[FEJL_AELDRE], 'mockens resolved_at skal være sat på den kvitterede række')
  assert.equal(efterEn[FEJL_NYERE], null, 'den anden række skal stadig være uløst')
  await shot('03-en-markeret')

  // ---- 3) RPC'en findes ikke endnu: rækken bliver stående, fejlen ses ----
  await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/fault`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pathPrefix: '/rest/v1/rpc/resolve_automation_alert_v1', method: 'POST', mode: 'missing-function', times: 1 }),
  })
  await raekke(FEJL_NYERE).getByRole('button', { name: 'Markeret som set' }).click()
  await raekke(FEJL_NYERE).getByRole('alert').waitFor({ state: 'visible', timeout: 10000 })
  const fejltekst = await raekke(FEJL_NYERE).getByRole('alert').innerText()
  assert.match(fejltekst, /findes ikke endnu/, 'fejlen skal forklare at databasefunktionen mangler')
  assert.equal(await raekke(FEJL_NYERE).count(), 1, 'rækken skal blive stående når kaldet fejler')
  assert.equal(mock.table('automation_alerts').find(r => r.id === FEJL_NYERE).resolved_at, null, 'intet må være skrevet når kaldet fejler')
  const layoutFejl = await maalLayout(page)
  assert.deepEqual(layoutFejl.udenfor, [], 'fejlteksten må ikke stikke ud af rækken')
  assert.equal(layoutFejl.vandretRulning, false)
  await shot('04-rpc-mangler')

  // Næste forsøg lykkes (fejlen var opbrugt), og rækken forsvinder.
  await raekke(FEJL_NYERE).getByRole('button', { name: 'Markeret som set' }).click()
  await raekke(FEJL_NYERE).waitFor({ state: 'detached', timeout: 10000 })
  assert.ok(mock.table('automation_alerts').find(r => r.id === FEJL_NYERE).resolved_at)

  // ---- 4) ingen fejl tilbage: Indbakken er den samme som i dag ----
  await page.getByText('Coach Briefing er ryddet', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  const efter = await page.locator('body').innerText()
  assert.ok(!/Automatisering fejlede/.test(efter), 'ingen "Automatisering fejlede" må stå tilbage')
  await shot('05-ryddet')
  return efter
}

// Samme Indbakke, men mod en mock hvor automation_alerts aldrig har haft
// rækker - det er "som i dag".
export async function indbakkeUdenFejl(page, { appUrl, outDir, viewport }) {
  await loginOgAabnIndbakke(page, appUrl)
  await tilIndbakken(page)
  await page.getByText('Coach Briefing er ryddet', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({ path: join(outDir, `coach-automation-${viewport.label}-06-uden-fejl-som-i-dag.png`), fullPage: true })
  return page.locator('body').innerText()
}

async function med(browser, viewport, seed, fn, { forventet404 = 0 } = {}) {
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  const fejl = []
  page.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
  page.on('console', msg => { if (msg.type() === 'error') fejl.push(`console.error: ${msg.text()}`) })
  try {
    const result = await fn(page, mock)
    // Den injicerede "RPC findes ikke" giver browseren præcis een 404 i konsollen;
    // alt andet er en rigtig fejl.
    const er404 = m => /status of 404/.test(m)
    assert.equal(fejl.filter(er404).length, forventet404, `forventede ${forventet404} injiceret 404 (${viewport.label}), fandt: ${JSON.stringify(fejl)}`)
    const oevrige = fejl.filter(m => !er404(m))
    assert.deepEqual(oevrige, [], `Ingen browser-fejl forventet (${viewport.label}), fandt: ${JSON.stringify(oevrige)}`)
    return result
  } finally {
    await page.close().catch(() => {})
    await mock.close().catch(() => {})
  }
}

async function main() {
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    for (const viewport of [MOBILE, DESKTOP]) {
      const efter = await med(browser, viewport, seedMedFejl(), (page, mock) =>
        runCoachAutomationAlerts(page, { appUrl: APP_URL, outDir: OUT_DIR, mock, viewport }), { forventet404: 1 })
      const utenFejl = await med(browser, viewport, seedMedFejl({ medRaekker: false }), page =>
        indbakkeUdenFejl(page, { appUrl: APP_URL, outDir: OUT_DIR, viewport }))
      // Tidsstempler ("Opdateret kl. ...") kan afvige med et minut; alt andet skal være ens.
      // Den grønne "Markeret som set"-flash er en toast fra sidste klik, ikke en del af siden.
      const normaliser = t => t.replace(/kl\. \d{2}[.:]\d{2}/g, 'kl. --').replace(/^Markeret som set\r?\n/m, '')
      assert.equal(normaliser(efter), normaliser(utenFejl),
        `Indbakken uden fejl skal være ordret den samme som en Indbakke uden automatiseringsfejl (${viewport.label})`)
    }
    console.log('\nGRØN: automatiseringsfejl vises i Indbakken uden overlap (390x844 og desktop), "Markeret som set" fjerner rækken, en manglende RPC fejler synligt ved rækken, og en Indbakke uden fejl er uændret.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('coach-automation-alerts.spec.mjs')) main()
