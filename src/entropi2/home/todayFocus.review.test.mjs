import test from 'node:test'
import assert from 'node:assert/strict'
import { todayFocus } from './todayFocus.mjs'

const mobility = 'Dagens fokus: Giv plads til mobilitet.'
const nutrition = 'Dagens fokus: Arbejd hen imod dagens kostmål.'
const training = 'Dagens fokus: Gennemfør dagens pas.'
const date = '2026-11-03'
const exercise = { id: 'synthetic-review-exercise', sets: 1 }
const week = { id: 'synthetic-review-week', week_number: 1, start_date: '2026-11-02',
  sessions: [{ id: 'synthetic-review-session', exercises: [exercise] }] }
const props = { now: date, athlete: { id: 'synthetic-review-athlete' },
  allWeeks: [week], currentWeek: week, exerciseLogs: [] }

test('review: undated open sessions preserve Home semantics; skipped sets complete them', () => {
  assert.equal(todayFocus(props), training)
  assert.equal(todayFocus({ ...props, exerciseLogs: [{ exercise_id: exercise.id, set_number: 1, skipped: true }] }), mobility)
})

test('review: optimistic and other-athlete logs do not complete today', () => {
  for (const extra of [{ _optimistic: true }, { athlete_id: 'synthetic-other' }]) {
    assert.equal(todayFocus({ ...props,
      exerciseLogs: [{ exercise_id: exercise.id, set_number: 1, ...extra }] }), training)
  }
})

test('review: unrounded decimals, minimum target, and invalid companion nutrient', () => {
  for (const [snapshot, expected] of [
    [{ kcal: '1999,99', kcalTarget: 2000 }, nutrition],
    [{ kcal: 0, kcalTarget: 0.5 }, mobility],
    [{ protein: 0, proteinTarget: 1, kcal: 'bad', kcalTarget: 2000 }, nutrition],
    [{ protein: 100, proteinTarget: 100 }, mobility],
  ]) assert.equal(todayFocus({ now: date, nutritionToday: { date, ...snapshot } }), expected)
})

test('review: spring and autumn Copenhagen midnight use calendar day', () => {
  for (const [date, before, after] of [
    ['2026-03-29', '2026-03-29T21:59:59Z', '2026-03-29T22:00:00Z'],
    ['2026-10-25', '2026-10-25T22:59:59Z', '2026-10-25T23:00:00Z'],
  ]) {
    const nutritionToday = { date, protein: 0, proteinTarget: 80 }
    assert.equal(todayFocus({ now: before, nutritionToday }), nutrition)
    assert.equal(todayFocus({ now: after, nutritionToday }), mobility)
  }
})

test('review: no ambient Date construction, callbacks or storage access', () => {
  const RealDate = globalThis.Date
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      assert.ok(args.length, 'ambient clock read')
      super(...args)
    }
    static now() { assert.fail('ambient Date.now') }
  }
  try {
    const forbidden = () => assert.fail('side effect')
    assert.equal(todayFocus({ ...props, onStartSession: forbidden,
      storage: { getItem: forbidden, setItem: forbidden }, getNow: forbidden }), training)
    assert.equal(todayFocus(), mobility)
  } finally { globalThis.Date = RealDate }
})
