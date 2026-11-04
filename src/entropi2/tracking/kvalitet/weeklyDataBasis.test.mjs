import test from 'node:test'
import assert from 'node:assert/strict'
import { BASIS_DOMAINS, weeklyDataBasis } from './weeklyDataBasis.mjs'
import { load } from '../load.mjs'
import { nutritionTrend } from '../nutritionTrend.mjs'
import { weightTrend } from '../weightTrend.mjs'

const athleteId = 'synthetic-athlete-a'
const asOf = '2026-11-04'
const ready = rows => ({ athleteId, state: 'ready', complete: true, rows })
const set = (logged_at, extra = {}) => ({ athlete_id: athleteId, logged_at, weight: 60, reps_completed: 5, ...extra })
const meal = (date, extra = {}) => ({ athlete_id: athleteId, date, meal: 'Testmåltid', kcal: 500, protein: 30, carb: 50, fat: 10, ...extra })
const weight = (logged_at, extra = {}) => ({ athlete_id: athleteId, logged_at, weight: 80, ...extra })
const checkin = (logged_date, extra = {}) => ({ athlete_id: athleteId, logged_date, readiness_score: 50, ...extra })
const model = (sources = {}, extra = {}) => weeklyDataBasis({ enabled: true, athleteId, asOf, sources, ...extra })
const current = (sources, extra) => model(sources, extra).weeks.at(-1)
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('OFF requires literal true and never inspects sources or scope', () => {
  const options = { get athleteId() { throw Error('scope read') }, get sources() { throw Error('data read') } }
  assert.equal(weeklyDataBasis(), null)
  assert.equal(weeklyDataBasis(null), null)
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const input = Object.defineProperties({ enabled }, Object.getOwnPropertyDescriptors(options))
    assert.equal(weeklyDataBasis(input), null)
  }
  options.enabled = false
  assert.equal(weeklyDataBasis(options), null)
})

test('explicit valid scope/date required, no implicit clock or timestamp cutoff', () => {
  for (const date of [undefined, null, '', '2026-02-30', '2026-11-4', '2026-11-04T12:00:00Z', new Date(asOf), '0000-01-01', '9999-12-31']) {
    assert.deepEqual(model({}, { asOf: date }), { state: 'invalid', weeks: [] })
  }
  for (const id of ['', ' ', ' a ', null, 10]) assert.equal(model({}, { athleteId: id }).state, 'invalid')
})

test('four Monday-Sunday weeks, current partial week counts elapsed days only', () => {
  const result = model()
  assert.deepEqual(result.weeks.map(w => [w.weekStart, w.weekEnd, w.elapsedDays, w.partial]), [
    ['2026-10-12', '2026-10-18', 7, false], ['2026-10-19', '2026-10-25', 7, false],
    ['2026-10-26', '2026-11-01', 7, false], ['2026-11-02', '2026-11-08', 3, true],
  ])
  for (const [asOf, expected] of [['2026-11-02', 1], ['2026-11-08', 7]]) {
    const week = current({ training: ready([]) }, { asOf })
    assert.equal(week.elapsedDays, expected)
    assert.equal(week.domains.training.missingDays.length, expected)
    assert.ok(week.domains.training.missingDays.every(date => date <= asOf))
  }
})

test('unavailable reads stay unknown; complete empty reads show honest missing days', () => {
  for (const domain of BASIS_DOMAINS) {
    for (const state of ['missing', 'loading', 'partial', 'error']) {
      const source = { athleteId, state, get rows() { throw Error('unavailable read') } }
      const basis = current({ [domain]: source }).domains[domain]
      assert.deepEqual(basis, { state, recordedDays: null, valueDays: null, missingDays: null, invalidDays: null })
    }
    assert.equal(current().domains[domain].state, 'missing')
    assert.equal(current({ [domain]: { ...ready([]), complete: false } }).domains[domain].state, 'partial')
    assert.equal(current({ [domain]: { ...ready([]), complete: undefined } }).domains[domain].state, 'partial')
    assert.equal(current({ [domain]: { ...ready([]), rows: {} } }).domains[domain].state, 'invalid')
    const basis = current({ [domain]: ready([]) }).domains[domain]
    assert.equal(basis.recordedDays, 0); assert.equal(basis.valueDays, 0)
    assert.deepEqual(basis.missingDays, ['2026-11-02', '2026-11-03', '2026-11-04'])
  }
})

