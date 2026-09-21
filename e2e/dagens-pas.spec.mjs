// ORDRE 263 · commit 4, udvidet i ORDRE 280 · commit 5 — beviser hele
// "log et sæt uden tastatur"-flowet klikket igennem i den ÆGTE, ubuildede
// app (npm run dev, ikke en harness) mod den lokale mock-backend, samme
// mønster som atlet.spec.mjs/fejl.spec.mjs: Dagens pas (Hjem-fanen) viser
// næste sæt direkte med vægt/reps allerede udfyldt (blok 1) — logger tre
// sæt med kun "Godkendt"-tryk, ingen .fill() på vægt/reps-felterne — ser
// pausetimeren tælle ned (blok 3), fortryder det sidste sæt (blok 2), og
// genindlæser siden for at bevise at det fortrudte sæt er væk og resten
// stadig står rigtigt (blok 2+4).
//
// Egen, isoleret mock+vite-instans (ikke wired ind i e2e/run-all.mjs's delte
// sekvens): den delte sekvens logger bevidst kun 3 af Squats 4 sæt (sæt 4 er
// reserveret til fejl.spec.mjs's offline-test, se fixtures.mjs) — at logge
// sæt 1 her via Dagens pas ville forskyde den choreografi. Egen kørsel:
// `npm run e2e:dagens-pas`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, EXERCISE_ID } from './fixtures.mjs'

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

/** `page` er en frisk Playwright-side, `appUrl`/`mockUrl` peger på den
 * kørende vite-server hhv. mock-backend. */
