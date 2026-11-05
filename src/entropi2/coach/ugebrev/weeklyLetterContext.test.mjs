import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeeklyLetter } from './weeklyLetterModel.mjs'
import { emptyFixture, letterFixture } from './letterFixture.mjs'
import { activePlan, meal, coach } from '../../kostplan/rapport/reportFixture.mjs'

const run = data => createWeeklyLetter({ enabled: true, data })
function nutritionData() {
  const data = { ...emptyFixture(), asOf: '2026-11-04', coachId: coach.id }
  data.nutritionRead = { state: 'ready', complete: true, athleteId: data.athleteId,
    coachId: coach.id, date: data.asOf, plans: [activePlan()], weightLogs: [],
    mealLogs: [meal('2026-11-02', 'synthetic-1'), meal('2026-11-04', 'synthetic-2')] }
  return data
}
const context = (data, id) => run(data).context?.find(c => c.id === id)

test('actual nutrition report compares matching logged days to dated plan targets in the draft', () => {
  const data = nutritionData(), m = run(data), c = context(data, 'nutrition')
  assert.equal(m.state, 'ready'); assert.equal(c.sampleCount, 2); assert.equal(c.elapsedDays, 3)
  assert.equal(c.from, '2026-11-02'); assert.equal(c.to, '2026-11-04')
  assert.deepEqual(c.metrics.map(metric => [metric.key, metric.actual, metric.target]),
    [['kcal', 2000, 4000], ['protein', 200, 300]])
  assert.match(m.text, /2\.000 kcal mod 4\.000 kcal.*50 %/)
  assert.match(m.text, /200 g protein mod 300 g protein/)
  assert.match(m.text, /2\/3 dage/); assert.match(m.text, /ikke nødvendigvis hele dit indtag/)
  assert.equal((m.text.match(/\?/g) || []).length, 1)
  assert.equal(m.requiresCoachEdit, true)
})

test('report evidence replaces the legacy nutrition praise without claiming complete food days', () => {
  const d = { ...letterFixture(), ...nutritionData(), nutritionDays: letterFixture().nutritionDays }
  assert.doesNotMatch(run(d).praise, /komplette kostregistreringer/)
  assert.match(run(d).text, /logget måltider på 2\/3 dage/)
})

test('unrepresentable report percentages stay unknown rather than becoming zero or Infinity', () => {
  const d = nutritionData()
  d.nutritionRead.plans = [activePlan({ dailyTargets: { kcal: 1e-320, protein: 150, carb: 250, fat: 60 } })]
  const c = context(d, 'nutrition')
  assert.equal(c.metrics[0].percent, null)
  assert.match(c.text, /procent ukendt/); assert.doesNotMatch(c.text, /Infinity|NaN|\(0 %\)/)
})

test('plan activation is never backdated; overlapping plans hide comparison, unknown history does not become current targets', () => {
  const late = nutritionData(); late.nutritionRead.plans = [activePlan({ on: '2026-11-04' })]
  assert.equal(context(late, 'nutrition').metrics[0].target, null)
  assert.doesNotMatch(run(late).text, /mod \d/)
  const overlap = nutritionData(); overlap.nutritionRead.plans.push(activePlan({ id: 'synthetic-overlap' }))
  assert.equal(context(overlap, 'nutrition').metrics[1].target, null)
  const unavailable = nutritionData(); unavailable.nutritionRead.planHistory = 'unavailable'
  Object.defineProperty(unavailable.nutritionRead, 'plans', { get() { assert.fail('unavailable history read') } })
  assert.match(run(unavailable).text, /uden kendt, entydigt dateret mål/)
})

test('incomplete, failed, malformed or stale receipts give an error without a draft', () => {
  for (const mutate of [d => { d.nutritionRead.state = 'error' },
    d => { d.nutritionRead.complete = false }, d => { d.nutritionRead.date = '2026-11-03' },
    d => { d.nutritionRead.athleteId = 'other' }, d => { d.nutritionRead.coachId = 'other' },
    d => { delete d.coachId }, d => { delete d.nutritionRead.weightLogs },
    d => { d.nutritionRead.mealLogs.push(d.nutritionRead.mealLogs[0]) }]) {
    const d = nutritionData(); mutate(d)
    assert.equal(context(d, 'nutrition'), undefined); assert.equal(run(d).state, 'error')
    assert.equal(run(d).text, undefined)
  }
  const missing = nutritionData(); delete missing.nutritionRead
  assert.equal(run(missing).state, 'empty')
  const empty = nutritionData(); empty.nutritionRead.mealLogs = []
  assert.equal(run(empty).state, 'empty')
})

