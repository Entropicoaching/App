// Ordre 1580: atletens Mine data viser, hvor mange kostdage der ramte coachens kostplan.
// Faktisk model, bro og laeser; kun klienten er syntetisk.
import test from 'node:test'
import assert from 'node:assert/strict'
import { historyFixture, athleteId, uuid } from '../kostplan/dailyReference.fixture.mjs'
import { kostDageModPlan, KCAL_TOLERANCE, PROTEIN_MIN_SHARE, MIN_ASSESSED_DAYS } from './kostDageModPlan.mjs'
import { mineDataWithPlan, analysisMineData } from './analysisMineData.mjs'
import { mineDataModel, mineDataVisibility } from '../athlete/minedata/mineDataModel.mjs'
import { readKostPlanBasis } from './AnalysisMedKostplan.mjs'

const today = '2026-11-17'
const targets = { kcal: 100, protein: 10, carb: 0, fat: null }
const approved = date => ({ date, state: 'approved', reason: null, targets })
const meal = (date, kcal, protein, extra = {}) => ({ date, meal: 'Syntetisk maaltid', kcal, protein, ...extra })
const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

test('graenserne er navngivne og kcal og protein vurderes hver for sig', () => {
  assert.equal(KCAL_TOLERANCE, 0.10); assert.equal(PROTEIN_MIN_SHARE, 0.90); assert.equal(MIN_ASSESSED_DAYS, 4)
  const result = kostDageModPlan({ today, planDays: days.map(approved), meals: [
    meal(days[0], 110, 9), // praecis paa begge graenser: rammer
    meal(days[1], 111, 10), // kcal over: rammer ikke
    meal(days[2], 89, 10), // kcal under: rammer ikke
    meal(days[3], 100, 8.9), // protein for lavt: rammer ikke
    meal(days[4], 90, 20), // kcal paa nedre graense, protein over: rammer
  ] })
  assert.deepEqual([...result], [[days[0], true], [days[1], false], [days[2], false], [days[3], false], [days[4], true]])
})

test('flere maaltider samles pr. dag; kvittering, ukendte tal, i dag og dage uden plan vurderes ikke', () => {
  const planDays = [...days.map(approved), { date: '2026-11-09', state: 'unknown', reason: 'no-approved-version',
    targets: { kcal: null, protein: null, carb: null, fat: null } }, approved(today)]
  const result = kostDageModPlan({ today, planDays, meals: [
    meal(days[0], 40, 4), meal(days[0], 60, 6), meal(days[0], 0, 0, { meal: '[dag] kvittering' }),
    meal(days[1], 100, 10), meal(days[1], null, 5), // ukendt kcal: hele dagen ukendt
    meal(days[2], 100, 10), meal(days[3], 100, 10), meal(days[4], 100, 10),
    meal('2026-11-09', 100, 10), // dag uden godkendt plan
    meal(today, 100, 10), // dagen er ikke faerdig
    meal('2026-11-02', 100, 10), // uden for de 14 dage
  ] })
  assert.deepEqual([...result.keys()], [days[0], days[2], days[3], days[4]])
  assert.ok([...result.values()].every(v => v === true))
})

test('under 4 vurderede dage giver ingen vurdering, og ugyldige input giver intet', () => {
  const three = days.slice(0, 3)
  assert.equal(kostDageModPlan({ today, planDays: three.map(approved), meals: three.map(d => meal(d, 100, 10)) }).size, 0)
  for (const bad of [undefined, {}, { today, planDays: null, meals: [] }, { today: 'i dag', planDays: [], meals: [] }])
    assert.equal(kostDageModPlan(bad).size, 0)
  // Dage uden kendt maal i planen gaettes ikke.
  const none = kostDageModPlan({ today, planDays: days.map(d => ({ ...approved(d), targets: { kcal: null, protein: 10 } })),
    meals: days.map(d => meal(d, 100, 10)) })
  assert.equal(none.size, 0)
})

const bridge = (planDays, meals) => {
  const mineProps = analysisMineData({ athlete: { id: athleteId }, historicalMealLogs: meals.map(m => ({ ...m, athlete_id: athleteId })),
    weightLogs: [], fremgangLogs: [] }, new Date(`${today}T12:00:00Z`))
  return { mineProps, withPlan: mineDataWithPlan(mineProps, { athleteId, planDays, meals }) }
}