test('source and row identities are both enforced, never user_id or absent ids', () => {
  const factories = { training: set, nutrition: meal, weight, readiness: checkin }
  for (const domain of BASIS_DOMAINS) {
    const row = factories[domain](asOf)
    const foreign = { ...row, athlete_id: 'synthetic-athlete-b' }
    const missing = { ...row, athlete_id: undefined, user_id: athleteId }
    const sources = { [domain]: ready([foreign, missing, null, 'bad', row]) }
    assert.equal(current(sources).domains[domain].recordedDays, 1)
    assert.equal(current({ [domain]: ready([foreign, missing]) }).domains[domain].recordedDays, 0)
    assert.equal(current({ [domain]: { ...sources[domain], athleteId: 'synthetic-athlete-b' } }).domains[domain].state, 'invalid')
  }
  const sources = { training: ready([set(asOf, { id: 'same' }), set(asOf, { id: 'same', athlete_id: 'synthetic-athlete-b', weight: 100 })]) }
  assert.equal(current(sources).domains.training.valueDays, 1)
})

test('actual load module controls distinct retained training days and measurement validity', () => {
  const rows = [set('2026-11-02', { id: 'a' }), set('2026-11-02', { id: 'b' }),
    set('2026-11-03', { weight: '' }), set(asOf, { skipped: true }), set(asOf, { _optimistic: true }),
    set('2026-11-05'), set('2026-02-30'), set('2025-01-01')]
  const expected = load(rows, asOf).days.filter(d => d.date >= '2026-11-02' && d.sets)
  const basis = current({ training: ready(rows) }).domains.training
  assert.equal(basis.recordedDays, expected.length)
  assert.equal(basis.valueDays, 1)
  assert.deepEqual(basis.invalidDays, ['2026-11-03'])
  assert.deepEqual(basis.missingDays, [asOf])
})

test('Copenhagen midnight, DST and conflicting set ids follow existing load contract', () => {
  const rows = [set('2026-11-01T23:15:00Z'), set('2026-11-04T23:15:00Z'),
    set('2026-11-03', { id: 'conflict' }), set(asOf, { id: 'conflict' })]
  const basis = current({ training: ready(rows) }).domains.training
  assert.equal(basis.recordedDays, 1)
  assert.deepEqual(basis.missingDays, ['2026-11-03', asOf])
  const summer = current({ training: ready([set('2026-06-07T22:00:00Z')]) }, { asOf: '2026-06-08' })
  assert.equal(summer.domains.training.recordedDays, 1)
  const dst = model({ training: ready([set('2026-10-25T23:30:00Z')]) })
  assert.equal(dst.weeks[2].domains.training.recordedDays, 1)
})

test('actual nutrition module excludes receipts and distinguishes unknown nutrients', () => {
  const rows = [meal('2026-11-02'), meal('2026-11-02'), meal('2026-11-03', { protein: null }),
    meal(asOf, { meal: '[appData2-day-v1]synthetic' }), meal('2026-11-05'), meal('2026-02-30')]
  const upstream = nutritionTrend(rows, null, asOf)
  const basis = current({ nutrition: ready(rows) }).domains.nutrition
  assert.equal(basis.recordedDays, upstream.days.length)
  assert.equal(basis.recordedDays, 2); assert.equal(basis.valueDays, 1)
  assert.deepEqual(basis.missingDays, [asOf]); assert.deepEqual(basis.invalidDays, ['2026-11-03'])
  assert.equal(current({ nutrition: ready([meal(asOf, { kcal: 0, protein: 0 })]) }).domains.nutrition.valueDays, 1)
})

