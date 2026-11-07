import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import HomeSession from '../home/HomeSession.mjs'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'
import { sessionRecordFixture } from './sessionRecordFixture.mjs'
import { rows, calls as transportCalls } from './sessionSaveBoundary.mjs'
import { guardTrainingActions } from '../../coachSelfTraining.mjs'
import { loadOfflineSets } from '../../offlineSetQueue.js'

async function mounted(Component, run, f = quickSetFixture()) {
  const doc = sessionReactDocument(), host = doc.createElement('div')
  f.p.athlete = { id: f.p.athleteId }
  f.p.currentWeek.start_date = '2026-11-02'
  f.p.now = new Date('2026-11-03T12:00:00Z'); f.p.storage = null
  const create = doc.createElement
  doc.createElement = tag => {
    const n = create(tag)
    if (tag === 'select') Object.defineProperty(n, 'options', { get: () => n.children.filter(c => c.tagName === 'OPTION') })
    return n
  }
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, setInterval() { return 1 }, clearInterval() {} }
  const originals = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const root = createRoot(host)
  const update = () => act(async () => { root.render(h(Component, { ...f.p })); await new Promise(resolve => setImmediate(resolve)) })
  const button = label => host.querySelectorAll('button').find(b => b.textContent === label)
  const press = async label => {
    const b = button(label); assert.ok(b, label); assert.equal(b.disabled, false, label)
    await act(async () => {
      if (b.events.get('click')?.size) b.click()
      else host.dispatch('click', { type: 'click', target: b, button: 0, bubbles: true, stopPropagation() {} })
      await import('./sessionView.mjs'); await new Promise(resolve => setImmediate(resolve))
    })
  }
  try { await update(); await run({ f, host, button, press, update }) }
  finally {
    await act(async () => root.unmount())
    for (const [k, value] of Object.entries(originals)) {
      if (value) Object.defineProperty(globalThis, k, value); else delete globalThis[k]
    }
  }
}

// Baseline mounted reproduction confirmed neither training skip action existed.
for (const Component of [HomeSession, SessionScreen]) test(`${Component.name}: mounted skip, inline confirmation, preservation and undo`, async () => {
  await mounted(Component, async ({ f, host, press, update, button }) => {
    const calls = []
    const skip = (id, n) => f.p.exerciseLogs.push({ athlete_id: f.p.athleteId, exercise_id: id, set_number: n, skipped: true })
    f.p.onSkipSet = (id, n, planned) => { calls.push(['set', id, n, planned]); skip(id, n) }
    f.p.onSkipExercise = ex => {
      calls.push(['exercise', ex.id])
      for (let n = 1; n <= ex.sets; n++) if (!f.p.exerciseLogs.some(r => r.exercise_id === ex.id && r.set_number === n)) skip(ex.id, n)
    }
    f.p.onUnskipSet = (id, n) => { calls.push(['undo', id, n]); f.p.exerciseLogs = f.p.exerciseLogs.filter(r => r.exercise_id !== id || r.set_number !== n) }
    const completed = { athlete_id: f.p.athleteId, exercise_id: f.exercise.id, set_number: 1, weight: 81, reps_completed: 5 }
    f.p.exerciseLogs.push(completed)
    await update(); await press('Start dagens pas')
    assert.match(host.querySelector('dialog').textContent, /Sæt 2 af 3/)
    const retained = button('Spring sættet over')
    await press('Spring sættet over'); await update()
    assert.deepEqual(calls, [['set', f.exercise.id, 2, 8]])
    assert.match(host.querySelector('dialog').textContent, /Sæt 3 af 3/)
    assert.match(host.querySelector('[data-session-skips]').textContent, /Sæt 2: Sprunget over/)
    await act(async () => retained.click()); assert.equal(calls.length, 1)
    await press('Spring øvelsen over'); assert.equal(calls.length, 1)
    assert.match(host.textContent, /1 resterende sæt/)
    await press('Annuller spring over'); assert.equal(calls.length, 1)
    await press('Spring øvelsen over'); await press('Ja, spring resten af øvelsen over'); await update()
    assert.deepEqual(calls[1], ['exercise', f.exercise.id])
    assert.equal(f.p.exerciseLogs[0], completed)
    assert.equal(f.p.exerciseLogs.filter(r => !r.skipped).length, 1)
    assert.match(host.querySelector('dialog').textContent, /Løft B/)
    await press('Fortryd spring over: Løft A, sæt 2'); await update()
    assert.match(host.querySelector('dialog').textContent, /Sæt 2 af 3/)
    assert.equal(f.p.exerciseLogs[0], completed)
    assert.equal(f.calls.length, 0, 'skip never invokes completed-set writer')
  })
})

