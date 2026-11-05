import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { createPlanAdapter, activationSnapshot } from '../planAdapter.mjs'
import { createAthleteDay } from '../atlet/dayModel.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView } from './view.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage, createElement as h, nodes, text } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && (context.parentURL?.endsWith('/coach/activation.mjs') || context.parentURL?.endsWith('/atlet/ActivePlan.mjs')))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  // A hermetic test must fail rather than load the real session/client module.
  if (specifier.includes('supabase')) throw Error('Real client forbidden in synthetic test')
  return next(specifier, context)
} })
const { startPlanActivation } = await import('./activation.mjs')
const { default: ActivePlan, startActivePlan, activePlanView } = await import('../atlet/ActivePlan.mjs')
hooks.deregister()
const scope = { athleteId: 'synthetic-athlete', date: '2026-11-05' }
function editor() {
  const storage = memoryStorage()
  const { controller } = openPortalPlan({ enabled: true, coachId: 'synthetic-coach',
    athlete: { id: scope.athleteId, protein_target: 120 }, date: scope.date, storage: () => storage,
    template: [{ id: 'meal', name: '<synthetic meal>', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
  controller.set('maintenanceKcal', 2400); controller.set('fat', 70); assert.equal(controller.generate(), true)
  return { controller, storage }
}
const planOf = c => ({ ...scope, goal: c.snapshot().form.goal, intensity: c.snapshot().form.intensity, meals: c.snapshot().meals })
const adapterOf = f => createPlanAdapter({ enabled: true, ...scope, client: f.client })
const view = c => coachPlanView(h, c.snapshot(), c)

test('OFF touches neither client, scope nor loader; construction has no I/O', () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(createPlanAdapter({ enabled, get client() { throw Error('OFF') } }), null)
    assert.equal(ActivePlan({ enabled, get athleteId() { throw Error('OFF') } }), null)
  }
  const f = syntheticTables(); adapterOf(f); assert.equal(f.calls.length, 0)
})

test('each missing namespace table hides activation and keeps local draft operations unchanged', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode }), c = editor().controller
    const cleanup = startPlanActivation({ controller: c, ...scope, client: f.client }); await flush()
    assert.equal(c.snapshot().canPublish, false); assert.equal(c.snapshot().activationError, null)
    assert.doesNotMatch(text(view(c)), /Aktivér for atleten/)
    assert.equal(await c.save(), true); assert.equal(await c.activate(), true)
    assert.match(c.snapshot().message, /Lokal kladde gemt/)
    assert.equal(await adapterOf(f).loadActive(), null)
    await assert.rejects(adapterOf(f).activate(planOf(c)))
    assert.equal(f.writes().length, 0)
    cleanup()
  }
})

test('available tables enable explicit saved-draft activation and actual athlete-day reading', async () => {
  const f = syntheticTables(), { controller: c, storage } = editor()
  const cleanup = startPlanActivation({ controller: c, ...scope, client: f.client }); await flush()
  assert.equal(c.snapshot().canPublish, true); assert.equal(f.writes().length, 0)
  const button = () => nodes(view(c)).find(n => text(n) === 'Aktivér for atleten' && n.type === 'button')
  assert.equal(button().props.disabled, true); assert.equal(await c.activate(), false)
  await c.save(); assert.equal(button().props.disabled, false)
  assert.equal(await button().props.onClick(), true); assert.match(c.snapshot().message, /aktiveret for atleten/)
  assert.equal(button().props.disabled, true); assert.equal(await c.activate(), false)
  assert.deepEqual(f.writes().map(c => c.table), tableNames)
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
  const version = f.data[tableNames[1]][0]
  assert.equal(version.goal, 'vedligehold'); assert.equal(version.intensity, 0.1)
  assert.equal(version.rationale, 'Coachen har gennemgået og aktiveret den lokale dagsplan.')
  assert.doesNotMatch(version.rationale, /\u00c3/)
  assert.deepEqual(version.meals, activationSnapshot(planOf(c)).meals)
  assert.equal(version.calculation_basis.readiness, null)
  assert.ok(version.meals[0].portions[0].food.source.citation)
  const adapter = adapterOf(f), loaded = await adapter.loadActive()
  assert.equal(loaded.athlete_id, scope.athleteId); assert.equal(loaded.revision, version.id)
  const day = createAthleteDay({ enabled: true, ...scope, loadDay: async () => ({ plan: await adapter.loadActive(), logs: [], eaten: [] }) })
  assert.equal(await day.load(), true); assert.equal(day.snapshot().mode, 'plan')
  assert.equal(day.snapshot().meals[0].foods[0].grams, c.snapshot().meals[0].items[0].grams)
  assert.match(text(activePlanView(h, { plan: loaded })), /Plan fra din coach|Registrér/)
  assert.equal(activePlanView(h, { plan: null }), null)
  cleanup(); assert.equal(c.snapshot().canPublish, false)
  c.editGrams(0, 0, 201); await c.save(); await c.activate()
  assert.equal(f.writes().length, 3) // retained handlers after cleanup have no database capability
})

