import test from 'node:test'
import assert from 'node:assert/strict'
import { createKostDaySession } from './daySession.mjs'
import { createNutritionController } from '../../nutrition/controller.mjs'
import { remainingToday } from '../../nutrition/startModel.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'

const profile = Object.freeze({ id: athleteId, kcal_target: 2400, protein_target: 160 })
function pair(t, f, scope = {}, athlete = profile) {
  const session = createKostDaySession({ enabled: true, athleteId: athlete.id, date, client: f.client, storage: f.storage, ...scope })
  const tracker = createNutritionController({ enabled: true, athlete, date: scope.date || date,
    contracts: session.contracts, storage: f.storage })
  t.after(() => { tracker.dispose(); session.dispose() })
  return { session, day: session.controller, tracker }
}
const two = targets => ({ kcal: targets.kcal, protein: targets.protein })
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }

test('daily targets: actual session replaces profile reference with the same immutable approved version, without tracker plan reads or writes', async t => {
  const f = fixture(); f.approve()
  freeze(f.plan.data)
  const input = JSON.stringify(f.plan.data), p = pair(t, f)
  assert.deepEqual(p.tracker.snapshot().targets, { kcal: 2400, protein: 160 })
  await p.day.load(); await p.tracker.load()
  const s = p.tracker.snapshot(), day = p.day.snapshot()
  assert.deepEqual(s.targets, { kcal: 500, protein: 50 })
  assert.deepEqual(s.targets, two(day.targets))
  assert.deepEqual(s.targetReference, { source: 'approved-plan', state: 'ready', planId: day.planId, revision: day.planRevision })
  assert.deepEqual(remainingToday(s.totals, s.targets), two(day.remaining))
  assert.equal(day.eatenCount, 0); assert.equal(s.logs.length, 0)
  s.targets.kcal = 9
  assert.equal(p.tracker.snapshot().targets.kcal, 500)
  assert.throws(() => { p.session.contracts.dayTargets.snapshot().targets.kcal = 9 }, TypeError)
  assert.deepEqual(p.tracker.snapshot().profileTargets, { kcal: 2400, protein: 160 })
  assert.deepEqual(p.tracker.weekPlanInputs().targets, { kcal: 2400, protein: 160 })
  assert.equal(f.plan.calls.length, 7) // three probes + plans/versions/approvals/parent recheck; no tracker plan query
  assert.deepEqual(f.plan.calls.slice(3).map(call => call.table), [tableNames[0], tableNames[1], tableNames[2], tableNames[0]])
  assert.equal(JSON.stringify(f.plan.data), input)
  assert.equal(f.plan.writes().length, 0); assert.equal(f.rows.length, 0); assert.deepEqual(f.writes, [])
})

test('daily targets: actual one-tap meal, tracker edit, remove and reopen share targets and retain existing save contracts', async t => {
  const f = fixture(); f.approve(); const p = pair(t, f)
  await p.day.load(); await p.tracker.load()
  const revision = p.tracker.snapshot().targetReference.revision
  const meal = p.day.snapshot().meals[0]
  assert.equal(p.day.setGrams(meal.id, meal.foods[0].id, '125'), true)
  assert.equal(await p.day.markEaten(meal.id), true); await flush(); await p.tracker.load()
  assert.deepEqual(remainingToday(p.tracker.snapshot().totals, p.tracker.snapshot().targets), two(p.day.snapshot().remaining))
  assert.equal(p.tracker.snapshot().totals.kcal, 125)
  assert.equal(await p.tracker.update(f.rows[0].id, { ...f.rows[0], kcal: 90 }, 'synthetic-edit'), true)
  await flush()
  assert.equal(p.day.snapshot().remaining.kcal, 410)
  assert.equal(p.day.snapshot().meals[0].blocked, true)
  assert.equal(await p.tracker.remove(f.rows[0].id, 'synthetic-remove', true), true)
  await flush()
  assert.equal(p.day.snapshot().remaining.kcal, 500)
  const reopened = pair(t, f); await reopened.day.load(); await reopened.tracker.load()
  assert.deepEqual(reopened.tracker.snapshot().targets, p.tracker.snapshot().targets)
  assert.equal(reopened.tracker.snapshot().targetReference.revision, revision)
  assert.equal(f.plan.writes().length, 0)
  assert.ok(f.calls.filter(c => c.action === 'insert').every(c =>
    Object.keys(c.value).sort().join(',') === 'athlete_id,carb,date,fat,kcal,meal,protein'))
})

test('daily targets: missing schema, unapproved plan and missing profile targets use an honest unmixed fallback', async t => {
  for (const config of [{ missing: true }, {}, { error: '42501' }]) {
    const f = fixture(config), p = pair(t, f)
    await p.day.load(); await p.tracker.load()
    assert.equal(p.tracker.snapshot().targetReference.source, 'profile')
    assert.deepEqual(p.tracker.snapshot().targets, { kcal: 2400, protein: 160 })
    assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
  }
  const f = fixture(), p = pair(t, f, {}, { id: athleteId })
  await p.day.load(); await p.tracker.load()
  assert.deepEqual(p.tracker.snapshot().targets, { kcal: null, protein: null })
  assert.equal(remainingToday(p.tracker.snapshot().totals, p.tracker.snapshot().targets), null)
  f.approve(); f.plan.data[tableNames[2]].length = 0
  await p.day.load()
  assert.equal(p.tracker.snapshot().targetReference.source, 'profile')
})

