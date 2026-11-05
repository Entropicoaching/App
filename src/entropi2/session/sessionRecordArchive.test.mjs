import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionRecordReceipts, sessionRecordReceipt } from './sessionRecordReceipt.mjs'

function fixture() {
  const exercises = ['synthetic-a', 'synthetic-b'].map(id => ({ id, name: 'Syntetisk løft', sets: 1 }))
  const sessions = exercises.map((ex, i) => ({ id: `synthetic-session-${i}`, exercises: [ex] }))
  const p = { enabled: true, athlete: { id: 'synthetic-owner' }, athleteId: 'synthetic-owner',
    currentWeek: { id: 'synthetic-week', sessions }, exerciseLogs: exercises.map(ex => ({
      id: `synthetic-row-${ex.id}`, athlete_id: 'synthetic-owner', exercise_id: ex.id,
      set_number: 1, weight: 90, reps_completed: 5 })) }
  const receipts = p.exerciseLogs.map(row => ({ key: `${row.exercise_id}_1`, id: `${row.exercise_id}_1:90:5`,
    tekst: 'Syntetisk rekord', athleteId: p.athlete.id, weekId: p.currentWeek.id, rowId: row.id }))
  return { p, receipts, store: createSessionRecordReceipts() }
}

test('an archive spans only its mounted scope and each session sees only its own confirmed receipts', () => {
  const { p, receipts, store } = fixture()
  receipts.forEach(receipt => store.remember(p, receipt))
  for (const [i, session] of p.currentWeek.sessions.entries()) {
    const visible = store.read(p).map(receipt => sessionRecordReceipt(p,
      { open: true, session, logs: p.exerciseLogs }, receipt)).filter(Boolean)
    assert.equal(visible.length, 1)
    assert.equal(visible[0].key, receipts[i].key)
  }
  store.clear()
  assert.deepEqual(store.read(p), [], 'reopening a disposed view never rebuilds records from historic rows')
})

test('loading and failed reads hide receipts until confirmed data is available again', () => {
  const { p, receipts, store } = fixture()
  store.remember(p, receipts[0])
  for (const flag of ['exerciseLogsLoading', 'exerciseLogsError']) {
    assert.deepEqual(store.read({ ...p, [flag]: true, exerciseLogs: [] }), [])
    assert.equal(store.read(p).length, 1)
  }
  p.exerciseLogs[0].athlete_id = null
  assert.deepEqual(store.read(p), [], 'an archived acknowledgement requires explicit current row ownership')
})

test('OFF clears local receipts without reading athlete, week, logs or external storage', () => {
  const { p, receipts, store } = fixture()
  store.remember(p, receipts[0])
  const off = { enabled: false }
  for (const key of ['athlete', 'currentWeek', 'exerciseLogs', 'storage'])
    Object.defineProperty(off, key, { get() { assert.fail(`OFF read: ${key}`) } })
  assert.deepEqual(store.read(off), [])
  assert.deepEqual(store.read(p), [])
})
