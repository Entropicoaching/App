// ORDRE 1475 fase B: en hel uge som atlet (mock, 390x844), mandag til fredag. Hver dag aabnes appen
// med fast ur (context.clock), passet logges, et saet springes over (tirsdag), et saet rettes (onsdag),
// og Fremgang + forsiden aflaeses efter hver dag. Tekst og billeder skrives til UDMAPPE (aldrig i repoet).
// Egen koersel: `npm run e2e:uge-1475`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ATHLETE_USER, ATHLETE_ID, WEEK_ID } from './fixtures.mjs'
import { seed1451 } from './fremgang-1451.spec.mjs'

const OUT_DIR = process.env.UDMAPPE || ''
if (OUT_DIR) mkdirSync(OUT_DIR, { recursive: true })
const uuid = (n) => `e${String(n).padStart(7, '0')}-eeee-4eee-8eee-eeeeeeeeeeee`

// [ugedag 0=man, titel, [navn, saet, reps, kg]...]
const UGE = [
  [0, 'Dag 1 — Squat', [['Squat topsæt', 1, '3', 150], ['Squat backoff', 3, '5', 125]]],
  [1, 'Dag 2 — Bænk', [['Bænkpres topsæt', 1, '3', 117.5], ['Bænkpres - backoff', 3, '8', 100], ['Militærpres', 3, '5', 52.5]]],
  [2, 'Dag 3 — Dødløft', [['Dødløft topsæt', 1, '2', 177.5], ['Rumænsk dødløft', 3, '8', 120]]],
  [3, 'Dag 4 — Squat', [['Squat topsæt', 1, '3', 152.5], ['Front squat', 3, '5', 90]]],
  [4, 'Dag 5 — Bænk', [['Bænkpres topsæt', 1, '3', 120], ['Bænkpres volumen', 3, '12', 80]]],
]

