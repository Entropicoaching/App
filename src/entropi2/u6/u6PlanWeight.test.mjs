import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument } from '../onboarding/firstVisitDom.mjs'
import { planWeightLines, planWeightText, planFirstSetPrefill, plannedWeight } from './planWeight.mjs'
import { u6Enabled } from './flag.mjs'

// Kun syntetiske data: ingen navne og ingen rigtige atletrækker.
const A = 'atlet-syntetisk-u6'
const today = '2026-11-10'

test('U6 1/5: coachens planvægt vises med forskellen mod sidst; uden plan gælder sidste pas', () => {
  const exercises = [
    { id: 'ex-squat', name: 'Squat', reps: '5', recommended_weight: 142.5 },
    { id: 'ex-bench', name: 'Bænkpres', reps: '5', recommended_weight: null },
    { id: 'ex-dl', name: 'Dødløft', reps: '3', recommended_weight: 180 },
    { id: 'ex-row', name: 'Roning', reps: '10', recommended_weight: 0 },
    { id: 'ex-ny', name: 'Ny øvelse', reps: '8', recommended_weight: 40 }]
  const last = { squat: { weight: 140 }, 'bænkpres': { weight: 92.5 }, 'dødløft': { weight: 182.5 }, roning: { weight: 0 } }
  assert.deepEqual(planWeightLines(exercises, last).map(planWeightText),
    ['Squat 142,5 kg (+2,5)', 'Bænkpres 92,5 kg som sidst', 'Dødløft 180 kg (−2,5)', 'Ny øvelse 40 kg'])
  assert.equal(planWeightText({ name: 'Squat', weight: 140, source: 'plan', delta: 0 }), 'Squat 140 kg (som sidst)')
  assert.equal(plannedWeight({ recommended_weight: 0 }), null, '0 betyder vælg selv')
  assert.equal(plannedWeight({ recommended_weight: '' }), null)
})

test('U6 1/5: første sæt får planvægten; atletens eget felt bevares', () => {
  const exercises = [{ id: 'ex-squat', name: 'Squat', reps: '5', recommended_weight: 142.5 },
    { id: 'ex-bench', name: 'Bænkpres', reps: '4-6', recommended_weight: 100 },
    { id: 'ex-row', name: 'Roning', reps: '10', recommended_weight: null }]
  assert.deepEqual(planFirstSetPrefill(exercises, { 'ex-bench_1': { weight: '97,5' } }),
    { 'ex-squat_1': { weight: '142,5', reps: '5' } }, 'u8c: dansk komma i feltet')
  assert.deepEqual(planFirstSetPrefill(exercises, {})['ex-bench_1'], { weight: '100', reps: '' })
})

test('U6 1/5: flaget er slukket, indtil sidste commit tænder det', () => {
  assert.equal(u6Enabled('planWeight', true), true)
  assert.equal(u6Enabled('planWeight', false), false)
})

let React, act, createRoot, TodayCard, missing = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: TodayCard } = await import('../home/today/TodayCard.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const h = (...a) => React.createElement(...a)
async function mount(node) {
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host)
  await act(async () => root.render(node))
  return { host, text: () => host.textContent, async done() {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
  } }
}

test('U6 1/5: I dag-kortet viser "Squat 142,5 kg (+2,5)" og lægger planvægten i første sæt', gate, async () => {
  const exercises = [{ id: 'ex-squat', name: 'Squat', reps: '5', recommended_weight: 142.5 },
    { id: 'ex-bench', name: 'Bænkpres', reps: '5', recommended_weight: null }]
  const last = async () => ({ squat: { weight: 140, reps_completed: 5 }, 'bænkpres': { weight: 92.5, reps_completed: 5 } })
  let inputs = {}
  const m = await mount(h(TodayCard, { athlete: { id: A }, today, visKost: false, u6PlanWeight: true, u5ReadLastWeights: last,
    u5Training: { kind: 'today', logged: 0, total: 6, exercises }, logInputs: inputs, setLogInputs: f => { inputs = f(inputs) } }))
  try {
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.match(m.text(), /Squat 142,5 kg \(\+2,5\)/)
    assert.match(m.text(), /Bænkpres 92,5 kg som sidst/)
    assert.match(m.text(), /Coachens vægt står i første sæt/)
    assert.deepEqual(inputs, { 'ex-squat_1': { weight: '142,5', reps: '5' }, 'ex-bench_1': { weight: '92,5', reps: '5' } })
  } finally { await m.done() }
})

test('U6 1/5: med flaget slukket er kortet som i U5', gate, async () => {
  const exercises = [{ id: 'ex-squat', name: 'Squat', reps: '5', recommended_weight: 142.5 }]
  let inputs = {}
  const m = await mount(h(TodayCard, { athlete: { id: A }, today, visKost: false, u6PlanWeight: false, u5ReadLastWeights: async () => ({ squat: { weight: 140 } }),
    u5Training: { kind: 'today', logged: 0, total: 3, exercises }, logInputs: inputs, setLogInputs: f => { inputs = f(inputs) } }))
  try {
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.doesNotMatch(m.text(), /142,5/)
    assert.deepEqual(inputs, {})
  } finally { await m.done() }
})
