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

// Coach-only history on the existing RLS-scoped namespace. Four bounded reads,
// no paging or inferred empty history. Exact counts detect server page truncation.
const historySchema = 'entropi2-kostplan:daily-reference/v1'
const nutrientKeys = [['kcal', 'energyKcal'], ['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]
const unknownTargets = () => Object.fromEntries(nutrientKeys.map(([key]) => [key, null]))
const historyError = reason => { throw Object.assign(Error('Planhistorikken kunne ikke bekræftes.'), { reason }) }
const localApprovalDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
})
// Postgres timestamptz preserves microseconds. Date.parse alone would turn two
// distinct same-millisecond corrections into a tie. UUIDs are not time ordering.
function approvalTime(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/)
  if (!match || !day(match[1])) historyError('invalid-history')
  const ms = Date.parse(`${match[1]}T${match[2]}${match[4]}`)
  if (!Number.isFinite(ms) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(match[2])) historyError('invalid-history')
  const stamp = BigInt(ms) * 1000n + BigInt((match[3] ?? '').padEnd(6, '0'))
  const parts = Object.fromEntries(localApprovalDay.formatToParts(new Date(ms)).map(p => [p.type, p.value]))
  return { stamp, on: `${parts.year}-${parts.month}-${parts.day}` }
}

