import { createElement as h, useEffect, useState } from 'react'
import KostMaal from './kostMaal/KostMaal.mjs'

// Entropi 2 (APP-KOST-MAAL1): coachens kostfane. Kostmål og vægtgrundlag vises med pakken
// KostMaal; redigering og gem går gennem Dashboardets eksisterende startEdit('setup', ...) og
// saveEdit. Vægtloggen hentes med den eksisterende fetchAthleteWeightLogs. Ingen ny skrivevej.

// Effektens krop: henter vægtloggen for den valgte atlet med den eksisterende læser og melder
// status for netop den atlet. Et svar efter annullering afleveres aldrig.
export function startKostVaegt({ enabled, athleteId, fetchAthleteWeightLogs }, onStatus) {
  if (enabled !== true || athleteId == null || typeof fetchAthleteWeightLogs !== 'function') return undefined
  let current = true
  onStatus({ athleteId, state: 'loading' })
  Promise.resolve().then(() => fetchAthleteWeightLogs(athleteId)).then(
    () => { if (current) onStatus({ athleteId, state: 'ready' }) },
    () => { if (current) onStatus({ athleteId, state: 'error' }) })
  return () => { current = false }
}

export function useEntropi2KostVaegt({ enabled, athleteId, fetchAthleteWeightLogs }) {
  const [status, setStatus] = useState(null)
  const live = enabled === true ? athleteId : undefined
  // fetchAthleteWeightLogs er ny i hvert render (lavLaesninger); læsningen startes kun ved atlet- eller flagskift.
  useEffect(() => startKostVaegt({ enabled, athleteId: live, fetchAthleteWeightLogs }, setStatus), [enabled, live])
  return status
}

// Vægtrækkerne gives kun videre, når læsningen for netop denne atlet er afsluttet, og alle
// rækker hører til atleten. Den eksisterende læser sorterer nyeste først; pakken lader den
// sidst indlæste række vinde, så rækkefølgen vendes til stigende.
export function kostMaalVaegt(status, athleteId, weightLogs) {
  if (athleteId == null || status?.athleteId !== athleteId) return { state: 'loading' }
  if (status.state !== 'ready') return { state: status.state === 'error' ? 'error' : 'loading' }
  const rows = Array.isArray(weightLogs) ? weightLogs : []
  if (!rows.every(row => row?.athlete_id === athleteId)) return { state: 'loading' }
  return { state: 'ready', rows: [...rows].reverse() }
}

// Standard OFF: læser hverken props, data eller callbacks.
export default function CoachKostMaal(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, weightStatus, weightLogs, today, editing, editData, startEdit, setEditData, setEditing, saveEdit, saving } = props
  const weight = kostMaalVaegt(weightStatus, athlete?.id, weightLogs)
  if (weight.state === 'error') return h('p', { role: 'alert' }, 'Vægtgrundlaget kunne ikke hentes. Prøv igen ved at åbne kostfanen.')
  if (weight.state !== 'ready') return h('p', { role: 'status' }, 'Indlæser vægtgrundlag…')
  return h(KostMaal, { key: athlete.id, enabled: true, athlete, weightLogs: weight.rows, today,
    editing, editData, startEdit, setEditData, setEditing, saveEdit, saving })
}
