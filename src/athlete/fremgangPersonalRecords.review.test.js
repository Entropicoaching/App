import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './frem3Loader.mjs'
import { mount, nodes, text } from './frem3Dom.mjs'
install()
const { personalRecordRows } = await import('./fremgangPersonalRecords.mjs')
const { default: Fremgang } = await import('./FremgangTab.jsx')
const log = (name, weight, reps, logged_at) => ({ exercises: { name }, weight, reps_completed: reps, logged_at })

test('counterexample: aliases combine, sumo and variants remain separate', () => {
  const logs = [log('Bench', 80, 5, '2026-10-01'), log('Bænkpres top set', 85, 5, '2026-10-08'),
    log('Dødløft', 200, 5, '2026-10-01'), log('Sumo dødløft', 250, 5, '2026-10-08'),
    log('Front squat', 200, 5, '2026-10-01')]
  const before = JSON.stringify(logs)
  const rows = personalRecordRows({ logs })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Bænkpres')
  assert.equal(rows[0].weight, 85)
  assert.equal(JSON.stringify(logs), before)
})
test('counterexample: day threshold uses Danish calendar dates', () => {
  const logs = [log('Squat', 100, 5, '2026-10-01T22:30:00Z'), log('Squat', 105, 5, '2026-10-02T10:00:00Z')]
  assert.deepEqual(personalRecordRows({ logs }), [])
  logs.push(log('Squat', 110, 5, '2026-10-03T10:00:00Z'))
  assert.equal(personalRecordRows({ logs })[0].day, '2026-10-03')
})
test('counterexample: best uses unrounded Epley value and not heaviest weight', () => {
  const logs = [log('Squat', 101, 1, '2026-10-01'), log('Squat', '100,5', 5, '2026-10-02')]
  assert.equal(personalRecordRows({ logs })[0].weight, 100.5)
  const ties = [log('Squat', 105, 2, '2026-10-09'), log('Squat', 96, 5, '2026-10-01')]
  assert.equal(personalRecordRows({ logs: ties })[0].day, '2026-10-01')
})
test('counterexample: real picker handler still switches lifts with flag enabled', () => {
  const logs = [log('Squat', 100, 5, '2026-10-01'), log('Squat', 105, 5, '2026-10-08'),
    log('Bench', 70, 5, '2026-10-01'), log('Bench', 75, 5, '2026-10-08')]
  const app = mount(Fremgang, { fremgangLogs: logs, currentWeek: { sessions: [] }, allWeeks: [],
    exerciseLogs: [], personalRecords: true })
  const tree = app.render()
  const bench = nodes(tree, n => n.type === 'button' && text(n) === 'Bænkpres')[0]
  assert.ok(bench)
  bench.props.onClick()
  const next = app.render()
  assert.match(text(nodes(next, n => n.props['data-fremgang-linje'] !== undefined)[0]), /Bænkpres/)
  assert.equal(nodes(next, n => n.props['data-personal-record'] !== undefined).length, 2)
})
