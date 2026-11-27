// ORDRE 2421: en ny atlet moeder én rundvisning, ikke to (mock, 390x844, uafhaengig af ugedagen).
// Guiden (gennemfoert eller sprunget) goer Hjem-turen "Trin 1 af 4" overfloedig; en atlet der har set guiden foer, aendres ikke.
// Egen koersel: `npm run e2e:en-rundvisning-2421` (MAAL=1 skriver kun, hvad der ses).
import assert from 'node:assert/strict'
import { buildSeed } from './fixtures.mjs'

const MAIL = 'klient@e2e.test'
const MAAL = process.env.MAAL === '1'

function seedFor() {
  const seed = buildSeed(); const t = seed.tables
  t.exercises[0].intensity = null; t.exercises[0].recommended_weight = null
  Object.assign(t.athletes[0], { name: 'Testklient', user_id: null, email: MAIL, onboarding_completed_at: null })
  t.profiles = t.profiles.filter(p => p.id !== t.athletes[0].user_id && p.email !== 'atlet@e2e.test')
  return seed
}

async function opretOgGennemgaa(ap, APP_URL, sprunget) {
  await ap.goto(APP_URL)
  await ap.getByText('Opret her').click()
  await ap.locator('#athlete-auth-email').fill(MAIL)
  await ap.locator('#athlete-auth-password').fill('e2e-pass-klient-1')
  await ap.getByRole('button', { name: /Opret konto/ }).click()
  await ap.getByRole('button', { name: /Videre/i }).first().waitFor({ state: 'visible', timeout: 15000 })
  if (sprunget) await ap.getByRole('button', { name: /Spring guiden over/i }).click()
  else for (let i = 0; i < 6; i++) {
    const v = ap.getByRole('button', { name: /Videre|Se dit program|Gå til forsiden/i })
    if (!(await v.count())) break
    await v.first().click(); await ap.waitForTimeout(500)
  }
  await ap.waitForTimeout(800)
}

async function hjemTur(ap) {
  await ap.getByRole('button', { name: /^Hjem$/ }).first().evaluate(el => el.click()).catch(() => {})
  await ap.waitForTimeout(900)
  return (await ap.locator('[data-home-onboarding]:not([hidden])').count()) + (await ap.getByText('Trin 1 af 4').count())
}

async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, sprunget, tema) {
  const mock = createMockSupabase(seedFor())
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  try {
    const ap = await ctx.newPage()
    await ap.addInitScript(([t]) => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, [tema])
    ap.on('pageerror', err => console.error('[browser pageerror]', err))
    await opretOgGennemgaa(ap, APP_URL, sprunget)
    const efterGuide = await hjemTur(ap)
    if (process.env.SKAERM) await ap.screenshot({ path: `${process.env.SKAERM}-${sprunget ? 'sprunget' : 'gennemfoert'}-${tema}.png`, fullPage: true })
    // Genindlaes: en atlet med set guide ser heller ikke turen senere.
    await ap.reload(); await ap.waitForTimeout(1500)
    const efterGenindlaes = await hjemTur(ap)
    return { efterGuide, efterGenindlaes }
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}

// Atlet der har set guiden foer i dag: onboarding_completed_at er sat, turen er ikke set lokalt, og intet aendres.
async function korGammel(browser, createMockSupabase, MOCK_PORT, APP_URL) {
  const seed = buildSeed(); seed.tables.athletes[0].onboarding_completed_at = '2026-01-01T10:00:00Z'
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const ap = await ctx.newPage()
    const { ATHLETE_USER } = await import('./fixtures.mjs')
    await ap.goto(APP_URL)
    await ap.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await ap.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await ap.getByRole('button', { name: 'Log ind' }).click()
    await ap.getByRole('button', { name: /Start dagens pas|Start næste pas/ }).first().waitFor({ state: 'visible', timeout: 20000 })
    return await hjemTur(ap)
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    const temaer = process.env.SKAERM ? ['lys', 'moerk'] : ['lys']
    const res = {}
    for (const tema of temaer) {
      res[`gennemfoert-${tema}`] = await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, false, tema)
      res[`sprunget-${tema}`] = await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, true, tema)
    }
    const gammel = await korGammel(browser, createMockSupabase, MOCK_PORT, APP_URL)
    console.log(JSON.stringify({ ...res, gammelUdenGuideSet: gammel }))
    if (MAAL) return
    for (const [navn, r] of Object.entries(res)) {
      assert.equal(r.efterGuide, 0, `${navn}: Hjem-turen vises efter guiden`)
      assert.equal(r.efterGenindlaes, 0, `${navn}: Hjem-turen vises efter genindlaesning`)
    }
    assert.equal(gammel, 0, 'atlet med gennemfoert guide faar heller ikke Hjem-turen (uaendret)')
    console.log('en-rundvisning-2421: OK')
  } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
main().catch(err => { console.error(err); process.exit(1) })
