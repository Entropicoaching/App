import './sessionSaveRegister.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { bygGrundlag } from '../../athlete/rekorder.js'
import { saveSessionSet } from './sessionSetSave.mjs'
import { subscribeSessionRecordCelebrations, confirmedSessionRecord } from './sessionRecordCelebration.mjs'
import { sessionRecordFixture } from './sessionRecordFixture.mjs'
import { calls, mode, rows } from './sessionSaveBoundary.mjs'
import { mountSession } from './sessionView.mjs'
import { dom } from './a11y-dom.mjs'

function fixture(t, extra) {
  const f = sessionRecordFixture(t, extra)
  const dispose = subscribeSessionRecordCelebrations(() => f.p, f.clock)
  t.after(() => { dispose(); assert.equal(f.timers.size, 0) })
  return { ...f, dispose, get fetches() { return f.fetches } }
}

test('actual session-only save publishes one existing receipt in the open session with no extra reads', async t => {
  const f = fixture(t), root = dom()
  const view = mountSession(root, () => f.p, { clock: { Date, setInterval: () => 1, clearInterval() {} } })
  t.after(view.dispose); view.controller.start()
  await f.save(); view.update()
  assert.equal(f.p.exerciseLogs[0]._optimistic, false)
  assert.equal(f.p.rekordFejring.tekst, 'Ny rekord: Squat e1RM 105 kg, +12 kg')
  assert.equal(root.querySelectorAll('[data-rekord-fejring]').length, 1)
  assert.equal(root.querySelector('[data-rekord-fejring]').textContent, 'Squat · Sæt 1: Ny rekord: Squat e1RM 105 kg, +12 kg')
  assert.equal(root.querySelector('[data-rekord-fejring]').getAttribute('role'), 'status')
  assert.equal(calls.filter(c => c.op === 'select').length, 1)
  assert.equal(calls.filter(c => c.op === 'insert').length, 1)
  assert.equal(f.fetches, 1, 'only the existing writer refresh')
  assert.ok(f.writes.every(k => k === 'entropi_offline_sets:synthetic-record-owner'))
  const count = f.receipts.length
  await f.save(); view.update()
  assert.equal(f.receipts.length, count, 'a repeated acknowledgement never celebrates twice')
  for (const [id, { fn, ms }] of f.timers) { assert.equal(ms, 5000); f.timers.delete(id); fn() }
  view.update(); assert.equal(root.querySelector('[data-rekord-fejring]'), null)
})

test('offline and lost replies wait for confirmed replay and never announce twice', async t => {
  const f = fixture(t)
  globalThis.navigator.onLine = false
  assert.equal((await f.save()).phase, 'queued')
  assert.equal(f.p.rekordFejring, null); assert.equal(calls.length, 0)
  globalThis.navigator.onLine = true; mode('lost')
  await f.handlers().flushOfflineSets()
  assert.equal(f.p.rekordFejring, null); assert.equal(rows.size, 1)
  await f.handlers().flushOfflineSets()
  assert.match(f.p.rekordFejring.tekst, /Ny rekord/)
  assert.equal(f.receipts.length, 1)
  await f.handlers().flushOfflineSets(); assert.equal(f.receipts.length, 1)
})

test('late server acknowledgement can celebrate after the slow reply returned queued', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  let reply
  const pending = saveSessionSet({ athleteId: f.p.athlete.id, exerciseId: f.ex.id, setNumber: 1,
    payload: { weight: 90, reps_completed: 5 }, storage: f.p.storage, offline: () => false,
    send: () => new Promise(resolve => { reply = resolve }), confirm(row) { f.p.exerciseLogs = [row] } })
  t.mock.timers.tick(8001)
  assert.equal((await pending).phase, 'queued'); assert.equal(f.p.rekordFejring, null)
  reply({ data: { id: 'synthetic-late' }, error: null })
  await Promise.resolve(); await Promise.resolve()
  assert.match(f.p.rekordFejring.tekst, /Ny rekord/)
})

