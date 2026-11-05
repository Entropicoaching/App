// Actual copied modules, synthetic hooks/element tree. This is not a real React test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text } from '../../athlete/prog5Dom.mjs'
import { productionFixture, day } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'

const runtime = new URL('../../athlete/prog5Dom.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(runtime)};
  export const useMemo = fn => fn(); export const useCallback = fn => fn;
  export const Fragment = Symbol.for('coach-front.fragment');`)
registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react' ? { url: react, shortCircuit: true } : next(specifier, context)
} })
const { default: CoachScreen, CoachView } = await import('./CoachScreen.mjs')
const { default: Workspace } = await import('./CoachAthleteWorkspace.mjs')

function fixture(count = 10) {
  const p = productionFixture(), ids = Array.from({ length: count }, (_, i) => `synthetic-${i}`)
  p.athletes = ids.map((id, i) => ({ id, name: i === 0 ? 'Syntetisk Æble' : `Syntetisk atlet ${i} med et meget langt konstrueret navn` }))
  p.readContext.athleteIds = ids
  p.calendarWeeks = Object.fromEntries(ids.map(id => [id, []]))
  p.coachActionsStatus.activity = { state: 'ready', day, ids, rows: [] }
  p.coachMorningData.messages = { state: 'ready', day, ids, rows: [] }
  p.coachMorningData.videos = { state: 'ready', day, ids, rows: [] }
  p.latestByTrack = Object.fromEntries(ids.map((id, i) => [id, { besked: {
    athlete_id: id, content: 'Syntetisk besked', created_at: `${day}T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z` } }]))
  p.unreadByTrack = Object.fromEntries(ids.map(id => [id, { besked: 1 }]))
  delete p.coachNutrition
  return p
}
const all = tree => nodes(tree, () => true)
const actions = tree => all(tree).filter(n => n.props['data-coach-action'])
const fold = (tree, name) => all(tree).find(n => n.props['data-coach-fold'] === name)

test('home shows 0, 1 or 3 tasks before a closed remainder; inbox keeps every task and callback', () => {
  for (const count of [0, 1, 10]) {
    const p = fixture(count), calls = []
    // Inbox can contain more than one task for the same athlete.
    if (count === 10) for (const a of p.athletes) {
      p.latestByTrack[a.id].teknik = p.latestByTrack[a.id].besked
      p.unreadByTrack[a.id].teknik = 1
    }
    p.openCoachPriorityItem = (...args) => calls.push(args)
    const model = coachHomeModel(p, day), tree = CoachView(p)
    assert.match(text(tree), new RegExp(`${count} ${count === 1 ? 'opgave' : 'opgaver'} i alt`))
    assert.deepEqual(actions(tree).map(n => n.props['data-coach-action']), model.actions.map(r => r.key))
    const rest = fold(tree, 'opgaver')
    assert.equal(Boolean(rest), count > 3)
    if (rest) {
      assert.notEqual(rest.props.open, true)
      assert.match(text(rest), /Vis resten \(7\)/)
      assert.equal(actions(rest).length, 7)
      assert.equal(actions(tree).length - actions(rest).length, 3)
      assert.ok(all(rest).find(n => n.type === 'summary').props.style.minHeight >= 44)
    }
    for (const [index, button] of actions(tree).entries()) {
      button.props.onClick(); assert.deepEqual(calls.at(-1), [model.actions[index].item, 'list'])
    }
    const inbox = CoachView({ ...p, tab: 'inbox' })
    assert.equal(fold(inbox, 'opgaver'), undefined)
    assert.deepEqual(actions(inbox).map(n => n.props['data-coach-action']), model.inbox.map(r => r.key))
    assert.equal(actions(inbox).length, count === 10 ? 20 : count)
    for (const button of actions(inbox)) { button.props.onClick(); assert.equal(calls.at(-1)[1], 'inbox') }
  }
})

test('program task callbacks in the folded remainder retain the same profile tab and return route', () => {
  const p = fixture(), calls = []
  p.latestByTrack = {}; p.unreadByTrack = {}
  p.calendarWeeks = Object.fromEntries(p.athletes.map(a => [a.id, [{ start_date: '2026-10-12', exercise_count: 1, week_number: 1 }]]))
  p.openProfile = (...args) => calls.push(args)
  const model = coachHomeModel(p, day), rest = fold(CoachView(p), 'opgaver')
  assert.equal(actions(rest).length, 7)
  for (const [index, b] of actions(rest).entries()) {
    b.props.onClick(); assert.deepEqual(calls.at(-1), [model.actions[index + 3].athlete, 'program', 'list'])
  }
})

test('local controlled search preserves model order, task list, scope, full names and profile return', () => {
  const p = fixture(), calls = [], queries = []
  p.athletes.push({ id: 'foreign', name: 'Syntetisk skjult' })
  p.openProfile = (...args) => calls.push(args)
  const model = coachHomeModel(p, day)
  for (const query of ['', '  ÆBLE  ', 'meget langt', 'intet-match']) {
    const tree = CoachView({ ...p, athleteQuery: query, onAthleteQueryChange: value => queries.push(value) })
    const list = fold(tree, 'atleter'), workspaces = all(list).filter(n => n.type === Workspace)
    const expected = model.summaries.filter(row => row.athlete.name.toLocaleLowerCase('da').includes(query.trim().toLocaleLowerCase('da')))
    assert.deepEqual(workspaces.map(n => n.props.athlete.id), expected.map(r => r.athlete.id))
    assert.match(text(list), new RegExp(`${expected.length} af 10`))
    assert.equal(text(list).includes('Ingen match'), expected.length === 0)
    assert.deepEqual(actions(tree).map(n => n.props['data-coach-action']), model.actions.map(r => r.key))
    const input = all(list).find(n => n.type === 'input')
    assert.equal(input.props.type, 'search'); assert.ok(input.props.style.minHeight >= 44)
    input.props.onChange({ target: { value: 'ny søgning' } }); assert.equal(queries.at(-1), 'ny søgning')
    for (const workspace of workspaces) {
      workspace.props.onOpen(); assert.deepEqual(calls.at(-1), [workspace.props.athlete, 'hub', 'list'])
    }
    const reset = all(list).find(n => n.type === 'button' && text(n) === 'Nulstil søgning')
    if (query.trim()) { reset.props.onClick(); assert.equal(queries.at(-1), '') }
  }
})

test('actual enabled state boundary retains search across renders without storage or reads', () => {
  const app = mount(CoachScreen, fixture())
  const before = app.render(), input = all(before).find(n => n.type === 'input')
  input.props.onChange({ target: { value: 'ÆBLE' } })
  const filtered = app.render()
  assert.match(text(fold(filtered, 'atleter')), /1 af 10/)
  assert.equal(actions(filtered).length, 10)
  all(fold(filtered, 'atleter')).find(n => n.type === 'button' && text(n) === 'Nulstil søgning').props.onClick()
  assert.match(text(fold(app.render(), 'atleter')), /10 af 10/)
})

test('loading, failed and empty reads cannot become search misses or task counts', () => {
  for (const state of ['loading', 'error', 'empty']) {
    const p = fixture(state === 'empty' ? 0 : 10)
    if (state === 'loading') p.loading = true
    if (state === 'error') p.loadError = true
    const tree = CoachView({ ...p, athleteQuery: 'intet-match' })
    assert.equal(fold(tree, 'atleter'), undefined)
    assert.doesNotMatch(text(tree), /Ingen match/)
    assert.equal(actions(tree).length, 0)
    if (state !== 'empty') assert.doesNotMatch(text(tree), /opgaver i alt/)
  }
  const off = { enabled: false, get athletes() { throw Error('OFF accessed data') } }
  assert.equal(CoachScreen(off), null); assert.equal(CoachView(off), null)
})
