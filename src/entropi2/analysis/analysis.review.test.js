import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './testRender.mjs'
import { analysisModel } from './analysisModel.mjs'
import { adaptPublicContract } from './publicContract.mjs'

const now = new Date('2026-11-01T12:00:00Z')
const days = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']
const row = (day, weight, name = 'Squat') => ({ exercise_id: name + day,
  weight, reps_completed: 3, logged_at: day + 'T10:00:00Z',
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } } })
const rows = () => days.map((d, i) => row(d, 100 + 5 * i))
const model = fremgangLogs => analysisModel({ fremgangLogs }, now)

test('review: strongest same-day set wins; extra sets do not inflate day count', () => {
  const input = [...rows(), row(days[3], 80)]
  // Same timestamp with conflicting value is deliberately ambiguous: no winner.
  assert.equal(model(input).answers[0].value, undefined)
  input.at(-1).logged_at = days[3] + 'T11:00:00Z'
  assert.equal(model(input).answers[0].value, '127 kg e1RM')
  assert.equal(model(input.slice(1)).answers[0].value, undefined)
})
test('review: different offsets on one Danish day cannot establish independent days', () => {
  const input = ['2026-10-25T00:00:00Z', '2026-10-25T01:00:00+01:00',
    '2026-10-25T02:00:00Z', '2026-10-25T03:00:00Z'].map((timestamp, i) => ({
      ...row(days[i], 100), logged_at: timestamp }))
  assert.equal(model(input).answers[0].value, undefined)
})
test('review: overflow and invalid clock times never establish strength', () => {
  for (const change of [{ weight: Number.MAX_VALUE }, { logged_at: '2026-10-25T24:00:00Z' },
    { logged_at: '2026-10-25T10:60:00Z' }]) {
    const input = rows(); input[3] = { ...input[3], ...change }
    assert.equal(model(input).answers[0].value, undefined)
  }
})
test('review: local snapshot cannot borrow a set from outside its dated week', () => {
  const currentWeek = { start_date: '2026-10-26', block_name: 'Styrke',
    sessions: [{ exercises: [{ id: 'local', name: 'Squat' }] }] }
  const fremgangLogs = rows(); fremgangLogs[3].exercise_id = 'local'
  const p = { currentWeek, fremgangLogs, exerciseLogs: [{ ...fremgangLogs[3], set_number: 1 }] }
  assert.equal(analysisModel(p, now).answers[0].value, undefined)
  assert.equal(adaptPublicContract(p, now).rows.length, 3)
})
test('review: positive answer may select a different qualified lift; no invented readiness', () => {
  const flat = rows().map(r => ({ ...r, weight: 100, logged_at: r.logged_at.replace('10:00', '11:00') }))
  const positive = days.map((d, i) => row(d, 60 + 5 * i, 'Bench'))
  const dom = Analysis({ entropi2: true, now, fremgangLogs: [...flat, ...positive] })
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 2)
  assert.match(dom.textContent, /Bænkpres/)
  assert.doesNotMatch(dom.textContent, /parathed:\s*\d|klar til|fordi|overtræning/)
})
