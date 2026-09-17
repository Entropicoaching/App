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

    // A) Atletlisten viser målingen uden noget klik.
    const measurementText = '3 reps · Ø 2.4 cm sidelæns · Ø 2.1s/rep'
    await page.getByText(measurementText, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '01-atletlisten')

    // B) Coach Briefing-forhåndsvisningen på samme side viser "Ny måling fra et sæt".
    await page.getByText(/Ny måling fra et sæt · Squat/).waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '02-kraever-dit-blik')

    // C) Ét klik på den kompakte måling åbner den eksisterende reviewvisning.
    // Scoperet til selve dialogen (ikke page-bred getByText) - AnalyseTab
    // (mountet bagved, samme klik) har sin EGEN "Gennemgå måling"-knap i sin
    // videoliste, som ellers ville give en falsk-positiv match.
    // Ren CSS-attributmatch, ikke getByRole/getByLabel: den ydre atlet-række
    // er selv role="button" og arver den indre knaps aria-label ind i sit
    // eget tilgængelige navn (nestede interaktive elementer), så en
    // navnebaseret matcher rammer BEGGE.
    await page.locator('button[aria-label^="Åbn gemt måling"]').click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText('Gennemgå måling').first().waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByText('3 reps').first().waitFor({ state: 'visible', timeout: 10000 })
    await shot(page, '03-review-aabnet')

    const crashed = await page.getByText('Ups — noget gik galt.').count()
    assert.equal(crashed, 0, 'Reviewvisningen ramte ErrorBoundary-fallbacken')
    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(consoleErrors)}`)

    console.log(`\nGRØN: coachen ser en gemt måling (${MEASURED_VIDEO_ID}) i atletlisten og Coach Briefing uden at åbne VideoCoach, og ét klik åbner den eksisterende reviewvisning.`)
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
