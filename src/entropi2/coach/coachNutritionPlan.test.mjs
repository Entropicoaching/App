// Ordre 1588: coachens kostlinje måles mod kostplanen, når atleten har godkendt plan i vinduet.
// Kun syntetiske data. Den rigtige adapter, den rigtige læser og den rigtige linje; kun databasegrænsen er falsk.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachNutrition, readCoachPlanBasis, startCoachNutritionRead } from '../coachNutritionRead.mjs'
import { coachNutritionLines } from './coachNutrition.mjs'
import { nutritionDatabase } from '../coachNutritionPagination.fixture.mjs'
import { historyFixture, uuid } from '../kostplan/dailyReference.fixture.mjs'
import { tableNames } from '../kostplan/coach/activation.fixture.mjs'
import { mineDataWithPlan } from '../analysis/analysisMineData.mjs'
import { addCalendarDays } from '../../calendarDate.js'

const coachId = 'synthetic-plan-coach', athlete = 'synthetic-plan-athlete', today = '2026-11-17'
const context = () => ({ coachId, day: today, athleteIds: [athlete] })
const windowDays = Array.from({ length: 14 }, (_, i) => addCalendarDays(today, -14 + i))
const meal = (date, kcal = 2000, protein = 150) => ({ id: `meal-${date}`, athlete_id: athlete, date, meal: 'Syntetisk måltid', kcal, protein, carb: 0, fat: 0 })
// 14 dage: de første 10 rammer planen, de sidste 4 spiser for lidt.
const logs = () => windowDays.map((date, i) => i < 10 ? meal(date) : meal(date, 900, 40))

function setup({ archived = false, noPlan = false, planFails = false, rows = logs() } = {}) {
  const f = historyFixture()
  if (!noPlan) {
    f.plan(1, '2026-11-01', 'godkendt', athlete); f.version(10, uuid(1), '2026-11-01', 1, 2000, 150); f.approve(10, uuid(1), '2026-11-01T10:00:00Z', athlete)
    if (archived) { f.plan(2, '2026-11-10', 'arkiveret', athlete); f.version(12, uuid(2), '2026-11-10', 1, 2000, 150); f.approve(12, uuid(2), '2026-11-10T10:00:00Z', athlete) }
  }
  const db = nutritionDatabase(rows, { goals: [{ id: athlete, kcal_target: 2400, protein_target: 150 }] })
  const client = { from(table) {
    if (!tableNames.includes(table)) return db.client.from(table)
    if (planFails) throw Error('Syntetisk planfejl')
    return f.client.from(table)
  } }
  return { f, db, client }
}
const props = batch => ({ session: { user: { id: coachId } }, readContext: context(), coachNutrition: batch })
const lineOf = batch => coachNutritionLines(props(batch), today, [{ id: athlete }], true).get(athlete)
const withPlan = async client => ({ ...await readCoachNutrition(client, context()), plan: await readCoachPlanBasis(client, context()) })

test('dag under godkendt plan: linjen måles mod planen og siger det', async () => {
  const { client, f } = setup()
  const batch = await withPlan(client), line = lineOf(batch)
  assert.equal(line.mod, 'plan'); assert.equal(line.days, 14); assert.equal(line.hit, 10); assert.equal(line.notAssessed, 0)
  assert.equal(line.text, 'Kost · mod kostplan · 10 af 14 vurderede dage ramt, seneste 14 dage')
  assert.doesNotMatch(line.text, /Mål:|profilens/)
  assert.equal(f.writes().length, 0)
})

test('uden plan-opgradering viser samme batch profillinjen (før-tilstanden)', async () => {
  const { client } = setup()
  const batch = await readCoachNutrition(client, context())
  const line = lineOf(batch)
  assert.equal(line.mod, undefined)
  assert.equal(line.text, 'Kost · 6/7 dage · Gns. pr. logget dag: 1267 kcal / 77 g protein · Mål: 2400 kcal / 150 g protein · Protein nået 2 af 6 dage · mod profilens mål')
})

