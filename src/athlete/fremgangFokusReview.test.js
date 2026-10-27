import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { install } from './fokusLoader.mjs'
import { mount, nodes, text, button } from './fokusDom.mjs'
install()
const { fokusModel } = await import('./fremgangFokusModel.mjs')
const { default: Fokus } = await import('./fremgangFokus.mjs')
const read = name => readFileSync(new URL(existsSync(new URL(name, import.meta.url)) ? name : '../' + name, import.meta.url), 'utf8')
test('review: App and AthleteView flag is default OFF and requires strict true', () => {
  const app = read('App.jsx'), athlete = read('AthleteView.jsx')
  assert.match(app, /function App\(\{[^\r\n]*fremgangFokus = false[^\r\n]*\} = \{\}\)/)
  assert.equal((app.match(/fremgangFokus: fremgangFokus === true/g) || []).length, 2)
  assert.match(athlete, /fremgangFokus = false/)
  assert.match(athlete, /factory=\{fremgangFokus === true \? fremgangFokusFactory : enkelOn \? enkelFremgangFactory : fremgangFactory\}/)
  assert.match(athlete, /: \{ blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, fremgangLinjer: fremgangLinjer === true, enkelDel: enkelOn \? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek \}\}/)
})
test('review: skipped historical sets and deload cannot create a strength measurement', () => {
  const model = fokusModel({ fremgangLogs: [
    { exercises: { name: 'Squat' }, weight: 999, reps_completed: 1, logged_at: '2026-10-01', skipped: true },
    { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } }, weight: 999, reps_completed: 1, logged_at: '2026-10-02' },
  ] })
  assert.equal(model.lifts[0].points.length, 0)
})
test('review: valid zero-load work counts; skips, zero reps, unrelated weeks do not', () => {
  const currentWeek = { sessions: [{ exercises: [{ id: 'body', name: 'Pull-up' }] }] }
  const exerciseLogs = [
    { exercise_id: 'body', set_number: 1, weight: 0, reps_completed: 5 },
    { exercise_id: 'body', set_number: 2, weight: 0, reps_completed: 0 },
    { exercise_id: 'body', set_number: 3, weight: 0, reps_completed: 5, skipped: true },
    { exercise_id: 'outside', set_number: 1, reps_completed: 5 },
  ]
  assert.equal(fokusModel({ currentWeek, exerciseLogs }).completed, 1)
})
test('review: negative development is preserved and malicious names remain text', () => {
  const props = { fremgangLogs: [
    { exercises: { name: 'Squat' }, weight: 110, reps_completed: 3, logged_at: '2026-10-01' },
    { exercises: { name: 'Squat' }, weight: 100, reps_completed: 3, logged_at: '2026-10-02' },
  ] }
  assert.match(text(mount(Fokus, props).render()), /-11 kg siden/)
  const app = mount(Fokus, { ...props, weightLogs: [{ weight: '<script>', logged_at: '2026-10-01' }] })
  nodes(app.render(), n => n.type === 'input')[0].props.onChange({ target: { checked: true } })
  assert.match(text(app.render()), /Ingen vejninger endnu/)
  assert.equal(nodes(app.render(), n => n.type === 'script').length, 0)
})
test('review: no mutation or IO even when frozen data is rendered and expanded', () => {
  const props = Object.freeze({ fremgangLogs: Object.freeze([]), weightLogs: Object.freeze([]), exerciseLogs: Object.freeze([]) })
  const app = mount(Fokus, props)
  button(app.render(), 'Se alle detaljer').props.onClick()
  assert.doesNotThrow(() => app.render())
  const fresh = mount(Fokus, props).render()
  assert.equal(nodes(fresh, n => n.props['aria-label'] === 'Kropsvægt').length, 0)
  assert.equal(button(fresh, 'Se alle detaljer').props['aria-expanded'], false)
})
