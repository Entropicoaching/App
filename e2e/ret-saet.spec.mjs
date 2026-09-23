// ORDRE 320 · blok 2 — proven af blok 1: "ret" på et allerede klaret sæt
// (Dagens pas) redigerer sættet IN PLACE i stedet for at slette log-rækken
// og genåbne den (docs/KRITIK-314.md fund 1+3). Logger sæt 1-3, retter sæt 2
// (vægt op 2,5 kg), gemmer, og tjekker på to viewports (390×844 og 360×780):
//   1) sæt 3 er stadig synligt som en klaret linje efter "ret"+"Godkendt" på
//      sæt 2 (den gamle onUndoLastSet-genbrug gjorde det usynligt),
//   2) det aktuelle sæt (Sæt 4/4) er UÆNDRET efter redigeringen,
//   3) mockens exercise_logs har stadig præcis tre rækker for øvelsen (ingen
//      dublet, ingen tabt række) og sæt 2's vægt er opdateret,
//   4) offline-køen fra 293 virker stadig ved "ret" (samme mønster som
//      e2e/fejl.spec.mjs's runOfflineSetLog): en redigering foretaget uden
//      net viser "☁ 1 sæt gemt lokalt" og bliver sendt når forbindelsen
//      kommer tilbage — uden dublet i mockens tabel.
//
// Egen mock+browser-kontekst pr. viewport (samme mønster som
// e2e/saet-nu.spec.mjs). Egen kørsel: `npm run e2e:ret-saet`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, EXERCISE_ID, buildSeed } from './fixtures.mjs'

const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '320')
mkdirSync(OUT_DIR, { recursive: true })

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

function assertNoHorizontalOverflow(width) {
  return async (page, label) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(scrollWidth <= width, `${label}: vandret overflow (scrollWidth ${scrollWidth} > viewport ${width})`)
  }
}

