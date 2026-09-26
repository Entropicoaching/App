// ORDRE 387 (kopi af outputs/377/skaermbilleder.mjs, mappe foer-coach/efter-coach) — headless skærmbilleder af coachens hovedskærme på 1280 og 390 px
// mod den ægte, ubyggede app (vite) og e2e-mocken (e2e/mock-supabase.mjs +
// e2e/fixtures.mjs's buildSeed, samme som e2e:coach-briefing-seen og
// outputs/373/skaermbilleder.mjs). Kun seedens egne syntetiske data plus to
// opdigtede, ulæste beskeder (så "Kræver dit blik" og Beskeder har indhold)
// og en stævnedato. Ingen atletdata.
// Kørsel (samme dag før og efter, datoen står på skærmen):
//   node outputs/387/skaermbilleder-coach.mjs foer|efter
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { buildSeed, COACH_USER, ATHLETE_ID } from '../../e2e/fixtures.mjs'

const FASE = process.argv[2]
if (!/^(foer|efter)[a-z0-9-]*$/.test(FASE || '')) { console.error('brug: foer|efter'); process.exit(2) }
const OUT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), FASE + '-coach')
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { width: 1280, height: 900, label: '1280' },
  { width: 390, height: 844, label: '390' },
]

// Faste tidsstempler (ikke "for N minutter siden" regnet fra nu), så to
// kørsler samme dag tegner samme tekst.
function seed() {
  const s = buildSeed({ withLogs: true, withMeasuredVideo: true, withAnalyzedVideo: true })
  s.tables.athletes[0].competition_date = '2026-12-05'
  s.tables.messages = [
    { id: 'cccccccc-0377-4377-8377-cccccccccc01', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: 'Hej, hvordan gik ugen?', category: 'besked', read_by_coach: false, created_at: '2026-09-20T08:00:00Z' },
    { id: 'cccccccc-0377-4377-8377-cccccccccc02', athlete_id: ATHLETE_ID, sender_role: 'coach', content: 'Fint, vi holder planen.', category: 'besked', read_by_coach: true, created_at: '2026-09-20T09:00:00Z' },
    { id: 'cccccccc-0377-4377-8377-cccccccccc03', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: 'Kan du se på min teknik?', category: 'teknik', read_by_coach: false, created_at: '2026-09-21T08:00:00Z' },
  ]
  return s
}

async function settle(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('Indlæser…'), null, { timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
}

async function run(browser, viewport, APP_URL, errors) {
  const mobile = viewport.width < 768
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', err => errors.push(`${viewport.label}: ${err}`))
  const shot = async (name, fullPage = true) => {
    await page.screenshot({ path: join(OUT, `${viewport.label}-${name}.png`), fullPage, animations: 'disabled', caret: 'hide' })
    console.log(`${FASE}/${viewport.label}-${name}.png`)
  }
  // Hovedvisninger: sidebaren på desktop, bundnav + menu-ark på mobil.
  const gotoView = async label => {
    if (!mobile) { await page.locator('aside nav div', { hasText: new RegExp(`^${label}`) }).first().click(); return }
    if (label === 'Forside' || label === 'Coach Briefing') { await page.locator('nav button', { hasText: label }).click(); return }
    await page.locator('nav button', { hasText: 'Menu' }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
  }
  // Profilfaner: de fire primære står fremme, resten ligger bag "Mere".
  const gotoTab = async label => {
    const primary = page.locator('main button', { hasText: new RegExp(`^\\S+${label}\\d*$`) })
    if (['Hjem', 'Program', 'Log', 'Beskeder'].includes(label)) { await primary.first().click(); return }
    // "Mere"-knappen er den første ▾ i <main> (den viser den aktive fanes navn).
    await page.locator('main button', { hasText: '▾' }).first().click()
    await page.locator('div[style*="min-width: 11rem"] button', { hasText: label }).click()
  }

  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 20000 })
  await settle(page)
  await shot('01-forside')

  await gotoView('Coach Briefing'); await settle(page); await shot('02-coach-briefing')
  await gotoView('Kalender'); await settle(page); await shot('03-kalender')
  await gotoView('Bibliotek'); await settle(page); await shot('04-bibliotek')
  if (mobile) {
    await page.locator('nav button', { hasText: 'Menu' }).click(); await page.waitForTimeout(300)
    await shot('05-menu', false)
    // Arket dækker bundnavigationen; det lukkes ved et tryk på baggrunden.
    await page.locator('div[style*="z-index: 205"]').click({ position: { x: 195, y: 60 } })
  } else {
    await page.getByRole('button', { name: /Værktøjer/ }).click(); await page.waitForTimeout(300)
    await shot('05-vaerktoejer', false)
    await page.getByRole('button', { name: /Værktøjer/ }).click()
  }

  await gotoView('Forside'); await settle(page)
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
  await settle(page); await shot('06-profil-program')
  const tabs = [['07', 'Hjem'], ['08', 'Log'], ['09', 'Beskeder'], ['10', 'Oversigt'], ['11', 'Kost & mål'], ['12', 'Analyse'], ['13', 'Opvarmning'], ['14', 'Stævne'], ['15', 'Noter']]
  for (const [nr, label] of tabs) {
    await gotoTab(label); await settle(page)
    await shot(`${nr}-profil-${label.toLowerCase().replace(/ & /g, '-').replace('æ', 'ae').replace('å', 'aa')}`)
  }

  // Gennemgå måling (review-modalen) fra Analyse-fanens gemte analyse.
  await gotoTab('Analyse'); await settle(page)
  const gennemgaa = page.getByRole('button', { name: /Gennemgå/ }).first()
  if (await gennemgaa.count()) { await gennemgaa.click(); await settle(page); await shot('16-gennemgaa-maaling', false); await page.getByRole('button', { name: 'Luk', exact: true }).first().click() }
  else console.log('(ingen "Gennemgå"-knap — 16 springes over)')

  // Stævneresultat-modalen, og Ny atlet-modalen (kun i mobilens menu-ark).
  await gotoTab('Stævne'); await settle(page)
  await page.getByRole('button', { name: 'Registrér resultat', exact: true }).click(); await page.waitForTimeout(600)
  await shot('17-staevneresultat', false)
  await page.getByRole('button', { name: 'Annuller', exact: true }).click()
  if (mobile) {
    await page.locator('nav button', { hasText: 'Menu' }).click()
    await page.getByRole('button', { name: '+ Tilføj atlet', exact: true }).click()
    await page.waitForTimeout(400); await shot('18-ny-atlet', false)
  }

  await context.close()
}

async function main() {
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('../../e2e/harness.mjs')
  const mock = createMockSupabase(seed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  const errors = []
  try {
    for (const viewport of VIEWPORTS) await run(browser, viewport, APP_URL, errors)
    if (errors.length) console.log('pageerror:', errors)
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

main().catch(err => { console.error('FEJL:', err.message); process.exitCode = 1 })
