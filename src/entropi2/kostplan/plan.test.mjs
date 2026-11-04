import test from 'node:test'
import assert from 'node:assert/strict'
import { createDraft, transitionPlan } from './plan.mjs'
import { calculateNutrition } from './beregning.mjs'

const actor = { id: 'synthetic-coach', role: 'coach' }
const input = () => ({ id: 'synthetic-plan', athleteId: 'synthetic-athlete', coachId: actor.id,
  createdOn: '2026-11-04', dailyTargets: calculateNutrition({ date: '2026-11-04', adult: true, weightKg: 80, goal: 'maintain' }).targets,
  meals: [{ id: 'meal-1', name: 'Måltid', items: [{ grams: 200, food: { name: 'Syntetisk mad', kcal100: 100, protein100: 10, carb100: 10, fat100: 2 } }] }] })

test('full pure draft → coach activated → archived lifecycle preserves identities and food snapshots', () => {
  const draft = createDraft(input()), before = JSON.stringify(draft)
  const active = transitionPlan(draft, { to: 'active', actor, on: '2026-11-05' })
  assert.equal(active.status, 'active')
  assert.equal(active.activated.by, actor.id)
  assert.equal(active.athleteId, 'synthetic-athlete')
  assert.equal(JSON.stringify(draft), before)
  const archived = transitionPlan(active, { to: 'archived', actor, on: '2026-11-06' })
  assert.equal(archived.status, 'archived')
  assert.deepEqual(archived.activated, active.activated)
  assert.deepEqual(archived.archived, { by: actor.id, on: '2026-11-06' })
  archived.meals[0].items[0].food.name = 'Edited'
  assert.equal(active.meals[0].items[0].food.name, 'Syntetisk mad')
})

test('athlete and other coaches cannot transition a plan, including truthy fake roles', () => {
  for (const wrong of [undefined, { id: actor.id, role: 'athlete' }, { id: 'other', role: 'coach' }, { id: actor.id, role: true }]) {
    assert.throws(() => transitionPlan(createDraft(input()), { to: 'active', actor: wrong, on: '2026-11-04' }), /coach/)
  }
})

test('no skip, repeat, backwards or archived reactivation; only ordered transitions', () => {
  const draft = createDraft(input()), active = transitionPlan(draft, { to: 'active', actor, on: '2026-11-05' })
  const archived = transitionPlan(active, { to: 'archived', actor, on: '2026-11-06' })
  for (const [plan, to] of [[draft, 'archived'], [draft, 'draft'], [active, 'active'], [active, 'draft'], [archived, 'active'], [archived, 'draft']]) {
    assert.throws(() => transitionPlan(plan, { to, actor, on: '2026-11-06' }), TypeError)
  }
})

test('unknown schema/status, impossible dates, future history and missing activation metadata fail closed', () => {
  const draft = createDraft(input())
  for (const patch of [{ schema: 'x' }, { status: 'x' }, { createdOn: '2026-02-30' }, { status: 'active' },
    { status: 'active', activated: { by: 'other', on: '2026-11-05' } },
    { status: 'active', activated: { by: actor.id, on: '2026-11-07' } }]) {
    assert.throws(() => transitionPlan({ ...draft, ...patch }, { to: 'archived', actor, on: '2026-11-06' }), TypeError)
  }
  for (const on of ['2026-11-03', '2026-02-30', undefined]) {
    assert.throws(() => transitionPlan(draft, { to: 'active', actor, on }), TypeError)
  }
})

test('empty draft is allowed as unfinished work, activation requires concrete meals', () => {
  const draft = createDraft({ ...input(), meals: [] })
  assert.equal(draft.status, 'draft')
  assert.throws(() => transitionPlan(draft, { to: 'active', actor, on: '2026-11-04' }), /tom kladde/)
})

test('all IDs and daily macro targets are mandatory, valid and copied', () => {
  const data = input(), draft = createDraft(data)
  draft.dailyTargets.kcal = 9999
  assert.notEqual(data.dailyTargets.kcal, 9999)
  for (const key of ['id', 'athleteId', 'coachId']) assert.throws(() => createDraft({ ...data, [key]: '' }), TypeError)
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    for (const n of [0, -1, Infinity, null, undefined, '20']) {
      assert.throws(() => createDraft({ ...data, dailyTargets: { ...data.dailyTargets, [key]: n } }), TypeError)
    }
  }
})

test('transition recalculates supplied meal totals instead of trusting stale derived data', () => {
  const draft = createDraft(input())
  draft.totals.kcal = 99999
  draft.meals[0].totals.kcal = 99999
  const active = transitionPlan(draft, { to: 'active', actor, on: '2026-11-04' })
  assert.equal(active.totals.kcal, 200)
  assert.equal(active.meals[0].totals.kcal, 200)
})
