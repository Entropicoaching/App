// Ordre 1619: ugerapporten tæller også kulhydrat- og fedtdage mod kostplanen (1615s 10 %-regel, delt hjælper).
// Kun syntetiske data. Rigtig adapter, læser, model og tekst; kun databasegrænsen er falsk.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachNutrition, readCoachPlanBasis } from '../coachNutritionRead.mjs'
import { coachNutritionLines } from './coachNutrition.mjs'
import WeeklyReport from './WeeklyReport.mjs'
import { weeklyReportModel } from './weeklyReportModel.mjs'
import { nutritionDatabase } from '../coachNutritionPagination.fixture.mjs'
import { historyFixture, uuid } from '../kostplan/dailyReference.fixture.mjs'
import { tableNames } from '../kostplan/coach/activation.fixture.mjs'
import { addCalendarDays } from '../../calendarDate.js'

// 23:30 UTC den 17. er 00:30 den 18. i Danmark: dagen skal regnes i Europe/Copenhagen.
const coachId = 'synthetic-macro-coach', athlete = 'synthetic-macro-athlete', today = '2026-11-18'
const now = new Date('2026-11-17T23:30:00Z')
const context = () => ({ coachId, day: today, athleteIds: [athlete] })
const weekDays = Array.from({ length: 7 }, (_, i) => addCalendarDays(today, -6 + i))
const meal = (date, carb = 250, fat = 70) => ({ id: `meal-${date}`, athlete_id: athlete, date, meal: 'Syntetisk måltid', kcal: 2000, protein: 150, carb, fat })

function setup({ rows = weekDays.map(date => meal(date)), carbFat = [250, 70] } = {}) {
  const f = historyFixture()
  f.plan(1, '2026-11-01', 'godkendt', athlete)
  f.version(10, uuid(1), '2026-11-01', 1, 2000, 150, carbFat[0] ?? 0, carbFat[1])
  f.approve(10, uuid(1), '2026-11-01T10:00:00Z', athlete)
  const db = nutritionDatabase(rows, { goals: [{ id: athlete, kcal_target: 2400, protein_target: 200 }] })
  return { client: { from: table => tableNames.includes(table) ? f.client.from(table) : db.client.from(table) } }
}
const withPlan = async client => ({ ...await readCoachNutrition(client, context()), plan: await readCoachPlanBasis(client, context()) })
const props = batch => ({ session: { user: { id: coachId } }, readContext: context(), athletes: [{ id: athlete, name: 'Syntetisk atlet' }],
  loading: false, loadError: false, coachNutrition: batch })
const nutritionOf = batch => weeklyReportModel(props(batch), now).rows[0].nutrition
const text = n => Array.isArray(n) ? n.map(text).join(' ') : !n || typeof n === 'boolean' ? '' :
  typeof n !== 'object' ? String(n) : text(n.props?.children ?? n.children)
const rendered = batch => text(WeeklyReport({ ...props(batch), today: now }))
const run = async options => { const batch = await withPlan(setup(options).client); return { batch, n: nutritionOf(batch), t: rendered(batch) } }

test('plan med kulhydrat- og fedtmål giver nye dagstal ved siden af protein', async () => {
  const { n, t } = await run()
  assert.deepEqual(n.plan, { logged: 6, reached: 6, carb: { logged: 6, reached: 6 }, fat: { logged: 6, reached: 6 } })
  assert.match(t, /Proteinmål nået mod kostplan: 6 af 6 loggede dage/)
  assert.match(t, /Kulhydrat inden for 10 % af planen: 6 af 6 · Fedt inden for 10 % af planen: 6 af 6/)
})

test('10 %-grænsen: 10 % rammer, over 10 % rammer ikke', async () => {
  const rows = weekDays.map((date, i) => meal(date, [275, 276, 225, 224, 250, 250, 250][i], [77, 78, 63, 62, 70, 70, 70][i]))
  const { n, t } = await run({ rows })
  // De seks afsluttede dage er 12.-17. nov.: indeks 0-5. Kulhydrat 275 og 225 rammer, 276 og 224 ikke.
  assert.deepEqual(n.plan.carb, { logged: 6, reached: 4 })
  assert.deepEqual(n.plan.fat, { logged: 6, reached: 4 })
  assert.match(t, /Kulhydrat inden for 10 % af planen: 4 af 6/)
})

test('plan uden kulhydrat- eller fedtmål giver rapporten som før', async () => {
  for (const carbFat of [[null, null], [0, 0]]) {
    const { n, t } = await run({ carbFat })
    assert.deepEqual(n.plan, { logged: 6, reached: 6 })
    assert.doesNotMatch(t, /Kulhydrat|Fedt/)
  }
})

test('kun ét af målene: kun det felt vises', async () => {
  const { n, t } = await run({ carbFat: [250, null] })
  assert.deepEqual(n.plan.carb, { logged: 6, reached: 6 }); assert.equal(n.plan.fat, undefined)
  assert.match(t, /Kulhydrat inden for 10 % af planen: 6 af 6/); assert.doesNotMatch(t, /Fedt/)
})

test('null i loggen gør dagen ukendt, 0 er et tal og er et miss', async () => {
  const rows = weekDays.map((date, i) => meal(date, i === 0 ? null : i === 1 ? 0 : 250, i === 2 ? null : 70))
  const { n } = await run({ rows })
  // Dag 0 uden kulhydrat og dag 2 uden fedt udelades; dag 1 har 0 g og er logget men ikke ramt.
  assert.deepEqual(n.plan.carb, { logged: 5, reached: 4 })
  assert.deepEqual(n.plan.fat, { logged: 5, reached: 5 })
})

test('samme dag giver samme ramt i kostlinjen og i ugerapporten', async () => {
  const rows = weekDays.map((date, i) => meal(date, i % 2 ? 100 : 250, i % 3 ? 70 : 20))
  const { batch, n } = await run({ rows })
  const line = coachNutritionLines(props(batch), today, [{ id: athlete }], true).get(athlete)
  assert.equal(line.mod, 'plan')
  assert.deepEqual(line.macros.carb, { hit: n.plan.carb.reached, days: n.plan.carb.logged })
  assert.deepEqual(line.macros.fat, { hit: n.plan.fat.reached, days: n.plan.fat.logged })
})
