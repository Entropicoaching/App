// ORDRE 1429 - coachens fremgang matcher atletens. To syntetiske atleter:
//  A "Testatlet": baenk og squat stiger, doedloeft staar fast (svageste), lette saet med hoej Epley.
//  B "Atlet Stille": baenk staar stille i 8 uger mens backoff stiger, smerte-note om skulderen.
// Beviser (1) styrkelinjen oeverst, (2) coach-Log e1RM = atletens Fremgang-tal, (3) Stævne-rekorder
// uden lette saet og med eet navn. Skaermbilleder i outputs/1429 (390 og 1280).
// `node e2e/coach-fremgang.spec.mjs` (efter) / `FREMGANG_FOER=1 ...` (foer-billeder fra gammel kode).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

const FOER = !!process.env.FREMGANG_FOER
const OUT_DIR = process.env.E2E_OUT || join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1429')
mkdirSync(OUT_DIR, { recursive: true })
const uuid = (a, n) => `${a}${String(n).padStart(7, '0')}-${a}${a}${a}${a}-4${a}${a}${a}-8${a}${a}${a}-${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}`
const DAY = 864e5
const B_ID = uuid('e', 1)

const A = [ // [dage siden, navn, kg, reps]
  [60, 'Bænkpres topsæt', 100, 3], [60, 'Bænkpres - backoff', 85, 8],
  [46, 'Baenkpres top set', 102.5, 3], [46, 'Bænkpres teknik single', 60, 1],
  [32, 'Bænkpres (comp)', 105, 3], [32, 'Bænkpres back-off', 95, 10],
  [18, 'Bænkpres topsæt', 107.5, 3], [4, 'Bænkpres topsæt', 110, 3], [4, 'Bænkpres volumen', 80, 12],
  [58, 'Squat - topsæt', 130, 3], [44, 'Squat Top Set', 135, 3], [30, 'Squat comp', 140, 3], [16, 'Squat - topsæt', 145, 3], [3, 'Squat topsæt', 150, 3], [3, 'Squat backoff', 120, 10],
  [57, 'Dødløft topsæt', 160, 3], [43, 'Dødløft - topsæt', 160, 3], [29, 'Dødløft topsæt', 160, 3], [9, 'Dødløft topsæt', 160, 3], [9, 'Dødløft backoff', 150, 8],
]
const B = [
  ...[56, 49, 42, 35, 28, 21, 14, 7, 2].flatMap((d, i) => [[d, 'Bænkpres topsæt', 100, 4], [d, 'Bænkpres backoff', 70 + i * 2.5, 8]]),
  ...[56, 42, 28, 14, 2].map((d, i) => [d, 'Squat topsæt', 120 + i * 5, 3]),
]

