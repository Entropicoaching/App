import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './release3-loader.mjs'
install()
const { default: Progress } = await import('./fremgangFokus.mjs')
const { default: Planner } = await import('./MeetDayPlanner.jsx')
const { mount, nodes, button, text } = await import('./rel3Dom.mjs')
const { CASES, buildRelease3Seed } = await import('./release3Flows.test.js')

test('eksaktfinale: rigtig fremgangskomponent gennem vaegt og aabn/luk detaljer', () => {
  const seed = buildRelease3Seed(CASES[0], 'progress')
  const week = { ...seed.tables.weeks[0], sessions: [{ ...seed.tables.sessions[0], exercises: seed.tables.exercises }] }
  const props = { currentWeek: week, allWeeks: [week], fremgangLoading: false,
    exerciseLogs: seed.tables.exercise_logs, fremgangLogs: seed.tables.exercise_logs, weightLogs: [] }
  const app = mount(Progress, props)
  assert.match(text(app.render()), /1 sæt gennemført i programuge 1\./)
  assert.match(text(app.render()), /Første måling\. Flere træningsdage/)
  const check = () => nodes(app.render(), n => n.type === 'input' && n.props.type === 'checkbox')[0].props
  assert.equal(check().checked, false)
  check().onChange({ target: { checked: true } })
  assert.match(text(app.render()), /Ingen vejninger endnu\./)
  button(app.render(), 'Se alle detaljer').onClick()
  assert.equal(nodes(app.render(), n => n.props['aria-label'] === 'Alle fremgangsdetaljer').length, 1)
  button(app.render(), 'Skjul detaljer').onClick()
  assert.equal(nodes(app.render(), n => n.props['aria-label'] === 'Alle fremgangsdetaljer').length, 0)
  assert.equal(nodes(mount(Progress, props).render(), n => n.props['aria-label'] === 'Kropsvægt').length, 0)
})

test('eksaktfinale: rigtig staevnekomponent, klokke, ugyldig kladde og lokal nulstilling', () => {
  const props = { meetAttempts: { squat: [{ w: 100 }], bench: [{ w: 60 }], deadlift: [{ w: 120 }] }, meetType: 'sbd', dayFocus: true }
  const before = structuredClone(props)
  const app = mount(Planner, props)
  const squat = () => nodes(app.render(), n => n.type === 'fieldset')[0]
  nodes(squat(), n => n.type === 'input' && n.props.type === 'time')[0].props.onChange({ target: { value: '14:00' } })
  assert.match(text(squat()), /13:35/)
  button(squat(), 'Rediger med coach').onClick()
  nodes(squat(), n => n.type === 'input' && n.props.type === 'number')[0].props.onChange({ target: { value: '1001' } })
  button(squat(), 'Brug i denne visning').onClick()
  assert.equal(nodes(squat(), n => n.props.role === 'alert').length, 1)
  nodes(squat(), n => n.type === 'input' && n.props.type === 'number')[0].props.onChange({ target: { value: '22.5' } })
  button(squat(), 'Brug i denne visning').onClick()
  assert.match(text(squat()), /22.5 kg/)
  assert.equal(nodes(squat(), n => n.props.role === 'alert').length, 0)
  const reopened = mount(Planner, props)
  assert.doesNotMatch(text(reopened.render()), /22.5 kg|13:35/)
  assert.deepEqual(props, before)
})
