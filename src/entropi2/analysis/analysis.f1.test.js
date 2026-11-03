import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './testRender.mjs'
import { analysisModel } from './analysisModel.mjs'
import { adaptPublicContract } from './publicContract.mjs'

// F1: independent fixtures taken from the named review reproduction.
const now = new Date('2026-11-01T12:00:00Z')
const days = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24']
const rows = block_name => days.map((logged_at, i) => ({
  exercise_id: `f1-${i}`, logged_at, weight: 100 + 10 * i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name } } },
}))
function checkUnknown(p) {
  const props = { entropi2: true, now, ...p }
  assert.equal(adaptPublicContract(props, now).rows.length, 0)
  assert.deepEqual(analysisModel(props, now).answers.slice(0, 2).map(a => a.value),
    [undefined, undefined])
  const dom = Analysis(props)
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 0)
  assert.match(dom.textContent, /Programblokken skal v\u00e6re kendt/)
  // Ugeoversigt, 4 uger, RPE (E2-ANALYSE-RPE1), Dine rekorder (E2-ANALYSE-PR1), Volumen pr. muskelgruppe (E2-ANALYSE4) og tre spørgsmål.
  assert.equal(dom.querySelectorAll('h2').length, 8)
}
for (const block of ['', '   ', '\t\r\n', '\u00a0\u2003']) {
  test(`F1: unknown whitespace block ${JSON.stringify(block)} has no metrics`, () => {
    checkUnknown({ fremgangLogs: rows(block) })
  })
}
test('F1 positive: known block preserves the exact named reproduction metrics', () => {
  for (const block of ['Styrke', '  Styrke  ']) {
    const props = { entropi2: true, now, fremgangLogs: rows(block) }
    assert.equal(adaptPublicContract(props, now).rows.length, 4)
    assert.deepEqual(analysisModel(props, now).answers.slice(0, 2).map(a => a.value),
      ['143 kg e1RM', '+33 kg e1RM'])
    assert.equal(Analysis(props).querySelectorAll('[data-analysis-value]').length, 2)
  }
})
test('F1 local snapshot: blank program block also fails the common evidence gate', () => {
  const currentWeek = { start_date: '2026-10-26', block_name: '   ',
    sessions: [{ exercises: days.map((_, i) => ({ id: `f1-${i}`, name: 'Squat' })) }] }
  checkUnknown({ currentWeek, fremgangLogs: [], exerciseLogs: rows('Styrke').map(
    (r, i) => ({ ...r, set_number: 1, logged_at: `2026-10-${27 + i}` })) })
})
test('F1 mixed evidence: one blank day cannot supply the fourth comparable day', () => {
  const input = rows('Styrke')
  input[1].exercises.sessions.weeks.block_name = ''
  const p = { entropi2: true, now, fremgangLogs: input }
  assert.equal(adaptPublicContract(p, now).rows.length, 3)
  assert.equal(Analysis(p).querySelectorAll('[data-analysis-value]').length, 0)
})
