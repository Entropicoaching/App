// Ordre 2207 (Marc 24. nov. kl. 19:11: atleterne skal "rent faktisk følge planerne"; dom 19:12: fri pulje 0 til ca. 30 %, 15 % som udgangspunkt, sat pr. atlet):
// hele kostugen samlet for tre syntetiske atleter med fri pulje 0 %, 15 % og 30 %. Samme logdata i alle tre; kun niveauet er forskelligt.
// Ugen: dag -6 uden log, -5 plan + uplanlagt, -4 planmåltider med andre versaler/mellemrum + uplanlagt, -3 rettet måltid + uplanlagt,
// -2 og -1 plan som planlagt; i dag trykkes i appen: "Spist som planlagt", "Alt som planlagt" (med Ret mængde) eller "Alt fra i går".
// Atleten (Kost i dag og ugelinjen) og coachen (Basemåltider fulgt, Fri pulje holdt, signaler) læser samme tal; de skrives som tabel i UD_MAPPE.
// 390 px, lys og mørk. Kun syntetisk "Atlet W", ingen rigtige data.
// Kør: E2E_VITE_PORT=5307 E2E_MOCK_PORT=8907 VITE_SUPABASE_URL=http://127.0.0.1:8907 UD_MAPPE=<mappe> node e2e/kost-uge-samlet-2207.spec.mjs
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2207')
mkdirSync(UD, { recursive: true })
const GRUND = 'Følger ikke kostplanen'
const LOGGER = 'Logger ikke maden'
const plus = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const kr = n => new Intl.NumberFormat('da-DK').format(n)
let nr = 0
function raekke(athlete, dag, meal, kcal) {
  return { id: `39000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`, athlete_id: athlete, date: dag, meal, kcal, protein: Math.round(kcal / 5), carb: 60, fat: 20, created_at: `${dag}T12:00:00Z` }
}
function seed(pct) {
  const s = ugeSeed(), t = s.tables, i = d => plus(s.today, d)
  t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []; t.kostplan_v1_seen = []
  const [foerste] = t.kostplan_v1_plans
  t.kostplan_v1_plans = [foerste]
  t.kostplan_v1_versions = t.kostplan_v1_versions.filter(v => v.plan_id === foerste.id)
  t.kostplan_v1_approvals = t.kostplan_v1_approvals.filter(a => a.plan_id === foerste.id)
  foerste.valid_from = i(-15)
  for (const v of t.kostplan_v1_versions) { v.effective_from = foerste.valid_from; v.calculation_basis = { fri_pct: pct } }
  for (const a of t.kostplan_v1_approvals) a.approved_at = i(-16) + 'T10:00:00.000001Z'
  t.meal_logs = []
  const L = (d, meal, kcal) => t.meal_logs.push(raekke(ATHLETE_ID, i(d), meal, kcal))
  // dag -6: ingen log.
  L(-5, 'Frokost', 450); L(-5, 'Aftensmad', 600); L(-5, 'Ekstra pizza', 200)
  L(-4, 'frokost', 450); L(-4, '  AFTENSMAD ', 600); L(-4, 'Ekstra pizza', 200)
  L(-3, 'Frokost', 300); L(-3, 'Aftensmad', 600); L(-3, 'Ekstra pizza', 200) // Frokost rettet til en mindre mængde
  L(-2, 'Frokost', 450); L(-2, 'Aftensmad', 600)
  L(-1, 'Frokost', 450); L(-1, 'Aftensmad', 600)
  return s
}
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
async function login(page, user) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email); await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)

// Forventet uge for niveauet (dag -6..0 hos atleten). Basen er 2 planmåltider pr. dag, 14 i alt.
const PULJE_PLAN = { 15: 158, 30: 315 } // 15 % og 30 % af 1050 kcal, afrundet
function forventet(pct, variant) {
  if (pct === 0) return null
  const idag = variant === 'spist' ? 1 : 2
  const over = PULJE_PLAN[pct] < 200 ? 3 : 0 // pizzaen på 200 kcal over puljen dag -5, -4 og -3
  return { basis: 10 + idag, basisAf: 14, vurderede: 6, holdt: 6 - over, signal: pct === 15 ? GRUND : null }
}

