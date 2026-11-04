import test from 'node:test'
import assert from 'node:assert/strict'
import { SIGNAL_EXPLANATIONS, getSignalExplanation } from './signalExplanations.mjs'
import { load } from '../load.mjs'
import { buildStrengthTrend } from '../strengthTrend.mjs'
import { nutritionTrend } from '../nutritionTrend.mjs'
import { weightTrend } from '../weightTrend.mjs'
import { buildAthleteSignalList } from '../signaler/athleteSignals.mjs'

test('five exact signal keys have complete, short Danish copy', () => {
  assert.deepEqual(SIGNAL_EXPLANATIONS.map(e => e.key), [
    'belastningsspring', 'plateau', 'fald i e1RM', 'lavt protein', 'hurtig vægtændring',
  ])
  for (const entry of SIGNAL_EXPLANATIONS) {
    assert.deepEqual(Object.keys(entry), ['key', 'title', 'explanation', 'dataBasis', 'conversation', 'caveat'])
    for (const text of Object.values(entry)) {
      assert.equal(typeof text, 'string')
      assert.ok(text.trim().length > 0 && text.length <= 400)
    }
    assert.equal(getSignalExplanation(entry.key), entry)
    assert.ok(entry.conversation.includes('?'))
  }
})

test('unsupported keys stay quiet without coercion or prototype lookup', () => {
  for (const key of [undefined, null, false, 1, {}, [], 'normal', '',
    ' plateau ', 'PLATEAU', '__proto__', 'constructor', 'toString',
    { toString() { throw new Error('must not coerce') } }]) {
    assert.equal(getSignalExplanation(key), null)
  }
})

test('shared copy cannot be changed through the public API', () => {
  assert.ok(Object.isFrozen(SIGNAL_EXPLANATIONS))
  for (const entry of SIGNAL_EXPLANATIONS) {
    assert.ok(Object.isFrozen(entry))
    assert.throws(() => { entry.title = 'changed' }, TypeError)
  }
  assert.throws(() => SIGNAL_EXPLANATIONS.push({}), TypeError)
  assert.equal(getSignalExplanation('plateau').title, 'Ingen ny top i estimeret styrke')
})

test('actual copied load model supports both directions and quiet boundaries', () => {
  const dates = ['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
  for (const weights of [[5, 5, 5, 10], [4, 4, 4, 2]]) {
    const result = load(dates.map((logged_at, i) => ({ logged_at,
      weight: weights[i], reps_completed: 1 })), '2026-11-04')
    assert.equal(getSignalExplanation(result.signal).key, 'belastningsspring')
  }
  assert.equal(getSignalExplanation(load([], '2026-11-04').signal), null)
  assert.match(getSignalExplanation('belastningsspring').explanation, /stigning eller et fald/)
})

test('actual copied strength model distinguishes plateau, drop and missing weeks', () => {
  const dates = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
  const trend = weights => buildStrengthTrend(weights.map((weight, i) => ({
    logged_at: dates[i], weight, reps_completed: 3, exercises: { name: 'Squat' },
  })), { today: '2026-11-03' }).lifts.find(l => l.key === 'squat')
  assert.equal(trend([100, 100, 100, 100]).plateau, true)
  assert.equal(trend([100, 100, 100, 95]).drop, false)
  assert.equal(trend([100, 100, 100, 94]).drop, true)
  assert.equal(trend([100, 100, 100]).plateau, null)
  assert.equal(trend([100, 100, 100]).drop, null)
  assert.match(getSignalExplanation('plateau').dataBasis, /fire afsluttede uger/)
  assert.match(getSignalExplanation('fald i e1RM').explanation, /mere end 5 %/)
})

test('actual copied nutrition model uses seven logged dates, including older history', () => {
  const dates = ['2026-10-01', '2026-10-03', '2026-10-10', '2026-10-19',
    '2026-10-27', '2026-11-01', '2026-11-03']
  const meals = dates.map((date, i) => ({ date, meal: 'Syntetisk måltid',
    kcal: 100, protein: i < 4 ? 7 : 10, carb: 5, fat: 2 }))
  const goals = { kcal_target: 100, protein_target: 10 }
  const result = nutritionTrend(meals, goals, dates.at(-1))
  assert.equal(getSignalExplanation(result.signal).key, 'lavt protein')
  assert.equal(result.recent.belowProtein80Days, 4)
  assert.equal(nutritionTrend(meals.slice(1), goals, dates.at(-1)).signal, null)
  assert.equal(nutritionTrend(meals, null, dates.at(-1)).signal, null)
  assert.match(getSignalExplanation(result.signal).dataBasis, /Uregistrerede dage tælles ikke som nul/)
})

test('actual copied weight model requires two changes in the same direction', () => {
  const athleteId = 'synthetic-copy-test'
  const rows = weights => weights.flatMap((weight, i) => [0, 2, 6].map(day => ({
    athlete_id: athleteId, weight,
    logged_at: new Date(Date.UTC(2026, 10, 3 - i * 7 - day)).toISOString().slice(0, 10),
  })))
  for (const weights of [[104, 102, 100], [96, 98, 100]]) {
    assert.equal(weightTrend(rows(weights), athleteId, '2026-11-03').fastChange, true)
  }
  assert.equal(weightTrend(rows([104, 102, 104]), athleteId, '2026-11-03').fastChange, false)
  assert.equal(weightTrend(rows([104, 102]), athleteId, '2026-11-03').fastChange, null)
  assert.match(getSignalExplanation('hurtig vægtændring').dataBasis, /mindst tre forskellige måledage/)
})

test('copy import leaves the existing OFF contract quiet without inspecting outputs', () => {
  assert.deepEqual(buildAthleteSignalList({ enabled: false,
    get outputs() { throw new Error('OFF read data') },
  }), [])
})
