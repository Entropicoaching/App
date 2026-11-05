import { createPlanSnapshot, summarizePlanSnapshot } from './planSnapshot.mjs'
import { catalogFoods, day, identifier, totals } from './coach/model.mjs'

const tables = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const missing = error => ['42P01', 'PGRST205'].includes(error?.code)
// Share pending and confirmed schema probes per client in this page session.
// A rejected probe is transient: the next load must be able to try again.
// Cache capabilities only: athlete/date plan data is always read again. Coach
// checks and every activation remain uncached. No storage or session/auth reads.
const athleteAvailability = new WeakMap()
const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(key => [key, null]))
const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value)
const fail = () => { throw Error('Kostplanen kunne ikke bekræftes.') }
const rows = result => {
  if (!result || result.error || !Array.isArray(result.data) || result.data.length >= 501) fail()
  return result.data
}

// Pure projection to the existing immutable SQL snapshot contract. No invented
// calculation evidence: this flow is an explicit manual coach activation.
export function activationSnapshot(plan) {
  if (!identifier(plan?.athleteId) || !day(plan.date) || !totals(plan.meals)) fail()
  return createPlanSnapshot({ goal: plan.goal === 'maintain' ? 'vedligehold' : plan.goal,
    intensity: plan.intensity / 100,
    meals: plan.meals.map(meal => ({ name: meal.name, portions: meal.items.map(item => ({
      grams: Number(String(item.grams).replace(',', '.')), food: catalogFoods([item.food])?.[0]?.nutrition,
    })) })) })
}

