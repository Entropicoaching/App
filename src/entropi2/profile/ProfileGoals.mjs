import { createElement as h, useEffect, useRef, useState } from 'react'
import { createProfileGoals } from './profileGoalsController.mjs'
import { athleteGoals, goalDraft } from './profileGoalsModel.mjs'
import { ProfileGoalsView } from './ProfileGoalsView.mjs'
import { ownGoalScope } from './profileGoalsStore.mjs'

// Do not mount hooks, inspect identity or touch storage in the OFF branch.
export function ProfileGoals(props = {}) {
  if (props.enabled !== true) return null
  if (!props.ownerId || !props.athlete?.id || props.athlete.user_id !== props.ownerId) return null
  return h(ActiveProfileGoals, { ...props, key: `${props.ownerId}:${props.athlete.id}` })
}

function ActiveProfileGoals(props) {
  const live = useRef(props); live.current = props
  const controller = useRef(null)
  const [state, setState] = useState(() => {
    const values = athleteGoals(props.athlete)
    return { phase: 'loading', values, draft: goalDraft(values), localFields: [], errors: {}, message: '', pending: false }
  })
  useEffect(() => {
    const instance = createProfileGoals({ enabled: true, athlete: props.athlete,
      storage: () => props.storage ? props.storage() : globalThis.localStorage,
      getScope: () => {
        const current = live.current
        const host = current.getScope?.()
        const hostAllowed = typeof current.getScope !== 'function' || ownGoalScope(host) &&
          host.ownerId === current.ownerId && host.athleteId === current.athlete?.id
        return { enabled: current.enabled === true && hostAllowed,
          ownerId: current.ownerId, athleteId: current.athlete?.id, athleteUserId: current.athlete?.user_id }
      } })
    controller.current = instance
    const unsubscribe = instance?.subscribe(() => setState(instance.snapshot()))
    instance?.refresh()
    return () => { unsubscribe?.(); instance?.dispose(); controller.current = null }
  }, [props.ownerId, props.athlete, props.storage])
  return h(ProfileGoalsView, { state,
    onChange: (key, value) => controller.current?.change(key, value),
    onSave: () => controller.current?.save(), onReset: () => controller.current?.reset(),
    onRetry: () => controller.current?.refresh() })
}
