import * as React from 'react'
import { KostplanAtletView } from './KostplanAtlet.mjs'

const { createElement: h, useRef, useSyncExternalStore } = React

const idle = Object.freeze({ phase: 'idle' })
const snapshot = () => idle
const subscribe = () => () => {}

// Only a known active plan owns a disclosure. The tracker component owns its
// mount/cleanup when moving between the direct fallback and that disclosure.
export default function KostDayFrame({ controller, tracker }) {
  const s = useSyncExternalStore(controller?.subscribe || subscribe, controller?.snapshot || snapshot, controller?.snapshot || snapshot)
  const previous = useRef(null)
  if (!previous.current || previous.current.controller !== controller) previous.current = { controller, value: null }
  if (s.mode === 'plan') previous.current.value = s
  else if (!['loading', 'load-error'].includes(s.phase)) previous.current.value = null
  const refreshing = s.phase === 'loading' && previous.current.value
  const failed = s.phase === 'load-error' && previous.current.value
  const shown = failed ? { ...previous.current.value, phase: 'load-error', message: s.message }
    : refreshing ? { ...previous.current.value, pending: true, phase: 'loading',
    message: 'Opdaterer dagens kost…', meals: previous.current.value.meals.map(meal => ({ ...meal, canSave: false })) } : s
  const plan = shown.mode === 'plan'
  // A refreshed plan keeps its place but cannot be logged until reads finish.
  const view = refreshing ? { ...shown, phase: 'ready' } : shown
  return h('div', null,
    plan && h(KostplanAtletView, { enabled: true, snapshot: view,
      onRetry: controller.load, onEaten: controller.markEaten, onEdit: controller.toggleEdit,
      onGrams: controller.setGrams, onConfirmNotLogged: controller.confirmNotLogged,
      tracker: h('p', null, 'Åbn Kostlog og vejning nedenfor for at kontrollere måltidet.') }),
    plan ? h('details', null,
      h('summary', { style: { minHeight: 44, padding: 12, cursor: 'pointer' } }, 'Kostlog og vejning'), tracker) : tracker)
}
