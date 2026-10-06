// ORDRE 1451 - Fremgang der er sand. Syntetisk atlet, 8 uger (ingen rigtige data):
//  * baenkpres under alle de navne en atlet skriver: "Baenkpres top set", "Baenkpres topsaet",
//    "Bench", "Baenkpres - backoff", "baenk teknik single", "Baenkpres volumen"
//  * en deload-uge (blok "Deload") med lette saet, plus squat, doedloeft og militaerpres
//  * varianter (Front squat, Rumaensk doedloeft, Pause baenkpres) der ikke maa vaere faner
// Beviser paa 390 og 1280: (1) praecis fire hovedloeft-faner, varianter under "Andre oevelser",
// (2) baenkpres er EEN kurve, (3) deload og lette saet traekker ikke kurven ned, (4) tryk paa et punkt
// viser hvilket saet det er, (5) rekorder uden lette saet, (6) forsidens styrkeudvikling og coachens
// visning (hub-linje, Log, Staevne) viser samme tal og navne.
// `node e2e/fremgang-1451.spec.mjs` (efter) / `FREMGANG_FOER=1 ...` (kun skaermbilleder fra gammel kode).
import assert from 'node:assert/strict'
import { join, basename } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

const FOER = !!process.env.FREMGANG_FOER
const OUT_DIR = process.env.E2E_OUT || join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1451')
mkdirSync(OUT_DIR, { recursive: true })
const uuid = (a, n) => `${a}${String(n).padStart(7, '0')}-${a}${a}${a}${a}-4${a}${a}${a}-8${a}${a}${a}-${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}`
const DAY = 864e5

// [dage siden, blok, navn, kg, reps]
const BASE = 'Base', DELOAD = 'Deload'
const SAET = [
  [54, BASE, 'Bænkpres top set', 100, 3], [54, BASE, 'Bænkpres - backoff', 85, 8], [54, BASE, 'baenk teknik single', 60, 1], [54, BASE, 'Bænkpres volumen', 70, 12],
  [47, BASE, 'Baenkpres topsæt', 102.5, 3], [47, BASE, 'Bænkpres - backoff', 88, 8],
  [40, BASE, 'Bench', 105, 3], [40, BASE, 'Bænkpres - backoff', 90, 10],
  [33, DELOAD, 'Bænkpres top set', 70, 5], [33, DELOAD, 'baenk teknik single', 60, 1], [33, DELOAD, 'Bænkpres volumen', 60, 12],
  [26, BASE, 'Bænkpres top set', 107.5, 3], [26, BASE, 'Bænkpres - backoff', 95, 8],
  [19, BASE, 'Baenkpres topsæt', 110, 3], [19, BASE, 'baenk teknik single', 100, 1],
  [12, BASE, 'Bænkpres top set', 112.5, 3],
  [5, BASE, 'Bænkpres topsæt', 115, 3], [5, BASE, 'Bænkpres - backoff', 100, 8], [5, BASE, 'Bænkpres volumen', 80, 15],
  [5, BASE, 'Pause bænkpres', 90, 5],
  // squat: stiger, deload-uge let
  [53, BASE, 'Squat - topsæt', 130, 3], [53, BASE, 'Squat backoff', 110, 8],
  [46, BASE, 'Squat Top Set', 135, 3], [39, BASE, 'Squat topsæt', 137.5, 3], [39, BASE, 'Squat volumen', 100, 12],
  [32, DELOAD, 'Squat topsæt', 100, 5],
  [25, BASE, 'Squat - topsæt', 140, 3], [18, BASE, 'Squat Top Set', 145, 3], [11, BASE, 'Squat topsæt', 147.5, 3], [4, BASE, 'Squat topsæt', 150, 3], [4, BASE, 'Squat backoff', 125, 8],
  [11, BASE, 'Front squat', 90, 5],
  // doedloeft
  [52, BASE, 'Dødløft topsæt', 160, 3], [38, BASE, 'Dødløft - backoff', 140, 8], [31, DELOAD, 'Dødløft topsæt', 120, 5],
  [24, BASE, 'Dødløft topsæt', 165, 3], [10, BASE, 'Dødløft topsæt', 170, 3], [3, BASE, 'Dødløft topsæt', 175, 2],
  [10, BASE, 'Rumænsk dødløft', 120, 8],
  // militaerpres (assistance, ikke hovedloeft)
  [50, BASE, 'Militærpres', 45, 5], [22, BASE, 'Militærpres', 50, 5], [6, BASE, 'Militærpres', 52.5, 5],
]
const FORVENTET_BAENK = [110, 113, 116, 118, 121, 124, 127] // hoejeste e1RM pr. tung dag, deload-dagen (33) har intet punkt