export async function runDagensPasPause(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `dagens-pas-${name}.png`), fullPage: true })
  const waitForLoggedRows = (count) => page.waitForFunction(
    async ([url, n]) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      return rows.filter(r => !r.skipped).length >= n
    },
    [mockUrl, count],
    { timeout: 10000 },
  )

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // Dagens pas: næste sæt vises øverst på Hjem, med det samme — ingen
  // navigation til Program-fanen nødvendig.
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Squat', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
  // Ingen pause før noget er logget.
  assert.equal(await page.getByText('Pause', { exact: false }).count(), 0, 'ingen pausetimer må vises før et sæt er logget')
  await shot('01-naeste-saet')

  // ORDRE 280 · commit 1 — vægt/reps skal stå udfyldt af sig selv (planens
  // tal, øvelsen har recommended_weight: 80, reps 4-6 → 4). Ingen .fill()
  // her: hele pointen er at "Godkendt" kan trykkes uden tastatur.
  assert.equal(await page.getByLabel('Vægt, sæt 1').inputValue(), '80', 'vægten skal stå udfyldt (planens anbefaling) uden at taste')
  assert.equal(await page.getByLabel('Reps, sæt 1').inputValue(), '4', 'reps skal stå udfyldt (ordinationens nederste tal) uden at taste')
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await waitForLoggedRows(1)

  const logsAfter1 = await readTable(mockUrl, 'exercise_logs')
  const set1 = logsAfter1.find(l => l.exercise_id === EXERCISE_ID && l.set_number === 1)
  assert.ok(set1, 'sæt 1 skal være logget i mockens exercise_logs')
  assert.equal(set1.weight, 80)
  assert.equal(set1.reps_completed, 4)

  // Pausetimeren starter automatisk — synlig med det samme, ingen navigation.
  // (teksten er "Pause · Squat" — øvelsesnavnet står med i samme span, se
  // RestPauseFooter i AthleteView.jsx — deraf exact: false.)
  await page.getByText('Pause', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  const secondsText = () => page.getByText(/^\d+s$/).first().textContent()
  const firstReading = parseInt(await secondsText(), 10)
  assert.ok(Number.isFinite(firstReading) && firstReading > 0 && firstReading <= 90,
    `pausen skal starte med et positivt sekundtal (≤ 90s standard), fik "${firstReading}"`)
  await shot('02-pause-startet')

  // Den skal faktisk tælle ned (ikke stå stille) — vent til uret har rykket sig.
  await page.waitForFunction(
    (prev) => {
      const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^\d+s$/.test(e.textContent || ''))
      if (!el) return false
      return parseInt(el.textContent, 10) < prev
    },
    firstReading,
    { timeout: 5000 },
  )
  await shot('03-pause-taeller-ned')
  console.log(`Pausetimeren tæller ned (${firstReading}s → lavere).`)

  // Sæt 2 og 3 — kortet er sprunget videre af sig selv, vægten er ført med
  // over (samme øvelse), reps genudfyldt fra ordinationen. Stadig ingen
  // .fill(), kun "Godkendt".
  for (const setNum of [2, 3]) {
    await page.getByText(`Sæt ${setNum}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await page.getByLabel(`Vægt, sæt ${setNum}`).inputValue(), '80', `vægten skal føres med til sæt ${setNum} uden at taste`)
    assert.equal(await page.getByLabel(`Reps, sæt ${setNum}`).inputValue(), '4', `reps skal genudfyldes for sæt ${setNum} uden at taste`)
    if (setNum === 2) {
      // ORDRE 293 · F1 — knapperne skal starte fra det viste tal (4), ikke 0:
      // ét tryk på plus giver 5, ét på minus tilbage til 4 (sæt 1 var fint;
      // det var sæt 2+ hvor state står tomt mens feltet viser ordinationen).
      await page.getByRole('button', { name: '1 rep mere', exact: true }).click()
      assert.equal(await page.getByLabel('Reps, sæt 2').inputValue(), '5', 'ét tryk på "1 rep mere" i sæt 2 skal give ordinationens 4 + 1, ikke 1')
      await page.getByRole('button', { name: '1 rep mindre', exact: true }).click()
      assert.equal(await page.getByLabel('Reps, sæt 2').inputValue(), '4', 'ét tryk på "1 rep mindre" derefter skal give 4 igen')
      await page.getByRole('button', { name: '1 rep mindre', exact: true }).click()
      assert.equal(await page.getByLabel('Reps, sæt 2').inputValue(), '3', '"1 rep mindre" fra 4 skal give 3, ikke 0')
      await page.getByRole('button', { name: '1 rep mere', exact: true }).click()
      assert.equal(await page.getByLabel('Reps, sæt 2').inputValue(), '4')
    }
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await waitForLoggedRows(setNum)
  }
  await shot('04-tre-saet-logget')
  const logsAfter3 = await readTable(mockUrl, 'exercise_logs')
  assert.equal(logsAfter3.filter(l => l.exercise_id === EXERCISE_ID && !l.skipped).length, 3, 'tre sæt skal være logget, ingen dubletter')

  // Fortryd sidste sæt (blok 2) — kun muligt mens man ikke har forladt
  // øvelsen, hvilket stadig er tilfældet her.
  await page.getByRole('button', { name: '↺ Fortryd sidste sæt', exact: true }).click()
  await page.waitForFunction(
    async (url) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      return rows.filter(r => !r.skipped).length === 2
    },
    mockUrl,
    { timeout: 10000 },
  )
  await page.getByText('Sæt 3/4', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await shot('05-fortrudt')

  // Genindlæs siden — det fortrudte sæt må ikke være der, de to andre skal
  // stadig stå, og appen skal ikke hænge i en spøgelses-pause fra det
  // fortrudte sæt.
  await page.reload()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Sæt 3/4', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  assert.equal(await page.getByText('Pause', { exact: false }).count(), 0, 'det fortrudte sæts pause må ikke overleve en genindlæsning')
  const logsAfterReload = await readTable(mockUrl, 'exercise_logs')
  const loggedAfterReload = logsAfterReload.filter(l => l.exercise_id === EXERCISE_ID && !l.skipped)
  assert.equal(loggedAfterReload.length, 2, 'præcis to sæt skal overleve genindlæsning (det tredje blev fortrudt)')
  assert.ok(loggedAfterReload.every(l => l.set_number <= 2), 'kun sæt 1 og 2 må være logget efter fortryd + genindlæsning')
  await shot('06-genindlaest')

  console.log('GRØN: tre sæt logget fra Dagens pas uden tastatur (vægt/reps udfyldt af sig selv), pausen talte ned, sidste sæt blev fortrudt, og en genindlæsning viste den rigtige tilstand.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { buildSeed } = await import('./fixtures.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runDagensPasPause(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR })
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('dagens-pas.spec.mjs')) main()