export function seedUge() {
  const seed = seed1451()
  seed.tables.sessions = seed.tables.sessions.filter(s => s.week_id !== WEEK_ID)
  seed.tables.exercises = seed.tables.exercises.filter(e => seed.tables.sessions.some(s => s.id === e.session_id))
  let n = 0
  UGE.forEach(([wd, titel, oev], i) => {
    const sid = uuid(1000 + i)
    seed.tables.sessions.push({ id: sid, week_id: WEEK_ID, title: titel, session_order: i + 1, weekday: wd, athlete_rating: null, athlete_comment: null })
    oev.forEach(([navn, saet, reps, kg], j) => seed.tables.exercises.push({ id: uuid(++n), session_id: sid, name: navn, sets: saet, reps, intensity: 'RPE 8', note: null, exercise_order: j + 1, recommended_weight: kg }))
  })
  return seed
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seedUge()); await mock.listen(MOCK_PORT)
  const dumps = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    const shot = async (navn, full = true) => { if (OUT_DIR) await page.screenshot({ path: join(OUT_DIR, `${navn}.png`), fullPage: full }) }
    const tekst = async () => page.evaluate(() => document.body.innerText)
    const dag = ['man', 'tir', 'ons', 'tor', 'fre']
    const dato = (i) => new Date(`2026-10-0${5 + i}T18:00:00`)
    let foerste = true
    for (let i = 0; i < 5; i++) {
      await ctx.clock.setFixedTime(dato(i))
      if (foerste) {
        await page.goto(APP_URL)
        await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
        await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
        await page.getByRole('button', { name: 'Log ind' }).click()
        foerste = false
      } else await page.reload()
      await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(800)
      const foer = await tekst(); dumps.push(`===== ${dag[i]} FOER =====\n${foer}`)
      await shot(`uge-${i + 1}-${dag[i]}-a-forside`)
      // log passet; tirsdag: spring 2. backoff-saet over; torsdag: skriv en anden vaegt paa topsaettet
      let antal = 0
      const logEt = async () => { await page.getByRole('button', { name: 'Godkendt', exact: true }).first().click(); antal++; await page.waitForTimeout(500); if (await page.getByTestId('rest-pause-open').count()) await page.getByRole('button', { name: 'Skjul pausetimer' }).click().catch(() => {}) }
      for (let k = 0; k < 14; k++) {
        const knap = page.getByRole('button', { name: 'Godkendt', exact: true })
        if (await knap.count() === 0) break
        if (!(await page.locator('h1').first().innerText()).includes(UGE[i][1])) break // naeste pas: ikke i dag
        if (i === 1 && antal === 2) { await page.getByRole('button', { name: 'Spring over', exact: true }).first().click(); antal++; await page.waitForTimeout(500); continue }
        await logEt()
        if (i === 2 && antal === 2) {
          // ret et saet: RDL saet 1 blev 8 reps, retter til 6
          await shot(`uge-${i + 1}-${dag[i]}-a2-midt-i-passet`, false)
          dumps.push(`===== ${dag[i]} MIDT I PASSET =====
${await tekst()}`)
          await page.getByRole('button', { name: /Vis \d+ klarede sæt/ }).first().click().catch(() => {})
          await page.getByRole('button', { name: 'Ret sæt 1' }).first().click().catch(() => {})
          await page.waitForTimeout(300)
          const reps = page.getByLabel('Reps, ret sæt 1')
          if (await reps.count()) { await reps.fill('6'); await shot(`uge-${i + 1}-${dag[i]}-a3-ret-saet`, false); await page.getByRole('button', { name: 'Godkendt, ret sæt 1' }).click(); await page.waitForTimeout(600); dumps.push('(rettede RDL saet 1: 8 -> 6 reps)') }
          else dumps.push('(KUNNE IKKE finde ret-felt)')
        }
      }
      dumps.push(`===== ${dag[i]} logget ${antal} saet =====`)
      await page.waitForTimeout(500)
      await shot(`uge-${i + 1}-${dag[i]}-b-efter`)
      dumps.push(`===== ${dag[i]} EFTER (forside) =====\n${await tekst()}`)
      await page.getByText('Fremgang', { exact: true }).last().click(); await page.waitForTimeout(1800)
      const loeft = ['Squat', 'Bænkpres', 'Dødløft', 'Squat', 'Bænkpres'][i]
      // Ordre 1475: Fremgang aabner paa det loeft der blev trænet i dag
      if (process.env.UGE_ASSERT) assert.match(await tekst(), new RegExp(`${loeft}\\s+e1RM\\s+\\d+\\s+kg`), `Fremgang aabnede ikke paa ${loeft} efter ${dag[i]}`)
      await page.getByRole('button', { name: loeft, exact: true }).first().click(); await page.waitForTimeout(500)
      dumps.push(`===== ${dag[i]} FREMGANG =====\n${await tekst()}`)
      await shot(`uge-${i + 1}-${dag[i]}-c-fremgang`)
      if (i === 4) { await page.getByText('Volumen', { exact: true }).last().click(); await page.waitForTimeout(1500); dumps.push(`===== fre VOLUMEN =====
${await tekst()}`); await shot('uge-5-fre-d-volumen')
        if (process.env.UGE_ASSERT) { const v = await tekst(); assert.doesNotMatch(v, /Forreste skulder\s+0\//, 'militaerpres taeller i forreste skulder'); assert.match(v, /Forreste skulder/); assert.doesNotMatch(v, /6 sæt denne uge er på øvelser/, 'front squat/militaerpres staar som ukortlagt') } }
      await page.getByText('Hjem', { exact: true }).last().click().catch(() => {}); await page.waitForTimeout(300)
    }
    if (OUT_DIR) writeFileSync(join(OUT_DIR, 'uge-tekst.txt'), dumps.join('\n\n'), 'utf8')
    console.log(`GRØN: en uge gennemgaaet (5 dage)${OUT_DIR ? `, tekst i ${OUT_DIR}/uge-tekst.txt` : ''}`)
  } finally { await browser.close(); await mock.close(); await vite.stop() }
}
main().catch(e => { console.error('FEJL:', e.message); process.exit(1) })