test('mounted SessionScreen: void, queued and parked outcomes never advance or duplicate', async () => {
  for (const mode of ['void', 'queued', 'parked', 'optimistic']) await mounted(SessionScreen, async ({ f, host, press, update, button }) => {
    let calls = 0
    f.p.onSkipSet = (id, n) => {
      calls++
      if (mode !== 'void') f.p.exerciseLogs.push({ exercise_id: id, set_number: n, skipped: true, _optimistic: true })
      if (mode === 'queued') f.p.pendingSyncKeys.push(`${id}_${n}`)
      if (mode === 'parked') f.p.parkedSets.push({ exerciseId: id, setNumber: n })
    }
    await update(); await press('Start dagens pas')
    const retained = button('Spring sættet over')
    await press('Spring sættet over'); await update()
    await act(async () => retained.click())
    assert.equal(calls, 1); assert.equal(button('Spring sættet over').disabled, true)
    assert.match(host.querySelector('dialog').textContent, /Sæt 1 af 3/)
    assert.equal(host.querySelector('[data-session-skips]'), null)
    assert.equal(host.querySelector('.approve').disabled, true)
    assert.match(host.querySelector('[data-announce]').textContent, /[Aa]fventer|venter på net|synkroniseres/)
  })
})

test('mounted SessionScreen: double click, rejection and late result are bounded', async () => {
  await mounted(SessionScreen, async ({ f, host, press, update, button }) => {
    let release, calls = 0
    f.p.onSkipSet = () => { calls++; return new Promise(resolve => { release = resolve }) }
    await update(); await press('Start dagens pas')
    const retained = button('Spring sættet over')
    await press('Spring sættet over')
    await act(async () => retained.click()); assert.equal(calls, 1)
    assert.equal(host.querySelector('.approve').disabled, true)
    await act(async () => release(false)); await update()
    assert.equal(button('Spring sættet over').disabled, false)
    assert.match(host.textContent, /Handlingen kunne ikke bekræftes/)
    f.p.onSkipSet = () => { calls++; throw Error('synthetic rejection') }
    await update(); await press('Spring sættet over'); assert.equal(calls, 2)
    f.p.onSkipSet = () => { calls++; return new Promise(resolve => { release = resolve }) }
    await update(); await press('Spring sættet over')
    f.p.athleteId = 'replacement'; await update()
    await act(async () => release()); assert.equal(host.querySelector('dialog'), null)
    assert.equal(calls, 3)
  })
})

for (const mode of ['readOnly', 'exerciseLogsLoading', 'exerciseLogsError', 'programLoading', 'pendingSessionAction', 'onHoliday'])
  test(`mounted SessionScreen: ${mode} prevents skip`, async () => {
    await mounted(SessionScreen, async ({ f, host, press, update, button }) => {
      let calls = 0; f.p.onSkipSet = () => calls++; f.p.onSkipExercise = () => calls++
      await update(); await press('Start dagens pas')
      const retained = button('Spring sættet over')
      f.p[mode] = true; await update()
      await act(async () => retained.click())
      if (mode === 'readOnly') assert.equal(host.querySelector('[data-session-skip-actions]'), null)
      else assert.equal(button('Spring sættet over').disabled, true)
      assert.equal(calls, 0)
    })
  })

