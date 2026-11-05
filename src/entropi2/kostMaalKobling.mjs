import { createElement as h, useEffect, useState } from 'react'
import KostMaal from './kostMaal/KostMaal.mjs'
import { nutritionBasis } from './kostMaal/nutritionWeek.mjs'
import PortalPlan from './kostplan/coach/PortalPlan.mjs'

// Entropi 2 (APP-KOST-MAAL1): coachens kostfane. Kostmål og vægtgrundlag vises med pakken
// KostMaal; redigering og gem går gennem Dashboardets eksisterende startEdit('setup', ...) og
// saveEdit. Vægtloggen læses med samme forespørgsel som den eksisterende fetchAthleteWeightLogs,
// men i koblingens egen læsning, så rækker og status hører til præcis samme svar. Ingen ny skrivevej.

// Effektens krop: læser vægtloggen for den valgte atlet (samme select som den eksisterende læser:
// weight_logs, athlete_id, nyeste først, højst 90) og melder status MED rækkerne for netop den
// læsning. Et svar efter annullering afleveres aldrig og rører ingen fælles state, så et sent svar
// fra en tidligere atlet kan ikke blande sig med den nye atlets skærm. Kun et svar uden error og
// med en liste er en komplet læsning; alt andet er en fejl, aldrig "ingen vejninger".
export function startKostVaegt({ enabled, athleteId, client }, onStatus) {
  if (enabled !== true || athleteId == null || typeof client?.from !== 'function') return undefined
  let current = true
  onStatus({ athleteId, state: 'loading' })
  Promise.resolve().then(() => client.from('weight_logs').select('*').eq('athlete_id', athleteId)
    .order('logged_at', { ascending: false }).limit(90)).then(
    result => {
      if (!current) return
      if (!result || result.error || !Array.isArray(result.data)) onStatus({ athleteId, state: 'error' })
      else onStatus({ athleteId, state: 'ready', rows: result.data })
    },
    () => { if (current) onStatus({ athleteId, state: 'error' }) })
  return () => { current = false }
}

export function useEntropi2KostVaegt({ enabled, athleteId, client }) {
  const [status, setStatus] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const live = enabled === true ? athleteId : undefined
  // Genforsøg gentager kun den eksisterende, afgrænsede læsning.
  useEffect(() => startKostVaegt({ enabled, athleteId: live, client }, setStatus), [enabled, live, client, attempt])
  return status && { ...status, retry: () => setAttempt(value => value + 1) }
}

// Vægtrækkerne gives kun videre, når læsningen for netop denne atlet er afsluttet, og alle
// rækker hører til atleten. Læsningen sorterer nyeste først; pakken lader den sidst indlæste
// række vinde, så rækkefølgen vendes til stigende. Rækkerne kommer fra statusobjektet selv.
export function kostMaalVaegt(status, athleteId) {
  if (athleteId == null || status?.athleteId !== athleteId) return { state: 'loading' }
  if (status.state !== 'ready') return { state: status.state === 'error' ? 'error' : 'loading' }
  if (!Array.isArray(status.rows)) return { state: 'error' }
  if (!status.rows.every(row => row?.athlete_id === athleteId)) return { state: 'loading' }
  return { state: 'ready', rows: [...status.rows].reverse() }
}

// Dashboard already supplies the coach's completed meal read to this host.
// Reuse its scope guards and original meal rows; never fetch or reconstruct history
// from current targets or the portal's device draft. This base has no saved plan
// history reader, so the report must remain hidden until one supplies nutritionRead.
export function kostMaalNutritionRead(props = {}) {
  if (props.enabled !== true || nutritionBasis(props).state !== 'ready') return undefined
  const { athlete, today, coachNutrition, readContext, weightStatus } = props
  const weight = kostMaalVaegt(weightStatus, athlete.id)
  if (weight.state !== 'ready') return undefined
  return { coachId: readContext.coachId, athleteId: athlete.id, date: today,
    state: 'ready', complete: true, planHistory: 'unavailable',
    mealLogs: coachNutrition.rows.filter(row => row.athlete_id === athlete.id), weightLogs: weight.rows }
}

// Standard OFF: læser hverken props, data eller callbacks.
export default function CoachKostMaal(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, weightStatus, today, editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,
    session, loading, loadError, coachNutrition, readContext, nutritionRead } = props
  const weight = kostMaalVaegt(weightStatus, athlete?.id)
  return h('div', null, h(KostMaal, { key: athlete?.id, enabled: true, athlete, weightLogs: weight.rows, today,
    weightState: weight.state, retryWeight: weightStatus?.athleteId === athlete?.id ? weightStatus?.retry : undefined,
    editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,
    session, loading, loadError, coachNutrition, readContext }),
    h(PortalPlan, { enabled: true, athlete, today, session,
      nutritionRead: nutritionRead === undefined ? kostMaalNutritionRead(props) : nutritionRead }))
}