test('dag under arkiveret plan er ikke vurderet og indgår ikke i tallet', async () => {
  const { client } = setup({ archived: true })
  const line = lineOf(await withPlan(client))
  // 3.-9. nov. under den godkendte plan, 10.-16. nov. under arkiveret plan (adapterens sikkerhedsregel: ukendt).
  assert.equal(line.days, 7); assert.equal(line.notAssessed, 7)
  assert.equal(line.text, 'Kost · mod kostplan · 7 af 7 vurderede dage ramt, seneste 14 dage · 7 dage ikke vurderet')
})

test('vinduet uden plan giver uændret profillinje, og ingen måltidsforespørgsel om planen', async () => {
  const { client, db } = setup({ noPlan: true })
  const batch = await withPlan(client)
  assert.equal(batch.plan, null)
  assert.equal(db.calls.filter(c => c.table === 'meal_logs').length, 2)
  const line = lineOf(batch)
  assert.match(line.text, / · mod profilens mål$/)
  assert.equal(line.text, lineOf(await readCoachNutrition(client, context())).text)
})

test('samme atlet og samme 14 dage giver præcis samme tal som atletens Kostdage mod mål', async () => {
  const { client } = setup({ archived: true })
  const batch = await withPlan(client), line = lineOf(batch)
  const entry = batch.plan.athletes[0]
  const mine = mineDataWithPlan({ athleteId: athlete, today, nutritionDays: { state: 'ready', rows: windowDays.map(date => ({ date })) } },
    { athleteId: athlete, planDays: entry.days, meals: batch.plan.meals })
  const rated = mine.nutritionDays.rows.filter(r => typeof r.goalMet === 'boolean')
  assert.equal(line.days, rated.length); assert.equal(line.hit, rated.filter(r => r.goalMet).length)
  const open = setup()
  const full = await withPlan(open.client), fullLine = lineOf(full)
  const fullMine = mineDataWithPlan({ athleteId: athlete, today, nutritionDays: { state: 'ready', rows: windowDays.map(date => ({ date })) } },
    { athleteId: athlete, planDays: full.plan.athletes[0].days, meals: full.plan.meals })
  assert.deepEqual([fullLine.days, fullLine.hit], [14, fullMine.nutritionDays.rows.filter(r => r.goalMet).length + fullMine.nutritionDays.rows.filter(r => r.goalMet === false).length === 14 ? 10 : -1])
})

test('planlæsning fejler: linjen er uændret, ikke tom, og læsningen leverer stadig profilbatchen', async () => {
  const { client } = setup({ planFails: true })
  assert.equal(await readCoachPlanBasis(client, context()), null)
  const results = []
  startCoachNutritionRead({ enabled: true, client, readContext: context() }, value => results.push(value))
  for (let i = 0; i < 400; i++) await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(results.length, 1)
  assert.equal(results[0].batch.plan, undefined)
  assert.match(lineOf(results[0].batch).text, / · mod profilens mål$/)
})

test('profillinjen kommer først, kostplanen som opgradering af samme batch', async () => {
  const { client } = setup()
  const results = []
  startCoachNutritionRead({ enabled: true, client, readContext: context() }, value => results.push(value))
  for (let i = 0; i < 40 && results.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(results.length, 2)
  assert.equal(results[0].batch.plan, undefined); assert.ok(results[1].batch.plan)
  assert.match(lineOf(results[0].batch).text, /mod profilens mål$/)
  assert.match(lineOf(results[1].batch).text, /^Kost · mod kostplan/)
})

test('under 4 vurderede dage er linjen stille og falder ikke tilbage til profilens mål', async () => {
  const { client } = setup({ rows: windowDays.slice(0, 3).map(date => meal(date)) })
  assert.equal(lineOf(await withPlan(client)), undefined)
})

test('en plan, der ikke er præcis de 14 afsluttede dage, ignoreres', async () => {
  const { client } = setup()
  const batch = await withPlan(client)
  batch.plan = { ...batch.plan, from: addCalendarDays(batch.plan.from, 1) }
  assert.match(lineOf(batch).text, /mod profilens mål$/)
})
