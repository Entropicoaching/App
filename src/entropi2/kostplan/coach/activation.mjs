import { createElement as h, useEffect, useState, useSyncExternalStore } from 'react'
import { createPlanAdapter } from '../planAdapter.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'

// Keep the write adapter (and its reserved operation IDs) across read retries.
const sessions = new WeakMap()
const activationFingerprint = snapshot => JSON.stringify(supportedPlanSnapshot(snapshot))

export async function readActivationState({ client, athleteId, date }) {
  // A fresh read facade also rechecks a previous negative capability result.
  const adapter = createPlanAdapter({ enabled: true, client: { from: table => client.from(table) }, athleteId, date })
  if (!await adapter.available()) return { state: 'unavailable', active: null }
  const active = await adapter.loadActive()
  if (!active) return { state: 'ready', active: null }
  // loadActive verifies approval/owner/version selection, but its meal projection
  // omits goal, intensity and effective date. Compare the complete immutable version.
  const result = await client.from('kostplan_v1_versions').select('*').eq('id', active.revision).limit(2)
  const version = result?.data?.[0]
  if (result?.error || !Array.isArray(result?.data) || result.data.length !== 1
    || version.id !== active.revision || version.plan_id !== active.id) throw Error('Unconfirmed version')
  return { state: 'ready', active, effectiveFrom: version.effective_from,
    fingerprint: activationFingerprint(version) }
}

// Called only by the enabled, opened coach editor. Loading the existing client
// does not create a second session; hermetic tests always inject a synthetic one.
export const productionClient = async () => (await import('../../../supabase.js')).supabase

export function startPlanActivation({ controller, athleteId, date, client, loadClient = productionClient }) {
  let current = true
  controller.setActivationAdapter(null)
  Promise.resolve().then(async () => {
    if (!current) return
    const resolvedClient = client ?? await loadClient()
    if (!current) return
    let session = sessions.get(controller)
    if (!session || session.client !== resolvedClient || session.athleteId !== athleteId || session.date !== date) {
      const createAdapter = () => createPlanAdapter({ enabled: true, client: resolvedClient, athleteId, date })
      let adapter = createAdapter()
      session = { client: resolvedClient, athleteId, date, adapter: {
        activate: plan => adapter.activate(plan),
        check: () => readActivationState({ client: resolvedClient, athleteId, date }),
        // Only called after a confirmed receipt or a complete active match.
        // Drop obsolete pending IDs without replaying a possibly partial write.
        confirmed: () => { adapter = createAdapter() },
      } }
      sessions.set(controller, session)
    }
    if (current) {
      controller.setActivationAdapter(session.adapter)
      await controller.checkActivation()
    }
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
  return snapshot.activationError || snapshot.activationPending ? h('button', { type: 'button', disabled: Boolean(snapshot.busy), style: { minHeight: 44 },
    onClick: () => setAttempt(value => value + 1) }, 'Kontrollér aktivering igen') : null
}
