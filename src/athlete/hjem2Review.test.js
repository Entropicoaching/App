// Separate adversarial run against the same delivered modules and JSX handlers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hjem2Loader.mjs'
import { createElement, nodes, text } from './hjem2Dom.mjs'
const hooks = install()
const { nextTrainingHome, renderNextTrainingHome } = await import('./nextTrainingHome.mjs')
const sess = (id, weekday) => ({ id, weekday, title: id, exercises: [{ id, name: 'Squat', sets: 1 }] })
const w = (id, week_number, start_date, sessions) => ({ id, week_number, start_date, sessions })
const active = w('active', 7, '2026-10-19', [])
const args = weeks => ({ enabled: true, allWeeks: weeks, currentWeek: active, exerciseLogs: [], now: new Date('2026-10-25T12:00Z') })

test('counterexample: next week starts with a rest day; do not invent Monday training', () => {
  const next = w('next', 8, '2026-10-26', [sess('Thursday', 3)])
  const model = nextTrainingHome(args([active, next]))
  assert.equal(model.date, '2026-10-29')
  assert.equal(model.day, 'Torsdag')
})
test('counterexample: future dated week outranks higher undated week numbers', () => {
  const first = w('first', 8, '2026-10-26', [sess('first', 1)])
  const later = w('later', 9, null, [sess('later', 0)])
  assert.equal(nextTrainingHome(args([later, first, active])).title, 'first')
})
test('counterexample: future completion and foreign logs do not hide next real session', () => {
  const next = w('next', 8, '2026-10-26', [sess('done', 0), sess('open', 2)])
  const a = args([active, next]); a.exerciseLogs = [{ exercise_id: 'done', set_number: 1 }, { exercise_id: 'foreign', set_number: 1 }]
  assert.equal(nextTrainingHome(a).title, 'open')
})
test('counterexample: invalid weekdays never become real appointments', () => {
  const bad = w('bad', 8, '2026-10-26', [sess('seven', 7), sess('string', '0'), sess('negative', -1)])
  assert.equal(nextTrainingHome(args([active, bad])).kind, 'no-next')
})
test('counterexample: text resembling markup remains literal children, with one navigation action', () => {
  const next = w('next', 8, '2026-10-26', [sess('<img src=x onerror=send()>', 0)])
  const model = nextTrainingHome(args([active, next]))
  let calls = 0
  const dom = renderNextTrainingHome(createElement, model, () => { calls++ })
  assert.match(text(dom), /<img src=x onerror=send\(\)>/)
  assert.equal(nodes(dom, n => n.type === 'img').length, 0)
  assert.equal(calls, 0)
  const buttons = nodes(dom, n => n.type === 'button')
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].props.type, 'button')
  buttons[0].props.onClick(); assert.equal(calls, 1)
})
test('counterexample: frozen program and logs are not mutated', () => {
  const freeze = obj => { if (obj && typeof obj === 'object') { Object.values(obj).forEach(freeze); Object.freeze(obj) }; return obj }
  const data = freeze(args([active, w('next', 8, '2026-10-26', [sess('next', 0)])]))
  assert.equal(nextTrainingHome(data).date, '2026-10-26')
})
test.after(() => hooks.deregister())