function parseSetLineWeight(text) {
  const m = /Sæt \d+: ([\d.,]+)kg/.exec(text || '')
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

async function runViewport(page, { tag, width, height, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `${tag}-${name}.png`), fullPage: true })
  const checkOverflow = assertNoHorizontalOverflow(width)

  await page.goto(process.env.__RET_SAET_APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })

  // Log sæt 1-3 med de forudfyldte værdier — samme mønster som
  // e2e/saet-nu.spec.mjs, denne prøve bryr sig ikke om de eksakte tal, kun om
  // at sæt 2's linje ikke forsvinder/dubleres efter en "ret".
  for (const setNum of [1, 2, 3]) {
    await page.getByText(`Sæt ${setNum}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  }
  await page.getByText('Sæt 4/4', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await checkOverflow(page, `${tag} efter sæt 1-3, før ret`)
  await shot('00-tre-saet-logget')

  // ORDRE 339 · blok 1 (F3) — klarede sæt er kollapset til én linje som
  // standard; "ret"-rækkerne skal foldes ud først.
  assert.equal(await page.getByRole('button', { name: 'Ret sæt 2', exact: true }).count(), 0, `${tag}: "ret"-rækkerne skal være kollapset som standard`)
  await page.getByRole('button', { name: 'Vis 3 klarede sæt', exact: true }).click()
  const setNumSaetLinje = (n) => page.getByText(`Sæt ${n}:`, { exact: false })
  const foerVaegt = parseSetLineWeight(await setNumSaetLinje(2).innerText())
  assert.ok(foerVaegt != null, `${tag}: kunne ikke læse vægten på "Sæt 2:"-linjen`)

  // --- "ret" sæt 2: vægt op 2,5 kg, gem ---
  await page.getByRole('button', { name: 'Ret sæt 2', exact: true }).click()
  await page.getByText('Retter sæt 2', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await checkOverflow(page, `${tag} midt i "ret" sæt 2`)
  await shot('01-retter-saet-2')

  await page.getByRole('button', { name: '2,5 kg mere (ret)', exact: true }).click()
  await page.getByRole('button', { name: 'Godkendt, ret sæt 2', exact: true }).click()
  await page.getByText('Retter sæt 2', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 })

  // Sæt 4/4 (det aktuelle sæt) er UÆNDRET — kortet sprang ikke tilbage til
  // det redigerede sæt, og heller ikke frem forbi det aktuelle.
  await page.getByText('Sæt 4/4', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  // Sæt 3 er stadig synligt som klaret linje (blev IKKE "usynligt", fund 3).
  await setNumSaetLinje(3).waitFor({ state: 'visible', timeout: 5000 })
  await checkOverflow(page, `${tag} efter "ret" sæt 2 er gemt`)
  await shot('02-efter-ret-saet-2')

  const efterVaegt = parseSetLineWeight(await setNumSaetLinje(2).innerText())
  assert.equal(efterVaegt, Math.round((foerVaegt + 2.5) * 10) / 10,
    `${tag}: sæt 2's vægt skulle være ${foerVaegt + 2.5}kg efter "ret", var ${efterVaegt}kg`)

  await page.waitForFunction(
    async ([url, exId]) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      return rows.filter(r => r.exercise_id === exId).length === 3
    },
    [mockUrl, EXERCISE_ID],
    { timeout: 10000 },
  )
  // Kun sæt 1-3 er logget (sæt 4 er stadig det aktuelle, ulogget, sæt) — "ret"
  // må hverken tabe en række eller indsætte en ekstra (dublet).
  const logsAfterRet = (await readTable(mockUrl, 'exercise_logs')).filter(l => l.exercise_id === EXERCISE_ID)
  assert.equal(logsAfterRet.length, 3, `${tag}: skal stadig være præcis tre rækker (sæt 1-3), ingen dublet/tabt række, fandt ${logsAfterRet.length}`)
  const set2Row = logsAfterRet.find(l => l.set_number === 2)
  assert.equal(set2Row.weight, efterVaegt, `${tag}: databasens sæt 2-vægt skal matche det viste (${efterVaegt}kg)`)
  const set3Row = logsAfterRet.find(l => l.set_number === 3)
  assert.ok(set3Row, `${tag}: sæt 3's log-række skal stadig findes i databasen`)

  // --- offline-køen (293) virker stadig ved "ret": ret sæt 1 uden net ---
  const foerVaegtSaet1 = parseSetLineWeight(await setNumSaetLinje(1).innerText())
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Ret sæt 1', exact: true }).click()
  await page.getByText('Retter sæt 1', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await page.getByRole('button', { name: '2,5 kg mere (ret)', exact: true }).click()
  await page.getByRole('button', { name: 'Godkendt, ret sæt 1', exact: true }).click()

  // Optimistisk: redigeringen lukker med det samme, UI viser den nye vægt,
  // og "☁ 1 sæt gemt lokalt" dukker op når queueWrites forsøg er brugt op
  // (samme ~4s-mønster som logSet's localFallback, se docs/KRITIK-314.md).
  // queueWrite bruger 4 forsøg med backoff (~3,6s) før skrivningen fejler
  // og lægger sig i offline-køen (se src/supabase.js) — edit-formen lukker
  // først når det forsøg er ovre.
  await page.getByText('Retter sæt 1', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 })
  await page.getByText('gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 15000 })
  await shot('03-ret-saet-1-offline')
  const vaegtOfflineRettet = parseSetLineWeight(await setNumSaetLinje(1).innerText())
  assert.equal(vaegtOfflineRettet, Math.round((foerVaegtSaet1 + 2.5) * 10) / 10,
    `${tag}: sæt 1's vægt skal være opdateret i UI selvom skrivningen ligger offline`)

  await page.context().setOffline(false)
  await page.waitForFunction(
    async ([url, exId]) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      const set1 = rows.filter(r => r.exercise_id === exId && r.set_number === 1)
      return set1.length === 1
    },
    [mockUrl, EXERCISE_ID],
    { timeout: 15000 },
  )
  await page.getByText('gemt lokalt', { exact: false }).waitFor({ state: 'hidden', timeout: 15000 })
  await shot('04-online-igen-sendt')

  const logsEfterOnline = (await readTable(mockUrl, 'exercise_logs')).filter(l => l.exercise_id === EXERCISE_ID)
  assert.equal(logsEfterOnline.length, 3, `${tag}: stadig præcis tre rækker efter offline-ret + online igen, fandt ${logsEfterOnline.length}`)
  const set1Row = logsEfterOnline.find(l => l.set_number === 1)
  assert.equal(set1Row.weight, vaegtOfflineRettet, `${tag}: databasens sæt 1-vægt skal matche den offline-rettede værdi`)

  console.log(`${tag}: "ret" på sæt 2 opdaterede raekken uden at slette den, sæt 3 forblev synligt, sæt 4/4 var uændret, offline-ret på sæt 1 blev sendt uden dublet.`)
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  process.env.__RET_SAET_APP_URL = APP_URL
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`

  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const viewports = [
      { tag: 'atlet-390x844', width: 390, height: 844 },
      { tag: 'atlet-360x780', width: 360, height: 780 },
    ]
    for (const vp of viewports) {
      const mock = createMockSupabase(buildSeed())
      await mock.listen(MOCK_PORT)
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      try {
        await runViewport(page, { ...vp, mockUrl, outDir: OUT_DIR })
      } finally {
        await context.close()
        await mock.close()
      }
    }
    console.log('\nGRØN: ret-sæt (ordre 320) — "ret" redigerer en klaret log-række in place (ingen sletning), senere sæt forblev synlige, det aktuelle sæt var uændret, offline-køen fra 293 virker stadig ved "ret", på både 390×844 og 360×780.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
  }
}

if (process.argv[1] && process.argv[1].endsWith('ret-saet.spec.mjs')) main()
