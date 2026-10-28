import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './followUpLoader.mjs'
import { mount, nodes, text, raw } from './followUpDom.mjs'
install()
const { default: View } = await import('./ForsideView.jsx')
const { default: Dashboard } = await import('./Dashboard.jsx')
const { loadFollowUps, saveFollowUp, followUpKey } = await import('./coachFollowUp.mjs')
const athletes = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bo' }]
function store() {
  const data = new Map()
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}
const props = () => ({ athletes, coachId: 'one', coachFollowUp: true, hiddenAthleteIds: new Set(),
  athleteSortMode: 'navn', athleteCurrentWeek: {}, calendarWeeks: {}, athleteWeekCompletion: {}, athleteWeekSummary: {},
  athleteLastLogs: {}, coachBriefingSeen: {}, coachPriorityItems: [], unreadCounts: {}, videoMeasurementByAthlete: {}, openProfile() {} })
const controls = (tree, id) => nodes(tree, n => n.props['data-follow-up-controls'] === id)[0]
const press = (tree, id, label) => nodes(controls(tree, id), n => n.type === 'button' && text(n) === label)[0].props.onClick()
const field = tree => nodes(tree, n => n.type === 'input')[0].props

test('counterexample: cancel does not mark, draft stays with athlete after sorting', () => {
  globalThis.localStorage = store()
  const view = mount(View, props())
  let tree = view.render(); press(tree, 'a', 'Følg op'); tree = view.render()
  field(tree).onChange({ target: { value: 'Draft Anna' } })
  tree = view.render(); press(tree, 'b', 'Følg op'); tree = view.render()
  nodes(controls(tree, 'b'), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  tree = view.render()
  assert.equal(field(tree).value, 'Draft Anna')
  press(tree, 'a', 'Annuller'); tree = view.render()
  assert.equal(nodes(tree, n => n.type === 'input').length, 0)
  assert.deepEqual(Object.keys(loadFollowUps(globalThis.localStorage, 'one').marks), ['b'])
})

test('counterexample: denial of localStorage getter is handled and retry recovers', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked') } })
  const view = mount(View, props())
  let tree = view.render()
  assert.match(text(tree), /Kunne ikke læse/)
  const data = store()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: data })
  press(tree, 'a', 'Prøv opfølgning igen'); tree = view.render()
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 0)
})

test('counterexample: latest persisted marks survive an independent local writer', () => {
  const storage = store()
  saveFollowUp({ storage, coachId: 'one', athletes, athleteId: 'a' })
  saveFollowUp({ storage, coachId: 'one', athletes, athleteId: 'b', note: '<script>literal note</script>' })
  const result = saveFollowUp({ storage, coachId: 'one', athletes, athleteId: 'a', remove: true })
  assert.deepEqual(Object.keys(result.marks), ['b'])
  globalThis.localStorage = storage
  const tree = mount(View, props()).render()
  assert.match(text(tree), /<script>literal note<\/script>/)
  assert.equal(nodes(tree, n => n.type === 'script').length, 0)
  assert.equal(storage.data.size, 1)
})

test('counterexample: inherited IDs never appear marked; special IDs safely roundtrip', () => {
  const storage = store(), special = [{ id: '__proto__', name: 'Synthetic' }]
  const result = saveFollowUp({ storage, coachId: 'one', athletes: special, athleteId: '__proto__', note: 'Own entry' })
  assert.equal(result.marks.__proto__, 'Own entry')
  assert.equal(loadFollowUps(storage, 'one').marks.__proto__, 'Own entry')
  assert.equal({}.polluted, undefined)
  assert.notEqual(followUpKey('one/two'), followUpKey('one%2Ftwo'))
})

test('Dashboard passes real query flag and coach identity into actual ForsideView', () => {
  globalThis.localStorage = store()
  for (const [search, expected] of [['', false], ['?coachFollowUp=0', false], ['?coachFollowUp=1', true]]) {
    globalThis.window = { location: { search }, innerWidth: 1200 }
    const tree = raw(Dashboard, { session: { user: { id: 'synthetic-coach' } } })
    const list = nodes(tree, n => n.type === View)
    assert.equal(list.length, 1)
    assert.equal(list[0].props.coachFollowUp, expected)
    assert.equal(list[0].props.coachId, 'synthetic-coach')
  }
})
