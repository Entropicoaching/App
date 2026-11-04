import test from 'node:test'
import assert from 'node:assert/strict'
import { planLift } from '../meetModel.mjs'
import { emptyResults, planFingerprint, readPlans, summarize, validResults } from './athleteMeetModel.mjs'

const source = () => ({ squat: planLift({ e1RM: 200, openerTime: '10:00' }),
  bench: planLift({ e1RM: 100 }), deadlift: planLift({ e1RM: 250 }) })
const plans = () => readPlans(source())

test('consumes actual coach module without re-proposing, rounding, aliasing or mutating selected attempts', () => {
  const input = source()
  input.squat.attempts = [172.5, 180, 187.5]
  const before = JSON.stringify(input), model = readPlans(input)
  assert.deepEqual(model.squat.attempts, [172.5, 180, 187.5])
  assert.deepEqual(model.squat.warmup, input.squat.warmup)
  assert.equal(model.squat.openerTime, '10:00')
  model.squat.attempts[0] = 2.5; model.squat.warmup[0].kg = 2.5
  assert.equal(JSON.stringify(input), before)
  assert.equal(readPlans({ squat: planLift({ e1RM: 2.5 }) }).squat.status, 'ready')
})

test('empty, failed and malformed plans stay distinct; estimates alone are not selected attempts', () => {
  for (const input of [null, undefined, {}, { squat: { status: 'empty' } }])
    assert.ok(Object.values(readPlans(input)).every(plan => plan.status === 'empty'))
  for (const input of [[], false, 'plan']) assert.ok(Object.values(readPlans(input)).every(plan => plan.status === 'error'))
  for (const plan of [{ status: 'error' }, { e1RM: 200 }, null])
    assert.equal(readPlans({ squat: plan }).squat.status, plan === null ? 'empty' : 'error')
  const base = source().squat
  for (const patch of [{ attempts: [0, 100, 110] }, { attempts: ['100', 110, 120] }, { attempts: [100, 101, 110] },
    { attempts: [100, Infinity, 110] }, { attempts: [100, 110] }, { attempts: new Array(3) },
    { warmup: new Array(1) }, { warmup: null }, { warmup: Array(21).fill(base.warmup[0]) },
    { openerTime: '24:00' }, { warmup: [{ ...base.warmup[0], reps: 0 }] },
    { warmup: [{ ...base.warmup[0], kg: 180 }] }, { warmup: [{ ...base.warmup[0], minutesBefore: -1 }] },
    { warmup: [{ ...base.warmup[0], time: '25:00' }] }, { warmup: [{ ...base.warmup[0], time: null, previousDay: true }] }])
    assert.equal(readPlans({ squat: { ...base, ...patch } }).squat.status, 'error', JSON.stringify(patch))
  assert.equal(readPlans(Object.create({ squat: base })).squat.status, 'empty')
})

test('fingerprints are stable but change with selected weights, times and missing plans', () => {
  const input = source(), original = planFingerprint(readPlans(input))
  assert.equal(original, planFingerprint(readPlans(structuredClone(input))))
  input.squat.attempts[2] = 202.5
  assert.notEqual(original, planFingerprint(readPlans(input)))
  assert.notEqual(original, planFingerprint(readPlans({ ...source(), bench: null })))
  const other = source(); other.squat.warmup[0].time = '09:24'
  assert.notEqual(original, planFingerprint(readPlans(other)))
})

test('results require three explicit outcomes per lift and reject corrupt or sparse states', () => {
  assert.equal(validResults(emptyResults()), true)
  for (const invalid of [null, [], {}, { ...emptyResults(), squat: ['pending', 'good', 'approved'] },
    { ...emptyResults(), bench: new Array(3) }, { ...emptyResults(), deadlift: ['good'] },
    { ...emptyResults(), squat: [true, 'miss', 'good'] }]) assert.equal(validResults(invalid), false)
  const a = emptyResults(), b = emptyResults(); a.squat[0] = 'good'
  assert.equal(b.squat[0], 'pending'); assert.equal(a.bench[0], 'pending')
})

test('total includes only the best approved weight for each lift and stays provisional until all attempts resolve', () => {
  const model = plans(), results = emptyResults()
  assert.equal(summarize(model, results).sum, null)
  assert.equal(summarize(model, results).status, 'empty')
  results.squat = ['good', 'miss', 'pending']
  assert.deepEqual(summarize(model, results), { status: 'partial', best: { squat: 180, bench: null, deadlift: null }, sum: 180 })
  results.bench = ['good', 'pending', 'pending']; results.deadlift = ['good', 'pending', 'pending']
  assert.equal(summarize(model, results).sum, 495)
  assert.equal(summarize(model, results).status, 'provisional-total')
  results.squat = ['good', 'miss', 'good']; results.bench = ['miss', 'good', 'miss']; results.deadlift = ['miss', 'miss', 'good']
  assert.equal(summarize(model, results).sum, 545)
  assert.equal(summarize(model, results).status, 'total')
  results.squat[2] = 'miss'
  assert.equal(summarize(model, results).sum, 525)
})

test('a missing or entirely missed lift never yields an official total; corrupt state yields no number', () => {
  const results = Object.fromEntries(['squat', 'bench', 'deadlift'].map(lift => [lift, ['miss', 'miss', 'miss']]))
  assert.equal(summarize(plans(), results).status, 'no-total')
  assert.equal(summarize(plans(), results).sum, null)
  results.squat[0] = 'good'
  assert.equal(summarize(plans(), results).status, 'no-total')
  assert.equal(summarize(plans(), results).sum, 180)
  results.bench[0] = 'good'; results.deadlift[0] = 'good'
  const missing = readPlans({ squat: source().squat })
  assert.deepEqual(summarize(missing, results), { status: 'partial', best: { squat: 180, bench: null, deadlift: null }, sum: 180 })
  assert.deepEqual(summarize(plans(), {}), { status: 'error', best: {}, sum: null })
})
