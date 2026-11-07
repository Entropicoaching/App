// Actual copied host, portal, plan adapter and report; explicit synthetic hooks
// and in-memory namespace tables only. This is not React/DOM verification.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage, createElement as h, useEffect } from './portal.fixture.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput } from './syntheticFixture.mjs'
import { meal } from '../rapport/reportFixture.mjs'
import { RECIPES } from '../opskrifter/index.mjs'

const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.includes('supabase')) throw Error('Production client forbidden')
  return next(specifier, context)
} })
const { default: PortalPlan, ActiveReport } = await import('./PortalPlan.mjs')
const { activeReportScope, startActiveReport, activeReportView } = await import('./activeReport.mjs')
const { default: CoachKostMaal } = await import('../../kostMaalKobling.mjs')
hooks.deregister()

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', date: '2026-11-05' }
const receipt = patch => ({ ...scope, state: 'ready', complete: true, planHistory: 'unavailable',
  mealLogs: [meal('2026-10-30', 'first', { athlete_id: scope.athleteId, carb: undefined, fat: undefined }),
    meal(scope.date, 'last', { athlete_id: scope.athleteId, kcal: 2500, carb: undefined, fat: undefined })], ...patch })
const props = (f, read = receipt()) => ({ enabled: true, coachId: scope.coachId, athlete: { id: scope.athleteId, protein_target: 150 },
  today: scope.date, date: scope.date, session: { user: { id: scope.coachId } }, client: f.client, nutritionRead: read })
async function activate(f, grams) {
  const { options } = syntheticInput()
  const c = createCoachPlan(options); assert.equal(c.generate(), true)
  if (grams) c.editGrams(0, 0, grams)
  await createPlanAdapter({ enabled: true, ...scope, client: f.client }).activate({ ...scope, goal: 'maintain', intensity: 10, meals: c.snapshot().meals })
  return createPlanAdapter({ enabled: true, ...scope, client: f.client }).loadActive()
}
const settle = async () => { await flush(); await flush() }
const open = tree => nodes(tree).find(n => n.type === 'details' && text(n).trim() === 'Kostplan').props.onToggle({ currentTarget: { open: true } })

test('actual production host receipt plus active namespace plan shows trailing seven days outside the unopened editor', async () => {
  const f = syntheticTables(), active = await activate(f), read = receipt(), before = structuredClone(read)
  const coachNutrition = { coachId: scope.coachId, day: scope.date, athleteIds: [scope.athleteId],
    from: '2026-10-30', through: scope.date, state: 'ready', complete: true, rows: read.mealLogs, targets: [] }
  const host = CoachKostMaal({ ...props(f), nutritionRead: undefined, coachNutrition,
    readContext: { coachId: scope.coachId, day: scope.date, athleteIds: [scope.athleteId] },
    weightStatus: { athleteId: scope.athleteId, state: 'ready', rows: [] } })
  const portal = host.props.children.find(child => child.type === PortalPlan)
  assert.equal(portal.props.nutritionRead.planHistory, 'unavailable')
  const count = f.writes().length
  const screen = mount(PortalPlan, { ...portal.props, client: f.client }, { effects: true })
  assert.equal(text(screen.render()).trim(), 'Kostplan'); await settle()
  const tree = screen.render()
  assert.match(text(tree), /Plan og registreret kost|Seneste 7 dage|2 af 7 dage med kostlog/)
  assert.match(text(tree), /3.500 kcal registreret|Ukendt registreret/)
  assert.doesNotMatch(text(tree), /Vælg måltider|Vægttrend|Ugens kost/)
  assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => !n.props.open))
  assert.equal(active.active, true)
  assert.match(text(tree), /Historisk planreference ukendt|1 af 7 dage med bekræftet planreference/)
  assert.doesNotMatch(text(tree).split('Se dage og planportioner')[0], /% af planindhold/)
  assert.equal(f.writes().length, count); assert.deepEqual(read, before)
  screen.unmount()
})

test('no table/plan preserves actuals and unknown references; no recent meal still hides without reads', async () => {
  for (const missing of [true, ...tableNames]) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode }), screen = mount(ActiveReport, props(f), { effects: true })
    screen.render(); await settle(); assert.match(text(screen.render()), /Historisk planreference ukendt/)
    assert.equal(f.writes().length, 0); screen.unmount()
  }
  const f = syntheticTables(), screen = mount(ActiveReport, props(f), { effects: true })
  screen.render(); await settle(); assert.match(text(screen.render()), /Historisk planreference ukendt/); screen.unmount()
  for (const read of [undefined, receipt({ mealLogs: [] }), receipt({ mealLogs: [meal(scope.date, 'receipt',
    { athlete_id: scope.athleteId, meal: '  [appData2-day-v1][]' })] }),
    receipt({ mealLogs: [meal('2026-10-29', 'old', { athlete_id: scope.athleteId })] })]) {
    const count = f.calls.length
    assert.equal(startActiveReport({ enabled: true, ...scope, receipt: read, client: f.client }, () => assert.fail()), undefined)
    assert.equal(f.calls.length, count)
  }
})

test('strict OFF and stale/partial/foreign receipts read neither client nor other OFF props', () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    const off = new Proxy({ enabled }, { get(target, key) { if (key !== 'enabled') throw Error('OFF read'); return target.enabled } })
    assert.equal(activeReportScope(off), null); assert.equal(startActiveReport(off, () => assert.fail()), undefined)
    assert.equal(ActiveReport(off), null)
  }
  for (const patch of [{ coachId: 'other' }, { athleteId: 'other' }, { date: '2026-11-04' },
    { state: 'loading' }, { state: 'error' }, { complete: false }]) assert.equal(activeReportScope({ enabled: true,
    ...scope, receipt: receipt(patch) }), null)
})