export function seedToAtleter() {
  const seed = buildSeed()
  const mk = (athleteId, prefix, saet, navne, comment) => {
    const wk = uuid(prefix, 1), se = uuid(prefix, 2)
    seed.tables.weeks.push({ id: wk, athlete_id: athleteId, week_number: 0, block_name: 'Base' })
    seed.tables.sessions.push({ id: se, week_id: wk, title: 'Historik', session_order: 9, weekday: 0, athlete_rating: null, athlete_comment: comment })
    const idFor = new Map()
    navne.forEach((navn, i) => {
      const id = uuid(prefix === 'b' ? 'c' : 'f', i + 1); idFor.set(navn, id)
      seed.tables.exercises.push({ id, session_id: se, name: navn, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: i + 1, recommended_weight: 80 })
    })
    seed.tables.exercise_logs.push(...saet.map(([dage, navn, kg, reps], i) => ({
      id: uuid(prefix === 'b' ? 'd' : '9', i + 1), exercise_id: idFor.get(navn), athlete_id: athleteId, set_number: 1, weight: kg, reps_completed: reps,
      note: null, rpe_actual: null, rpe_planned: null, skipped: false, logged_at: new Date(Date.now() - dage * DAY + (i % 5) * 36e5).toISOString(),
    })))
  }
  mk(ATHLETE_ID, 'b', A, [...new Set(A.map(s => s[1]))], null)
  seed.tables.athletes.push({ id: B_ID, user_id: null, name: 'Atlet Stille', email: 'stille@e2e.test', status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: new Date().toISOString() })
  mk(B_ID, 'a', B, [...new Set(B.map(s => s[1]))], 'Det stikker i skulderen ved bunden')
  const pr = (id, aid, navn, w, r, dage) => ({ id, athlete_id: aid, exercise_name: navn, weight: w, reps: r, logged_at: new Date(Date.now() - dage * DAY).toISOString(), created_at: new Date(Date.now() - dage * DAY).toISOString() })
  seed.tables.personal_records.push(
    pr(uuid('1', 1), ATHLETE_ID, 'Bænkpres topsæt', 110, 3, 4),
    pr(uuid('1', 2), ATHLETE_ID, 'Bænkpres - backoff', 112.5, 10, 20), // let saet: maa ikke vaere rekord
    pr(uuid('1', 3), ATHLETE_ID, 'Squat teknik single', 160, 1, 10), // let saet
    pr(uuid('1', 4), ATHLETE_ID, 'Squat topsæt', 150, 3, 3),
  )
  return seed
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seedToAtleter()); await mock.listen(MOCK_PORT)
  const log = (...a) => console.log(...a)
  try {
    // ---- Atlet A: det atleten selv ser (390)
    const aCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const ap = await aCtx.newPage()
    ap.on('pageerror', err => console.error('[browser pageerror]', err))
    await ap.goto(APP_URL)
    await ap.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await ap.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await ap.getByRole('button', { name: 'Log ind' }).click()
    await ap.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await ap.waitForTimeout(1000)
    await ap.getByText('Fremgang', { exact: true }).last().click(); await ap.waitForTimeout(2500)
    const atletTal = {}
    for (const n of ['Bænkpres', 'Squat', 'Dødløft']) {
      await ap.getByRole('button', { name: n, exact: true }).first().click(); await ap.waitForTimeout(500)
      const t = await ap.evaluate(() => document.querySelector('[data-fremgang-linje]')?.textContent ?? null)
      atletTal[n] = Number(t?.match(/e1RM (\d+) kg/)?.[1])
    }
    log('Atletens Fremgang:', JSON.stringify(atletTal))
    await aCtx.close()

    // ---- Coach
    for (const [bredde, hoejde] of [[390, 844], [1280, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
      const page = await ctx.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      const shot = (n) => page.screenshot({ path: join(OUT_DIR, `${FOER ? 'foer' : 'efter'}-${n}-${bredde}.png`), fullPage: true })
      await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(COACH_USER.email)
      await page.locator('#athlete-auth-password').fill(COACH_USER.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      const open = async (navn) => {
        const row = page.getByRole('button', { name: new RegExp(`${navn}.*Uge`) }).first()
        await row.waitFor({ state: 'visible', timeout: 10000 }); await row.click(); await page.waitForTimeout(1500)
      }
      const tilListe = async () => { await page.getByRole('button', { name: /Tilbage til/ }).click(); await page.waitForTimeout(500) }
      const tab = async (label) => {
        // Navnene har emoji foran ("📓 Log"); ligger fanen i "Mere"-menuen, aabnes den foerst.
        const knap = page.getByRole('button', { name: new RegExp(`${label}$`) }).first()
        if (!(await knap.isVisible().catch(() => false))) {
          await page.getByRole('button', { name: /Mere/ }).first().click().catch(() => {}); await page.waitForTimeout(300)
        }
        await page.getByRole('button', { name: new RegExp(`${label}$`) }).first().click(); await page.waitForTimeout(1200)
      }
      const linje = () => page.evaluate(() => { const e = document.querySelector('[data-styrke-linje]'); return e ? { typer: e.getAttribute('data-styrke-linje'), tekst: e.innerText } : null })

      await open('Testatlet')
      if (FOER) {
        await shot('a-hub'); await tab('Log'); await page.locator('select').first().selectOption('Bænkpres'); await page.waitForTimeout(400); await shot('a-log-baenk')
        await tab('Stævne'); await shot('a-rekorder')
        await ctx.close(); continue
      }
      // 1) styrkelinje oeverst for A: svageste hovedloeft = Dødløft (160 -> 160)
      await page.waitForSelector('[data-styrke-linje]', { timeout: 8000 })
      const la = await linje()
      log('A linje:', la.tekst.replace(/\n/g, ' | '))
      assert.match(la.typer, /svageste|stagnation/, la.typer)
      assert.match(la.tekst, /Dødløft/, 'doedloeft er svageste/stagneret hos A')
      assert.ok(!/stikker/.test(la.tekst))
      await shot('a-hub')
      // 2) coach-Log: e1RM = atletens Fremgang-tal (seneste dag)
      await tab('Log')
      await page.locator('select').first().selectOption('Bænkpres'); await page.waitForTimeout(500)
      const logTekst = await page.evaluate(() => document.body.innerText)
      const e1 = [...logTekst.matchAll(/e1RM (\d+(?:\.\d)?)kg/g)].map(m => Number(m[1]))
      log('Coach Log bænk e1RM (nyeste først):', e1.join(', '))
      assert.equal(Math.round(e1[0]), atletTal['Bænkpres'], 'coach-Log bænk = atletens Fremgang')
      await shot('a-log-baenk')
      await page.locator('select').first().selectOption('Squat'); await page.waitForTimeout(400)
      const sq = [...(await page.evaluate(() => document.body.innerText)).matchAll(/e1RM (\d+(?:\.\d)?)kg/g)].map(m => Number(m[1]))
      assert.equal(Math.round(sq[0]), atletTal['Squat'], 'coach-Log squat = atletens Fremgang')
      // 3) Stævne: rekorder uden lette saet, eet navn
      await tab('Stævne')
      const rek = await page.evaluate(() => document.body.innerText)
      assert.match(rek, /Bænkpres/); assert.match(rek, /110 kg/)
      assert.ok(!/112[,.]5/.test(rek), 'backoff-rekord (112,5 x 10) maa ikke vises')
      assert.ok(!/160 kg/.test(rek), 'teknik-single-rekord (160) maa ikke vises')
      assert.ok(!/(topsæt|backoff|teknik)/i.test(rek.split('Rekorder')[1] || ''), 'suffiks-navn i rekorder')
      await shot('a-rekorder')
      // 4) Atlet B: stagnation + smerte
      await tilListe(); await open('Atlet Stille')
      await page.waitForSelector('[data-styrke-linje]', { timeout: 8000 })
      const lb = await linje()
      log('B linje:', lb.tekst.replace(/\n/g, ' | '))
      assert.match(lb.typer, /^smerte,stagnation/, lb.typer)
      assert.match(lb.tekst, /Smerte: skulderen nævnt/)
      assert.match(lb.tekst, /Bænkpres: ingen ny top i 8 uger \(e1RM 113 kg/)
      assert.ok(!/stikker/.test(lb.tekst), 'kommentaren citeres ikke')
      await shot('b-hub')
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(sw <= bredde, `vandret overflow ${sw} > ${bredde}`)
      await ctx.close()
    }
    log('\nGRØN: coachens tal = atletens, lette saet taeller ikke, styrkelinje oeverst (390 og 1280).')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
main()