test('Mine data: kortet viser N af M, og uden basis eller for en anden atlet er raekkerne uaendrede', () => {
  const meals = days.map((d, i) => meal(d, i < 3 ? 100 : 150, 10))
  const { mineProps, withPlan } = bridge(days.map(approved), meals)
  const model = mineDataModel(withPlan)
  assert.deepEqual(model.nutrition, { state: 'ready', loggedDays: 5, assessedDays: 5, unknownDays: 0, goalDays: 3 })
  assert.equal(mineDataVisibility(model).nutrition, true)
  assert.equal(mineDataModel(mineProps).nutrition.assessedDays, 0)
  assert.equal(mineDataWithPlan(mineProps, null), mineProps)
  assert.equal(mineDataWithPlan(mineProps, { athleteId: 'anden', planDays: days.map(approved), meals }), mineProps)
  assert.equal(mineDataWithPlan(mineProps, { athleteId, planDays: [], meals }), mineProps)
})

test('Mine data: under 4 vurderede dage vises kortet ikke, og en udtrykkelig kilde roeres ikke', () => {
  const { withPlan } = bridge(days.slice(0, 3).map(approved), days.slice(0, 3).map(d => meal(d, 100, 10)))
  assert.equal(mineDataModel(withPlan).nutrition.assessedDays, 0)
  const explicit = { athleteId, today, nutritionDays: { state: 'ready', rows: [{ athlete_id: athleteId, date: days[0], goalMet: false }] },
    sessions: { state: 'ready', rows: [] } }
  assert.equal(mineDataWithPlan(explicit, { athleteId, planDays: days.map(approved), meals: days.map(d => meal(d, 100, 10)) })
    .nutritionDays.rows[0].goalMet, false)
})

// Atletens egen laesning: planlaesninger pr. vindue og atletens egne kostraekker. Ingen skrivning.
function client(f, rows, calls) {
  const guard = name => () => { calls.push(name); throw Error('skrivning i en laesning: ' + name) }
  return { from(table) {
    if (table !== 'meal_logs') return f.client.from(table)
    const q = { select: () => q, eq: () => q, gte: () => q, lte: () => q, limit: () => Promise.resolve({ data: rows, error: null }),
      insert: guard('insert'), update: guard('update'), delete: guard('delete'), upsert: guard('upsert') }
    calls.push(table); return q
  } }
}
const seeded = (approvedAt = '2026-11-01T10:00:00.000001Z', effective = '2026-11-01') => {
  const f = historyFixture(); f.plan(1, effective); f.version(10, uuid(1), effective, 1, 100, 10); f.approve(10, uuid(1), approvedAt); return f
}

test('laeseren giver plan og kost for de 14 afsluttede dage uden at skrive', async () => {
  const calls = []
  const rows = days.map(d => meal(d, 100, 10))
  const basis = await readKostPlanBasis({ client: client(seeded(), rows, calls), athleteId, today })
  assert.equal(basis.athleteId, athleteId); assert.equal(basis.meals, rows)
  const planned = basis.planDays.filter(d => d.state === 'approved')
  assert.equal(planned.length, 14); assert.deepEqual(planned[0].targets, targets)
  assert.deepEqual(calls, ['meal_logs'])
  assert.deepEqual([...kostDageModPlan({ ...basis, today }).values()], [true, true, true, true, true])
})

test('dage foer planens godkendelse vurderes ikke', async () => {
  const f = seeded('2026-11-12T10:00:00.000001Z', '2026-11-01')
  const rows = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map(d => meal(d, 100, 10))
  const basis = await readKostPlanBasis({ client: client(f, rows, []), athleteId, today })
  assert.deepEqual(basis.planDays.filter(d => d.state === 'approved').map(d => d.date).slice(0, 1), ['2026-11-12'])
  // 12., 13. og 14. nov. kan vurderes; 8. til 11. nov. er foer godkendelsen. Tre dage er under graensen paa fire.
  assert.equal(kostDageModPlan({ ...basis, today }).size, 0)
  const more = await readKostPlanBasis({ client: client(f, [...rows, meal('2026-11-15', 100, 10)], []), athleteId, today })
  assert.deepEqual([...kostDageModPlan({ ...more, today }).keys()], ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
})

test('laesefejl, ufuldstaendig eller annulleret laesning giver ingen basis', async () => {
  // Ingen godkendt plan er en bekraeftet tom historik: ingen dag vurderes.
  const empty = await readKostPlanBasis({ client: client(historyFixture(), [meal(days[0], 100, 10)], []), athleteId, today })
  assert.equal(kostDageModPlan({ ...empty, today }).size, 0)
  assert.equal(await readKostPlanBasis({ client: { from() { throw Error('syntetisk') } }, athleteId, today }), null)
  const full = Array.from({ length: 1000 }, (_, i) => meal(days[0], 1, 1, { id: i }))
  assert.equal(await readKostPlanBasis({ client: client(seeded(), full, []), athleteId, today }), null)
  assert.equal(await readKostPlanBasis({ client: client(seeded(), [], []), athleteId, today, isCurrent: () => false }), null)
})
