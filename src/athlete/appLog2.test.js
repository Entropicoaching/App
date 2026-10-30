import { useTestRelease } from '../trin1TestProfile.mjs'
// Explicit legacy profile, loaded before the component/handler fixture.
useTestRelease(0)
await import('../udgivelseTrin.mjs')
import test from 'node:test'
import assert from 'node:assert/strict'
const { APP_LOG2_ENABLED, previousLog2Set, log2Defaults, fillLog2Input, renderLog2Button } = await import('./appLog2.mjs')
const { backendCalls, memoryStorage, syntheticElement } = await import('./appLog2Fakes.mjs')
const { lavSaetSkrivning } = await import('./saetSkrivning.js')
const { loadOfflineSets } = await import('../offlineSetQueue.js')
const history = { squat: [
  { date: '2026-10-26', sets: [{ set: 1, weight: 999, reps: 1 }] },
  { date: '2026-10-20', sets: [{ set: 1, weight: 82.5, reps: 5 }, { set: 2, weight: 77.5, reps: 6 }] },
  { date: '2026-10-15', sets: [{ set: 1, weight: 100, reps: 8 }] },
] }
const ex = { id: 'synthetic-sq', name: 'Squat', reps: '4-6', sets: 3 }
const previous = n => previousLog2Set(history, ex.name, '2026-10-26', n)

test('flaget er fra som standard uden en eksplicit buildværdi', () => {
  assert.equal(APP_LOG2_ENABLED, false)
})
test('første gang bruger plan eller tomt, aldrig en anden øvelse', () => {
  assert.equal(previousLog2Set(history, 'Rows', '2026-10-26', 1), null)
  assert.deepEqual(log2Defaults({ reps: '5', recommended_weight: '60,5' }, null), { weight: '60.5', reps: '5' })
  assert.deepEqual(log2Defaults({ reps: 'frit' }, null), { weight: '', reps: '' })
  assert.deepEqual(log2Defaults({ reps: '4-6' }, null, { weight: 50 }), { weight: '50', reps: '4' })
})
test('seneste tidligere dag og samme sætnummer, ellers sidste sæt på dagen', () => {
  assert.equal(previous(1).weight, 82.5)
  assert.equal(previous(2).weight, 77.5)
  assert.equal(previous(3).weight, 77.5)
  assert.deepEqual(log2Defaults(ex, previous(2)), { weight: '77.5', reps: '6' })
  assert.equal(previousLog2Set(history, 'Squat top', '2026-10-26', 1), null)
})
test('ændret ordination vinder over historik, interval bruger kun gyldige reps', () => {
  assert.deepEqual(log2Defaults({ ...ex, reps: '3', recommended_weight: 70 }, previous(1)), { weight: '70', reps: '3' })
  assert.equal(log2Defaults({ ...ex, reps: '8-10' }, previous(1)).reps, '8')
  assert.equal(log2Defaults({ ...ex, reps: 'frit' }, previous(1)).reps, '5')
  for (const reps of ['AMRAP', '30 sek', '8 pr. side']) assert.equal(log2Defaults({ reps }, previous(1)).reps, '')
})
test('sen historik og ændret plan opdaterer kun uberørte autofelter', () => {
  const plan = log2Defaults({ ...ex, reps: '5' }, null, { weight: 50 })
  const first = fillLog2Input(undefined, undefined, false, plan)
  assert.equal(first.weight, '50')
  const last = log2Defaults(ex, previous(1))
  assert.equal(fillLog2Input(first, plan, false, last).weight, '82.5')
  assert.equal(fillLog2Input(first, plan, true, last), null)
  assert.equal(fillLog2Input({ weight: '', reps: '' }, plan, true, last), null)
  assert.equal(fillLog2Input({ weight: '73', reps: '7' }, plan, false, last), null)
  const changed = fillLog2Input({ ...first, note: 'egen note', rpe: '7' }, plan, false, { weight: '60', reps: '3' })
  assert.deepEqual(changed, { weight: '60', reps: '3', note: 'egen note', rpe: '7' })
})

function syntheticGlobals(t) {
  for (const [key, value] of [['localStorage', memoryStorage()], ['navigator', { onLine: false }]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] })
  }
}

