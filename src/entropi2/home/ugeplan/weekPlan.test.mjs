import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { weekPlanModel } from './weekPlanModel.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: WeekPlan } = await import('./WeekPlan.mjs')

const session = (id, weekday, title = id) => ({ id, weekday, title, exercises: [{ id: `e-${id}`, sets: 1 }] })
const props = (extra = {}) => ({ enabled: true, athleteId: 'synthetic-a', now: '2026-11-03T12:00:00Z',
  week: { id: 'w', athlete_id: 'synthetic-a', start_date: '2026-11-02', sessions: [
    session('a', 0), session('b', 1), session('c', 2), session('d', 6)] },
  exerciseLogs: [{ exercise_id: 'e-a', set_number: 1, logged_at: '2026-11-02T12:00:00Z' }], ...extra })
const all = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(all)] : []
const text = node => typeof node === 'string' ? node : node?.children?.map(text).join('') ?? ''

 test('shared completion, today and upcoming are displayed in one semantic row per session', () => {
  const model = weekPlanModel(props())
  assert.deepEqual(model.rows.map(r => r.label), ['Klaret', 'I dag', 'Kommende', 'Kommende'])
  assert.deepEqual(model.rows.map(r => r.day), ['Man. 2/11', 'Tir. 3/11', 'Ons. 4/11', 'Søn. 8/11'])
  const tree = WeekPlan(props()), nodes = all(tree)
  assert.equal(tree.props['aria-label'], 'Ugens plan')
  assert.equal(nodes.filter(n => n.type === 'li').length, 4)
  assert.equal(nodes.filter(n => n.type === 'time').length, 4)
  assert.equal(nodes.filter(n => n.type === 'button').length, 0)
  for (const row of nodes.filter(n => n.type === 'li')) {
    assert.equal(row.children.length, 3)
    assert.equal(row.props.style.gridTemplateColumns, '5rem minmax(0, 1fr) max-content')
  }
})

test('OFF exits before reading data, and truthy values cannot enable it', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(WeekPlan({ enabled, get week() { assert.fail('OFF reads data') } }), null)
  }
  assert.equal(WeekPlan(), null)
})

test('missing snapshot and valid empty week have distinct messages', () => {
  assert.match(text(WeekPlan({ enabled: true })), /ikke tilgængelig/)
  const p = props(); p.week.sessions = []
  assert.match(text(WeekPlan(p)), /Ingen pas planlagt/)
  for (const extra of [{ now: undefined }, { exerciseLogs: undefined }]) {
    const m = weekPlanModel(props(extra))
    assert.ok(m.state === 'missing' || m.rows.every(r => r.status === 'unknown'))
  }
})

test('foreign or missing athlete context exposes no plan titles', () => {
  for (const athleteId of [null, undefined, '', false, 'synthetic-other']) {
    assert.deepEqual(weekPlanModel(props({ athleteId })), { state: 'missing', rows: [] })
    assert.equal(all(WeekPlan(props({ athleteId }))).filter(n => n.type === 'li').length, 0)
  }
})

test('past unfinished, undated and unknown status never become upcoming or completed', () => {
  const p = props({ exerciseLogs: [] }); p.week.sessions.push(session('extra', null))
  assert.deepEqual(weekPlanModel(p).rows.map(r => r.label), ['Ikke klaret', 'I dag', 'Kommende', 'Kommende', null])
  p.week.sessions[0].exercises[0].sets = '1'
  assert.equal(weekPlanModel(p).rows[0].label, null)
  assert.equal(weekPlanModel(p).rows[4].day, null)
})

test('pending and optimistic logs never establish completion; skipped sets retain shared semantics', () => {
  for (const extra of [{ pendingSyncKeys: ['e-a_1'] }, { parkedSets: [{ exerciseId: 'e-a', setNumber: 1 }] },
    { exerciseLogs: [{ ...props().exerciseLogs[0], _optimistic: true }] }])
    assert.equal(weekPlanModel(props(extra)).rows[0].label, 'Ikke klaret')
  const p = props(); p.exerciseLogs[0].skipped = true
  const tree = WeekPlan(p)
  assert.equal(weekPlanModel(p).rows[0].label, 'Klaret')
  assert.ok(all(tree).some(n => n.props['aria-label'] === 'Klaret · 1 sæt sprunget over'))
})

test('long and unsafe-looking names stay text; missing titles have a fallback', () => {
  const p = props(); p.week.sessions[0].title = '<script>synthetic</script>' + 'x'.repeat(500)
  p.week.sessions[1].title = ' '
  const tree = WeekPlan(p), names = all(tree).filter(n => n.props.style?.textOverflow === 'ellipsis')
  assert.equal(names[0].children[0], p.week.sessions[0].title)
  assert.equal(names[0].props.title, p.week.sessions[0].title)
  assert.equal(names[1].children[0], 'Pas uden navn')
  assert.ok(!all(tree).some(n => n.props.dangerouslySetInnerHTML))
})

test('Copenhagen midnight updates labels without an ambient clock', () => {
  assert.equal(weekPlanModel(props({ now: '2026-11-03T22:59:59Z' })).rows[2].label, 'Kommende')
  assert.equal(weekPlanModel(props({ now: '2026-11-03T23:00:00Z' })).rows[2].label, 'I dag')
})

test('frozen inputs and repeated calls retain caller order and remain side-effect free', () => {
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } return x }
  const p = freeze(props()), before = JSON.stringify(p)
  assert.deepEqual(WeekPlan(p), WeekPlan(p))
  assert.equal(JSON.stringify(p), before)
  assert.deepEqual(weekPlanModel(null), { state: 'missing', rows: [] })
})
