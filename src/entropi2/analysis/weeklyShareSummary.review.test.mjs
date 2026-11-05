import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyShareSummary } from './weeklyShareSummary.mjs'
import { rpeNote } from '../../rpeEvidence.mjs'

// Separate review probes; fixtures and expectations built independently of the
// producer suite. Only actual modules and synthetic snapshots are imported.
const clock = new Date('2026-11-05T15:00:00Z')
const week = { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
  { exercises: [{ id: 'review-lift', name: 'Squat', sets: 3 }] },
] }
const set = (position, weight, extra = {}) => ({ exercise_id: 'review-lift',
  set_number: position, weight, reps_completed: 3, logged_at: '2026-11-04T09:00:00Z', ...extra })
const share = (rows, extra = {}) => weeklyShareSummary({ currentWeek: week,
  exerciseLogs: rows, fremgangLogs: [], historicalMealLogs: [], ...extra }, clock)

test('review: overflowing estimate cannot hide another valid best set', () => {
  const text = share([set(1, Number.MAX_VALUE), set(2, 110)])
  assert.match(text, /Bedste sæt: Squat 110 kg × 3 \(121 kg e1RM\)/)
  assert.doesNotMatch(text, /Tonnage:|Infinity|NaN/)
})

test('review: actual note provenance is accepted and stale proof is excluded', () => {
  const row = set(1, 110, { rpe_actual: 7.5 })
  row.note = rpeNote(null, row, true)
  assert.match(share([row]), /RPE: 7,5 \(1 atletregistrering\)/)
  assert.doesNotMatch(share([{ ...row, rpe_actual: 8 }]), /RPE:/)
})

test('review: permutations preserve output and mixed exercise id types stay distinct', () => {
  const currentWeek = { ...week, sessions: [{ exercises: [
    { id: 1, name: 'Squat', sets: 1 }, { id: '1', name: 'Bænkpres', sets: 1 },
  ] }] }
  const rows = [set(1, 100, { exercise_id: 1 }), set(1, 50, { exercise_id: '1' })]
  const a = share(rows, { currentWeek })
  assert.match(a, /Pas gennemført: 1 af 1/)
  assert.match(a, /Tonnage: 450 kg/)
  assert.match(a, /Squat 100 kg × 3/)
  assert.match(a, /Bænkpres 50 kg × 3/)
  assert.equal(share([...rows].reverse(), { currentWeek }), a)
})

test('review: missing plan uses calendar week for meals and rejects normalized dates', () => {
  assert.match(share([], { currentWeek: undefined, historicalMealLogs: [
    { date: '2026-11-02', kcal: 200 }, { date: '2026-11-06', kcal: 200 },
    { date: '2026-11-00', kcal: 200 }, { date: '2026-11-02 ', kcal: 200 },
  ] }), /Kostdage logget: 1 af 7/)
  for (const sessions of [[{ exercises: [{ id: 'x', sets: 1 }, { id: 'x', sets: 1 }] }],
    [{ exercises: [{ id: '', sets: 1 }] }], [null]]) {
    assert.equal(share([], { currentWeek: { ...week, sessions } }), '')
  }
})

test('review: larger representative snapshot has only known share lines', () => {
  const rows = [set(1, 80), set(2, 90), set(3, 100)]
  const text = share(rows, { historicalMealLogs: Array.from({ length: 200 }, (_, i) =>
    ({ date: `2026-11-0${2 + i % 4}`, kcal: 100 })) })
  assert.equal(text.split('\n').length, 6)
  assert.match(text, /Tonnage: 810 kg/)
  assert.match(text, /Kostdage logget: 4 af 7/)
  assert.doesNotMatch(text, /undefined|NaN|Infinity|overtræning|klar til/)
})