const vite = await startVite(), browser = await launchBrowser(), errors = []
const tabel = []
let fejl = null, skaerm = 0
try {
  for (const pct of [0, 15, 30]) for (const variant of ['spist', 'alt', 'igaar']) {
    const hvem = `${pct} % ${variant}`
    const s = seed(pct); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const forv = forventet(pct, variant)
    const ctxA = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' }), ctxC = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' })
    const pa = await ctxA.newPage(), pc = await ctxC.newPage()
    for (const [p, rolle] of [[pa, 'atlet'], [pc, 'coach']]) p.on('pageerror', err => errors.push(`${hvem} ${rolle}: ${err.message}`))
    try {
      // Atleten: dagens tryk.
      await login(pa, ATHLETE_USER)
      await pa.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kost = pa.getByRole('region', { name: 'Kost i dag' })
      await kost.waitFor({ state: 'visible', timeout: 20000 })
      await tema(pa, 'lys')
      const frokost = kost.getByRole('button', { name: 'Frokost: spist som planlagt' })
      await frokost.waitFor({ timeout: 15000 })
      if (variant === 'spist') { await frokost.click(); await frokost.waitFor({ state: 'detached', timeout: 15000 }) }
      if (variant === 'alt') { await kost.getByRole('button', { name: 'Alt som planlagt (2)' }).click(); await frokost.waitFor({ state: 'detached', timeout: 20000 }) }
      if (variant === 'igaar') { await kost.getByRole('button', { name: 'Alt fra i går (2)' }).click(); await pa.waitForFunction(() => !document.body.innerText.includes('Alt fra i går'), null, { timeout: 20000 }) }
      // Rettet måltid: Frokost sættes til en anden mængde; rækken er stadig planmåltidet.
      if (variant === 'alt') {
        await kost.getByRole('button', { name: 'Ret mængde: Frokost' }).click()
        const felt = kost.getByRole('textbox', { name: 'Ny mængde Frokost' }); await felt.waitFor({ timeout: 10000 })
        await felt.fill('200'); await kost.getByRole('button', { name: 'Gem Frokost' }).click()
        await pa.waitForFunction(() => !document.querySelector('[aria-label="Ny mængde Frokost"]'), null, { timeout: 15000 })
      }
      const idagRaekker = mock.table('meal_logs').filter(r => r.date === plus(s.today, 0))
      krav(idagRaekker.length === (variant === 'spist' ? 1 : 2), `${hvem}: forventede ${variant === 'spist' ? 1 : 2} rækker i dag, fandt ${idagRaekker.length}`)
      krav(idagRaekker.every(r => ['Frokost', 'Aftensmad'].includes(String(r.meal).trim())), `${hvem}: dagens rækker skal have planens navne: ${idagRaekker.map(r => r.meal).join(', ')}`)
      // Atletens tal.
      let atlet = { pulje: null, status: null, uge: null }
      if (pct === 0) {
        krav(await pa.locator('[data-kost-fri]').count() === 0 && await pa.locator('[data-kost-fri-uge]').count() === 0, `${hvem}: 0 % må ikke vise pulje eller ugelinje`)
        krav(!(await kost.innerText()).includes('Fri i dag'), `${hvem}: 0 % må ikke vise "Fri i dag"`)
      } else {
        const fri = pa.locator('[data-kost-fri]'); await fri.waitFor({ timeout: 15000 })
        atlet.pulje = Number(await fri.getAttribute('data-kost-fri'))
        krav(atlet.pulje === PULJE_PLAN[pct], `${hvem}: puljen skulle være ${PULJE_PLAN[pct]} kcal, var ${atlet.pulje}`)
        atlet.status = (await pa.locator('[data-kost-fri-status]').innerText()).trim()
        krav(atlet.status === `Brugt 0 kcal, ${kr(atlet.pulje)} tilbage.`, `${hvem}: dagens pulje skulle være urørt: ${atlet.status}`)
        const ugeLinje = `Seneste 7 dage: basemåltider fulgt ${forv.basis} af ${forv.basisAf}, fri pulje holdt ${forv.holdt} af ${forv.vurderede} loggede dage.`
        await pa.waitForFunction(t => document.querySelector('[data-kost-fri-uge]')?.innerText.trim() === t, ugeLinje, { timeout: 20000 })
          .catch(async () => { throw new Error(`${hvem}: ugelinjen skulle være "${ugeLinje}", var "${await pa.locator('[data-kost-fri-uge]').innerText().catch(() => '(ingen)')}"`) })
        atlet.uge = (await pa.locator('[data-kost-fri-uge]').innerText()).trim()
      }
      await ingenScroll(pa, `${hvem} atlet lys`)
      if (pct === 15 && variant === 'alt') { await pa.locator('[data-kost-fri]').scrollIntoViewIfNeeded(); await pa.screenshot({ path: join(UD, '2207-atlet-15-lys.png') }); skaerm++ }
      await tema(pa, 'moerk'); await ingenScroll(pa, `${hvem} atlet mørk`)
      if (pct === 30 && variant === 'igaar') { await pa.locator('[data-kost-fri]').scrollIntoViewIfNeeded(); await pa.screenshot({ path: join(UD, '2207-atlet-30-moerk.png') }); skaerm++ }

      // Coachen: samme mock efter atletens tryk.
      await login(pc, COACH_USER)
      await pc.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
      await tema(pc, 'lys')
      const coachTekst = async () => {
        await pc.getByText('Atlet W', { exact: true }).first().click()
        const fane = pc.getByRole('button', { name: /Kost & mål/ }).first()
        if (!(await fane.isVisible().catch(() => false))) await pc.getByRole('button', { name: /^Mere/ }).first().click({ timeout: 20000 })
        await fane.click({ timeout: 20000 })
        await pc.getByText(/Seneste 7 dage mod kostplanen/).first().waitFor({ timeout: 30000 })
        return pc.locator('body').innerText()
      }
      const tekst = await coachTekst()
      const m = tekst.match(/Basemåltider fulgt: (\d+) af (\d+)\. Fri pulje holdt: (\d+) af (\d+) (?:logget dag|loggede dage)\./)
      const coach = { basis: null, holdt: null, signal: null }
      if (pct === 0) krav(!m && !tekst.includes('Basemåltider fulgt'), `${hvem}: 0 % må ikke give Basemåltider fulgt hos coachen`)
      else {
        krav(!!m, `${hvem}: coachens "Basemåltider fulgt" mangler`)
        coach.basis = `${m[1]} af ${m[2]}`; coach.holdt = `${m[3]} af ${m[4]}`
        krav(+m[1] === forv.basis && +m[2] === forv.basisAf && +m[3] === forv.holdt && +m[4] === forv.vurderede, `${hvem}: coachens tal ${m[0]} er ikke ${JSON.stringify(forv)}`)
        krav(atlet.uge === `Seneste 7 dage: basemåltider fulgt ${m[1]} af ${m[2]}, fri pulje holdt ${m[3]} af ${m[4]} loggede dage.`, `${hvem}: atlet og coach har ikke samme tal: "${atlet.uge}" mod "${m[0]}"`)
      }
      await ingenScroll(pc, `${hvem} coach Kost lys`)
      // Signaler: kun hvor det er sandt. Tilbage til oversigten og åbn "Mere".
      await pc.reload(); await pc.getByText('Dine atleter (1)').waitFor({ timeout: 20000 }); await tema(pc, 'moerk')
      const mere = pc.locator('[data-coach-fold="mere"] > summary'); await mere.waitFor({ state: 'visible', timeout: 30000 }); await mere.click()
      const sektion = pc.locator('section[aria-label="Signaler fra appen"]')
      if (forv?.signal) {
        await sektion.getByText(GRUND, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
        coach.signal = GRUND
        krav(!(await sektion.innerText()).includes(LOGGER), `${hvem}: "${LOGGER}" må ikke stå sammen med planlinjen`)
        if (variant === 'alt') { await sektion.evaluate(el => el.scrollIntoView({ block: 'center' })); await pc.screenshot({ path: join(UD, '2207-coach-signal-15-moerk.png') }); skaerm++ }
      } else {
        await pc.waitForTimeout(2500)
        krav(await pc.getByText(GRUND, { exact: false }).count() === 0 && await pc.getByText(LOGGER, { exact: false }).count() === 0, `${hvem}: intet signal må stå`)
      }
      await ingenScroll(pc, `${hvem} coach signaler mørk`)
      tabel.push({ pct, variant, atletPulje: atlet.pulje, atletStatus: atlet.status, atletUge: atlet.uge, coachBasis: coach.basis, coachHoldt: coach.holdt, coachSignal: coach.signal })
      console.log(`OK ${hvem}`)
    } catch (e) { try { await pa.screenshot({ path: join(UD, `fejl-${pct}-${variant}-atlet.png`) }); await pc.screenshot({ path: join(UD, `fejl-${pct}-${variant}-coach.png`) }) } catch { /* ignoreret */ } throw new Error(`${hvem}: ${e.message}`) }
    finally { await ctxA.close(); await ctxC.close(); await mock.close() }
  }
  krav(skaerm <= 3, `for mange skærmbilleder: ${skaerm}`)
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
const md = ['| Fri pulje | Dagens tryk | Atlet: pulje i dag | Atlet: status | Atlet: ugelinje | Coach: basemåltider fulgt | Coach: pulje holdt | Coach: signal |', '|---|---|---|---|---|---|---|---|',
  ...tabel.map(r => `| ${r.pct} % | ${r.variant} | ${r.atletPulje ?? 'ingen'} kcal | ${r.atletStatus ?? 'intet'} | ${r.atletUge ?? 'ingen linje'} | ${r.coachBasis ?? 'intet'} | ${r.coachHoldt ?? 'intet'} | ${r.coachSignal ?? 'intet'} |`)]
writeFileSync(join(UD, 'tabel-2207.md'), md.join('\n') + '\n')
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2207 e2e grøn')