test('uncertain commit at each write retries the same immutable operation and approval once', async () => {
  for (const lost of tableNames) {
    const f = syntheticTables({ lost }), adapter = adapterOf(f), plan = planOf(editor().controller)
    await assert.rejects(adapter.activate(plan))
    const changed = structuredClone(plan); changed.meals[0].items[0].grams++
    await assert.rejects(adapter.activate(changed), /uafklarede/)
    const receipt = await adapter.activate(plan); assert.equal(receipt.ok, true)
    for (const table of tableNames) assert.equal(f.data[table].length, 1)
    assert.equal((await adapter.loadActive()).revision, receipt.versionId)
  }
})

test('schema disappearance, permission and transport errors never activate or masquerade as missing', async () => {
  for (const error of ['42501', 'PGRST301', 'XX000', '404', '42p01', 'pgrst205']) {
    const f = syntheticTables({ error }), c = editor().controller
    const stop = startPlanActivation({ controller: c, ...scope, client: f.client }); await flush()
    assert.equal(c.snapshot().canPublish, false); assert.match(c.snapshot().activationError, /kunne ikke kontrolleres/)
    assert.equal(await c.save(), true); await assert.rejects(adapterOf(f).loadActive())
    assert.equal(f.writes().length, 0); stop()
  }
  const f = syntheticTables(), a = adapterOf(f); assert.equal(await a.available(), true)
  f.options.missing = tableNames[1]; await assert.rejects(a.activate(planOf(editor().controller)))
  assert.equal(f.writes().length, 0)
})

test('read selects approved effective versions only, including same-day correction and future exclusion', async () => {
  const f = syntheticTables(), a = adapterOf(f), c = editor().controller
  const first = await a.activate(planOf(c))
  c.editGrams(0, 0, 200); const second = await a.activate(planOf(c))
  assert.notEqual(second.planId, first.planId)
  assert.equal((await a.loadActive()).revision, second.versionId)
  const future = createPlanAdapter({ enabled: true, ...scope, date: '2026-11-06', client: f.client })
  await future.activate({ ...planOf(c), date: '2026-11-06' })
  assert.equal((await a.loadActive()).revision, second.versionId)
  f.data[tableNames[0]].find(p => p.id === second.planId).status = 'arkiveret'
  assert.equal((await a.loadActive()).revision, first.versionId)
  f.data[tableNames[2]].splice(0, 1)
  assert.equal(await a.loadActive(), null)
})

test('malformed or foreign read receipts, truncated reads and zero-row writes fail closed', async () => {
  const f = syntheticTables(), a = adapterOf(f), c = editor().controller
  await a.activate(planOf(c))
  const parent = f.data[tableNames[0]][0], version = f.data[tableNames[1]][0], approval = f.data[tableNames[2]][0]
  for (const [row, key, bad] of [[parent, 'athlete_id', 'other'], [version, 'meals', []], [approval, 'approved_at', 'invalid']]) {
    const old = row[key]; row[key] = bad
    if (key === 'athlete_id') assert.equal(await a.loadActive(), null)
    else await assert.rejects(a.loadActive())
    row[key] = old
  }
  for (const table of [tableNames[0], tableNames[2]]) {
    f.options.response = (call, found) => call.table === table && call.limit !== 0
      ? { data: found.map(row => ({ ...row, athlete_id: 'synthetic-foreign' })), error: null } : undefined
    await assert.rejects(a.loadActive())
  }
  f.options.response = (call, found) => call.limit === 501 ? { data: Array(501).fill(found[0]), error: null } : undefined
  await assert.rejects(a.loadActive())
  const zero = syntheticTables({ response(call) { if (call.action === 'insert') return { data: [], error: null } } })
  await assert.rejects(adapterOf(zero).activate(planOf(c))); assert.equal(zero.data[tableNames[2]].length, 0)
  await assert.rejects(a.activate({ ...planOf(c), athleteId: 'other' }))
  await assert.rejects(a.activate({ ...planOf(c), date: '2026-11-06' }))
})

