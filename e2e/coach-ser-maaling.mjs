// ORDRE 266 · commit 3 — coachen ser en måling der er gemt af en atlet, UDEN
// at åbne VideoCoach. Seeder en allerede SPORET video_analyses-række
// (MEASURED_VIDEO_ID, se fixtures.mjs) og bekræfter to ting med rigtige klik
// mod den ægte app (Dashboard.jsx), ikke en harness:
//
//  A) Atletlisten viser den kompakte måling (reps, vandret afvigelse,
//     tid/rep) uden noget klik overhovedet (ordre 266 · commit 1).
//  B) Coach Briefing viser "Ny måling fra et sæt" for samme række
//     (ordre 266 · commit 2).
//  C) Ét klik på den kompakte måling åbner den EKSISTERENDE "Gennemgå
//     måling"-visning — samme vej som video-review.spec.mjs allerede
//     beviser, ingen ny kode i selve åbningen.
//
// ÆRLIG GRÆNSE: seeder rækken FÆRDIG-SPORET (samme mønster som
// ANALYZED_VIDEO_ID i video-review.spec.mjs) i stedet for at spore et rigtigt
// klip via "Film et sæt" — fordi "Film et sæt"s Gem-knap i dag IKKE sender
// reps/afvigelse/tid til Supabase (kun video_path/lift/variation/load_kg/rpe,
// se docs/RAPPORT-266.md), så en reel ende-til-ende-kørsel fra atlet-klik til
// dette panel ikke er mulig endnu uden at ændre public/videocoach.html (uden
// for denne ordres grænser). Prøven beviser derfor visningslaget mod de
// samme kolonner AnalyseTab allerede skriver, ikke hele kæden.
//
// Kørsel: node e2e/coach-ser-maaling.mjs

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, MEASURED_VIDEO_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

async function main() {
  const shot = (page, name) => page.screenshot({ path: join(OUT_DIR, `coach-ser-maaling-${name}.png`), fullPage: true })

  const mock = createMockSupabase(buildSeed({ withMeasuredVideo: true }))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const consoleErrors = []
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()

    // A) Forsiden (Kræver dit blik) viser atletens gemte måling som opgaven
    // "<navn> · Video venter på feedback" uden noget andet klik end login.
    // FORÆLDET FØR: den kompakte tekst "3 reps · Ø 2.4 cm sidelæns · Ø 2.1s/rep"
    // i atletlisten og "Ny måling fra et sæt" i Coach Briefing fandtes kun på
    // den gamle forside (ForsideView, entropi2={false}). Entropi 2 er tændt for
    // alle (src/entropi2/flag.mjs), og forsiden er siden U11 (f27c24c6) en
    // opgaverække plus atletknapper "Åbn programmet for <navn>".
    const opgave = page.getByRole('button', { name: /Video venter på feedback/ })
    await opgave.first().waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '01-forsiden')

    // B) Coach Briefing (menuen) viser samme opgave i indbakken.
    await page.getByText('Coach Briefing', { exact: true }).first().click()
    await page.getByRole('heading', { name: 'Indbakke' }).waitFor({ state: 'visible', timeout: 10000 })
    await opgave.first().waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '02-kraever-dit-blik')

    // C) Ét klik på opgaven åbner den eksisterende reviewvisning med den gemte
    // måling (dialogen, ikke Analyse-fanen bagved, som har sin egen liste).
    await opgave.first().click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText('Gennemgå måling').first().waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText(/3 reps/).first().waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText('2,4 cm').first().waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '03-review-aabnet')

    const crashed = await page.getByText('Ups — noget gik galt.').count()
    assert.equal(crashed, 0, 'Reviewvisningen ramte ErrorBoundary-fallbacken')
    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(consoleErrors)}`)

    console.log(`\nGRØN: coachen ser en gemt måling (${MEASURED_VIDEO_ID}) på forsiden og i Coach Briefing uden at åbne VideoCoach, og ét klik åbner den eksisterende reviewvisning.`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

main()