async function readDailyReferences(client, athleteId, date, options = {}) {
  if (!identifier(options.coachId) || date < '1900-01-07' || date > '9999-12-24') fail()
  const from = new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  const base = { schema: historySchema, athleteId, date, from, through: date }
  const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10))
  const unknown = (date, reason, state = 'unknown') => ({ date, state, reason, planId: null, versionId: null, targets: unknownTargets() })
  const checkCurrent = () => { if (options.isCurrent?.() === false) historyError('cancelled') }
  const complete = result => {
    checkCurrent()
    if (missing(result?.error)) historyError('tables-unavailable')
    if (!result || result.error || !Array.isArray(result.data)) historyError('read-error')
    if (!Number.isSafeInteger(result.count) || result.count !== result.data.length || result.count >= 501) historyError('incomplete-read')
    return result.data
  }
  const unique = (items, key) => { if (new Set(items.map(v => v[key])).size !== items.length) historyError('invalid-history') }
  const readPlans = () => client.from(tables[0]).select('id,athlete_id,valid_from,status', { count: 'exact' })
    .eq('athlete_id', athleteId).lte('valid_from', date).limit(501)
  try {
    checkCurrent()
    const plans = complete(await readPlans())
    unique(plans, 'id')
    if (plans.some(p => !uuid(p.id) || p.athlete_id !== athleteId || !day(p.valid_from)
      || p.valid_from > date || !['forslag', 'godkendt', 'arkiveret'].includes(p.status))) historyError('invalid-history')
    if (!plans.length) return { ...base, state: 'ready', reason: null, days: dates.map(d => unknown(d, 'no-approved-version')) }
    const versions = complete(await client.from(tables[1])
      .select('id,plan_id,version_no,effective_from,goal,intensity,meals', { count: 'exact' })
      .in('plan_id', plans.map(p => p.id)).limit(501))
    unique(versions, 'id')
    if (versions.some(v => !uuid(v.id) || !plans.some(p => p.id === v.plan_id && day(v.effective_from) && v.effective_from >= p.valid_from)
      || !Number.isSafeInteger(v.version_no) || v.version_no < 1)) historyError('invalid-history')
    unique(versions.map(v => ({ key: `${v.plan_id}:${v.version_no}` })), 'key')
    // SQL primary key is version_id: there is no approvals.id column.
    const approvals = complete(await client.from(tables[2])
      .select('version_id,plan_id,athlete_id,approved_at,approval_kind', { count: 'exact' })
      .in('plan_id', plans.map(p => p.id)).eq('athlete_id', athleteId).limit(501))
    unique(approvals, 'version_id')
    const approved = approvals.map(a => {
      const v = versions.find(v => v.id === a.version_id && v.plan_id === a.plan_id)
      const p = plans.find(p => p.id === a.plan_id)
      if (!v || !p || a.athlete_id !== athleteId || !['coach', 'automatic'].includes(a.approval_kind)
        || p.status === 'forslag') historyError('invalid-history')
      const time = approvalTime(a.approved_at)
      const snapshot = createPlanSnapshot(v)
      if (!snapshot.meals.length) historyError('invalid-history')
      const summary = summarizePlanSnapshot(snapshot)
      const targets = Object.fromEntries(nutrientKeys.map(([key, nutrient]) => [key, summary.nutrients[nutrient].value]))
      return { p, v, time, targets }
    })
    if (plans.some(p => p.status === 'godkendt' && !approved.some(a => a.p.id === p.id))) historyError('incomplete-history')
    // Mutable archive status has no historical timestamp. Recheck parents once
    // after reading the append-only rows; never publish a crossed archive read.
    const confirmed = complete(await readPlans())
    const sorted = list => [...list].sort((a, b) => a.id.localeCompare(b.id))
    if (canonical(sorted(plans)) !== canonical(sorted(confirmed))) historyError('changed-during-read')
    const days = dates.map(d => {
      const candidates = approved.filter(a => a.v.effective_from <= d && a.time.on <= d)
      candidates.sort((a, b) => b.v.effective_from.localeCompare(a.v.effective_from)
        || (a.time.stamp < b.time.stamp ? 1 : a.time.stamp > b.time.stamp ? -1 : 0)
        || (a.p.id === b.p.id ? b.v.version_no - a.v.version_no : 0))
      if (!candidates.length) return unknown(d, 'no-approved-version')
      const first = candidates[0]
      if (candidates.some(a => a.p.id !== first.p.id && a.v.effective_from === first.v.effective_from
        && a.time.stamp === first.time.stamp)) return unknown(d, 'approval-order-conflict', 'conflict')
      // An archived candidate cannot be dated or safely removed to revive an
      // older plan. Its affected days stay unknown until a later reference wins.
      if (first.p.status === 'arkiveret') return unknown(d, 'archive-date-unavailable')
      return { date: d, state: 'approved', reason: null, planId: first.p.id, versionId: first.v.id, targets: first.targets }
    })
    return { ...base, state: 'ready', reason: null, days }
  } catch (error) {
    return { ...base, state: 'unavailable', reason: error?.reason ?? 'read-error',
      days: dates.map(d => unknown(d, error?.reason ?? 'read-error')) }
  }
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
    for (const [index, table] of tables.entries()) {
      const result = await client.from(table).select(index === 2 ? 'version_id' : 'id').limit(0)
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
    loadDailyReferences: options => readDailyReferences(client, athleteId, date, options),
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
      const readPlans = () => client.from(tables[0]).select('id,athlete_id,valid_from,status')
        .eq('athlete_id', athleteId).eq('status', 'godkendt').lte('valid_from', date).limit(501)
      const unique = (items, key) => { if (new Set(items.map(item => item[key])).size !== items.length) fail() }
      const plans = rows(await readPlans())
      unique(plans, 'id')
      if (plans.some(p => p.athlete_id !== athleteId || p.status !== 'godkendt' || !day(p.valid_from) || p.valid_from > date || !uuid(p.id))) fail()
      if (!plans.length) return null
      const versions = rows(await client.from(tables[1]).select('id,plan_id,version_no,effective_from,goal,intensity,meals')
        .in('plan_id', plans.map(p => p.id)).lte('effective_from', date).limit(501))
      unique(versions, 'id')
      unique(versions.map(v => ({ key: `${v.plan_id}:${v.version_no}` })), 'key')
      if (versions.some(v => !plans.some(p => p.id === v.plan_id && v.effective_from >= p.valid_from)
        || !uuid(v.id) || !day(v.effective_from) || v.effective_from > date
        || !Number.isSafeInteger(v.version_no) || v.version_no < 1)) fail()
      if (!versions.length) return null
      // The existing approval ledger is keyed by version_id, with no id column.
      const approvals = rows(await client.from(tables[2]).select('version_id,plan_id,athlete_id,approved_at,approval_kind')
        .in('version_id', versions.map(v => v.id)).eq('athlete_id', athleteId).limit(501))
      unique(approvals, 'version_id')
      if (approvals.some(a => a.athlete_id !== athleteId || !['coach', 'automatic'].includes(a.approval_kind)
        || !versions.some(v => v.id === a.version_id && v.plan_id === a.plan_id))) fail()
      const approved = approvals.map(a => ({ v: versions.find(v => v.id === a.version_id), time: approvalTime(a.approved_at) }))
        .filter(a => a.time.on <= date)
      // Do not publish a plan whose mutable parent changed during the read.
      const confirmed = rows(await readPlans())
      const sorted = list => [...list].sort((a, b) => a.id.localeCompare(b.id))
      if (canonical(sorted(plans)) !== canonical(sorted(confirmed))) fail()
      // Resolve corrections by actual server time, including microseconds.
      // Equal effective dates and times are ambiguous; UUID/row order is no clock.
      approved.sort((x, y) => y.v.effective_from.localeCompare(x.v.effective_from)
        || (x.time.stamp < y.time.stamp ? 1 : x.time.stamp > y.time.stamp ? -1 : 0))
      if (!approved.length) return null
      if (approved.length > 1 && approved[0].v.effective_from === approved[1].v.effective_from
        && approved[0].time.stamp === approved[1].time.stamp) fail()
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
