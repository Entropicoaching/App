// Separate own review probes. All fixtures are synthetic and imports are real
// application modules; only React element creation is replaced in hermetic runs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { muscleVolume } from './muscleVolume.mjs'
import Analysis from './testRender.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const row = (id, day, name, weight, reps_completed) => ({ id, exercise_id: id,
  logged_at: day, exercises: { name }, weight, reps_completed })

test('own review: four-week ledger reconciles exact hand totals, not e1RM maxima', () => {
  const fremgangLogs = [row('a', '2026-10-12', 'Squat', '2,5', 10),
    row('b', '2026-10-18', 'Back squat', 5, 5), row('c', '2026-10-26', 'Bench', 10, 12),
    row('d', '2026-11-03', 'Unknown', 3, 10), row('e', '2026-11-04', 'Squat special', 7, 10),
    row('f', '2026-11-03', 'Squat', 5, 20), row('g', '2026-11-09', 'Squat', 999, 99)]
  const result = muscleVolume({ fremgangLogs }, now)
  const nonzero = result.weeks.map(w => w.groups.filter(g => g.sets))
  assert.deepEqual(nonzero, [
    [{ group: 'Ben', sets: 2, tonnage: 50 }], [],
    [{ group: 'Bryst', sets: 1, tonnage: 120 }],
    [{ group: 'Ben', sets: 1, tonnage: 100 }, { group: 'Øvrigt', sets: 2, tonnage: 100 }],
  ])
  assert.equal(nonzero.flat().reduce((sum, g) => sum + g.tonnage, 0), 370)
})

test('own review: incomplete tonnage is visible and does not erase the confirmed set', () => {
  const fremgangLogs = [row('a', '2026-11-03', 'Bench', '', 10)]
  const section = Analysis({ entropi2: true, now, fremgangLogs }).querySelectorAll('[data-analysis-volume]')[0]
  const rows = section.querySelectorAll('tbody').at(-1).querySelectorAll('tr')
  assert.equal(rows[1].textContent, 'Bryst1Kan ikke beregnes')
})

test('own review: volume does not create strength evidence or change navigation/OFF', () => {
  let calls = 0
  const p = { entropi2: true, now, fremgangLogs: [row('a', '2026-11-03', 'Unknown', 10, 12)],
    setTab: () => ++calls }
  const dom = Analysis(p)
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 0)
  const buttons = dom.querySelectorAll('button')
  assert.equal(buttons.length, 3)
  assert.equal(calls, 0)
  for (const button of buttons) button.dispatchEvent({ type: 'click' })
  assert.equal(calls, 3)
  assert.equal(Analysis({ entropi2: false, get now() { throw Error('OFF must be lazy') } }), null)
})
