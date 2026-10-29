import { createElement as h, useEffect, useRef, useState } from 'react'
import { missingRequirement } from '../dataMissing.mjs'

export default function AnalyseMissingData(props) {
  if (props.enabled !== true) return props.legacy ?? null
  const requirement = missingRequirement(props.rule, props.evidence)
  if (!requirement) return null
  const line = props.scopeKey ? `${props.scopeKey}: ${requirement}` : requirement
  return h(MissingLine, { ...props, line, key: JSON.stringify([props.coachId, props.athleteId, props.rule, line, props.scopeKey]) })
}

function MissingLine({ rule, line, coachId, athleteId, loading, error, sendMessage }) {
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const current = useRef(null)
  const token = { coachId, athleteId, line, loading, error, sendMessage }
  current.current = token
  const canSend = !!coachId && !!athleteId && !loading && !error && typeof sendMessage === 'function'
  async function send() {
    if (!active.current || current.current !== token || !canSend || lock.current) return
    lock.current = true; setSending(true); setStatus('')
    try {
      const sent = await sendMessage({ coachId, athleteId, text: line })
      if (sent !== true) throw Error('Ikke sendt')
      if (active.current) setStatus('Beskeden er sendt.')
    } catch {
      lock.current = false
      if (active.current) setStatus('Beskeden blev ikke sendt. Prøv igen.')
    } finally { if (active.current) setSending(false) }
  }
  return h('section', { 'data-missing-rule': rule, style: { minWidth: 0, overflowWrap: 'anywhere' } },
    h('p', null, line),
    canSend && h('button', { type: 'button', disabled: sending || lock.current,
      style: { minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', padding: '0.6rem' }, onClick: send }, 'Send logkrav til atleten'),
    status && h('p', { role: 'status' }, status))
}
