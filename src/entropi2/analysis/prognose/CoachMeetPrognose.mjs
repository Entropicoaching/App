import { createElement as h, useEffect, useState } from 'react'
import PrognoseView from './PrognoseView.mjs'
import { readCoachPrognose } from './coachPrognoseRead.mjs'

export default function CoachMeetPrognose(props = {}) {
  return props.enabled === true ? h(EnabledCoachMeetPrognose, props) : null
}

// Controlled content also supports real React server-render tests. All state
// belongs to this panel; neither dates nor estimates are written to the plan.
export function CoachPrognoseContent({ snapshot, meetDate, onMeetDateChange, meetType, onRetry }) {
  return h('div', null,
    h(PrognoseView, { entropi2: true, now: snapshot.now, meetDate,
      onMeetDateChange, meetType, fremgangLogs: snapshot.rows,
      fremgangLoading: snapshot.status === 'loading', fremgangError: snapshot.status === 'error' }),
    snapshot.status === 'error' && h('button', { type: 'button', onClick: onRetry,
      style: { minHeight: 44 } }, 'Prøv igen'),
    h('p', null, 'Datoen vælges kun til denne prognose. Prognosen ændrer ikke forsøgsvalg eller gemmer noget.'))
}

export function EnabledCoachMeetPrognose({ client, athleteId, meetDate: initialDate = '', meetType = 'sbd', now }) {
  const [opened, setOpened] = useState(false)
  const [meetDate, setMeetDate] = useState(initialDate ?? '')
  const [retry, setRetry] = useState(0)
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    if (!opened) return
    let current = true
    const reference = now ?? new Date().toISOString()
    setSnapshot({ client, athleteId, now: reference, status: 'loading' })
    readCoachPrognose(client, athleteId, reference, () => current).then(rows => {
      if (current) setSnapshot({ client, athleteId, now: reference, status: 'ready', rows })
    }).catch(() => {
      if (current) setSnapshot({ client, athleteId, now: reference, status: 'error' })
    })
    return () => { current = false }
  }, [client, athleteId, opened, retry, now])
  const visible = snapshot && snapshot.athleteId === athleteId && snapshot.client === client && (now == null || snapshot.now === now)
    ? snapshot : { now: now ?? new Date().toISOString(), status: 'loading' }
  return h('details', { onToggle: event => setOpened(event.currentTarget.open),
    style: { marginBlock: '1.5rem', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Prognose til stævnedagen'),
    opened && h(CoachPrognoseContent, { snapshot: visible, meetDate, meetType,
      onMeetDateChange: setMeetDate, onRetry: () => setRetry(previous => previous + 1) }))
}
