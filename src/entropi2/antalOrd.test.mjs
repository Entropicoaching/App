import test from 'node:test'
import assert from 'node:assert/strict'
import { antalOrd } from './antalOrd.mjs'
import { analyseAtlet1Model } from '../athlete/analyseAtlet1.mjs'
import { developmentModel } from './analysis/developmentModel.mjs'
import { createCoachMessageDraft } from './coach/udkast/messageDraft.mjs'

test('Danish counts: one, zero, plural, fractions, raw strings, ranges and unknown', () => {
  for (const one of [1, '1', ' 1 ', '1.0']) assert.equal(antalOrd(one, 'dag', 'dage'), 'dag')
  for (const other of [0, -1, 2, 11, 21, 101, 1.5, '0', '2', '1-3', '1–3', '', null, undefined, NaN, Infinity, true, [1]]) {
    assert.equal(antalOrd(other, 'dag', 'dage'), 'dage', String(other))
  }
  for (const count of [0, 1, 2]) assert.equal(antalOrd(count, 'sæt', 'sæt'), 'sæt')
  assert.equal(antalOrd(1, 'logget dag', 'loggede dage'), 'logget dag')
})

const now = '2026-11-04T12:00:00Z'
const row = reps => ({ athlete_id: 'synthetic-count', exercise_id: 'synthetic-exercise', set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', weight: 100, reps_completed: reps,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } })

test('actual athlete and development models preserve values while describing a single rep/week', () => {
  for (const reps of [1, 2, 3]) {
    const props = { athlete: { id: 'synthetic-count' }, fremgangLogs: [row(reps)] }
    const before = structuredClone(props)
    const athlete = analyseAtlet1Model(props, new Date(now))
    assert.match(athlete[0].message, new RegExp(`${reps} ${reps === 1 ? 'gentagelse,' : 'gentagelser,'}`))
    const development = developmentModel(props, now)
    assert.equal(development.lifts[0].observed, 1)
    assert.match(development.lifts[0].evidence, /^1 uge med data/)
    assert.match(development.lifts[0].evidence, /1-3 gentagelser/)
    assert.deepEqual(props, before)
  }
})

test('actual coach draft: one registration/day/planned session; plural and known zero stay truthful', () => {
  for (const count of [0, 1, 2]) {
    const report = { ready: true, rows: [{ athlete: { id: 'synthetic-count' },
      training: { completed: count, planned: count, rpe: 8, rpeCount: count },
      nutrition: { logged: count, reached: count, proteinGoal: 100 } }] }
    const before = structuredClone(report)
    const draft = createCoachMessageDraft(report, 'synthetic-count')
    assert.match(draft.text, new RegExp(`${count} pas logget mod ${count} ${count === 1 ? 'planlagt\\.' : 'planlagte\\.'}`))
    assert.match(draft.text, new RegExp(`kost på ${count} af de seneste 7 dage`))
    if (count) {
      assert.match(draft.text, new RegExp(`${count} ${count === 1 ? 'registrering\\.' : 'registreringer\\.'}`))
      assert.match(draft.text, new RegExp(`på ${count} af ${count} ${count === 1 ? 'logget dag\\.' : 'loggede dage\\.'}`))
    } else assert.doesNotMatch(draft.text, /Proteinmålet|RPE/)
    assert.equal(draft.requiresCoachReview, true)
    assert.deepEqual(report, before)
  }
})
