import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fokusLoader.mjs'
import { mount, nodes, text, button } from './fokusDom.mjs'
install()
const { default: Fokus } = await import('./fremgangFokus.mjs')
const { fokusModel } = await import('./fremgangFokusModel.mjs')
const ex = { id: 'squat-now', name: 'Squat', sets: 3 }
const week = { id: 'week', week_number: 4, sessions: [{ exercises: [ex] }] }
const log = (name, weight, date = '2026-10-01', extra = {}) => ({ exercises: { name }, weight, reps_completed: 3, logged_at: date, ...extra })
const fixture = () => ({ currentWeek: week, allWeeks: [week], exerciseLogs: [], fremgangLogs: [log('Squat', 100), log('Squat', 110, '2026-10-20')], weightLogs: [] })
test('four exact main lifts, variants and light sets cannot inflate strength', () => {
  const props = fixture()
  props.fremgangLogs.push(log('Front squat', 500), log('Squat backoff', 400), log('Squat', 500, '2026-10-22', { reps_completed: 12 }), log('Squat', 800, '2026-10-23', { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }))
  const model = fokusModel(props)
  assert.equal(model.lifts.length, 4)
  assert.deepEqual(model.lifts[0].points.map(p => p.e1rm), [110, 121])
  const tree = mount(Fokus, props).render()
  assert.match(text(tree), /\+11 kg siden 01.10.2026/)
  assert.equal(nodes(tree, n => n.type === 'svg').length, 1)
})
test('current week local rows override history, skips and undo, with one count per set', () => {
  const props = fixture()
  props.fremgangLogs.push(log('Squat', 900, '2026-10-21', { exercise_id: ex.id }))
  props.exerciseLogs = [
    { exercise_id: ex.id, set_number: 1, weight: 100, reps_completed: 3, logged_at: '2026-10-21' },
    { exercise_id: ex.id, set_number: 1, weight: 120, reps_completed: 3, logged_at: '2026-10-21' },
    { exercise_id: ex.id, set_number: 2, skipped: true, reps_completed: 3, weight: 999 },
    { exercise_id: 'other-week', set_number: 1, reps_completed: 5 },
  ]
  assert.equal(fokusModel(props).completed, 1)
  assert.equal(fokusModel(props).lifts[0].points.at(-1).e1rm, 132)
  props.exerciseLogs = []
  assert.equal(fokusModel(props).completed, 0)
  assert.equal(fokusModel(props).lifts[0].points.at(-1).e1rm, 121)
})
test('weight requires actual checkbox handler; invalid rows omitted and input unchanged', () => {
  const props = fixture()
  props.weightLogs = [{ weight: '82,5', logged_at: '2026-10-25' }, { weight: 80, logged_at: '2026-10-01' }, { weight: Infinity, logged_at: '2026-10-26' }, { weight: 0, logged_at: 'bad' }]
  const before = JSON.stringify(props)
  const app = mount(Fokus, props)
  let tree = app.render()
  assert.equal(nodes(tree, n => n.props['aria-label'] === 'Kropsvægt').length, 0)
  nodes(tree, n => n.type === 'input')[0].props.onChange({ target: { checked: true } })
  tree = app.render()
  assert.match(text(tree), /82,5 kg den 25.10.2026/)
  assert.match(text(tree), /2,5 kg siden 01.10.2026/)
  nodes(tree, n => n.type === 'input')[0].props.onChange({ target: { checked: false } })
  assert.equal(nodes(app.render(), n => n.props['aria-label'] === 'Kropsvægt').length, 0)
  assert.equal(JSON.stringify(props), before)
})
test('details handler mounts actual original component, selectable lifts and record history', () => {
  const app = mount(Fokus, fixture())
  let tree = app.render()
  assert.equal(nodes(tree, n => n.props['aria-label'] === 'Alle fremgangsdetaljer').length, 0)
  button(tree, 'Se alle detaljer').props.onClick()
  tree = app.render()
  assert.match(text(tree), /Dine rekorder/)
  button(tree, 'Squat').props.onClick()
  tree = app.render()
  assert.match(text(tree), /Tryk på et punkt/)
  assert.equal(nodes(tree, n => n.props['data-punkt']).length, 2)
  nodes(tree, n => n.props['data-punkt'])[0].props.onClick()
  assert.match(text(app.render()), /01. okt|1. okt/)
  button(tree, 'Skjul detaljer').props.onClick()
  assert.equal(nodes(app.render(), n => n.props['aria-label'] === 'Alle fremgangsdetaljer').length, 0)
})
test('empty, one-day and loading states do not claim zero strength', () => {
  const props = fixture()
  props.fremgangLoading = true
  assert.match(text(mount(Fokus, props).render()), /Henter løftehistorik/)
  props.fremgangLoading = false; props.fremgangLogs = null
  assert.match(text(mount(Fokus, props).render()), /ikke klar endnu/)
  props.fremgangLogs = []
  assert.match(text(mount(Fokus, props).render()), /Ingen tunge sæt endnu/)
  props.fremgangLogs = [log('Squat', 100)]
  assert.match(text(mount(Fokus, props).render()), /Første måling/)
  props.currentWeek = null
  assert.match(text(mount(Fokus, props).render()), /Ingen programuge endnu/)
})
test('simple prototype details remain available', () => {
  const app = mount(Fokus, { ...fixture(), enkelOn: true, enkelDel: 'rekorder' })
  button(app.render(), 'Se alle detaljer').props.onClick()
  assert.match(text(app.render()), /Dine rekorder/)
})