test('daily targets: unknown approved nutrient never borrows a profile goal; incomplete intake remains unknown', async t => {
  const f = fixture(); f.approve()
  f.plan.data[tableNames[1]][0] = structuredClone(f.plan.data[tableNames[1]][0])
  f.plan.data[tableNames[1]][0].meals[0].portions[0].food.nutrientsPer100g.proteinG = null
  const p = pair(t, f); await p.day.load(); await p.tracker.load()
  assert.deepEqual(p.tracker.snapshot().targets, { kcal: 500, protein: null })
  assert.equal(p.day.snapshot().targets.protein, null)
  assert.equal(p.day.snapshot().meals[0].canSave, false)
  f.rows.push({ id: 'synthetic-unknown', athlete_id: athleteId, date, meal: 'Ukendt mængde', kcal: null, protein: null, carb: null, fat: null })
  await p.day.load(); await p.tracker.load()
  assert.equal(p.tracker.snapshot().totals, null)
  assert.equal(p.day.snapshot().remaining.kcal, null)
  assert.equal(f.plan.writes().length, 0)
})

test('daily targets: retain and label last approved reference during retry; successful no-plan clears it', async t => {
  const config = {}, f = fixture(config); f.approve(); const p = pair(t, f)
  await p.day.load(); await p.tracker.load()
  let release
  config.before = () => new Promise(resolve => { release = resolve; config.before = undefined })
  const loading = p.day.load(); await flush()
  assert.deepEqual(p.tracker.snapshot().targets, { kcal: 500, protein: 50 })
  assert.equal(p.tracker.snapshot().targetReference.state, 'loading')
  config.error = '42501'; release(); assert.equal(await loading, false)
  assert.equal(p.tracker.snapshot().targetReference.state, 'load-error')
  assert.equal(p.tracker.snapshot().targets.kcal, 500)
  delete config.error
  assert.equal(await p.day.load(), true)
  assert.equal(p.tracker.snapshot().targetReference.state, 'ready')
  f.plan.data[tableNames[2]].length = 0
  await p.day.load()
  assert.deepEqual(p.tracker.snapshot().targets, { kcal: 2400, protein: 160 })
  assert.equal(p.tracker.snapshot().targetReference.source, 'profile')
})

test('daily targets: athlete/date/client owners and late disposed responses cannot cross a session', async t => {
  const f = fixture(); f.approve()
  const p = pair(t, f), otherDay = pair(t, f, { date: '2026-11-04' })
  const otherAthlete = pair(t, f, {}, { ...profile, id: 'synthetic-other' })
  const otherClient = pair(t, fixture())
  for (const x of [p, otherDay, otherAthlete, otherClient]) await x.day.load()
  assert.equal(p.tracker.snapshot().targets.kcal, 500)
  for (const x of [otherDay, otherAthlete, otherClient]) {
    assert.equal(x.tracker.snapshot().targets.kcal, 2400)
    assert.notEqual(x.session.contracts.dayTargets.owner, p.session.contracts.dayTargets.owner)
  }
  const source = p.session.contracts.dayTargets
  for (const change of [{ owner: {} }, { athleteId: 'other' }, { date: '2026-11-04' }]) {
    const bad = createNutritionController({ enabled: true, athlete: profile, date, contracts: {
      dayTargets: { ...source, snapshot: () => ({ ...source.snapshot(), ...change }) } } })
    assert.equal(bad.snapshot().targets.kcal, 2400); assert.equal(bad.snapshot().targetReference.state, 'unavailable'); bad.dispose()
  }
  let release
  const late = fixture({ before: () => new Promise(resolve => { release = resolve }) }); late.approve()
  const old = pair(t, late), loading = old.day.load(); await flush()
  old.session.dispose(); release()
  // The next probes must also settle, but no old result can publish after disposal.
  late.plan.options.before = undefined
  assert.equal(await loading, false)
  assert.equal(old.tracker.snapshot().targetReference.source, 'profile')
  assert.equal(old.tracker.snapshot().targetReference.state, 'disposed')
  assert.equal(p.tracker.snapshot().targets.kcal, 500)
})

test('daily targets: approved effective version selection stays date-specific, future and unapproved versions excluded', async t => {
  const f = fixture(); f.approve()
  const [plans, versions, approvals] = tableNames.map(name => f.plan.data[name])
  const original = versions[0], v2 = structuredClone(original)
  v2.id = '40000000-0000-4000-8000-000000000002'; v2.version_no = 2; v2.effective_from = '2026-11-06'
  v2.meals[0].portions[0].grams = 600
  versions.push(v2)
  approvals.push({ ...approvals[0], version_id: v2.id, approved_at: '2026-11-06T12:00:00Z' })
  const old = pair(t, f), next = pair(t, f, { date: '2026-11-06' })
  await old.day.load(); await next.day.load()
  assert.equal(old.tracker.snapshot().targets.kcal, 500); assert.equal(next.tracker.snapshot().targets.kcal, 900)
  assert.equal(old.tracker.snapshot().targetReference.revision, original.id)
  assert.equal(next.tracker.snapshot().targetReference.revision, v2.id)
  assert.equal(plans.length, 1); assert.equal(f.plan.writes().length, 0)
})

test('daily targets: strict OFF never reads the target channel and disposal removes subscriptions', async t => {
  for (const enabled of [false, undefined, 'true', 1]) {
    assert.equal(createKostDaySession({ enabled, get client() { throw Error('OFF') } }), null)
    assert.equal(createNutritionController({ enabled, contracts: { get dayTargets() { throw Error('OFF') } } }), null)
  }
  const f = fixture(); f.approve(); const p = pair(t, f)
  let updates = 0; p.tracker.subscribe(() => { updates++ })
  await p.day.load(); assert.ok(updates > 0)
  p.tracker.dispose(); const before = updates
  await p.day.load(); p.session.dispose()
  assert.equal(updates, before)
})
