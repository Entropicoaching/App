import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { createWeekPlan } from './ugeplan/model.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const athleteId = 'synthetic:week', date = '2026-11-04'
const meal = { meal: 'Syntetisk <skål>', kcal: 400, protein: 25, carb: 50, fat: 10 }
const template = { id: mealKey(meal), name: meal.meal, meal }
const templateKey = `entropi2:nutrition:skabeloner:v1:${encodeURIComponent(athleteId)}`
const planKey = `entropi2:nutrition:ugeplan:v1:${encodeURIComponent(athleteId)}:2026-11-02`
const fold = host => host.querySelectorAll('details').find(n => n.getAttribute('data-focus') === 'week-plan')

function fixture(t, options = {}) {
  const data = options.data ?? new Map([[templateKey, JSON.stringify({ version: 1, templates: [template] })]])
  const reads = [], writes = [], calls = [], disposed = [], backend = []
  const storage = { getItem(key) { reads.push(key); return data.get(key) ?? null },
    setItem(key, value) { writes.push([key, value]); if (options.writeError) throw Error('synthetic quota'); data.set(key, value) } }
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 120 }, date, storage,
    contracts: { load: async () => { if (options.loadError) throw Error('synthetic'); return options.rows ?? [] },
      save: async value => { backend.push(value); return true } } })
  const host = syntheticHost()
  // Lifecycle contract only. Real React output is covered in Ugeplan.test.mjs.
  const cleanup = mountNutrition(host, controller, { mountWeekPlan(child, inputs) {
    calls.push({ child, inputs, model: inputs.templateError ? null : createWeekPlan(inputs) })
    return () => disposed.push(child)
  } })
  t.after(cleanup)
  return { host, controller, cleanup, data, reads, writes, calls, disposed, backend }
}
async function open(f) { const node = fold(f.host); node.open = true; await node.fire('toggle'); return node }

test('week plan wiring: collapsed without empty week summary, lazy scoped inputs, detached templates, no mount writes', async t => {
  const f = fixture(t); await flush()
  const plan = fold(f.host), weekly = plan.parentElement
  assert.equal(find(f.host, 'h2', 'Din uge'), undefined)
  assert.equal(plan.parentElement, weekly)
  assert.equal(weekly.children.at(-1), plan)
  assert.equal(plan.open, false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.reads.includes(planKey), false)
  assert.ok(find(f.host, 'h2', 'Log hurtigt'))
  assert.ok(find(f.host, 'summary', 'Notér et måltid'))
  await open(f)
  const { inputs, model } = f.calls[0]
  assert.equal(inputs.enabled, true)
  assert.equal(inputs.embedded, true)
  assert.equal(inputs.athleteId, athleteId)
  assert.equal(inputs.date, date)
  assert.deepEqual(inputs.targets, { kcal: 2000, protein: 120 })
  assert.deepEqual(inputs.templates, [template])
  assert.equal(inputs.client, undefined)
  assert.equal(inputs.rows, undefined)
  inputs.templates[0].name = 'Detached mutation'
  assert.equal(f.controller.weekPlanInputs().templates[0].name, template.name)
  assert.equal(model.snapshot().days.length, 7)
  assert.deepEqual(f.writes, [])
  assert.deepEqual(f.backend, [])
})

test('week plan wiring: model writes only its namespace; redraw/close preserves island and portions', async t => {
  const f = fixture(t); await flush(); await open(f)
  const { child, model } = f.calls[0]
  assert.equal(model.add(0, template.id), true)
  assert.equal(model.add(6, template.id), true)
  assert.deepEqual(model.snapshot().days[0].totals, { kcal: 400, protein: 25 })
  assert.equal(model.snapshot().shopping.missingMeals.length, 2)
  assert.deepEqual(f.writes.map(([key]) => key), [planKey, planKey])
  assert.deepEqual(f.backend, [])
  f.controller.toggleHistory(); f.cleanup.updateWeight({ weightLogs: [] })
  assert.equal(fold(f.host).open, true)
  assert.equal(fold(f.host).children[1], child)
  assert.equal(f.calls.length, 1)
  fold(f.host).open = false; await fold(f.host).fire('toggle')
  f.controller.toggleHistory(); await open(f)
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.disposed, [])
  f.cleanup()
  assert.deepEqual(f.disposed, [child])
  assert.equal(f.controller.weekPlanInputs(), null)
})

test('week plan wiring: refresh disposes island, ignores stale toggles and remounts the saved draft', async t => {
  const f = fixture(t); await flush()
  const old = await open(f)
  f.calls[0].model.add(0, template.id)
  await f.controller.load()
  assert.equal(f.disposed.length, 1)
  assert.equal(fold(f.host).open, false)
  old.open = true; await old.fire('toggle')
  assert.equal(f.calls.length, 1)
  await open(f)
  assert.equal(f.calls[1].model.snapshot().days[0].entries.length, 1)
  f.cleanup(); await old.fire('toggle')
  assert.equal(f.calls.length, 2)
})

test('week plan wiring: accepting a real suggestion refreshes the open plan', async t => {
  const rows = [1, 2, 3].map(id => ({ ...meal, id: 'synthetic:' + id, athlete_id: athleteId, date }))
  const f = fixture(t, { data: new Map(), rows }); await flush(); await open(f)
  assert.deepEqual(f.calls[0].inputs.templates, [])
  assert.equal(f.controller.acceptTemplate(template.id), true)
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].inputs.templates[0].id, template.id)
  assert.equal(fold(f.host).open, true)
  assert.equal(f.disposed.length, 1)
})

test('week plan wiring: empty, source error and load failure remain distinct; retry reloads templates', async t => {
  const empty = fixture(t, { data: new Map() }); await flush(); await open(empty)
  assert.equal(empty.calls[0].model.snapshot().templates.length, 0)
  assert.equal(empty.calls[0].model.snapshot().days[0].totals.kcal, null)
  const bad = fixture(t, { data: new Map([[templateKey, '{broken']]) }); await flush(); await open(bad)
  assert.match(bad.calls[0].inputs.templateError, /kunne ikke læses/)
  assert.equal(bad.calls[0].model, null)
  assert.equal(bad.reads.includes(planKey), false)
  bad.data.set(templateKey, JSON.stringify({ version: 1, templates: [template] }))
  await bad.calls[0].inputs.onRetry(); await open(bad)
  assert.equal(bad.calls[1].model.snapshot().templates.length, 1)
  const failed = fixture(t, { loadError: true }); await flush()
  assert.equal(fold(failed.host), undefined)
  assert.ok(find(failed.host, 'button', 'Hent kostloggen igen'))
})

test('week plan wiring: corrupt drafts and quota failures never erase the saved plan', async t => {
  const corrupt = fixture(t); corrupt.data.set(planKey, '{broken'); await flush(); await open(corrupt)
  assert.equal(corrupt.calls[0].model.snapshot().readFailed, true)
  assert.equal(corrupt.calls[0].model.add(0, template.id), false)
  assert.equal(corrupt.data.get(planKey), '{broken')
  assert.deepEqual(corrupt.writes, [])
  const quota = fixture(t, { writeError: true }); await flush(); await open(quota)
  assert.equal(quota.calls[0].model.add(0, template.id), false)
  assert.match(quota.calls[0].model.snapshot().error, /ikke gemt/)
  assert.equal(quota.calls[0].model.snapshot().days[0].entries.length, 0)
})
