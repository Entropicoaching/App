import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { previousLog2Set, log2Defaults, fillLog2Input, renderLog2Button } from './appLog2.mjs'
import { syntheticElement } from './appLog2Fakes.mjs'

test('modprøve: usorteret historik, fremtid og navnefamilier må ikke lække', () => {
  const history = { squat: [
    { date: '2026-10-01', sets: [{ set: 1, weight: 120, reps: 8 }] },
    { date: '2026-11-01', sets: [{ set: 1, weight: 500, reps: 1 }] },
    { date: '2026-10-20', sets: [{ set: 1, weight: 80, reps: 5 }] },
  ], 'squat top': [{ date: '2026-10-21', sets: [{ set: 1, weight: 140, reps: 2 }] }] }
  const before = JSON.stringify(history)
  assert.equal(previousLog2Set(history, 'SQUAT', '2026-10-26', 1).weight, 80)
  assert.equal(previousLog2Set(history, 'Squat top', '2026-10-26', 1).weight, 140)
  assert.equal(JSON.stringify(history), before)
})
test('modprøve: nul og ugyldige historiktal, ændret interval og coachvægt', () => {
  assert.deepEqual(log2Defaults({ reps: '5', recommended_weight: 0 }, { weight: 80, reps: 9 }), { weight: '0', reps: '5' })
  assert.deepEqual(log2Defaults({ reps: '4-6' }, { weight: 'NaN', reps: 4.5 }, { weight: '62,5' }), { weight: '62.5', reps: '4' })
  assert.equal(log2Defaults({ reps: '4-6' }, { weight: 80, reps: 7 }).reps, '4')
  assert.equal(log2Defaults({ reps: '4-6' }, { weight: 80, reps: 6 }).reps, '6')
})
test('modprøve: manuel vægt bevares når tomme reps får historik', () => {
  const current = { weight: '72,5', reps: '', note: 'min note', rpe: '9' }
  const before = JSON.stringify(current)
  assert.deepEqual(fillLog2Input(current, undefined, false, { weight: '90', reps: '6' }),
    { weight: '72,5', reps: '6', note: 'min note', rpe: '9' })
  assert.equal(JSON.stringify(current), before)
})
test('modprøve: knap sender et selvstændigt snapshot og præcis det rette sæt', async () => {
  const input = { weight: '72,5', reps: '6', note: 'min note', rpe: '9' }
  const calls = []
  const exercise = { id: 'kun-denne' }
  const el = renderLog2Button(syntheticElement, { input, exercise, setNumber: 3, totalSets: 4,
    reps: '6', plannedRpe: 7, acceptTap: () => true, askZero: () => false, clearZero: () => {},
    onLogSet: (...args) => calls.push(args) })
  await el.click()
  assert.deepEqual(calls[0], [exercise, 3, 4, '6', 7, input])
  assert.notEqual(calls[0][5], input)
  calls[0][5].weight = '100'
  assert.equal(input.weight, '72,5')
})
test('supplerende kildekontrakt: flaget styrer den faktiske kortgren', () => {
  const card = readFileSync(new URL('./DagensPasCard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(card, /log2Enabled = APP_LOG2_ENABLED/)
  assert.match(card, /log2Enabled === true \? renderLog2Button\(createElement/)
  assert.match(card, /\}\) : <button[\s\S]*?>Godkendt<\/button>\}/)
  assert.match(card, /onClick=\{\(\) => onUndoLastSet\(lastLoggedSet.exerciseId, lastLoggedSet.setNumber\)\}/)
  assert.match(card, /fillLog2Input\(current, lastAuto, touched, defaults\)/)
})
