import { createElement as h } from 'react'
import { calendarDay } from '../../../calendarDate.js'
import { buildPainHistory } from './painModel.mjs'
import { readPainHistory } from './painRead.mjs'
import PainHistory from './PainHistory.mjs'

export default function CoachPainHistory(props = {}) {
  if (props.enabled !== true) return null
  const { athleteId, coachId, weeks = 6 } = props
  if (typeof coachId !== 'string' || !coachId.trim()) return null
  const asOf = props.asOf ?? calendarDay()
  const data = readPainHistory({ enabled: true, athleteId, asOf, weeks, readiness: props.readiness })
  // Synchronous props only: no requests, retained athlete state or late responses.
  return h(PainOverview, { enabled: true, data, athleteId, asOf, weeks, onRetry: props.onRetry })
}

export function PainOverview(props = {}) {
  if (props.enabled !== true) return null
  const { data, athleteId, asOf, weeks = 6 } = props
  if (typeof athleteId !== 'string' || !athleteId.trim() || typeof asOf !== 'string'
    || calendarDay(asOf) !== asOf || !Number.isInteger(weeks) || weeks < 4 || weeks > 8
    || data?.athleteId !== athleteId || data?.asOf !== asOf) return null
  if (data.state === 'error' && data.invalidObservations === true) return h('div', { role: 'alert' },
    h('p', null, 'Smertehistorikken kunne ikke vises. Nogle registreringer mangler oplysninger.'),
    typeof props.onRetry === 'function' && h('button', { type: 'button', style: { minHeight: 44 }, onClick: props.onRetry }, 'Prøv igen'))
  const model = buildPainHistory({ enabled: true, data, weeks })
  // No entered area pain, unavailable data or invalid scope: no optional section.
  if (model.state !== 'ready') return null
  return h('details', { style: { marginBlock: '1.5rem', minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center' } },
      'Smerte pr. område (4-8 uger)'),
    h(PainHistory, { enabled: true, data, weeks }))
}