test('permission/transport errors are visible and retry loads the same scope without showing stale totals', async () => {
  const f = syntheticTables(), plan = await activate(f)
  // Fresh client identity: there must be no successful cached schema probe
  // before the first failed report attempt.
  const client = { from: table => f.client.from(table) }
  const screen = mount(ActiveReport, { ...props(f), client }, { effects: true })
  f.options.error = '42501'; screen.render(); await settle()
  let tree = screen.render(); assert.match(text(tree), /Historisk planreference kunne ikke bekræftes/)
  assert.match(text(tree), /3.500 kcal registreret/)
  assert.doesNotMatch(text(tree), /% af planindhold/)
  delete f.options.error
  nodes(tree).find(n => n.type === 'button').props.onClick()
  assert.equal(screen.render(), null); await settle(); tree = screen.render()
  assert.match(text(tree), /3.500 kcal registreret/)
  assert.equal(plan.active, true); screen.unmount()
})

test('schema disappearance and transport rejection are rechecked without converting errors into empty evidence', async () => {
  const f = syntheticTables(); await activate(f)
  const run = () => new Promise(resolve => startActiveReport({ enabled: true, ...scope,
    receipt: receipt(), client: f.client }, resolve))
  f.options.missing = tableNames[1]
  assert.equal((await run()).report.referenceState, 'unavailable')
  delete f.options.missing
  f.options.before = () => { throw Error('Synthetic transport failure') }
  assert.equal((await run()).report.referenceState, 'unavailable')
  delete f.options.before
  assert.equal((await run()).report.comparison, 'daily-approved-plan')
})

test('late results are cancelled and receipt/athlete/date/coach/client changes hide old evidence synchronously', async () => {
  const f = syntheticTables(); await activate(f)
  const screen = mount(ActiveReport, props(f), { effects: true })
  screen.render(); await settle(); assert.match(text(screen.render()), /3.500/)
  for (const change of [{ nutritionRead: receipt({ state: 'loading' }) }, { athlete: { id: 'other' } },
    { coachId: 'other' }, { date: '2026-11-06' }]) {
    assert.equal(screen.render(change), null)
    screen.render(props(f)); await settle(); assert.match(text(screen.render()), /3.500/)
  }
  let release; const held = new Promise(resolve => { release = resolve })
  const other = syntheticTables({ before: () => held })
  assert.equal(screen.render({ client: other.client }), null)
  await flush(); screen.unmount(); release(); await settle()
  const results = []
  const stop = startActiveReport({ enabled: true, ...scope, receipt: receipt(), loadClient: async () => {
    await held; return f.client
  } }, result => results.push(result))
  stop(); await settle(); assert.deepEqual(results, [])
})

test('successful activation refreshes report in the same open portal; draft generation alone does not', async () => {
  const f = syntheticTables(), storage = memoryStorage()
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  const screen = mount(PortalPlan, props(f), { effects: true })
  try {
    screen.render(); await settle(); let tree = screen.render()
    assert.match(text(tree), /0 af 7 dage med bekræftet planreference/)
    open(tree); screen.render(); await settle(); tree = screen.render()
    const change = (name, value) => nodes(tree).find(n => n.props.name === name).props.onChange({ currentTarget: { value } })
    change('maintenanceKcal', '2400'); change('fat', '70')
    for (let i = 0; i < 3; i++) change(`template-recipe-${i}`, RECIPES[0].id)
    tree = screen.render()
    const generate = nodes(tree).find(n => n.type === 'button' && text(n) === 'Brug måltider og generér dagsplan')
    nodes(tree).find(n => n.type === 'form' && nodes(n).includes(generate)).props.onSubmit({ preventDefault() {} })
    screen.render(); await settle(); tree = screen.render()
    assert.match(text(tree), /0 af 7 dage med bekræftet planreference/)
    await nodes(tree).find(n => n.type === 'button' && text(n) === 'Gem som kladde').props.onClick()
    tree = screen.render()
    assert.equal(await nodes(tree).find(n => n.type === 'button' && text(n) === 'Aktivér for atleten').props.onClick(), true)
    screen.render(); await settle(); tree = screen.render()
    assert.match(text(tree), /1 af 7 dage med bekræftet planreference/)
    assert.match(text(tree), /Planen er aktiveret for atleten/)
    assert.equal(nodes(tree).filter(n => n.type === 'h2' && text(n) === 'Plan og registreret kost').length, 1)
    assert.deepEqual(f.writes().map(c => c.table), tableNames)
  } finally {
    screen.unmount()
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('effect cleanup during a pending database read suppresses its completion', async () => {
  let release; const held = new Promise(resolve => { release = resolve })
  const f = syntheticTables({ before: () => held }), results = []
  function Pending() { useEffect(() => startActiveReport({ enabled: true, ...scope,
    receipt: receipt(), client: f.client }, result => results.push(result)), []); return h('p', null, 'synthetic') }
  const screen = mount(Pending, {}, { effects: true }); screen.render(); await flush()
  screen.unmount(); release(); await settle(); assert.deepEqual(results, [])
  assert.equal(activeReportView(h, { state: 'ready', report: null }), null)
})
