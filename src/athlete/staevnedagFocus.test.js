import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './staevneLoader.mjs'
import { mount, nodes, text, button, io } from './staevneDom.mjs'
import { DEFAULT_STAEVNEDAG_FOKUS, isMeetDay } from './staevnedagFocus.mjs'
install()
const { default: Tab } = await import('./StaevnedagTab.jsx')
const RealDate = Date
const today = new RealDate(2026, 9, 26, 9, 30)
const date = '2026-10-26'
function withClock(run) {
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [today.getTime()])) } }
  try { return run() } finally { globalThis.Date = RealDate }
}
export function fixture(extra = {}) {
  const attempts = { squat: [{ w: '150' }, { w: '160' }, { w: '165' }], bench: [{ w: '102,5' }, { w: '' }, { w: '' }], deadlift: [{ w: '200' }, { w: '' }, { w: '' }] }
  return { athlete: { id: 'synthetic', name: 'Test Atlet', competition_date: date }, hasMeetPlan: true,
    coachAthleteId: 'preview', meetAttempts: attempts, meetType: 'sbd', meetPlanNotes: 'Aftal næste forsøg med coach',
    meetResults: [{ id: 'synthetic-result', meet_date: '2026-01-01', meet_name: 'Teststævne', total: 400 }],
    setMeetAttempts() { throw Error('Unexpected write') }, setAthlete() { throw Error('Unexpected write') },
    setMeetType() {}, showFlash() {}, ...extra }
}
const render = props => withClock(() => mount(Tab, props).render())
const focus = tree => nodes(tree, n => n.props['aria-label'] === 'Det vigtigste på stævnedagen')
function visible(tree) {
  if (tree == null || typeof tree !== 'object') return text(tree)
  const children = tree.type === 'details' && !tree.props.open ? tree.props.children.filter(n => n?.type === 'summary') : tree.props.children
  return children.map(visible).join('')
}
test('default OFF and strict explicit flag preserve legacy tree', () => {
  assert.equal(DEFAULT_STAEVNEDAG_FOKUS, false)
  const legacy = JSON.stringify(render(fixture()))
  for (const flag of [false, undefined, null, 0, 1, 'true']) {
    assert.equal(JSON.stringify(render(fixture({ staevnedagFokus: flag }))), legacy)
    assert.equal(focus(render(fixture({ staevnedagFokus: flag }))).length, 0)
  }
})
test('meet day puts current openers, warmups and times before collapsed remainder', () => {
  const tree = render(fixture({ staevnedagFokus: true }))
  assert.equal(focus(tree).length, 1)
  assert.match(visible(tree), /Dine åbnere.*Squat: 150 kg.*Bænkpres: 102.5 kg.*Dødløft: 200 kg.*Opvarmning og tidspunkter/)
  assert.equal(nodes(tree, n => n.type === 'input' && n.props.type === 'time').length, 3)
  assert.equal(nodes(tree, n => n.type === 'fieldset').length, 3)
  assert.doesNotMatch(visible(tree), /Aftal næste|Tidligere stævner|Teststævne|Konkurrencemaks/)
  assert.match(text(tree), /Aftal næste forsøg med coach.*Tidligere stævner/)
  assert.equal(tree.props.children[0], focus(tree)[0])
  for (const details of nodes(tree, n => n.type === 'details')) assert.ok(!details.props.open)
  assert.equal(io.rpc, 0)
})
test('day before, day after and no meet retain full legacy presentation', () => {
  for (const competition_date of ['2026-10-27', '2026-10-25', null, '', '2026-02-30']) {
    const base = fixture({ athlete: { id: 'synthetic', competition_date } })
    const off = render(base), on = render({ ...base, staevnedagFokus: true })
    assert.equal(JSON.stringify(on), JSON.stringify(off))
    assert.equal(focus(on).length, 0)
  }
  const noMeet = render(fixture({ athlete: {}, hasMeetPlan: false, staevnedagFokus: true }))
  assert.match(text(noMeet), /Ingen stævne/)
  assert.equal(focus(noMeet).length, 0)
})
test('bench-only and missing plan do not invent other lifts or opener weights', () => {
  const tree = render(fixture({ meetType: 'bench', staevnedagFokus: true }))
  assert.doesNotMatch(text(focus(tree)[0]), /Squat|Dødløft/)
  assert.equal(nodes(tree, n => n.type === 'fieldset').length, 1)
  const missing = render(fixture({ hasMeetPlan: false, meetAttempts: { squat: [], bench: [], deadlift: [] }, staevnedagFokus: true }))
  assert.equal((text(focus(missing)[0]).match(/Åbner mangler/g) || []).length, 3)
  assert.equal(nodes(missing, n => n.type === 'input' && n.props.type === 'time').length, 0)
})
test('actual time and warmup handlers change only local planner state', () => withClock(() => {
  const props = fixture({ meetType: 'bench', staevnedagFokus: true })
  const before = JSON.stringify(props)
  const app = mount(Tab, props)
  let tree = app.render()
  nodes(tree, n => n.type === 'input' && n.props.type === 'time')[0].props.onChange({ target: { value: '00:10' } })
  tree = app.render()
  assert.match(text(tree), /23:45 \(dagen før\)/)
  button(tree, 'Rediger med coach').props.onClick()
  tree = app.render()
  const weight = nodes(tree, n => n.type === 'input' && n.props.type === 'number' && n.props.min === 20)[0]
  weight.props.onChange({ target: { value: '22.5' } })
  button(app.render(), 'Brug i denne visning').props.onClick()
  assert.match(text(app.render()), /22.5 kg/)
  const check = nodes(app.render(), n => n.type === 'input' && n.props.type === 'checkbox')[0]
  check.props.onChange({ target: { checked: true } })
  assert.equal(nodes(app.render(), n => n.type === 'input' && n.props.type === 'checkbox')[0].props.checked, true)
  assert.equal(JSON.stringify(props), before)
  assert.equal(io.rpc, 0)
}))
test('date gate uses local calendar date including first and last minute', () => {
  for (const hour of [0, 12, 23]) assert.equal(isMeetDay(true, date, new Date(2026, 9, 26, hour, 59)), true)
  for (const d of [new Date(2026, 9, 25, 23, 59), new Date(2026, 9, 27, 0, 0), new Date(NaN)]) assert.equal(isMeetDay(true, date, d), false)
  for (const d of ['2026-10-26T00:00:00Z', '26-10-2026', '2026-10-026', {}, null]) assert.equal(isMeetDay(true, d, today), false)
})
