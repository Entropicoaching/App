import test from 'node:test'
import assert from 'node:assert/strict'
import PrognoseView from './PrognoseView.mjs'
import { renderTree } from '../testDom.mjs'

const history = () => Array.from({ length: 10 }, (_, i) => ({ exercise_id: `synthetic-${i}`,
  logged_at: new Date(Date.UTC(2026, 8, 2 + 7 * i)).toISOString().slice(0, 10), weight: 100 + i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
const props = extra => ({ entropi2: true, now: '2026-11-04', meetDate: '2026-11-18', fremgangLogs: history(), ...extra })
const view = extra => renderTree(PrognoseView(props(extra)))

test('strict OFF returns before touching data, date or callbacks', () => {
  for (const entropi2 of [undefined, false, 1, 'true']) {
    const p = { entropi2 }
    for (const field of ['now', 'meetDate', 'fremgangLogs', 'onMeetDateChange'])
      Object.defineProperty(p, field, { get() { throw Error('OFF read: ' + field) } })
    assert.equal(PrognoseView(p), null)
  }
})

test('forecast, interval and per-lift missing data are visible, method starts folded', () => {
  const tree = view()
  assert.match(tree.textContent, /Skøn: 122 kg/)
  assert.match(tree.textContent, /Usikkerhedsinterval:/)
  assert.match(tree.textContent, /BænkpresFor lidt data/)
  assert.match(tree.textContent, /ikke et statistisk kalibreret/)
  const details = tree.querySelectorAll('details')
  assert.equal(details.length, 2)
  for (const node of details) assert.equal(node.getAttribute('open'), null)
  assert.equal(tree.querySelectorAll('input').length, 1)
})

test('empty, loading, unavailable and failed histories have honest messages', () => {
  const empty = view({ fremgangLogs: [] })
  assert.equal((empty.textContent.match(/For lidt data/g) ?? []).length, 4)
  assert.doesNotMatch(empty.textContent, /Skøn:|Usikkerhedsinterval:/)
  assert.match(view({ fremgangLoading: true }).textContent, /Henter løftehistorik/)
  for (const extra of [{ fremgangError: true }, { fremgangLogs: undefined }, { meetDate: '2026-02-30' }]) {
    const tree = view(extra)
    assert.ok(tree.querySelectorAll('[role]').some(node => node.getAttribute('role') === 'alert'))
    assert.doesNotMatch(tree.textContent, /Skøn:/)
  }
})

test('date input is labelled and controlled; changes only call the supplied callback', () => {
  const calls = [], tree = view({ onMeetDateChange: day => calls.push(day) })
  const input = tree.querySelectorAll('input')[0]
  assert.equal(input.getAttribute('type'), 'date')
  assert.equal(input.getAttribute('value'), '2026-11-18')
  assert.equal(tree.querySelectorAll('label').length, 1)
  input.dispatchEvent({ type: 'change', target: { value: '2026-12-02' } })
  assert.deepEqual(calls, ['2026-12-02'])
  assert.equal(input.getAttribute('value'), '2026-11-18')
  assert.equal(view().querySelectorAll('input')[0].getAttribute('readOnly'), 'true')
})
