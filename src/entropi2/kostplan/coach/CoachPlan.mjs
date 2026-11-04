import { createElement as h, useSyncExternalStore } from 'react'
import { coachPlanView } from './view.mjs'

// Identity belongs to the controller, not an athlete name or a reusable plan id.
// A changed controller must get a fresh hook/subscription boundary immediately.
const controllerKeys = new WeakMap()
let nextControllerKey = 0

function ConnectedCoachPlan({ controller, athleteId, date }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  // The host can supply its current selection before the new controller arrives.
  // Fail closed during that interval, including the server snapshot path.
  if (athleteId !== undefined && snapshot?.athleteId !== athleteId
    || date !== undefined && snapshot?.date !== date) return null
  return coachPlanView(h, snapshot, controller)
}

// Supply a controller scoped to the selected athlete and day. Switching the
// controller switches both the snapshot and subscription; no persistence on mount.
export default function CoachPlan(props = {}) {
  if (props.enabled !== true) return null
  const controller = props.controller
  if (!controller || typeof controller.snapshot !== 'function' || typeof controller.subscribe !== 'function')
    return h('p', { role: 'alert' }, 'Kostplanen kunne ikke åbnes. Vælg en atlet og dato igen.')
  if (!controllerKeys.has(controller)) controllerKeys.set(controller, ++nextControllerKey)
  return h(ConnectedCoachPlan, { key: controllerKeys.get(controller), controller,
    athleteId: props.athleteId, date: props.date })
}
