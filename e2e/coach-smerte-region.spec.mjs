// ORDRE 2342 · coachens smerterække viser regionen, og notens og kommentarens tekst står aldrig i DOM.
//   Marc 5. nov. (V10 3A): "smerte-note standser stigningsforslag". Bygger paa 2317 (bodyPartsOf i painFromNotes og painFromVoices).
//   Tre scenarier (kilderne taeller ikke sammen for samme atlet, den foerste fundne vinder):
//     note med smerte paa knaeet      -> "Smerte nævnt <dato>, knæet"
//     pas-kommentar med smerte i skulder -> "Smerte nævnt i uge N, skulderen"
//     rolig note uden smerte           -> ingen smerterække
//   390x844 og 1280x800, lys og moerk: 4 koersler. Kun syntetiske data, Testatlet, Chromium.
// Koersel: E2E_VITE_PORT=5342 E2E_MOCK_PORT=8992 VITE_SUPABASE_URL=http://127.0.0.1:8992 node e2e/coach-smerte-region.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER, ATHLETE_ID, EXERCISE_ID, WEEK_ID, buildSeed } from './fixtures.mjs'

const NOTE_SMERTE = 'Syntetisk note: det knaeekker og knæet gør ondt helt nede i bunden af sidste sæt'
const KOMMENTAR_SMERTE = 'Syntetisk kommentar: skulderen stikker og jeg stoppede tidligt i dag'
const NOTE_ROLIG = 'Syntetisk note: let og rolig dag, teknikken sad fint hele vejen'
const DATO = /Smerte nævnt \d{1,2}\. [a-zæøå]+\.?, knæet/
const OEVRIGE = /ondt|stikker|stoppede tidligt|Syntetisk (note|kommentar)|sidste sæt|rolig dag/i

const isoDagsiden = n => new Date(Date.now() - n * 864e5).toISOString()

function seedMed(scenarie) {
  const data = buildSeed()
  const t = data.tables
  t.exercise_logs = t.exercise_logs ?? []
  const log = note => t.exercise_logs.push({ id: 'cc000000-0000-4000-8000-000000000001', exercise_id: EXERCISE_ID, athlete_id: ATHLETE_ID, set_number: 1,
    weight: 100, reps_completed: 5, note, rpe_actual: 7, rpe_planned: null, skipped: false, logged_at: isoDagsiden(2) })
  if (scenarie === 'note') log(NOTE_SMERTE)
  if (scenarie === 'rolig') log(NOTE_ROLIG)
  if (scenarie === 'kommentar') t.sessions.find(x => x.week_id === WEEK_ID).athlete_comment = KOMMENTAR_SMERTE
  return data
}

async function loeb(browser, { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }, { scenarie, tema, vp }) {
  const mock = createMockSupabase(seedMed(scenarie))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const fejl = []
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => fejl.push(err.message))
    await page.addInitScript(t => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, tema)
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
    const mere = page.locator('[data-coach-fold="mere"] > summary')
    await mere.waitFor({ state: 'visible', timeout: 15000 })
    await mere.click()
    const raekke = page.getByText('Smerte nævnt', { exact: false })
    if (scenarie === 'rolig') {
      await page.waitForTimeout(3000)
      assert.equal(await raekke.count(), 0, `rolig note ma ikke give en smerterække (${tema}/${vp.width})`)
    } else {
      await raekke.first().waitFor({ state: 'visible', timeout: 15000 }).catch(async e => { throw new Error(`${e.message}
${scenarie}: ${(await page.evaluate(() => document.body.innerText)).slice(0, 800)}`) })
      const tekst = (await raekke.first().innerText()).replace(/\s+/g, ' ')
      if (scenarie === 'note') assert.match(tekst, DATO, `forventede regionen knæet (${tema}/${vp.width}): ${tekst}`)
      else assert.match(tekst, /Smerte nævnt i uge \d+, skulderen/, `forventede regionen skulderen (${tema}/${vp.width}): ${tekst}`)
      assert.equal(await raekke.count(), 1, 'praecis en smerterække')
    }
    const krop = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    for (const streng of [NOTE_SMERTE, KOMMENTAR_SMERTE, NOTE_ROLIG]) assert.ok(!krop.includes(streng), `hele teksten maa ikke staa i DOM: ${streng}`)
    assert.ok(!OEVRIGE.test(krop), `dele af notens eller kommentarens tekst staar i DOM (${scenarie}): ${(krop.match(OEVRIGE) || [])[0]}`)
    if (scenarie !== 'rolig') await page.screenshot({ path: join(OUT_DIR, `smerte-region-2342-${scenarie}-${vp.width}-${tema}.png`), fullPage: false })
    assert.deepEqual(fejl, [], `browser-fejl: ${fejl.join(' | ')}`)
  } finally { await ctx.close().catch(() => {}); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  let groenne = 0
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      for (const tema of ['lys', 'moerk']) {
        for (const scenarie of ['note', 'kommentar', 'rolig']) {
          await loeb(browser, { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }, { scenarie, tema, vp })
        }
        groenne++
        console.log(`GRØN: ${vp.width}x${vp.height} ${tema} (note, kommentar, rolig)`)
      }
    }
    console.log(`\nGRØN: coachens smerterække viser regionen og aldrig teksten, ${groenne} af 4 kørsler.`)
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-smerte-region.spec.mjs')) main()
