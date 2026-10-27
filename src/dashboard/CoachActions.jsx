import CoachTemplateMessage from './CoachTemplateMessage.jsx'
import { createElement as h } from 'react'
import { buildCoachActions, coachActionsEnabled, openCoachAction } from './coachActions.mjs'

export default function CoachActions({ templateMessages = false, coachId, sendTemplateMessage, enabled, athletes, calendarWeeks, completion, latestByTrack, videos, loading, hasError, dataStatus = {}, openProfile, openCoachPriorityItem, today }) {
  if (!coachActionsEnabled(enabled)) return null
  const ready = dataStatus.calendar === 'ready' && dataStatus.progress === 'ready'
  const failed = hasError || Object.values(dataStatus).includes('error')
  const pending = loading || !ready
  const rows = buildCoachActions({ enabled, athletes, calendarWeeks: ready ? calendarWeeks : {}, completion: ready ? completion : {}, latestByTrack, videos, today })
  return h('section', { 'aria-label': 'Hvem skal jeg hjælpe i dag', 'data-coach-actions': true, style: { marginBottom: '1rem', padding: '0.85rem', background: '#1c1c18', border: '1px solid #575044', borderRadius: 5 } },
    h('h2', { style: { margin: '0 0 0.5rem', color: '#edeae2', fontSize: '1rem' } }, 'Hvem skal jeg hjælpe i dag?'),
    (pending || failed) && h('p', { role: 'status', style: { color: '#d79a83', fontSize: '0.8rem' } }, failed ? 'Nogle data mangler. Listen kan være ufuldstændig.' : 'Afventer kalender og træningslogs. Listen kan være ufuldstændig.'),
    !rows.length && !pending && !failed && h('p', { style: { color: '#b3afa4', fontSize: '0.8rem' } }, 'Ingen handlinger i de indlæste data.'),
    h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, rows.map(row => h('li', { key: row.athlete.id },
      h('button', { type: 'button', onClick: () => openCoachAction(row, { openProfile, openCoachPriorityItem }), style: { display: 'block', width: '100%', minHeight: 52, padding: '0.55rem 0', border: 0, borderBottom: '1px solid #383730', background: 'transparent', color: '#edeae2', textAlign: 'left', cursor: 'pointer' } },
        h('span', { style: { display: 'block', overflowWrap: 'anywhere', fontWeight: 600 } }, row.athlete.name),
        h('span', { style: { display: 'block', color: '#b3afa4', fontSize: '0.78rem', lineHeight: 1.4, overflowWrap: 'anywhere' } }, row.reason)),
      templateMessages === true && h(CoachTemplateMessage, { key: `${coachId}:${row.athlete.id}`, coachId, athlete: row.athlete, sendMessage: sendTemplateMessage })))))
}
