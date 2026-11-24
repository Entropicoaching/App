import { createElement as h, useEffect, useRef, useState } from 'react'
import AthleteHome from './AthleteHome.mjs'
import { readHomeRpeLastTime } from './homeRpeRead.mjs'
import { readCoachWarmup } from '../session/opvarmning/coachWarmup.mjs'
import { mountHomeSession } from './homeSessionBridge.mjs'
import { subscribeSessionRecordCelebrations } from '../session/sessionRecordCelebration.mjs'
import { createSessionRecordReceipts } from '../session/sessionRecordReceipt.mjs'
import AtletUgevideo from '../../ugevideo/AtletUgevideo.mjs'
import { isRestTimerHidden } from '../../restTimerVisning.js'

// Functional opt-in entry, entirely within the home namespace.
export default function HomeSession(props) {
  const root = useRef(null), latest = useRef(props), bridge = useRef(null)
  const records = useRef(null)
  if (!records.current) records.current = createSessionRecordReceipts()
  const [loading, setLoading] = useState(false)
  const sessionRecordReceipts = records.current.read(props)
  const athleteId = props.enabled === true ? props.athlete?.id : undefined
  // Ordre 1594: ét opslag pr. atlet, om seneste loggede dag havde RPE; fejl eller skrivebeskyttet giver false.
  const [rpeLast, setRpeLast] = useState(null)
  const rpeRead = props.readHomeRpeLastTime ?? readHomeRpeLastTime
  const rpeWriter = typeof props.onLogSet === 'function' && typeof props.setLogInputs === 'function'
  const rpeUsedLastTime = rpeLast != null && rpeLast.athleteId === athleteId && rpeLast.used === true
  // Ordre 1704: ét opslag pr. atlet af coachens opvarmning; kun svaret for den viste atlet bruges.
  const [warmupRead, setWarmupRead] = useState(null)
  const warmupReader = props.readCoachWarmupTemplates ?? readCoachWarmup
  const warmupShown = warmupRead != null && warmupRead.athleteId === athleteId
  const coachWarmupTemplates = warmupShown ? warmupRead.templates : []
  // Ordre 1881: en fejlet læsning (svar med failed, eller et kastet kald) vises i passet.
  const coachWarmupFailed = warmupShown && warmupRead.failed === true
  latest.current = props.enabled === true ? { ...props, sessionRecordReceipts, rpeUsedLastTime, coachWarmupTemplates, coachWarmupFailed } : props
  // Ordre 2033f: atletens eget valg under Mig (huskes pr. atlet paa telefonen); kun visningen af pausetimeren.
  if (props.enabled === true) latest.current.restTimerHidden = isRestTimerHidden(athleteId, props.storage)
  useEffect(() => {
    if (props.enabled !== true || !athleteId || !rpeWriter) return
    let active = true
    Promise.resolve().then(() => rpeRead({ athleteId })).then(
      used => { if (active) setRpeLast({ athleteId, used: used === true }) }, () => {})
    return () => { active = false }
  }, [props.enabled, athleteId, rpeWriter, rpeRead])
  useEffect(() => {
    if (props.enabled !== true || !athleteId) return
    let active = true
    Promise.resolve().then(() => warmupReader({ athleteId })).then(
      read => { if (active) setWarmupRead({ athleteId, ...warmupAnswer(read) }) },
      () => { if (active) setWarmupRead({ athleteId, templates: [], failed: true }) })
    return () => { active = false }
  }, [props.enabled, athleteId, warmupReader])
  const weekId = props.enabled === true ? props.currentWeek?.id : undefined
  useEffect(() => {
    if (props.enabled !== true) return
    const dispose = subscribeSessionRecordCelebrations(() => latest.current, globalThis,
      receipt => records.current.remember(latest.current, receipt))
    return () => { dispose(); records.current.clear() }
  }, [props.enabled, athleteId, weekId])
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
    // Ordre 1953: coachens ugevideo øverst på Hjem; kun atleten selv, ikke coachens forhåndsvisning eller egen træning.
    athleteId && props.readOnly !== true && props.coachOwnTraining !== true &&
      h(AtletUgevideo, { key: `ugevideo-${athleteId}`, athleteId, client: props.ugevideoClient }),
    // The host deliberately removes both write callbacks for its read-only preview.
    // A partially connected writer still receives Home's actionable start error.
    h(AthleteHome, { ...props, sessionRootRef: root, sessionLoading: loading,
      sessionReadOnly: typeof props.onLogSet !== 'function' && typeof props.setLogInputs !== 'function',
      onStartSession: ready ? (sessionId, weekId) => bridge.current?.start(sessionId, weekId) ?? false : undefined }))
}

// Ordre 1881: læseren giver { templates, failed } eller (ældre form) kun listen.
function warmupAnswer(read) {
  if (Array.isArray(read)) return { templates: read, failed: false }
  return { templates: Array.isArray(read?.templates) ? read.templates : [], failed: read?.failed === true }
}
