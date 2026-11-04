// Test/example input only. These illustrative numbers are not a food database.
import { NAMESPACE } from './model.mjs'
export function syntheticInput(overrides = {}) {
  const calls = [], athleteId = 'synthetic-athlete-a', date = '2026-11-04'
  let revision = 0
  const ack = (request, status) => ({ ok: true, namespace: NAMESPACE, athleteId: request.athleteId,
    date: request.date, planId: request.planId ?? 'synthetic-plan-new', clientVersion: request.clientVersion,
    revision: `synthetic-revision-${++revision}`, status })
  const options = { enabled: true, athlete: { id: athleteId, name: 'Syntetisk atlet A' }, date,
    basis: { athleteId, date, maintenanceKcal: 2400, protein: 150, fat: 70,
      context: { weightTrend: 'Syntetisk stabil trend', training: 'Syntetisk træningsuge',
        foodLog: 'Syntetisk kostlog', readiness: 'Syntetisk dagsform',
        competition: 'Ingen syntetisk stævnedato', experience: 'Syntetisk erfaring med vedligehold' } },
    catalog: [
      { id: 'rice', name: 'Ris, kogt (syntetisk)', per100g: { kcal: 130, protein: 2.7, carb: 28, fat: 0.3 } },
      { id: 'chicken', name: 'Kylling (syntetisk)', per100g: { kcal: 165, protein: 31, carb: 0, fat: 3.6 } },
      { id: 'veg', name: 'Grøntsager (syntetisk)', per100g: { kcal: 30, protein: 2, carb: 4, fat: 0.4 } },
      { id: 'oats', name: 'Havre (syntetisk)', per100g: { kcal: 370, protein: 13, carb: 60, fat: 7 } },
    ],
    template: [
      { id: 'breakfast', name: 'Morgenmad', items: [{ foodId: 'oats', grams: 100 }] },
      { id: 'lunch', name: 'Frokost', items: [{ foodId: 'rice', grams: 200 }, { foodId: 'chicken', grams: 100 }, { foodId: 'veg', grams: 50 }] },
      { id: 'dinner', name: 'Aftensmad', items: [{ foodId: 'rice', grams: 200 }, { foodId: 'chicken', grams: 100 }, { foodId: 'veg', grams: 50 }] },
    ],
    history: { athleteId, state: 'ready', plans: [], responses: [] },
    saveDraft: async request => { calls.push({ operation: 'save', request }); return ack(request, 'draft') },
    activatePlan: async request => { calls.push({ operation: 'activate', request }); return ack(request, 'active') },
    ...overrides }
  return { options, calls, ack }
}

export const element = (type, props, ...children) => ({ type, props: { ...props,
  children: children.flat(Infinity).filter(child => child !== false && child != null) } })
export function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))]
}
export function text(tree) {
  if (tree == null || tree === false) return ''
  return typeof tree === 'object' ? tree.props.children.map(text).join(' ') : String(tree)
}