test('receipts, foreign and future meals do not become evidence; zero stays known, unknown values stay unknown', () => {
  const d = nutritionData()
  d.nutritionRead.mealLogs.push(meal('2026-11-03', 'synthetic-receipt', { meal: ' [appData2-day-v1]synthetic' }),
    meal('2026-11-05', 'synthetic-future'), { ...meal('2026-11-03', 'synthetic-foreign'), athlete_id: 'other' })
  assert.equal(context(d, 'nutrition').sampleCount, 2)
  d.nutritionRead.mealLogs = [meal('2026-11-02', 'synthetic-zero', { kcal: 0, protein: 0 })]
  assert.equal(context(d, 'nutrition').metrics[0].actual, 0)
  d.nutritionRead.mealLogs[0].kcal = null
  assert.deepEqual(context(d, 'nutrition').metrics.map(metric => metric.key), ['protein'])
  d.nutritionRead.mealLogs[0].protein = null
  assert.equal(context(d, 'nutrition'), undefined)
})

test('small sleep samples show counts only; known zero is an observation and missing domains stay absent', () => {
  const d = letterFixture(); d.daily = d.daily.slice(0, 3); d.daily.forEach(row => { row.sleepHours = 0 })
  const c = context(d, 'sleep')
  assert.equal(c.sampleCount, 3); assert.equal(c.value, null); assert.match(c.text, /for lidt til et ugesnit/)
  assert.equal(context(d, 'recovery'), undefined); assert.equal(context(d, 'nutrition'), undefined)
  d.daily.push({ ...d.daily[0], day: '2026-11-01' })
  assert.equal(context(d, 'sleep').value, 0); assert.match(run(d).text, /0 timer/)
  d.daily[0].sleepHours = 25
  assert.equal(context(d, 'sleep'), undefined)
})

test('native recovery scales retain missing values, require four dates for means and reject ambiguous evidence', () => {
  const d = emptyFixture()
  d.recoveryDays = letterFixture().daily.map((row, i) => ({ day: row.day, source: 'athlete_manual',
    energy: i < 4 ? 2 : null, stress: i < 3 ? 4 : null, sorenessLevel: 5 }))
  const c = context(d, 'recovery')
  assert.equal(run(d).state, 'ready')
  assert.deepEqual(c.metrics.map(metric => [metric.sampleCount, metric.value]), [[4, 2], [3, null], [7, 5]])
  assert.match(c.text, /stress: 3\/7 dage, for lidt/); assert.match(c.text, /ikke en samlet vurdering/)
  const original = structuredClone(d.recoveryDays)
  for (const mutate of [rows => rows.push(rows[0]), rows => { rows[0].day = '2026-11-02' },
    rows => { rows[0].source = 'device' }, rows => { rows[0].day = '2026-02-30' }]) {
    d.recoveryDays = structuredClone(original); mutate(d.recoveryDays)
    assert.equal(context(d, 'recovery'), undefined)
  }
  d.recoveryDays = original; d.recoveryDays[0].sorenessLevel = 0
  assert.deepEqual(context(d, 'recovery').metrics.map(metric => metric.key), ['energy', 'stress'])
})

test('context never touches private cycle fields, raw notes or caller-owned data', () => {
  const d = nutritionData()
  const poison = object => Object.defineProperty(object, 'cycle', { get() { assert.fail('private read') } })
  poison(d); poison(d.nutritionRead); d.nutritionRead.mealLogs.forEach(poison)
  d.nutritionRead.mealLogs[0].meal = 'synthetic private meal text'
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } }
  const before = JSON.stringify(d); freeze(d); const m = run(d)
  assert.equal(JSON.stringify(d), before)
  assert.doesNotMatch(JSON.stringify(m), /synthetic private|cycle|synthetic-coach|synthetic-athlete|synthetic-plan/)
})
