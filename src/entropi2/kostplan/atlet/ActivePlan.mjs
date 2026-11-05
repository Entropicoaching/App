import { createElement as h, useEffect, useState } from 'react'
import { createPlanAdapter } from '../planAdapter.mjs'

// Loading and late-result suppression are independently testable with the actual
// adapter and synthetic clients. No plan or receipt is written from this view.
export function startActivePlan({ athleteId, date, client }, onResult) {
  let current = true
  Promise.resolve().then(async () => {
    const adapter = createPlanAdapter({ enabled: true, athleteId, date, client })
    const plan = await adapter.loadActive()
    if (current) onResult({ athleteId, date, client, plan })
  }).catch(() => { if (current) onResult({ athleteId, date, client, error: true }) })
  return () => { current = false }
}

export function activePlanView(create, result) {
  if (!result?.plan) return null
  const { plan } = result
  return create('section', { 'aria-label': 'Plan fra din coach', style: { padding: 16, overflowWrap: 'anywhere' } },
    create('h2', null, 'Plan fra din coach'),
    create('p', null, 'Planlagte måltider. Registrér det, du spiser, i kostloggen nedenfor.'),
    ...plan.meals.map(meal => create('section', { key: meal.id },
      create('h3', null, meal.name),
      create('ul', null, ...meal.foods.map(food => create('li', { key: food.id },
        `${food.name} · ${food.grams.toLocaleString('da-DK', { maximumFractionDigits: 1 })} g`))))))
}

function ActivePlanSession({ athleteId, date, client }) {
  const [result, setResult] = useState(null)
  useEffect(() => startActivePlan({ athleteId, date, client }, setResult), [athleteId, date, client])
  if (result?.athleteId !== athleteId || result?.date !== date || result?.client !== client) return null
  // An optional coach plan never interrupts the athlete's existing food log.
  // Preserve the error receipt; only the coach exposes activation/read failures.
  if (result.error) return null
  return activePlanView(h, result)
}

export default function ActivePlan(props = {}) {
  if (props.enabled !== true) return null
  return h(ActivePlanSession, { key: JSON.stringify([props.athleteId, props.date]),
    athleteId: props.athleteId, date: props.date, client: props.client })
}
