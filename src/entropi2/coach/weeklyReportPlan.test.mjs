// Ordre 1596: coachens ugerapport tæller proteindage mod kostplanen, når dagen ligger under godkendt plan.
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

const coachId = 'synthetic-plan-coach', athlete = 'synthetic-plan-athlete', today = '2026-11-17'
const context = () => ({ coachId, day: today, athleteIds: [athlete] })
const weekDays = Array.from({ length: 7 }, (_, i) => addCalendarDays(today, -6 + i))
const meal = (date, kcal, protein) => ({ id: `meal-${date}`, athlete_id: athlete, date, meal: 'Syntetisk måltid', kcal, protein, carb: 0, fat: 0 })
// Planen vil 150 g, profilen 200 g: 150 g rammer planen (mindst 135) men ikke profilen.
const logs = (protein = 150) => weekDays.map(date => meal(date, 2000, protein))

function setup({ archivedFrom = null, noPlan = false, planFails = false, rows = logs() } = {}) {
  const f = historyFixture()
  if (!noPlan) {
    f.plan(1, '2026-11-01', 'godkendt', athlete); f.version(10, uuid(1), '2026-11-01', 1, 2000, 150); f.approve(10, uuid(1), '2026-11-01T10:00:00Z', athlete)
    if (archivedFrom) { f.plan(2, archivedFrom, 'arkiveret', athlete); f.version(12, uuid(2), archivedFrom, 1, 2000, 150); f.approve(12, uuid(2), archivedFrom + 'T10:00:00Z', athlete) }
  }
  const db = nutritionDatabase(rows, { goals: [{ id: athlete, kcal_target: 2400, protein_target: 200 }] })
  return { f, client: { from(table) {
    if (!tableNames.includes(table)) return db.client.from(table)
    if (planFails) throw Error('Syntetisk planfejl')
    return f.client.from(table)
  } } }
}
const withPlan = async client => ({ ...await readCoachNutrition(client, context()), plan: await readCoachPlanBasis(client, context()) })
const props = batch => ({ session: { user: { id: coachId } }, readContext: context(), athletes: [{ id: athlete, name: 'Syntetisk atlet' }],
  loading: false, loadError: false, coachNutrition: batch })
const nutritionOf = batch => weeklyReportModel(props(batch), today).rows[0].nutrition
const text = n => Array.isArray(n) ? n.map(text).join(' ') : !n || typeof n === 'boolean' ? '' :
  typeof n !== 'object' ? String(n) : text(n.props?.children ?? n.children)
const rendered = batch => text(WeeklyReport({ ...props(batch), today }))

test('dag under godkendt plan tælles mod planens protein og teksten siger det', async () => {
  const { client } = setup(), batch = await withPlan(client)
  const n = nutritionOf(batch)
  assert.deepEqual(n.plan, { logged: 6, reached: 6 })
  assert.equal(n.profileLogged, 1); assert.equal(n.reached, 0)
  const t = rendered(batch)
  assert.match(t, /Proteinmål nået mod kostplan: 6 af 6 loggede dage/)
  assert.match(t, /Øvrige dage mod profilens mål: 0 af 1 logget dag/)
  assert.doesNotMatch(t, /Proteinmål nået: /)
})

test('dag under arkiveret plan tælles mod profilens mål', async () => {
  const { client } = setup({ archivedFrom: '2026-11-14' }), batch = await withPlan(client)
  const n = nutritionOf(batch)
  // 11.-13. nov. under godkendt plan; fra 14. nov. arkiveret (ukendt) og i dag uden plan: profilens 200 g.
  assert.deepEqual(n.plan, { logged: 3, reached: 3 })
  assert.equal(n.profileLogged, 4); assert.equal(n.reached, 0)
  assert.match(rendered(batch), /Øvrige dage mod profilens mål: 0 af 4 loggede dage/)
})

test('uge uden plan giver uændret rapport (samme tal og tekst som før)', async () => {
  const { client } = setup({ noPlan: true }), batch = await withPlan(client)
  const before = await readCoachNutrition(client, context())
  assert.deepEqual(nutritionOf(batch), nutritionOf(before))
  assert.deepEqual(nutritionOf(batch), { logged: 7, proteinGoal: 200, reached: 0 })
  assert.match(rendered(batch), /Proteinmål nået: 0 af 7 loggede dage/)
  assert.doesNotMatch(rendered(batch), /kostplan|profilens/)
})

test('planlæsning fejler: rapporten er uændret, ikke tom', async () => {
  const { client } = setup({ planFails: true }), batch = await withPlan(client)
  assert.equal(batch.plan, null)
  assert.deepEqual(nutritionOf(batch), { logged: 7, proteinGoal: 200, reached: 0 })
  assert.match(rendered(batch), /Kostdage logget: 7\/7/)
})

test('samme atlet og samme dage: ugerapportens protein er proteindelen af kostlinjens dagsvurdering', async () => {
  // Lidt protein: 100 g mod planens 150 g (under 90 %) giver miss; 140 g giver ramt.
  const rows = weekDays.map((date, i) => meal(date, 2000, i % 2 ? 100 : 140))
  const { client } = setup({ rows }), batch = await withPlan(client)
  const line = coachNutritionLines(props(batch), today, [{ id: athlete }], true).get(athlete)
  const n = nutritionOf(batch)
  assert.equal(line.mod, 'plan')
  // Kostlinjen vurderer 6 dage (ikke i dag); kcal 2000 rammer altid, så ramt = proteinramt.
  assert.equal(line.days, n.plan.logged); assert.equal(line.hit, n.plan.reached)
})

test('modellen læser kun, og uden plan på batchen kommer ingen planfelter', async () => {
  const { client, f } = setup(), full = await withPlan(client), writes = f.writes().length
  const { plan, ...bare } = full
  assert.equal(nutritionOf(bare).plan, undefined)
  assert.equal(f.writes().length, writes)
})