test('mounted HomeSession: preview/OFF and calendar expiry have no skip writes', async () => {
  await mounted(HomeSession, async ({ f, host, press, update, button }) => {
    let calls = 0; f.p.onSkipSet = () => calls++
    await update(); await press('Start dagens pas')
    const retained = button('Spring sættet over')
    f.p.now = new Date('2026-11-04T12:00:00Z'); await update()
    await act(async () => retained.click()); assert.equal(calls, 0)
    assert.equal(host.querySelector('dialog'), null)
    f.p.enabled = false; await update(); assert.equal(host.textContent, '')
  })
  await mounted(HomeSession, async ({ f, host, update }) => {
    f.p.onLogSet = undefined; f.p.setLogInputs = undefined; f.p.readOnly = true
    f.p.onSkipSet = () => assert.fail('preview'); await update()
    assert.equal(host.querySelector('dialog'), null)
    assert.equal(host.querySelector('[data-session-skip-actions]'), null)
    assert.ok(!host.querySelectorAll('button').some(b => b.textContent === 'Start dagens pas'))
  })
})

test('real mounted HomeSession uses copied guarded skip/undo actions and the original offline queue', async t => {
  const f = sessionRecordFixture(t)
  f.p.currentWeek.sessions[0].exercises.push({ id: 'later-lift', name: 'Later', sets: 1, reps: 8 })
  let allowed = true
  const actions = () => guardTrainingActions(f.handlers(), () => allowed, ['skipSet', 'skipExercise', 'unskipSet'])
  f.p.onSkipSet = (...args) => actions().skipSet(...args)
  f.p.onSkipExercise = (...args) => actions().skipExercise(...args)
  f.p.onUnskipSet = (...args) => actions().unskipSet(...args)
  await mounted(HomeSession, async ({ host, press, update, button }) => {
    await press('Start dagens pas')
    await press('Spring sættet over'); await update()
    assert.equal(transportCalls.filter(c => c.op === 'insert').length, 1)
    const saved = [...rows.values()][0]
    assert.equal(saved.skipped, true); assert.equal(saved.rpe_actual, null)
    assert.equal(saved.weight, 0); assert.equal(saved.reps_completed, 0)
    assert.equal(f.receipts.length, 0)
    assert.equal(host.querySelector('[data-rekord-fejring]'), null)
    assert.match(host.querySelector('dialog').textContent, /Sæt 1 af 2/, 'optimistic row cannot confirm success')
    f.p.exerciseLogs = [...rows.values()]; await update()
    assert.match(host.querySelector('dialog').textContent, /Sæt 2 af 2/)
    await press('Spring øvelsen over'); await press('Ja, spring resten af øvelsen over')
    f.p.exerciseLogs = [...rows.values()]; await update()
    assert.equal(transportCalls.filter(c => c.op === 'insert').length, 2)
    assert.match(host.querySelector('dialog').textContent, /Later/)
    await press('Fortryd spring over: Squat, sæt 1')
    f.p.exerciseLogs = [...rows.values()]; await update()
    assert.match(host.querySelector('dialog').textContent, /Sæt 1 af 2/)
    assert.equal(transportCalls.filter(c => c.op === 'delete').length, 1)
    const before = transportCalls.length
    allowed = false; await press('Spring sættet over'); await update()
    assert.equal(transportCalls.length, before, 'original role/lifetime action guard denies writes')
    assert.equal(button('Spring sættet over').disabled, false)
  }, f)
})

test('real mounted SessionScreen: offline skip stays in the existing queue without a completed set or transport', async t => {
  const f = sessionRecordFixture(t)
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  f.p.onSkipSet = (...args) => f.handlers().skipSet(...args)
  await mounted(SessionScreen, async ({ host, press, update, button }) => {
    await press('Start dagens pas'); await press('Spring sættet over'); await update()
    const queued = Object.values(loadOfflineSets(f.p.athleteId))
    assert.equal(queued.length, 1); assert.equal(queued[0].payload.skipped, true)
    assert.equal(transportCalls.length, 0)
    assert.match(host.querySelector('dialog').textContent, /Sæt 1 af 2/)
    assert.match(host.querySelector('[data-announce]').textContent, /venter på net/)
    assert.equal(button('Spring sættet over').disabled, true)
    assert.equal(f.receipts.length, 0)
  }, f)
})