// Only the caller's authenticated client is used. No auth/session/environment,
// migration, RPC, writes to existing tables, or activity merely from construction.
export function createPlanAdapter(options = {}) {
  if (options.enabled !== true) return null
  const { client, athleteId, date } = options
  if (!identifier(athleteId) || !day(date) || typeof client?.from !== 'function') fail()
  let pending = null
  async function available() {
    for (const table of tables) {
      const result = await client.from(table).select('id').limit(0)
      if (missing(result?.error)) return false
      rows(result)
    }
    return true
  }
  const requireTables = async () => { if (!await available()) throw Error('Kostplanens tabeller er ikke tilgængelige.') }
  const byId = async (table, id, key = 'id') => {
    const found = rows(await client.from(table).select('*').eq(key, id).limit(2))
    if (found.length > 1) fail()
    return found[0] ?? null
  }
  async function ensure(table, payload) {
    const existing = await byId(table, payload.id)
    if (existing) {
      for (const [key, value] of Object.entries(payload)) {
        if (canonical(existing[key]) !== canonical(value)) fail()
      }
      return existing
    }
    const inserted = rows(await client.from(table).insert(payload).select('*'))
    if (inserted.length !== 1 || inserted[0].id !== payload.id) fail()
    for (const [key, value] of Object.entries(payload)) {
      if (canonical(inserted[0][key]) !== canonical(value)) fail()
    }
    return inserted[0]
  }
  return Object.freeze({
    available,
    async activate(plan) {
      if (plan?.athleteId !== athleteId || plan.date !== date) fail()
      const snapshot = activationSnapshot(plan)
      const fingerprint = JSON.stringify(snapshot)
      // Retain operation IDs after an uncertain response. Reconcile immutable
      // rows before retrying; never blindly duplicate an approval after timeout.
      if (pending && pending.fingerprint !== fingerprint) throw Error('Genprøv den uafklarede aktivering før en ny plan.')
      await requireTables()
      if (!pending) {
        const id = () => { const value = globalThis.crypto.randomUUID(); if (!uuid(value)) fail(); return value }
        pending = { fingerprint, planId: id(), versionId: id() }
      }
      const operation = pending
      await ensure(tables[0], { id: operation.planId, athlete_id: athleteId, valid_from: date })
      await ensure(tables[1], { id: operation.versionId, plan_id: operation.planId,
        version_no: 1, effective_from: date, basis_as_of: date, calculation_basis: basis,
        rationale: 'Coachen har gennemgået og aktiveret den lokale dagsplan.', ...snapshot })
      let approval = await byId(tables[2], operation.versionId, 'version_id')
      if (!approval) {
        const inserted = rows(await client.from(tables[2]).insert({ version_id: operation.versionId, approval_kind: 'coach' }).select('*'))
        if (inserted.length !== 1) fail()
        approval = inserted[0]
      }
      if (approval.version_id !== operation.versionId || approval.approval_kind !== 'coach') fail()
      if (approval.athlete_id !== athleteId || approval.plan_id !== operation.planId || !Number.isFinite(Date.parse(approval.approved_at))) fail()
      const parent = await byId(tables[0], operation.planId)
      if (parent?.athlete_id !== athleteId || parent.status !== 'godkendt') fail()
      pending = null
      return { ok: true, athleteId, date, planId: operation.planId, versionId: operation.versionId }
    },
    async loadActive() {
      if (!athleteAvailability.has(client)) {
        const probe = available().catch(error => {
          if (athleteAvailability.get(client) === probe) athleteAvailability.delete(client)
          throw error
        })
        athleteAvailability.set(client, probe)
      }
      if (!await athleteAvailability.get(client)) return null
      const plans = rows(await client.from(tables[0]).select('id,athlete_id,valid_from,status')
        .eq('athlete_id', athleteId).eq('status', 'godkendt').lte('valid_from', date).limit(501))
      if (plans.some(p => p.athlete_id !== athleteId || p.status !== 'godkendt' || !day(p.valid_from) || p.valid_from > date || !uuid(p.id))) fail()
      if (!plans.length) return null
      const versions = rows(await client.from(tables[1]).select('*').in('plan_id', plans.map(p => p.id))
        .lte('effective_from', date).limit(501))
      if (versions.some(v => !plans.some(p => p.id === v.plan_id) || !uuid(v.id) || !day(v.effective_from) || v.effective_from > date
        || !Number.isSafeInteger(v.version_no) || v.version_no < 1)) fail()
      if (!versions.length) return null
      const approvals = rows(await client.from(tables[2]).select('id,version_id,plan_id,athlete_id,approved_at')
        .in('version_id', versions.map(v => v.id)).eq('athlete_id', athleteId).limit(501))
      if (approvals.some(a => a.athlete_id !== athleteId || !uuid(a.id) || !Number.isFinite(Date.parse(a.approved_at))
        || !versions.some(v => v.id === a.version_id && v.plan_id === a.plan_id))) fail()
      const approved = versions.flatMap(v => approvals.filter(a => a.version_id === v.id).map(a => ({ v, a })))
      // A future approval must not hide today's plan. Same-day coach corrections
      // are resolved by the server approval time, also across replacement plans.
      approved.sort((x, y) => y.v.effective_from.localeCompare(x.v.effective_from)
        || Date.parse(y.a.approved_at) - Date.parse(x.a.approved_at) || y.a.id.localeCompare(x.a.id))
      if (!approved.length) return null
      const { v } = approved[0], snapshot = createPlanSnapshot(v)
      if (!snapshot.meals.length) fail()
      const summary = summarizePlanSnapshot(snapshot)
      return { id: v.plan_id, revision: v.id, athlete_id: athleteId, date, active: true,
        targets: Object.fromEntries([['kcal', 'energyKcal'], ['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]
          .map(([key, nutrient]) => [key, summary.nutrients[nutrient].value])),
        meals: snapshot.meals.map((meal, mi) => ({ id: `${v.id}:meal:${mi}`, name: meal.name,
          foods: meal.portions.map((portion, fi) => ({ id: `${v.id}:meal:${mi}:food:${fi}`,
            name: portion.food.name, grams: portion.grams,
            ...Object.fromEntries([['kcal100', 'energyKcal'], ['protein100', 'proteinG'], ['carb100', 'carbohydrateG'], ['fat100', 'fatG']]
              .map(([key, nutrient]) => [key, portion.food.nutrientsPer100g[nutrient]])) })) })) }
    },
  })
}
