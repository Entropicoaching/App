import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { install } from './painCoachTestLoader.mjs'
import { expand, nodes, text, setFlag, LazyBoundary } from './painCoachTestRuntime.mjs'
install()
const { default: CoachPainHistory, PainOverview } = await import('./CoachPainHistory.mjs')
const { default: OversigtTab } = await import('../../../dashboard/OversigtTab.jsx')
const athleteId = 'synthetic-athlete', asOf = '2026-11-04', coachId = 'synthetic-coach'
const row = { day: asOf, source: 'athlete_manual', pain: 8, painLocation: 'Testknæ' }
const readinessRow = { athlete_id: athleteId, logged_date: asOf, pain: 8, pain_location: 'Testknæ' }
const data = daily => ({ state: 'ready', complete: true, athleteId, asOf, daily })
const props = { enabled: true, athleteId, coachId, asOf, weeks: 6 }
const view = (snapshot, extra = {}) => expand(PainOverview({ ...props, data: snapshot, ...extra }))

test('actual tab: lazy factory only with explicit selected-athlete pain; OFF and current legacy data have no boundary', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(asOf + 'T12:00:00Z') })
  const input = { a: { id: athleteId, user_id: 'synthetic-user' }, athleteReadiness: [readinessRow], profilesLastSeen: {},
    session: { user: { id: coachId } }, currentWeight: null, weightTrend: null }
  try {
    setFlag(true)
    const tree = OversigtTab(input)
    const boundary = nodes(tree).find(n => n.type === LazyBoundary && n.props.label === 'Smertehistorik')
    assert.ok(boundary)
    assert.deepEqual(boundary.props.componentProps, { enabled: true, athleteId, coachId, readiness: input.athleteReadiness })
    assert.equal((await boundary.props.factory()).default, CoachPainHistory)
    assert.match(text(expand(CoachPainHistory({ ...boundary.props.componentProps, asOf }))), /Testknæ/)
    const children = tree.children
    assert.ok(text(children[children.indexOf(boundary) - 1]).includes('Parathed i dag'))
    assert.ok(text(children[children.indexOf(boundary) + 1]).includes('Resultater'))
    for (const readiness of [[], [{ athlete_id: athleteId, logged_date: asOf, soreness_level: 5, sore_zones: ['Testryg'] }],
      [{ ...readinessRow, athlete_id: 'other' }], [{ ...readinessRow, pain: null }]])
      assert.equal(nodes(OversigtTab({ ...input, athleteReadiness: readiness })).filter(n => n.props.label === 'Smertehistorik').length, 0)
    for (const flag of [false, undefined, 'true', 1]) {
      setFlag(flag)
      assert.equal(nodes(OversigtTab(input)).filter(n => n.props.label === 'Smertehistorik').length, 0)
    }
  } finally { setFlag(true); mock.timers.reset() }
})

test('actual folded view: dated evidence and safe text; no section for empty/loading/error/mismatched data', () => {
  const tree = view(data([{ ...row, painLocation: 'Testknæ <script>' }]))
  assert.equal(tree.type, 'details'); assert.ok(!tree.props.open)
  assert.equal(text(tree.children[0]), 'Smerte pr. område (4-8 uger)')
  assert.equal(tree.children[0].props.style.minHeight, '44px')
  assert.match(text(tree), /6 uger/)
  assert.match(text(tree), /Flag: smerte 7\+/)
  assert.match(text(tree), /Datagrundlag: 1 af 1.*2026-11-04: 8\/10/)
  assert.equal(nodes(tree).filter(n => n.type === 'script' || n.props.dangerouslySetInnerHTML).length, 0)
  for (const daily of [[], [{ ...row, pain: null }], [{ ...row, pain: 0, painLocation: null }]]) assert.equal(view(data(daily)), null)
  for (const state of ['loading', 'error', 'off']) assert.equal(view({ state, daily: [row] }), null)
  for (const extra of [{ athleteId: 'other' }, { asOf: '2026-11-05' }]) assert.equal(view(data([row]), extra), null)
})

test('actual wrapper: literal OFF never reads scope or snapshot; no coach means no section', () => {
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(CoachPainHistory({ enabled,
    get athleteId() { throw Error('OFF scope read') }, get readiness() { throw Error('OFF data read') } }), null)
  for (const coachId of [undefined, null, '', ' ']) assert.equal(CoachPainHistory({ ...props, coachId,
    get readiness() { throw Error('missing coach data read') } }), null)
})

test('actual wrapper: props changes immediately remove old athlete/day/data; missing relation never shows error or loading', () => {
  const render = extra => expand(CoachPainHistory({ ...props, readiness: [readinessRow], ...extra }))
  assert.match(text(render()), /Testknæ/)
  for (const extra of [{ athleteId: 'other' }, { asOf: '2027-01-01' }, { readiness: [] },
    { readiness: undefined }, { readiness: { data: null, status: 404, error: { code: '42P01' } } }])
    assert.equal(render(extra), null)
  assert.match(text(render({ coachId: 'other-coach' })), /Testknæ/)
  assert.match(text(render()), /Testknæ/)
})