test('lifecycle cleanup suppresses late coach/athlete results and retries surface read errors', async () => {
  let release; const held = new Promise(resolve => { release = resolve })
  const f = syntheticTables({ before: () => held }), c = editor().controller, results = []
  const stopCoach = startPlanActivation({ controller: c, ...scope, client: f.client })
  const stopAthlete = startActivePlan({ ...scope, client: f.client }, result => results.push(result))
  stopCoach(); stopAthlete(); release(); await flush()
  assert.equal(c.snapshot().canPublish, false); assert.deepEqual(results, [])
  const bad = syntheticTables({ error: '42501' })
  const stop = startActivePlan({ ...scope, client: bad.client }, result => results.push(result)); await flush(); stop()
  assert.equal(results[0].error, true); assert.equal(results[0].athleteId, scope.athleteId)
})

test('pending activation locks editing and rejects double clicks until the server confirms', async () => {
  let release, reached
  const held = new Promise(resolve => { release = resolve }), ready = new Promise(resolve => { reached = resolve })
  const f = syntheticTables({ before(call) {
    if (call.table === tableNames[2] && call.action === 'insert') { reached(); return held }
  } }), c = editor().controller
  const stop = startPlanActivation({ controller: c, ...scope, client: f.client }); await flush()
  await c.save(); const first = c.activate(); await ready
  assert.equal(c.snapshot().busy, 'activate'); assert.equal(await c.activate(), false)
  assert.equal(c.editGrams(0, 0, 200), false); assert.equal(c.generate(), false); assert.equal(await c.save(), false)
  release(); assert.equal(await first, true); assert.equal(f.data[tableNames[2]].length, 1); stop()
})

test('host entry is confined to the existing writable Entropi 2 nutrition branch', () => {
  const source = readFileSync(new URL('../../../AthleteView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.equal((source.match(/<ActivePlan /g) ?? []).length, 1)
  assert.match(source, /e2Atlet && !e2ReadOnly && visKost && tab === 'kost' && \(\s*<>\s*<ActivePlan enabled=\{true\} athleteId=\{athlete.id\} date=\{kostDate\} client=\{inboxDatabase\}/)
})

test('schema success is cached across scopes, while approved plan data stays fresh and scoped', async () => {
  const f = syntheticTables(), a = adapterOf(f), c = editor().controller
  assert.equal(await a.loadActive(), null)
  assert.equal(f.calls.filter(call => call.limit === 0).length, 3)
  const activated = await a.activate(planOf(c))
  const probesAfterActivation = f.calls.filter(call => call.limit === 0).length
  assert.equal(probesAfterActivation, 6, 'coach activation always rechecks all tables')
  assert.equal((await adapterOf(f).loadActive()).revision, activated.versionId)
  const other = createPlanAdapter({ enabled: true, ...scope, athleteId: 'synthetic-other', client: f.client })
  assert.equal(await other.loadActive(), null)
  const earlier = createPlanAdapter({ enabled: true, ...scope, date: '2026-11-04', client: f.client })
  assert.equal(await earlier.loadActive(), null)
  f.data[tableNames[0]][0].status = 'arkiveret'
  assert.equal(await adapterOf(f).loadActive(), null)
  assert.equal(f.calls.filter(call => call.limit === 0).length, probesAfterActivation)
  assert.equal(f.writes().length, 3)
  f.options.missing = tableNames[1]
  await assert.rejects(a.activate(planOf(c)))
  assert.equal(f.writes().length, 3, 'cached athlete availability never authorizes a coach write')
})

test('coach and athlete both recover after an athlete probe error; coach checks stay uncached', async () => {
  const f = syntheticTables({ error: '42501' }), a = adapterOf(f)
  await assert.rejects(a.loadActive())
  delete f.options.error
  assert.equal(await a.available(), true)
  const probes = f.calls.length
  assert.equal(await adapterOf(f).loadActive(), null)
  assert.equal(f.calls.length, probes + 4) // Fresh athlete schema check plus active plans.
  assert.equal(await a.available(), true)
  assert.equal(f.calls.length, probes + 7) // Coach capability remains independent.
  assert.equal(await a.loadActive(), null)
  assert.equal(f.calls.length, probes + 8) // Successful athlete schema check is shared.
  assert.equal(f.writes().length, 0)
})
