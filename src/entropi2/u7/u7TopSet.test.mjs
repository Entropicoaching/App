import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument } from '../onboarding/firstVisitDom.mjs'
import { planWeightLines, planWeightText } from '../u6/planWeight.mjs'
import { readLastWeights } from '../home/today/todayRead.mjs'
import { u7Enabled } from './flag.mjs'

// U7 del 2: U6-kontrollens bemærkning. Hedder topsæt og backoff det samme, må "(+2,5)" ikke
// regnes mod backoff. Kun syntetiske data.
const A = 'atlet-syntetisk-u7'
const today = '2026-11-11'
const exercises = [
  { id: 'ex-top', name: 'Squat', reps: '1', recommended_weight: 142.5 },
  { id: 'ex-back', name: 'Squat', reps: '5', recommended_weight: 127.5 },
  { id: 'ex-bench', name: 'Bænkpres', reps: '5', recommended_weight: 95 },
]
// Sidste pas: topsæt 140 kl. 18.00, backoff 125 kl. 18.10 og 18.20 (seneste sæt er backoff).
const rows = [
  { weight: 125, reps_completed: 5, logged_at: '2026-11-04T17:20:00Z', skipped: false, exercises: { name: 'Squat' } },
  { weight: 125, reps_completed: 5, logged_at: '2026-11-04T17:10:00Z', skipped: false, exercises: { name: 'Squat' } },
  { weight: 145, reps_completed: 1, logged_at: '2026-11-04T17:05:00Z', skipped: true, exercises: { name: 'Squat' } },
  { weight: 140, reps_completed: 1, logged_at: '2026-11-04T17:00:00Z', skipped: false, exercises: { name: 'Squat' } },
  { weight: 92.5, reps_completed: 5, logged_at: '2026-11-04T16:30:00Z', skipped: false, exercises: { name: 'Bænkpres' } },
  { weight: 150, reps_completed: 1, logged_at: '2026-10-28T17:00:00Z', skipped: false, exercises: { name: 'Squat' } },
]
const client = { from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) }; return q } }

test('U7 2/5: sidste gang læses som dagens tungeste ikke-sprungne sæt af navnet; seneste sæt bevares', async () => {
  const map = await readLastWeights({ athleteId: A, client })
  assert.deepEqual(map.squat, { weight: 125, reps_completed: 5, top: 140 })
  assert.deepEqual(map['bænkpres'], { weight: 92.5, reps_completed: 5, top: 92.5 })
})

test('U7 2/5: "(+2,5)" regnes mod topsættet, og backoff med samme navn får ingen forskel', async () => {
  const last = await readLastWeights({ athleteId: A, client })
  const on = planWeightLines(exercises, last, { topSet: true }).map(planWeightText)
  assert.deepEqual(on, ['Squat 142,5 kg (+2,5)', 'Squat 127,5 kg', 'Bænkpres 95 kg (+2,5)'])
  // Fejlen i U6: forskellen blev regnet mod seneste sæt, som var backoff.
  const u6 = planWeightLines(exercises, last).map(planWeightText)
  assert.deepEqual(u6, ['Squat 142,5 kg (+17,5)', 'Squat 127,5 kg (+2,5)', 'Bænkpres 95 kg (+2,5)'])
  // Uden top i data (ældre læsning) virker topSet som før.
  assert.deepEqual(planWeightLines([exercises[2]], { 'bænkpres': { weight: 92.5 } }, { topSet: true }).map(planWeightText), ['Bænkpres 95 kg (+2,5)'])
})

test('U7 2/5: flaget følger samme mønster som U6', () => {
  assert.equal(u7Enabled('topSet', true), true)
  assert.equal(u7Enabled('topSet', false), false)
  assert.equal(u7Enabled('ukendt'), false)
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

for (const [u7TopSet, expected] of [[true, /Squat 142,5 kg \(\+2,5\)Squat 127,5 kg(?!\s*\()/], [false, /Squat 142,5 kg \(\+17,5\)/]]) {
  test(`U7 2/5: I dag-kortet med u7TopSet ${u7TopSet}`, gate, async () => {
    let inputs = {}
    const m = await mount(h(TodayCard, { athlete: { id: A }, today, visKost: false, u6PlanWeight: true, u7TopSet,
      u5ReadLastWeights: () => readLastWeights({ athleteId: A, client }),
      u5Training: { kind: 'today', logged: 0, total: 8, exercises }, logInputs: inputs, setLogInputs: f => { inputs = f(inputs) } }))
    try {
      await act(async () => new Promise(r => setTimeout(r, 0)))
      assert.match(m.text(), expected)
    } finally { await m.done() }
  })
}