export function seed1451() {
  const seed = buildSeed()
  const blokke = [...new Set(SAET.map(s => s[1]))]
  const blokId = new Map(), sessId = new Map()
  blokke.forEach((b, i) => {
    const wk = uuid('b', i + 1), se = uuid('a', i + 1); blokId.set(b, wk); sessId.set(b, se)
    seed.tables.weeks.push({ id: wk, athlete_id: ATHLETE_ID, week_number: 0, block_name: b })
    seed.tables.sessions.push({ id: se, week_id: wk, title: `Historik ${b}`, session_order: 9, weekday: 0, athlete_rating: null, athlete_comment: null })
  })
  const exId = new Map(); let n = 0
  for (const [, blok, navn] of SAET) {
    const k = `${blok}|${navn}`
    if (exId.has(k)) continue
    const id = uuid('c', ++n); exId.set(k, id)
    seed.tables.exercises.push({ id, session_id: sessId.get(blok), name: navn, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: n, recommended_weight: 80 })
  }
  seed.tables.exercise_logs.push(...SAET.map(([dage, blok, navn, kg, reps], i) => ({
    id: uuid('d', i + 1), exercise_id: exId.get(`${blok}|${navn}`), athlete_id: ATHLETE_ID, set_number: 1, weight: kg, reps_completed: reps,
    note: null, rpe_actual: null, rpe_planned: null, skipped: false, logged_at: new Date(Date.now() - dage * DAY + (i % 5) * 36e5).toISOString(),
  })))
  return seed
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seed1451()); await mock.listen(MOCK_PORT)
  const log = (...a) => console.log(...a)
  const pre = FOER ? 'foer' : 'efter'
  try {
    const atletTal = {}
    for (const [bredde, hoejde] of [[390, 844], [1280, 900]]) {
      // ---------- Atlet: Fremgang + forsidens styrkeudvikling
      const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
      const page = await ctx.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      const shot = (n) => page.screenshot({ path: join(OUT_DIR, `${pre}-${n}-${bredde}.png`), fullPage: true })
      await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
      await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(1000)
      await page.getByText('Fremgang', { exact: true }).last().click(); await page.waitForTimeout(2500)
      const udover = async (navn) => { await page.getByRole('button', { name: navn, exact: true }).first().click(); await page.waitForTimeout(500) }
      const knapper = () => page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.closest('nav')).map(b => b.textContent.trim()))
      const valg = () => page.evaluate(() => [...document.querySelectorAll('select option')].map(o => o.textContent.trim()))
      const punkter = () => page.evaluate(() => [...document.querySelectorAll('[data-punkt]')].map(g => ({ dag: g.getAttribute('data-punkt'), e1rm: Number(g.getAttribute('data-e1rm')) })))
      const linje = () => page.evaluate(() => document.querySelector('[data-fremgang-linje]')?.textContent ?? null)

      if (FOER) {
        await udover('Bænkpres').catch(() => {}); await shot('fremgang-baenk')
        log(`FOER ${bredde}: knapper =`, (await knapper()).join(' | ')); await ctx.close()
      } else {

      // 1) Praecis fire hovedloeft-faner (kun dem med data); varianter og assistance under "Andre oevelser".
      const k = await knapper()
      for (const n of ['Squat', 'Bænkpres', 'Dødløft']) assert.equal(k.filter(t => t === n).length, 1, `${n} skal staa praecis een gang: ${k.join(' | ')}`)
      for (const v of ['Rumænsk dødløft', 'Front squat', 'Pause bænkpres', 'Militærpres', 'Bench']) assert.ok(!k.includes(v), `${v} maa ikke vaere en fane`)
      const SUFF = /(top\s?-?s(?:æ|ae)t|top set|back[ -]?off|teknik|volumen|prim(?:æ|ae)r|comp)/i
      assert.ok(!k.some(t => SUFF.test(t)), `suffiks-navn i vaelgeren: ${k.filter(t => SUFF.test(t)).join(', ')}`)
      const v = await valg()
      for (const n of ['Rumænsk dødløft', 'Front squat', 'Pause bænkpres', 'Militærpres']) assert.ok(v.includes(n), `${n} skal ligge under "Andre øvelser": ${v.join(' | ')}`)

      // 2) Baenkpres er EEN kurve: syv tunge dage, ingen deload-dag, ingen let-saet-dag.
      await udover('Bænkpres')
      const p = await punkter()
      assert.deepEqual(p.map(x => x.e1rm), FORVENTET_BAENK, `baenk-kurve: ${JSON.stringify(p)}`)
      assert.equal(await page.locator('svg:has([data-punkt]) polyline').count(), 1, 'een polylinje for baenkpres')
      // 3) Ingen punkt under foerste (deload 70x5 = 82, volumen 80x15 = 120 osv. maa ikke trykke eller loefte kurven).
      assert.ok(p.every(x => x.e1rm >= FORVENTET_BAENK[0]), 'intet punkt under foerste tunge dag')
      assert.ok(p.every((x, i) => i === 0 || x.e1rm >= p[i - 1].e1rm - 0), 'kurven stiger: lette saet og deload trykker den ikke ned')
      const l = await linje()
      assert.match(l, /^Bænkpres e1RM 127 kg, \+17 kg siden \d+\. \w{3}$/, l)
      atletTal['Bænkpres'] = 127
      // 4) Tryk paa et punkt viser hvilket saet det er. Punkt 3 (idx 2) = "Bench" 105 x 3 (bart saet), idx 3 = topsaet 107,5 x 3.
      await page.locator('[data-punkt]').nth(2).click({ force: true }); await page.waitForTimeout(200)
      let forkl = await page.locator('[data-punkt-forklaring]').innerText()
      assert.match(forkl, /105 kg × 3 \(sæt\) giver e1RM 116 kg/, forkl)
      await page.locator('[data-punkt]').nth(3).click({ force: true }); await page.waitForTimeout(200)
      forkl = await page.locator('[data-punkt-forklaring]').innerText()
      assert.match(forkl, /107,5 kg × 3 \(topsæt\) giver e1RM 118 kg/, forkl)
      await shot('fremgang-baenk')
      // Rekorder: kun tunge saet, eet navn.
      const rek = await page.evaluate(() => document.querySelector('[data-rekord-liste]')?.innerText ?? '')
      assert.match(rek, /Bænkpres/); assert.ok(!SUFF.test(rek), `suffiks i rekorder: ${rek}`)
      assert.ok(!/ 90 kg × 10| 80 kg × 15| 85 kg × 8/.test(rek.replace(/,/g, '.')), 'let-saet-rekord vist')
      // Ordre 1469 (1467-5): hovedloeft foerst, varianter/assistance samlet nederst.
      const vari = await page.evaluate(() => document.querySelector('[data-rekord-varianter]')?.innerText ?? '')
      assert.match(vari, /Varianter og assistance/i); assert.match(vari, /Militærpres/, vari)
      assert.ok(!/Militærpres/.test(rek), 'variant staar mellem hovedloeftene: ' + rek)
      assert.ok(await page.evaluate(() => { const h = document.querySelector('[data-rekord-liste]'); const v = document.querySelector('[data-rekord-varianter]'); return !!h && !!v && !!(h.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING) }), 'varianter skal staa efter hovedloeftene')
      await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded(); await shot('fremgang-rekorder')
      // Ordre 1475 (QA 1474 fund 4): een raekke pr. hovedloeft, historik bag et tryk.
      const hoved = await page.evaluate(() => [...document.querySelectorAll('[data-rekord-hoved]')].map(e => e.getAttribute('data-rekord-hoved')))
      assert.equal(new Set(hoved).size, hoved.length, 'et hovedloeft staar flere gange: ' + hoved)
      assert.ok(hoved.includes('squat') && hoved.includes('baenk'), 'squat og baenk skal have hver sin raekke: ' + hoved)
      assert.equal(await page.locator('[data-rekord-historik]').count(), 0, 'historik skal vaere skjult som start')
      await page.locator('[data-rekord-historik-knap="squat"]').click(); await page.waitForTimeout(150)
      assert.ok(await page.locator('[data-rekord-historik]').count() >= 1, 'historik aabner ved tryk')
      await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded(); await shot('fremgang-rekorder-historik')
      await page.locator('[data-rekord-historik-knap="squat"]').click(); await page.waitForTimeout(150)

      // 5) Squat og Doedloeft: samme regler. Squat: 150x3 = 165, foerste 130x3 = 143 (deload 100x5 tæller ikke). Doedloeft: 175x2 = 187.
      await udover('Squat')
      const sq = await punkter(); assert.ok(sq.every(x => x.e1rm >= 143), `squat-kurve: ${JSON.stringify(sq)}`)
      assert.match(await linje(), /^Squat e1RM 165 kg, \+22 kg siden/, await linje())
      await shot('fremgang-squat')
      await udover('Dødløft')
      const dl = await punkter(); assert.ok(dl.every(x => x.e1rm >= 176), `doedloeft-kurve: ${JSON.stringify(dl)}`)
      assert.match(await linje(), /^Dødløft e1RM 187 kg, \+11 kg siden/, await linje())
      atletTal['Squat'] = 165; atletTal['Dødløft'] = 187
      // Variant under "Andre oevelser": kurve under sit eget navn, ikke i en hovedloeft-fane.
      await page.locator('select').selectOption('Rumænsk dødløft'); await page.waitForTimeout(400)
      assert.match(await page.locator('body').innerText(), /Rumænsk dødløft/)
      await shot('fremgang-variant')
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= bredde, 'vandret overflow paa Fremgang')

      // ---------- Forsiden: Styrkeudvikling (Mere)
      await page.getByText('Hjem', { exact: true }).last().click().catch(() => {}); await page.waitForTimeout(800)
      await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800)
      const hjem = await page.evaluate(() => document.body.innerText)
      if (!/Styrkeudvikling/i.test(hjem)) console.log('HJEM-TEKST:', hjem.slice(0, 1500))
      assert.match(hjem, /Styrkeudvikling/i, 'forsidens styrkeudvikling mangler')
      const leg = await page.evaluate(() => {
        const kort = [...document.querySelectorAll('div')].filter(d => d.textContent.startsWith('Styrkeudvikling') && d.textContent.includes('regnestykke'))[0]
        return kort ? kort.textContent : ''
      })
      assert.ok(leg.includes('Bænkpres') && leg.includes('Squat'), `forsidens legender: ${leg.slice(0, 200)}`)
      assert.ok(!/(Rumænsk|Front|Pause|Militær|topsæt|backoff|teknik)/i.test(leg), 'varianter/suffiks i forsidens styrkeudvikling')
      await page.getByText(/styrkeudvikling/i).first().scrollIntoViewIfNeeded().catch(() => {})
      await shot('hjem-styrkeudvikling')
      await ctx.close()
      }

      const ck = FOER ? new Proxy({}, { get: () => () => {} }) : assert
      // ---------- Coach: samme regel og navne
      const cctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
      const cp = await cctx.newPage()
      cp.on('pageerror', err => console.error('[browser pageerror]', err))
      const cshot = (n) => cp.screenshot({ path: join(OUT_DIR, `${pre}-${n}-${bredde}.png`), fullPage: true })
      await cp.goto(APP_URL)
      await cp.locator('#athlete-auth-email').fill(COACH_USER.email)
      await cp.locator('#athlete-auth-password').fill(COACH_USER.password)
      await cp.getByRole('button', { name: 'Log ind' }).click()
      const row = cp.getByRole('button', { name: /Testatlet.*Uge/ }).first()
      await row.waitFor({ state: 'visible', timeout: 10000 }); await row.click(); await cp.waitForTimeout(1500)
      const tab = async (label) => {
        const knap = cp.getByRole('button', { name: new RegExp(`${label}$`) }).first()
        if (!(await knap.isVisible().catch(() => false))) { await cp.getByRole('button', { name: /Mere/ }).first().click().catch(() => {}); await cp.waitForTimeout(300) }
        await cp.getByRole('button', { name: new RegExp(`${label}$`) }).first().click(); await cp.waitForTimeout(1200)
      }
      await cp.waitForSelector('[data-styrke-linje]', { timeout: 8000 })
      const sl = await cp.evaluate(() => document.querySelector('[data-styrke-linje]').innerText)
      log(`Coach hub-linje ${bredde}:`, sl.replace(/\n/g, ' | '))
      ck.ok(!/(topsæt|top set|backoff|teknik|Rumænsk|Front)/i.test(sl.split('Kun tunge')[0]), 'suffiks/variant i coachens styrkelinje')
      await cshot('coach-hub')
      await tab('Log')
      await cp.locator('select').first().selectOption('Bænkpres'); await cp.waitForTimeout(500)
      const e1 = [...(await cp.evaluate(() => document.body.innerText)).matchAll(/e1RM (\d+(?:\.\d)?)kg/g)].map(m => Number(m[1]))
      log(`Coach Log baenk e1RM ${bredde}:`, e1.join(', '))
      ck.equal(Math.round(e1[0]), atletTal['Bænkpres'], 'coach-Log baenk = atletens Fremgang')
      ck.deepEqual(e1.map(Math.round), [...FORVENTET_BAENK].reverse(), 'coach-Log: samme syv tunge dage som atletens kurve, deload-dagen har intet e1RM')
      await cshot('coach-log-baenk')
      await tab('Stævne')
      const crek = await cp.evaluate(() => document.body.innerText)
      ck.ok(!/(topsæt|backoff|teknik|volumen)/i.test(crek.split('Rekorder')[1] || ''), 'suffiks-navn i coachens rekorder')
      await cshot('coach-rekorder')
      ck.ok((await cp.evaluate(() => document.documentElement.scrollWidth)) <= bredde, 'vandret overflow hos coach')
      await cctx.close()
    }
    if (FOER) return
    log('\nGRØN: fire hovedloeft-faner, baenkpres een kurve, deload/lette saet trykker ikke, punkt-forklaring, samme tal hos coach (390 og 1280).')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
if (process.argv[1] && import.meta.url.endsWith('/' + basename(process.argv[1]))) main()
