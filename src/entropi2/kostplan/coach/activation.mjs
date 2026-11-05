import { createElement as h, useEffect, useState, useSyncExternalStore } from 'react'
import { createPlanAdapter } from '../planAdapter.mjs'

// Called only by the enabled, opened coach editor. Loading the existing client
// does not create a second session; hermetic tests always inject a synthetic one.
export const productionClient = async () => (await import('../../../supabase.js')).supabase

export function startPlanActivation({ controller, athleteId, date, client, loadClient = productionClient }) {
  let current = true
  Promise.resolve().then(async () => {
    const adapter = createPlanAdapter({ enabled: true, client: client ?? await loadClient(), athleteId, date })
    const available = await adapter.available()
    if (current) controller.setActivationAdapter(available ? adapter : null)
  }).catch(() => {
    if (current) controller.setActivationAdapter(null, 'Aktivering kunne ikke kontrolleres. Den lokale kladde virker stadig. Prøv kontrollen igen.')
  })
  return () => { current = false; controller.setActivationAdapter(null) }
}

export default function PlanActivation({ controller, athleteId, date, client, loadClient }) {
  const [attempt, setAttempt] = useState(0)
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => startPlanActivation({ controller, athleteId, date, client, loadClient }),
    [controller, athleteId, date, client, loadClient, attempt])
  return snapshot.activationError ? h('button', { type: 'button', style: { minHeight: 44 },
    onClick: () => setAttempt(value => value + 1) }, 'Kontrollér aktivering igen') : null
}