function harness() {
  const state = { logs: [], inputs: {}, last: null, pause: null, count: 0, errors: [] }
  const set = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value }
  const currentWeek = { id: 'synthetic-week', sessions: [{ id: 'synthetic-session', exercises: [ex] }] }
  const ref = { current: {} }
  const handlers = () => lavSaetSkrivning({ allWeeks: [currentWeek], athlete: { id: 'synthetic-athlete' }, currentWeek,
    exerciseLogs: state.logs, logInputs: state.inputs, setExerciseLogs: set('logs'), setLogInputs: set('inputs'),
    setLastLoggedSet: set('last'), setRestPause: set('pause'), setPendingSyncCount: set('count'),
    setSetConfirm: () => {}, setWriteRef: ref, showFlash: (...args) => state.errors.push(args),
    fetchExerciseLogs: () => {}, setPrToast: () => {}, setPrToastFading: () => {},
  })
  return { state, handlers }
}
const button = (onLogSet, input, extra = {}) => renderLog2Button(syntheticElement, {
  style: { minHeight: 44 }, describedBy: 'set-context', input, reps: input.reps,
  exercise: ex, setNumber: 1, totalSets: 3, plannedRpe: 8,
  askZero: () => false, acceptTap: () => true, clearZero: () => {}, onLogSet, ...extra,
})

test('syntetisk DOM: ét klik går gennem rigtig handler og storage, fortryd og genlog', async t => {
  syntheticGlobals(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { state, handlers } = harness()
  const input = { ...log2Defaults(ex, previous(1)), note: 'egen note', rpe: '' }
  const el = button(handlers().logDagensPasSet, { ...input, weight: '82,5' })
  assert.equal(el.tagName, 'BUTTON'); assert.equal(el.textContent, 'Som planlagt')
  assert.equal(el.props.type, 'button'); assert.equal(el.props['aria-describedby'], 'set-context')
  await el.click()
  assert.equal(state.logs.length, 1)
  assert.equal(state.logs[0].weight, 82.5)
  assert.equal(state.logs[0].reps_completed, 5)
  assert.equal(state.logs[0].rpe_actual, 8)
  assert.equal(state.logs[0].note, 'egen note')
  assert.equal(state.last.exerciseId, ex.id)
  assert.equal(state.inputs[ex.id + '_2'].weight, '', 'næste sæt skal have egen historik')
  const key = ex.id + '_1'
  const savedId = loadOfflineSets('synthetic-athlete')[key].clientId
  await handlers().undoLoggedSet(ex.id, 1)
  assert.equal(state.logs.length, 0); assert.equal(state.last, null); assert.equal(state.pause, null)
  assert.equal(state.inputs[key].weight, '82,5', 'fortryd bevarer det bekræftede input')
  assert.equal(loadOfflineSets('synthetic-athlete')[key].op, 'delete')
  assert.equal(loadOfflineSets('synthetic-athlete')[key].clientId, savedId)
  await button(handlers().logDagensPasSet, { ...input, weight: '80', reps: '4' }).click()
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].weight, 80)
  assert.notEqual(loadOfflineSets('synthetic-athlete')[key].op, 'delete')
  assert.deepEqual(backendCalls, [])
  assert.deepEqual(state.errors, [])
})
test('syntetisk DOM: nulkg-bekræftelse og tapværn standser skrivning', async () => {
  let writes = 0
  await button(() => writes++, { weight: '', reps: '5' }, { askZero: () => true }).click()
  await button(() => writes++, { weight: '80', reps: '5' }, { acceptTap: () => false }).click()
  assert.equal(writes, 0)
})
test('legacy-handler uden override beholder tastede tal og næste vægt', async t => {
  syntheticGlobals(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { state, handlers } = harness()
  state.inputs[ex.id + '_1'] = { weight: '91,5', reps: '6' }
  await handlers().logDagensPasSet(ex, 1, 3, '6', 7)
  assert.equal(state.logs[0].weight, 91.5)
  assert.equal(state.inputs[ex.id + '_2'].weight, '91,5')
  assert.deepEqual(backendCalls, [])
})
