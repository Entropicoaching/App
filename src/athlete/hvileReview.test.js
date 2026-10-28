import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hvileLoader.mjs'
import { mount, nodes, text } from './hvileDom.mjs'
import { restDays, restDate, REST_DAY_TEXT } from './restDays.mjs'
install()
const { default: Calendar } = await import('./WeekCalendar.jsx')
const { isSessionDone } = await import('./nextSet.js').catch(() => import(new URL('../../src/nextSet.js', import.meta.url)))
const s = { id: 'training', weekday: 0, title: 'Squat', exercises: [{ id: 'ex', sets: 1 }] }
const w = { sessions: [s], coach_note: '  ' }

test('counter: completed training stays a training day and opens the real session', () => {
  let opened
  const logs = [{ exercise_id: 'ex', set_number: 1 }]
  assert.equal(isSessionDone(s, logs), true)
  const tree = mount(Calendar, { week: w, weekStart: new Date('2026-03-23T12:00:00'), exerciseLogs: logs, onOpenSession: id => { opened = id } }).render()
  const done = nodes(tree, n => n.props['data-dag'] === 'klaret')
  assert.equal(done.length, 1)
  done[0].props.onClick(); assert.equal(opened, 'training')
  assert.ok(nodes(tree, n => n.props['data-hviledag'] !== undefined).every(n => text(n).includes(REST_DAY_TEXT)))
})
test('counter: flexible training plus fixed training cannot label unassigned days as rest', () => {
  assert.deepEqual(restDays({ sessions: [s, { ...s, id: 'flex', weekday: null }] }), [])
  assert.equal(restDate(new Date('invalid'), 1), '')
  assert.equal(restDate(null, 1), '')
})
test('counter: Europe Copenhagen clock shifts use 167 and 169 hour weeks', () => {
  for (const [start, hours, sunday] of [['2026-03-23', 167, '29. mar.'], ['2026-10-19', 169, '25. okt.']]) {
    const a = new Date(start + 'T12:00:00')
    const b = new Date(a); b.setDate(b.getDate() + 7)
    // Arithmetic remains portable; this run additionally records actual local DST.
    const offsetDelta = b.getTimezoneOffset() - a.getTimezoneOffset()
    assert.equal((b - a) / 3600000, 168 + offsetDelta / 60)
    if (new Intl.DateTimeFormat('en', { timeZoneName: 'long' }).resolvedOptions().timeZone === 'Europe/Copenhagen') assert.equal((b - a) / 3600000, hours)
    assert.equal(restDate(a, 6), sunday)
  }
})
