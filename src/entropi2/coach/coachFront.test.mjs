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
const { coachAthleteWorkspace } = await import('./coachWorkspaceModel.mjs')
const { default: AthleteCard } = await import('./atletkort/AthleteCard.mjs')

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

test('home shows 0, 1 or 3 tasks before a closed remainder; inbox starts with ten in model order', () => {
  for (const count of [0, 1, 10]) {
    const p = fixture(count), calls = []
    // Inbox can contain more than one task for the same athlete.
    if (count === 10) for (const a of p.athletes) {
      p.latestByTrack[a.id].teknik = p.latestByTrack[a.id].besked
      p.unreadByTrack[a.id].teknik = 1
    }
    p.openCoachPriorityItem = (...args) => calls.push(args)
    const model = coachHomeModel(p, day), tree = CoachView(p)
    // Ordre 1547 (genfanget bevidst, 1544's fund): tom liste siger ikke "0 opgaver i alt" eller "0 af 0"; den rolige sætning står alene.
    // Ordre 1707: forsiden siger aldrig "n opgaver i alt"; rækkerne og "Vis resten (n)" bærer tallet.
    assert.doesNotMatch(text(tree), /opgaver? i alt/)
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
    assert.deepEqual(actions(inbox).map(n => n.props['data-coach-action']), model.inbox.slice(0, 10).map(r => r.key))
    assert.equal(actions(inbox).length, Math.min(10, model.inbox.length))
    for (const button of actions(inbox)) { button.props.onClick(); assert.equal(calls.at(-1)[1], 'inbox') }
  }
})