test('actual weight module owns numeric validation, multiple measurements count once', () => {
  const rows = [weight('2026-11-02'), weight('2026-11-02', { weight: '81,5' }),
    weight('2026-11-03', { weight: 0 }), weight('2026-11-05'), weight('2026-02-30')]
  const basis = current({ weight: ready(rows) }).domains.weight
  assert.equal(basis.valueDays, weightTrend(rows, athleteId, asOf).daily.length)
  assert.equal(basis.recordedDays, 2); assert.equal(basis.valueDays, 1)
  assert.deepEqual(basis.invalidDays, ['2026-11-03'])
})

test('readiness zero is a value; conflicts, missing values and invalid scores are explicit', () => {
  for (const score of [0, 100, 50.5]) {
    const basis = current({ readiness: ready([checkin(asOf, { readiness_score: score })]) }).domains.readiness
    assert.equal(basis.valueDays, 1)
  }
  for (const score of [null, undefined, '', '50', -1, 101, NaN, Infinity]) {
    const basis = current({ readiness: ready([checkin(asOf, { readiness_score: score })]) }).domains.readiness
    assert.equal(basis.recordedDays, 1); assert.equal(basis.valueDays, 0)
    assert.deepEqual(basis.invalidDays, [asOf])
  }
  const row = checkin(asOf)
  assert.equal(current({ readiness: ready([row, { ...row }]) }).domains.readiness.valueDays, 1)
  assert.equal(current({ readiness: ready([row, { ...row, readiness_score: 40 }]) }).domains.readiness.valueDays, 0)
})

test('no optimistic records in any domain; no cross-domain contamination', () => {
  const sources = { training: ready([set(asOf, { _optimistic: true })]),
    nutrition: ready([meal(asOf, { _optimistic: true })]), weight: ready([weight(asOf, { _optimistic: true })]),
    readiness: ready([checkin(asOf, { _optimistic: true })]) }
  for (const basis of Object.values(current(sources).domains)) assert.equal(basis.recordedDays, 0)
  sources.training = { athleteId, state: 'error' }
  sources.weight = ready([weight(asOf)])
  assert.equal(current(sources).domains.weight.valueDays, 1)
  assert.equal(current(sources).domains.training.valueDays, null)
})

test('calendar weeks cover leap day and year change without local clock arithmetic', () => {
  const leap = model({ readiness: ready([checkin('2024-02-29')]) }, { asOf: '2024-03-03' })
  assert.equal(leap.weeks.at(-1).weekStart, '2024-02-26')
  assert.equal(leap.weeks.at(-1).domains.readiness.valueDays, 1)
  const year = model({ weight: ready([weight('2025-12-31')]) }, { asOf: '2026-01-01' })
  assert.equal(year.weeks.at(-1).weekStart, '2025-12-29')
  assert.equal(year.weeks.at(-1).domains.weight.valueDays, 1)
})

test('frozen inputs unchanged, deterministic order, output contains only coverage not raw data', () => {
  const sources = freeze({ training: ready([set(asOf), set('2026-11-02')]),
    nutrition: ready([meal(asOf)]), weight: ready([weight(asOf)]),
    readiness: ready([checkin(asOf, { private_note: 'synthetic-do-not-copy' })]) })
  const before = JSON.stringify(sources), result = model(sources)
  const reversed = Object.fromEntries(BASIS_DOMAINS.map(k => [k, { ...sources[k], rows: [...sources[k].rows].reverse() }]))
  assert.deepEqual(result, model(reversed)); assert.equal(JSON.stringify(sources), before)
  for (const secret of ['synthetic-do-not-copy', 'private_note', 'reps_completed', 'readiness_score', 'tonnage']) assert.ok(!JSON.stringify(result).includes(secret))
  result.weeks.at(-1).domains.training.missingDays.push('synthetic')
  assert.deepEqual(model(sources), model(reversed))
})
