import { createElement, useEffect, useRef, useState } from 'react'
import { mountConversation } from './ConversationView.mjs'
import { startLiveRefresh } from './liveRefresh.mjs'
import { unreadSummary, sameUnread } from './unreadHost.mjs'
import { InitialConversation } from '../../athlete/previewInitialPresentation.mjs'
// Each effect owns its controller, including React StrictMode's cleanup/replay.
// Assembly supplies a memoized factory scoped to role + owner + athlete.
// onUnread: U2, the host's tab dot and per-athlete counts follow the conversation.
// live: test seam for document, window and timers; production uses the globals.
export default function Conversation({ enabled = false, createController, controllerRef, initial, readOnly = false, onUnread, live }) {
  const ref = useRef(null)
  const unreadRef = useRef(onUnread); unreadRef.current = onUnread
  const liveRef = useRef(live); liveRef.current = live
  const [view, setView] = useState(null)
  useEffect(() => {
    if (enabled !== true || !createController || !ref.current) return
    const controller = createController()
    if (controllerRef) controllerRef.current = controller
    // Preview renders the same confirmed thread without a composer or read receipts.
    // Normal mode retains the original imperative renderer and its draft lifecycle.
    const cleanup = readOnly ? null : mountConversation(ref.current, controller, { enabled: true })
    let reported = null
    const unsubscribe = controller.subscribe(snapshot => {
      setView({ factory: createController, readOnly, snapshot })
      if (readOnly) return
      const summary = unreadSummary(snapshot)
      if (summary && !sameUnread(summary, reported)) {
        const previous = reported
        reported = summary
        unreadRef.current?.(summary, previous)
      }
    })
    void controller.refresh()
    // U2: new replies appear without reopening: on return from background, on
    // reconnect and every 30 s while visible, quietly and one load at a time.
    const stopLive = readOnly ? null : startLiveRefresh(() => controller.refresh({ quiet: true }), liveRef.current)
    return () => {
      stopLive?.()
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
