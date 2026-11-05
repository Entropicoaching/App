import { createElement as h, useEffect, useRef, useState } from 'react'
import AthleteHome from './AthleteHome.mjs'
import { mountHomeSession } from './homeSessionBridge.mjs'
import { subscribeSessionRecordCelebrations } from '../session/sessionRecordCelebration.mjs'

// Functional opt-in entry, entirely within the home namespace.
export default function HomeSession(props) {
  const root = useRef(null), latest = useRef(props), bridge = useRef(null)
  const [loading, setLoading] = useState(false)
  latest.current = props
  useEffect(() => {
    if (props.enabled !== true) return
    return subscribeSessionRecordCelebrations(() => latest.current)
  }, [props.enabled])
  useEffect(() => {
    if (props.enabled !== true) return
    let active = true
    setLoading(false)
    bridge.current = mountHomeSession(root.current, () => latest.current, {
      onLoadingChange: value => { if (active) setLoading(value) },
    })
    return () => { active = false; bridge.current.dispose(); bridge.current = null }
  }, [props.enabled])
  useEffect(() => { bridge.current?.update() })
  if (props.enabled !== true) return null
  const ready = typeof props.onLogSet === 'function' && typeof props.setLogInputs === 'function' &&
    typeof props.parsePlannedRpe === 'function'
  return h('div', { 'data-entropi2-home-session': '' },
    // The host deliberately removes both write callbacks for its read-only preview.
    // A partially connected writer still receives Home's actionable start error.
    h(AthleteHome, { ...props, sessionRootRef: root, sessionLoading: loading,
      sessionReadOnly: typeof props.onLogSet !== 'function' && typeof props.setLogInputs !== 'function',
      onStartSession: ready ? (sessionId, weekId) => bridge.current?.start(sessionId, weekId) ?? false : undefined }))
}
