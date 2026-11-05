import { createCoachPlan } from './controller.mjs'
import { NAMESPACE, identifier, day, normalizePlan, targets, number } from './model.mjs'
import { FOODS } from '../foedevarer/index.mjs'

export const DRAFT_MESSAGE = 'Lokal kladde gemt.'
const SCHEMA = 'entropi2:kostplan:coach:device-draft:v1'
export const draftKey = (coachId, athleteId, date) => `${SCHEMA}:${[coachId, athleteId, date].map(encodeURIComponent).join(':')}`

// No client or table adapter. The only write is one namespaced localStorage key,
// after an explicit coach action. The existing session is an isolation key, not auth.
export function openPortalPlan(options = {}) {
  if (options.enabled !== true) return null
  const { coachId, athlete, date } = options
  if (!identifier(coachId) || !identifier(athlete?.id) || !day(date)) throw TypeError('Vælg coach, atlet og dato.')
  const key = draftKey(coachId, athlete.id, date)
  const storage = options.storage ?? (() => globalThis.localStorage)
  let expected = null, restoreDraft = null, loadError = null
  try {
    expected = storage().getItem(key)
    if (expected !== null) {
      if (expected.length > 250000) throw Error('Oversized draft')
      const stored = JSON.parse(expected)
      const plan = normalizePlan(stored.plan, athlete.id)
      if (!Number.isSafeInteger(stored.sequence) || stored.sequence < 1 || stored.schema !== SCHEMA || stored.coachId !== coachId || stored.date !== date
        || !plan || plan.date !== date || plan.status !== 'draft'
        || stored.form?.goal !== plan.goal || stored.form?.intensity !== plan.intensity
        || !Number.isSafeInteger(stored.clientVersion) || stored.clientVersion < 0
        || JSON.stringify(targets(stored.form ?? {})) !== JSON.stringify(plan.targets)) throw Error('Invalid draft')
      restoreDraft = { plan, form: stored.form, clientVersion: stored.clientVersion }
    }
  } catch {
    loadError = 'Den lokale kladde kunne ikke læses. Genåbn kostfanen, når enhedens lagring er tilgængelig.'
  }
  let controller
  controller = createCoachPlan({ enabled: true, localDraftOnly: true, athlete: { id: athlete.id, bodyweight: athlete.bodyweight }, date,
    goal: athlete.goal, catalog: FOODS, template: options.template ?? restoreDraft?.plan.meals.map(meal => ({
      id: meal.id, name: meal.name, items: meal.items.map(item => ({ foodId: item.food.id, grams: item.grams })),
    })) ?? [], restoreDraft,
    // A kcal target is NOT maintenance energy. Leave maintenance and fat blank;
    // the coach supplies those explicitly. No inferred age, load or active plan.
    basis: { athleteId: athlete.id, date, protein: number(athlete.protein_target) ?? '' },
    saveDraft: async request => {
      if (loadError) throw Error('Unreadable draft')
      const store = storage()
      if (store.getItem(key) !== expected) throw Error('Draft changed in another tab')
      const planId = request.planId ?? 'device-draft'
      const previous = expected === null ? 0 : JSON.parse(expected).sequence
      if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw Error('Invalid revision')
      const sequence = previous + 1, revision = `device-${sequence}`
      const plan = { ...request.plan, id: planId, revision, status: 'draft' }
      const payload = JSON.stringify({ schema: SCHEMA, coachId, date, sequence,
        clientVersion: request.clientVersion, plan, form: controller.snapshot().form })
      if (payload.length > 250000) throw Error('Oversized draft')
      store.setItem(key, payload)
      if (store.getItem(key) !== payload) throw Error('Unconfirmed local write')
      expected = payload
      return { ok: true, namespace: NAMESPACE, athleteId: athlete.id, date,
        planId, revision, clientVersion: request.clientVersion, status: 'draft' }
    },
  })
  return { controller, loadError, restored: Boolean(restoreDraft) }
}
