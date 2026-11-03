import test from 'node:test'
import assert from 'node:assert/strict'
import { todayFocus } from './todayFocus.mjs'

const training = 'Dagens fokus: Gennemfør dagens pas.'
const nutrition = 'Dagens fokus: Arbejd hen imod dagens kostmål.'
const mobility = 'Dagens fokus: Giv plads til mobilitet.'
const date = '2026-11-03'
const week = { id: 'synthetic-week', week_number: 1, start_date: '2026-11-02', sessions: [
  { id: 'synthetic-session', weekday: 1, exercises: [{ id: 'synthetic-exercise', sets: 2 }] },
] }
const input = (extra = {}) => ({ now: date, allWeeks: [week], currentWeek: week,
  exerciseLogs: [], nutritionToday: { date, kcal: 1000, kcalTarget: 2000 }, ...extra })

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('today session wins over nutrition and mobility', () => {
  assert.equal(todayFocus(input()), training)
})

test('an unfinished session remains the focus, a completed session does not', () => {
  const log = set_number => ({ exercise_id: 'synthetic-exercise', set_number })
  assert.equal(todayFocus(input({ exerciseLogs: [log(1)] })), training)
  assert.equal(todayFocus(input({ exerciseLogs: [log(1), log(2)] })), nutrition)
})

test('a future or past dated session is not today', () => {
  for (const now of ['2026-11-02', '2026-11-04']) {
    assert.equal(todayFocus(input({ now, nutritionToday: { date: now, protein: 30, proteinTarget: 100 } })), nutrition)
  }
})

test('unavailable program never produces a training instruction', () => {
  for (const extra of [{ onHoliday: true }, { programError: true }, { offlineSnapshotAt: date },
    { allWeeks: [] }, { exerciseLogs: undefined }]) {
    assert.equal(todayFocus(input(extra)), nutrition)
  }
})

test('either valid nutrient below its goal beats mobility', () => {
  for (const snapshot of [
    { kcal: 0, kcalTarget: 2000 }, { protein: '79,5', proteinTarget: '80' },
    { kcal: 2000, kcalTarget: 2000, protein: 79, proteinTarget: 80 },
    { kcal: '', kcalTarget: 2000, protein: 10, proteinTarget: 80 },
  ]) assert.equal(todayFocus({ now: date, nutritionToday: { date, ...snapshot } }), nutrition)
})

test('goals reached or exceeded fall back to mobility', () => {
  for (const total of [2000, 2001]) assert.equal(todayFocus({ now: date,
    nutritionToday: { date, kcal: total, kcalTarget: 2000, protein: 100, proteinTarget: 100 } }), mobility)
})

test('missing, invalid and unsafe nutrition is never interpreted as zero', () => {
  for (const value of [undefined, null, '', ' ', false, {}, [], -1, Infinity, NaN, 'bad', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(todayFocus({ now: date, nutritionToday: { date, kcal: value, kcalTarget: 2000 } }), mobility)
    assert.equal(todayFocus({ now: date, nutritionToday: { date, kcal: 0, kcalTarget: value } }), mobility)
  }
  assert.equal(todayFocus({ now: date, nutritionToday: { date, kcal: 0, kcalTarget: 0 } }), mobility)
})

test('yesterday and tomorrow nutrition are ignored', () => {
  for (const stamp of ['2026-11-02', '2026-11-04', undefined]) assert.equal(todayFocus({ now: date,
    nutritionToday: { date: stamp, kcal: 0, kcalTarget: 2000 } }), mobility)
})

test('Copenhagen midnight advances the nutrition date', () => {
  const snapshot = { date, kcal: 0, kcalTarget: 2000 }
  assert.equal(todayFocus({ now: '2026-11-03T22:59:59Z', nutritionToday: snapshot }), nutrition)
  assert.equal(todayFocus({ now: '2026-11-03T23:00:00Z', nutritionToday: snapshot }), mobility)
})

test('missing or invalid explicit time uses no ambient clock', () => {
  for (const now of [undefined, null, '', '2026-02-30', new Date(NaN), 0]) {
    assert.equal(todayFocus(input({ now })), mobility)
  }
  assert.equal(todayFocus(), mobility)
  assert.equal(todayFocus(null), mobility)
})

test('the model is deterministic and does not mutate frozen caller data', () => {
  const props = freeze(input())
  const before = JSON.stringify(props)
  assert.equal(todayFocus(props), training)
  assert.equal(todayFocus(props), training)
  assert.equal(JSON.stringify(props), before)
})
