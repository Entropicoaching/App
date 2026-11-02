import { createElement as h, useEffect, useRef } from 'react'
import { mountConversation } from './ConversationView.mjs'
// Each effect owns its controller, including React StrictMode's cleanup/replay.
// Assembly supplies a memoized factory scoped to role + owner + athlete.
export default function Conversation({ enabled = false, createController, controllerRef }) {
  const ref = useRef(null)
  useEffect(() => {
    if (enabled !== true || !createController || !ref.current) return
    const controller = createController()
    if (controllerRef) controllerRef.current = controller
    const cleanup = mountConversation(ref.current, controller, { enabled: true })
    void controller.refresh()
    return () => { cleanup(); if (controllerRef?.current === controller) controllerRef.current = null }
  }, [enabled, createController, controllerRef])
  return enabled === true ? h('section', { ref, 'aria-label': 'Beskeder og video' }) : null
}