test('inbox reveals ten more locally, preserves every task key and callback, and keeps all conversations reachable', () => {
  for (const count of [0, 1, 10, 20, 25]) {
    const p = fixture(count), calls = []
    p.openCoachPriorityItem = (...args) => calls.push(args)
    p.openProfile = (...args) => calls.push(args)
    const expected = coachHomeModel(p, day).inbox
    const app = mount(CoachScreen, { ...p, tab: 'inbox' })
    let visible = Math.min(10, count), tree = app.render()
    for (;;) {
      assert.deepEqual(actions(tree).map(n => n.props['data-coach-action']), expected.slice(0, visible).map(r => r.key))
      // Ordre 1547 (genfanget bevidst, 1544's fund): tom liste siger ikke "0 opgaver i alt" eller "0 af 0"; den rolige sætning står alene.
      if (count === 0) {
        assert.doesNotMatch(text(tree), /opgaver i alt|0 af 0/)
        assert.equal(all(tree).find(n => n.props['data-coach-inbox-count']), undefined)
      } else {
        assert.match(text(tree), new RegExp(`${count} ${count === 1 ? 'opgave' : 'opgaver'} i alt`))
        assert.equal(text(all(tree).find(n => n.props['data-coach-inbox-count'])), `${visible} af ${count}`)
      }
      assert.ok(fold(tree, 'samtaler'))
      const more = all(tree).find(n => n.type === 'button' && text(n) === 'Vis 10 flere')
      assert.equal(Boolean(more), visible < count)
      if (!more) break
      assert.ok(more.props.style.minHeight >= 44)
      more.props.onClick()
      assert.deepEqual(calls, [], 'show-more must not navigate, send or acknowledge')
      visible = Math.min(count, visible + 10); tree = app.render()
    }
    for (const [i, button] of actions(tree).entries()) {
      button.props.onClick(); assert.deepEqual(calls.at(-1), [expected[i].item, 'inbox'])
    }
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

// Ordre 1692: Atletkort er flyttet ind i Dine atleter. Søgningen står over listen; hver række åbner atletens program.
const rowsOf = tree => all(tree).filter(n => n.props['data-u11-atlet'])
const searchBox = tree => all(tree).find(n => n.type === 'input')

test('local controlled search preserves task list, scope, full names and profile return', () => {
  const p = fixture(), calls = [], queries = []
  p.openProfile = (...args) => calls.push(args)
  const model = coachHomeModel(p, day)
  for (const query of ['', '  ÆBLE  ', 'meget langt', 'intet-match']) {
    const tree = mount(CoachScreen, { ...p, athleteQuery: query, onAthleteQueryChange: value => queries.push(value) }).render()
    const expected = model.athletes.filter(a => a.name.toLocaleLowerCase('da').includes(query.trim().toLocaleLowerCase('da')))
    assert.deepEqual(rowsOf(tree).map(n => n.props['data-u11-atlet']).sort(), expected.map(a => a.id).sort())
    assert.match(text(tree), new RegExp(`${expected.length} af 10`))
    assert.equal(text(tree).includes('Ingen match'), expected.length === 0)
    assert.deepEqual(actions(tree).map(n => n.props['data-coach-action']), model.actions.map(r => r.key))
    const input = searchBox(tree)
    assert.equal(input.props.type, 'search'); assert.ok(input.props.style.minHeight >= 44)
    input.props.onChange({ target: { value: 'ny søgning' } }); assert.equal(queries.at(-1), 'ny søgning')
    for (const row of rowsOf(tree)) {
      row.props.onClick(); assert.deepEqual(calls.at(-1)?.slice(1), ['program', 'list'])
    }
    const reset = all(tree).find(n => n.type === 'button' && text(n) === 'Nulstil søgning')
    if (query.trim()) { reset.props.onClick(); assert.equal(queries.at(-1), '') }
  }
})

test('actual enabled state boundary retains search across renders without storage or reads', () => {
  const app = mount(CoachScreen, fixture())
  const before = app.render(), input = searchBox(before)
  input.props.onChange({ target: { value: 'ÆBLE' } })
  const filtered = app.render()
  assert.match(text(filtered), /1 af 10/)
  assert.equal(actions(filtered).length, 10)
  all(filtered).find(n => n.type === 'button' && text(n) === 'Nulstil søgning').props.onClick()
  assert.match(text(app.render()), /10 af 10/)
})

test('loading, failed and empty reads cannot become search misses or task counts', () => {
  for (const state of ['loading', 'error', 'empty']) {
    const p = fixture(state === 'empty' ? 0 : 10)
    if (state === 'loading') p.loading = true
    if (state === 'error') p.loadError = true
    const tree = CoachView({ ...p, athleteQuery: 'intet-match' })
    assert.equal(rowsOf(tree).length, 0)
    assert.doesNotMatch(text(tree), /Ingen match/)
    assert.equal(actions(tree).length, 0)
    if (state !== 'empty') assert.doesNotMatch(text(tree), /opgaver i alt/)
  }
  const off = { enabled: false, get athletes() { throw Error('OFF accessed data') } }
  assert.equal(CoachScreen(off), null); assert.equal(CoachView(off), null)
})

test('actual read adapter and compact card distinguish complete empty activity from missing or invalid evidence', () => {
  const cases = [
    ['empty', () => {}, 'Ingen pas i det indlæste grundlag'],
    ['recorded', p => { p.coachActionsStatus.activity.rows = [{ athlete_id: p.athletes[0].id, logged_at: `${day}T10:00:00Z` }] }, 'Seneste pas i dag'],
    ...['partial', 'error', 'loading'].map(state => [state, p => { p.coachActionsStatus.activity.state = state }, null]),
    ['wrong athlete scope', p => { p.coachActionsStatus.activity.ids = ['synthetic-other'] }, null],
    ['wrong source day', p => { p.coachActionsStatus.activity.day = '2026-11-02' }, null],
    ['missing source', p => { delete p.coachActionsStatus.activity }, null],
    ...['not-a-date', '2026-11-04T10:00:00Z'].map(logged_at => [logged_at, p => {
      p.coachActionsStatus.activity.rows = [{ athlete_id: p.athletes[0].id, logged_at }]
    }, null]),
    ['truncated', p => { p.coachActionsStatus.activity.rows = Array.from({ length: 1000 }, () => ({ athlete_id: p.athletes[0].id, logged_at: `${day}T10:00:00Z` })) }, null],
  ]
  for (const [label, change, expected] of cases) {
    const p = fixture(1); change(p)
    const before = JSON.stringify(p), context = coachHomeModel(p, day)
    const data = coachAthleteWorkspace(p, context, p.athletes[0])
    const tree = AthleteCard({ enabled: true, facts: data.facts, compact: data.compact })
    if (expected) assert.ok(text(tree).includes(expected), label)
    else {
      assert.equal(data.facts.session, undefined, label)
      assert.doesNotMatch(text(tree), /Ingen pas|Seneste pas/, label)
    }
    assert.equal(JSON.stringify(p), before)
  }
  for (const change of [p => { p.readContext.day = '2026-11-02' }, p => { p.session.user.id = 'synthetic-other' }]) {
    const p = fixture(1); change(p)
    assert.equal(coachAthleteWorkspace(p, coachHomeModel(p, day), p.athletes[0]), null)
  }
})
