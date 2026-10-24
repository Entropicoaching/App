import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionSetTotal, sessionLoggedCount, isSessionDone, nextSetInSession, lastHeaviestSet } from './nextSet.js'
import { pasOverblik } from './athlete/pasOverblikModel.mjs'

const session = { id: 'pas', exercises: [{ id: 'ny', name: 'Squat', sets: 2 }] }
const log = (id, n, skipped = false) => ({ exercise_id: id, set_number: n, skipped })

test('APP-TEST7 tomt pas er neutralt med nul procent', () => {
  for (const empty of [null, {}, { exercises: [] }]) {
    assert.equal(sessionSetTotal(empty), 0)
    assert.equal(isSessionDone(empty, []), false)
    assert.equal(nextSetInSession(empty, []), null)
    assert.deepEqual(pasOverblik(empty, [], null), { rows: [], total: 0, done: 0, percent: 0 })
  }
})

test('APP-TEST7 et pas foelger oevelsesorden, og skipped er afgjort fremdrift', () => {
  const s = { exercises: [...session.exercises, { id: 'bp', name: 'Baenkpres', sets: 1 }] }
  const logs = [log('ny', 1), log('ny', 2, true)]
  const before = JSON.stringify([s, logs])
  assert.equal(sessionSetTotal(s), 3)
  assert.equal(isSessionDone(s, logs), false)
  assert.deepEqual(nextSetInSession(s, logs), { exercise: s.exercises[1], setNumber: 1, totalSets: 1 })
  const view = pasOverblik(s, logs, 'bp')
  assert.deepEqual([view.total, view.done, view.percent], [3, 2, 67])
  assert.deepEqual(view.rows[0].sets.map(r => r.status), ['Færdigt', 'Sprunget over'])
  assert.deepEqual(view.rows.map(r => r.current), [false, true])
  assert.equal(isSessionDone(s, [...logs, log('bp', 1)]), true)
  assert.equal(nextSetInSession(s, [...logs, log('bp', 1)]), null)
  assert.equal(JSON.stringify([s, logs]), before)
})

test('APP-TEST7 slettet oevelse i historik maa ikke logge en ny oevelse med samme navn', () => {
  const logs = [log('slettet', 1), log('slettet', 2)]
  assert.equal(sessionLoggedCount(session, logs), 0)
  assert.equal(isSessionDone(session, logs), false)
  assert.equal(nextSetInSession(session, logs).setNumber, 1)
  assert.equal(pasOverblik(session, logs, 'slettet').done, 0)
  assert.equal(pasOverblik(session, logs, 'slettet').rows[0].current, false)
})

test('APP-TEST7 historik paa navn bevares naar programmets oevelses-id er udskiftet', () => {
  const oldSet = { weight: 100, reps: 5, rpe: 8 }
  const history = { squat: [
    { date: '2026-10-25', sets: [{ weight: 110, reps: 3 }] },
    { date: '2026-03-29', sets: [{ weight: 80, reps: 5 }, oldSet] },
  ] }
  const before = JSON.stringify(history)
  assert.equal(lastHeaviestSet(history, 'SQUAT', '2026-10-25'), oldSet)
  assert.equal(lastHeaviestSet(history, 'Squat', '2026-03-29').weight, 110)
  assert.equal(lastHeaviestSet(history, 'Slettet assistance', '2026-10-25'), null)
  assert.equal(lastHeaviestSet({}, 'Squat', null), null)
  assert.equal(JSON.stringify(history), before)
})

test('APP-TEST7 kun dagens historik eller tomme saet giver intet tidligere saet', () => {
  assert.equal(lastHeaviestSet({ squat: [{ date: '2026-09-14', sets: [{ weight: 90 }] }] }, 'Squat', '2026-09-14'), null)
  assert.equal(lastHeaviestSet({ squat: [{ date: '2026-09-07', sets: [] }] }, 'Squat', '2026-09-14'), null)
})

test('APP-TEST7 FUND F4: dublet maa ikke afslutte pas mens naeste saet stadig mangler', () => {
  const logs = [log('ny', 1), log('ny', 1)]
  assert.equal(nextSetInSession(session, logs).setNumber, 2)
  assert.equal(pasOverblik(session, logs, null).percent, 50)
  assert.equal(isSessionDone(session, logs), false)
})
