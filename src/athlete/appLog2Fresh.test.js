import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_LOG2_ENABLED, previousLog2Set, log2Defaults, fillLog2Input, renderLog2Button } from './appLog2.mjs'
import { syntheticElement } from './appLog2Fakes.mjs'

test('frisk: manglende historik og tomme dage giver plan uden mutation', () => {
  assert.equal(APP_LOG2_ENABLED, false)
  assert.equal(previousLog2Set(undefined, 'Squat', '2026-10-26', 1), null)
  const history = { squat: [{ date: '2026-10-25', sets: [] },
    { date: '2026-10-24', sets: [{ set: 2, weight: '67,5', reps: 6 }] }] }
  const before = structuredClone(history)
  const last = previousLog2Set(history, 'Squat', '2026-10-26', 1)
  assert.deepEqual(log2Defaults({ reps: '3', recommended_weight: '70,5' }, last),
    { weight: '70.5', reps: '3' })
  assert.deepEqual(history, before)
})

test('frisk: roert tomt felt og manuel rettelse overlever ny ordination', () => {
  const current = { weight: '', reps: '', note: 'egen', rpe: '6' }
  const defaults = { weight: '100', reps: '8' }
  assert.equal(fillLog2Input(current, { weight: '80', reps: '5' }, true, defaults), null)
  assert.equal(fillLog2Input({ ...current, weight: '72,5', reps: '4' }, undefined, false, defaults), null)
  assert.deepEqual(current, { weight: '', reps: '', note: 'egen', rpe: '6' })
})

test('frisk DOM: nulbekraeftelse kommer foer tapvaern og gemning', async () => {
  const calls = []
  let confirm = true
  const el = renderLog2Button(syntheticElement, { input: { weight: '0', reps: '5' },
    exercise: { id: 'synthetic-only' }, setNumber: 2, totalSets: 3, reps: '5', plannedRpe: 7,
    askZero: () => { calls.push('zero'); return confirm },
    acceptTap: () => { calls.push('tap'); return true },
    clearZero: () => calls.push('clear'), onLogSet: (...args) => calls.push(args) })
  await el.click()
  assert.deepEqual(calls, ['zero'])
  confirm = false
  await el.click()
  assert.deepEqual(calls.slice(1, 4), ['zero', 'tap', 'clear'])
  assert.deepEqual(calls[4], [{ id: 'synthetic-only' }, 2, 3, '5', 7, { weight: '0', reps: '5' }])
})

test('frisk DOM: afvist tap hverken rydder bekraeftelse eller skriver', async () => {
  const calls = []
  const el = renderLog2Button(syntheticElement, { input: { weight: '82,5', reps: '5' },
    askZero: () => false, acceptTap: () => false,
    clearZero: () => calls.push('clear'), onLogSet: () => calls.push('write') })
  await el.click()
  assert.deepEqual(calls, [])
})
