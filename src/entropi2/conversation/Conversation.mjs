import { createElement, useEffect, useRef, useState } from 'react'
import { mountConversation } from './ConversationView.mjs'
import { InitialConversation } from '../../athlete/previewInitialPresentation.mjs'
// Each effect owns its controller, including React StrictMode's cleanup/replay.
// Assembly supplies a memoized factory scoped to role + owner + athlete.
export default function Conversation({ enabled = false, createController, controllerRef, initial, readOnly = false }) {
  const ref = useRef(null)
  const [view, setView] = useState(null)
  useEffect(() => {
    if (enabled !== true || !createController || !ref.current) return
    const controller = createController()
    if (controllerRef) controllerRef.current = controller
    // Preview renders the same confirmed thread without a composer or read receipts.
    // Normal mode retains the original imperative renderer and its draft lifecycle.
    const cleanup = readOnly ? null : mountConversation(ref.current, controller, { enabled: true })
    const unsubscribe = controller.subscribe(snapshot => setView({ factory: createController, readOnly, snapshot }))
    void controller.refresh()
    return () => {
      unsubscribe()
      cleanup?.()
      if (readOnly) controller.dispose()
      if (controllerRef?.current === controller) controllerRef.current = null
    }
  }, [enabled, createController, controllerRef, readOnly])
  if (enabled !== true) return null
  const current = view?.factory === createController && view.readOnly === readOnly ? view : null
  return createElement('section', { 'aria-label': 'Beskeder og video' },
    (readOnly || !current) && createElement(InitialConversation, { initial, snapshot: current?.snapshot }),
    // React owns the sibling above; the imperative view owns only this empty host.
    createElement('div', { ref }))
}
