import test from 'node:test'
import assert from 'node:assert/strict'
import { fremgangLinjer, renderFremgangLinjer } from './fremgangLinjer.mjs'

const h = (tag, props, ...children) => ({ tag, props, children })
function fixture() {
  const allWeeks = ['2026-10-05', '2026-10-12', '2026-10-19'].map((start_date, i) => ({
    id: `w${i}`, week_number: i + 1, block_name: 'Styrke', start_date,
    sessions: [{ exercises: [{ id: `e${i}`, name: 'Squat' }] }],
  }))
  const logs = allWeeks.map((w, i) => ({ exercise_id: `e${i}`, weight: 100 + i * 5,
    reps_completed: 3, logged_at: `${w.start_date}T12:00:00Z` }))
  return { allWeeks, currentWeek: allWeeks[2], fremgangLogs: logs.slice(0, 2),
    exerciseLogs: logs.slice(2), now: '2026-10-25T12:00:00Z' }
}

test('R1: disabled renderer does not inspect training rows', () => {
  const bad = { get [Symbol.iterator]() { throw Error('read while disabled') } }
  assert.equal(renderFremgangLinjer(h, { fremgangLogs: bad }), null)
})

test('R1: 14 day boundary passes, same-day duplicate cannot replace a missing day', () => {
  const p = fixture()
  assert.equal(fremgangLinjer(p)[0].mode, 'comparison')
  p.fremgangLogs[1].logged_at = p.fremgangLogs[0].logged_at
  assert.equal(fremgangLinjer(p)[0].mode, 'raw')
})

test('R1: changing current set updates DOM and leaves frozen source untouched', () => {
  const p = fixture()
  p.exerciseLogs[0].weight = '112,5'
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  freeze(p)
  const dom = renderFremgangLinjer(h, { ...p, enabled: true })
  assert.equal(dom.children.length, 1)
  assert.match(dom.children[0].children[0], /112,5 kg × 3 mod 100 kg × 3/)
})

test('R1: separated program weeks cannot borrow another block baseline', () => {
  const p = fixture()
  p.allWeeks[1].week_number = 7
  const dom = renderFremgangLinjer(h, { ...p, enabled: true })
  assert.equal(dom.children[0].props['data-grundlag'], 'raw')
  assert.doesNotMatch(dom.children[0].children[0], /blokstart|e1RM/)
})

test('R1: stale fetched current set cannot override edited local set', () => {
  const p = fixture()
  p.fremgangLogs.push({ ...p.exerciseLogs[0], weight: 999 })
  p.exerciseLogs[0].weight = 90
  const r = fremgangLinjer(p)[0]
  assert.equal(r.mode, 'comparison')
  assert.equal(r.current.weight, 90)
  assert.equal(r.delta, -11)
})

test('R1: Copenhagen DST repeat is ordered by actual timestamp', () => {
  const logs = ['2026-10-25T02:30:00+01:00', '2026-10-25T02:45:00+02:00'].map((logged_at, i) => ({
    logged_at, weight: 100 + i, reps_completed: 3, exercises: { name: 'Squat' },
  }))
  const r = fremgangLinjer({ fremgangLogs: logs, now: '2026-10-25T12:00:00Z' })[0]
  assert.equal(r.latest.weight, 100)
  assert.equal(r.latest.day, '2026-10-25')
})