test('same loaded rules exclude first registration, missing history, light work, deload and taper', async t => {
  const f = fixture(t)
  const row = { id: 'synthetic-rule-row', athlete_id: f.p.athlete.id, exercise_id: f.ex.id,
    set_number: 1, weight: 90, reps_completed: 5 }
  for (const patch of [
    { rekordGrundlagFoer: {} }, { rekordGrundlagFoer: null }, { enabled: false }, { readOnly: true },
    { onLogSet: undefined }, { setLogInputs: undefined }, { exerciseLogsError: true }, { exerciseLogsLoading: true },
    { programError: true }, { offlineSnapshotAt: 'synthetic-time' },
    ...['Deload', 'Taper'].map(block_name => ({ currentWeek: { ...f.week, block_name } })),
    { currentWeek: { ...f.week, athlete_id: 'synthetic-foreign' } },
  ]) assert.equal(confirmedSessionRecord({ ...f.p, ...patch }, row), null, JSON.stringify(patch))
  for (const patch of [{ reps_completed: 9 }, { weight: 80 }, { skipped: true }, { _optimistic: true },
    { athlete_id: 'synthetic-foreign' }, { exercise_id: 'foreign-exercise' }, { id: null }, { set_number: 3 }])
    assert.equal(confirmedSessionRecord(f.p, { ...row, ...patch }), null, JSON.stringify(patch))
  f.ex.name = 'Squat backoff'
  assert.equal(confirmedSessionRecord(f.p, row), null)
  f.ex.name = 'Squat'
  const basis = bygGrundlag([{ navn: 'Squat', weight: 90, reps: 4 }, { navn: 'Squat', weight: 100, reps: 3 }])
  assert.match(confirmedSessionRecord({ ...f.p, rekordGrundlagFoer: basis }, row).tekst, /90 kg × 5, 1 rep mere end før/)
})

test('initial reads, refusals and empty replies cannot publish a receipt', async t => {
  const f = fixture(t)
  f.p.exerciseLogs = [{ id: 'synthetic-read', athlete_id: f.p.athlete.id, exercise_id: f.ex.id,
    set_number: 1, weight: 90, reps_completed: 5 }]
  assert.equal(f.p.rekordFejring, null)
  for (const result of [{ error: { code: '42501' } }, { data: null, error: null }]) {
    await saveSessionSet({ athleteId: f.p.athlete.id, exerciseId: f.ex.id, setNumber: 1,
      payload: { weight: 90, reps_completed: 5 }, storage: null, offline: () => false,
      send: () => result, confirm() { assert.fail('unconfirmed row') } })
    assert.equal(f.p.rekordFejring, null)
  }
})

test('only confirmed heavy sets enter this week basis; current row is excluded', t => {
  const f = fixture(t, { rekordGrundlagFoer: {} })
  const row = { id: 'synthetic-current', athlete_id: f.p.athlete.id, exercise_id: f.ex.id,
    set_number: 2, weight: 90, reps_completed: 5 }
  const prior = { ...row, id: 'synthetic-prior', set_number: 1, weight: 80 }
  assert.ok(confirmedSessionRecord(f.p, row, [prior, row]))
  for (const patch of [{ _optimistic: true }, { athlete_id: 'synthetic-other' }])
    assert.equal(confirmedSessionRecord(f.p, row, [{ ...prior, ...patch }]), null)
  assert.equal(confirmedSessionRecord({ ...f.p, pendingSyncKeys: ['record-lift_1'] }, row, [prior]), null)
  assert.equal(confirmedSessionRecord({ ...f.p, parkedSets: [{ exerciseId: f.ex.id, setNumber: 1 }] }, row, [prior]), null)
})

test('batched confirmations compare against earlier acknowledgements even before props refresh', async t => {
  const f = fixture(t)
  f.p.pendingSyncKeys = ['record-lift_1', 'record-lift_2']
  const save = (setNumber, weight) => saveSessionSet({ athleteId: f.p.athlete.id, exerciseId: f.ex.id, setNumber,
    payload: { weight, reps_completed: 5 }, storage: null, offline: () => false,
    send: () => ({ data: { id: 'synthetic-batch-' + setNumber } }), confirm() {} })
  await save(1, 100); await save(2, 90)
  assert.equal(f.receipts.length, 1)
  assert.equal(f.p.rekordFejring.id, 'record-lift_1:100:5')
})

test('undo can celebrate the same values again; dispose cancels expiry and ignores later saves', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  await f.save(); assert.equal(f.receipts.length, 1)
  await f.handlers().undoLoggedSet(f.ex.id, 1)
  assert.equal(f.p.rekordFejring, null)
  await f.save(); assert.equal(f.receipts.length, 2)
  assert.equal(f.timers.size, 1, 'repeated values replace the old expiry timer')
  f.dispose(); assert.equal(f.p.rekordFejring, null)
  await f.save(2, 100); assert.equal(f.receipts.length, 2)
})
