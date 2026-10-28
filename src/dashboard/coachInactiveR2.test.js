import './coachInactiveLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { activityDay, inactiveTraining, readCoachActivity } from './coachInactive.mjs'
import { mount, button, text, nodes } from './coachInactiveDom.mjs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const today = '2026-10-27'
const athletes = ['old', 'today', 'missing'].map(id => ({ id, name: id }))
const source = { state: 'ready', day: today, ids: athletes.map(a => a.id), rows: [
  { athlete_id: 'old', logged_at: '2026-10-24T12:00:00Z' },
  { athlete_id: 'today', logged_at: '2026-10-27T12:00:00Z' },
] }
const props = { enabled: true, today, athletes, dataStatus: { calendar: 'ready', progress: 'ready' } }

test('K1: template-only opt-in without activity capture preserves original actions without filter', () => {
  const app = mount(CoachActions, { ...props, templateMessages: true })
  const tree = app.render()
  assert.equal(nodes(tree, n => n.type === 'button' && text(n) === 'Ikke trænet i 3 dage').length, 0)
  assert.match(text(tree), /Ingen handlinger/)
  for (const state of ['loading', 'ready', 'partial', 'error']) {
    const tree = app.render({ ...props, dataStatus: { ...props.dataStatus, activity: { ...source, state } } })
    assert.equal(nodes(tree, n => n.type === 'button' && text(n) === 'Ikke trænet i 3 dage').length, 1)
  }
})

test('K2: capped descending logs retain known athletes and keep absent athletes unknown', () => {
  const rows = [...Array(999).fill(source.rows[1]), source.rows[0]]
  const m = inactiveTraining({ enabled: true, athletes, source: { ...source, state: 'partial', rows }, today })
  assert.deepEqual(m.rows.map(r => [r.athlete.id, r.days]), [['old', 3]])
  assert.equal(m.unknown, 1)
  assert.equal(m.noSessions, 0)
})

test('K3: filtered DOM explains snapshot freshness and reflects a same-day reload', () => {
  const app = mount(CoachActions, { ...props, dataStatus: { ...props.dataStatus, activity: source } })
  button(app.render(), 'Ikke trænet i 3 dage').onClick()
  let tree = app.render()
  assert.match(text(tree), /Nye pas vises efter genindlæsning/)
  assert.match(text(tree), /old: 3 dage/)
  tree = app.render({ ...props, dataStatus: { ...props.dataStatus, activity: { ...source, rows: [...source.rows, { athlete_id: 'old', logged_at: today }] } } })
  assert.equal(nodes(tree, n => n.type === 'li').length, 0)
})

test('counter: partial history still rejects invalid, future, skipped and out-of-scope evidence', () => {
  for (const row of [{ logged_at: 'bad' }, { logged_at: '2026-10-28' }, { logged_at: '2026-10-24', skipped: true }]) {
    const m = inactiveTraining({ enabled: true, athletes, source: { ...source, state: 'partial', rows: [{ athlete_id: 'old', ...row }] }, today })
    assert.equal(m.rows.length, 0)
    assert.equal(m.unknown, 3)
    assert.equal(m.noSessions, 0)
  }
})

test('counter: actual capture of a capped result is usable only for returned scoped athletes', async () => {
  let status = {}
  await readCoachActivity(true, source.ids, fn => { status = fn(status) }, () => ({ data: Array(1000).fill({ athlete_id: 'old', logged_at: '2026-10-24' }) }))
  assert.equal(status.activity.state, 'partial')
  const captured = { ...status.activity, day: today }
  const m = inactiveTraining({ enabled: true, athletes, source: captured, today })
  assert.equal(m.rows.length, 1)
  assert.equal(m.unknown, 2)
})

test('counter: missing timestamp cannot become today or hide an old log as recent activity', () => {
  const day = activityDay()
  const old = new Date(Date.parse(day + 'T00:00:00Z') - 3 * 86400000).toISOString().slice(0, 10)
  const rows = [{ athlete_id: 'old', logged_at: old }, { athlete_id: 'old' }, { athlete_id: 'missing' }, { athlete_id: 'today', logged_at: day }]
  const m = inactiveTraining({ enabled: true, athletes, source: { ...source, day, rows }, today: day })
  assert.equal(m.rows.length, 0)
  assert.equal(m.unknown, 2)
  assert.equal(m.noSessions, 0)
})
