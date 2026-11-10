import { createElement as h, useEffect, useState } from 'react'
import { readinessDrop } from '../coach/coachAttention.mjs'
import { heavyWeekSuggestion } from './heavyWeek.mjs'
import { readHeavyWeekLogs } from './heavyWeekRead.mjs'

// U6 del 3: forslaget under en række i "Kræver dit blik". Læser kun, når readiness allerede
// falder for netop denne atlet. Forslaget er til coachen; intet ændres i programmet.
export default function HeavyWeekLine({ client, athleteId, day, readiness, read = readHeavyWeekLogs }) {
  const dropping = Array.isArray(readiness) && !!day && !!readinessDrop(readiness, day)
  const [logs, setLogs] = useState(null)
  useEffect(() => {
    setLogs(null)
    if (!dropping || !client) return undefined
    let active = true
    Promise.resolve(read({ client, athleteId, day })).then(rows => { if (active) setLogs({ athleteId, day, rows }) },
      () => { if (active) setLogs({ athleteId, day, rows: null }) })
    return () => { active = false }
  }, [dropping, client, athleteId, day, read])
  if (!dropping || logs?.athleteId !== athleteId || logs.day !== day || !Array.isArray(logs.rows)) return null
  const suggestion = heavyWeekSuggestion({ readiness, logs: logs.rows, day })
  return suggestion && h('p', { 'data-u6-heavy-week': athleteId,
    style: { margin: '0 0 12px', padding: 12, borderRadius: 12, background: '#22201a', border: '1px solid #59564c', color: '#edeae2' } },
  suggestion.text)
}
