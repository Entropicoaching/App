import { createElement as h, useEffect, useState } from 'react'
import KostMaal from './kostMaal/KostMaal.mjs'
import { nutritionBasis } from './kostMaal/nutritionWeek.mjs'
import PortalPlan, { PortalKostJustering } from './kostplan/coach/PortalPlan.mjs'
import { createPlanAdapter } from './kostplan/planAdapter.mjs'

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

// Dagsreferencerne (de gemte, godkendte planer pr. dag) læses asynkront med samme bundne læsning som
// den aktive rapport. Fejl, ingen rækker og en læsning under vejs giver ingen referencer: kvitteringen
// beholder så planHistory 'unavailable' og viser intet frem for gæt. Et svar efter annullering afleveres aldrig.
export function startKostDagsReferencer({ coachId, athleteId, date, client }, onResult) {
  if (!coachId || !athleteId || !date || typeof client?.from !== 'function') return undefined
  let current = true
  Promise.resolve().then(async () => {
    const refs = await createPlanAdapter({ enabled: true, client, athleteId, date })
      .loadDailyReferences({ coachId, isCurrent: () => current })
    const known = refs?.state === 'ready' && Array.isArray(refs.days) && refs.days.some(day => day?.state !== 'unknown')
    if (current) onResult({ coachId, athleteId, date, state: known ? 'ready' : 'unavailable', refs: known ? refs : null })
  }).catch(() => { if (current) onResult({ coachId, athleteId, date, state: 'unavailable', refs: null }) })
  return () => { current = false }
}

// Kvitteringen får kun referencer, der hører til netop denne coach, atlet og dag. Den gamle
// receipt.plans-vej og planHistory 'unavailable' røres ikke, når der ingen referencer er.
export function kostMaalKvitteringMedDage(receipt, status) {
  if (!receipt || status?.state !== 'ready' || !status.refs || status.coachId !== receipt.coachId
    || status.athleteId !== receipt.athleteId || status.date !== receipt.date) return receipt
  return { ...receipt, planHistory: 'daily', dailyReferences: status.refs }
}

// Planversionens mål (goal, intensity) for i dag, fra de samme dagsreferencer som kvitteringen allerede har læst.
// Uden godkendt version for netop i dag er svaret null, og vægtlinjen udebliver.
export function kostMaalPlanVersion(receipt, today) {
  const day = receipt?.dailyReferences?.days?.find(d => d?.date === today)
  return day?.state === 'approved' ? { goal: day.goal, intensity: day.intensity } : null
}

function KostDagsReferencer({ receipt, client, render }) {
  const [status, setStatus] = useState(null)
  const { coachId, athleteId, date } = receipt
  useEffect(() => startKostDagsReferencer({ coachId, athleteId, date, client }, setStatus),
    [coachId, athleteId, date, client])
  return render(kostMaalKvitteringMedDage(receipt, status))
}

// Standard OFF: læser hverken props, data eller callbacks.
export default function CoachKostMaal(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, weightStatus, today, editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,
    session, loading, loadError, coachNutrition, readContext, nutritionRead, weekClient } = props
  const weight = kostMaalVaegt(weightStatus, athlete?.id)
  const receipt = nutritionRead === undefined ? kostMaalNutritionRead(props) : nutritionRead
  const body = value => h('div', null, h(KostMaal, { key: athlete?.id, enabled: true, athlete, weightLogs: weight.rows, today,
    weightState: weight.state, retryWeight: weightStatus?.athleteId === athlete?.id ? weightStatus?.retry : undefined,
    editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,
    session, loading, loadError, coachNutrition, readContext, planVersion: kostMaalPlanVersion(value, today) }),
    h(PortalKostJustering, { enabled: true, athlete, coachId: session?.user?.id, date: today, loading, loadError, nutritionRead: value }),
    h(PortalPlan, { enabled: true, athlete, today, session, nutritionRead: value, weekClient }))
  // Kun den egne, ufuldstændige læsning får referencer; en udefra leveret nutritionRead bruges uændret.
  if (nutritionRead !== undefined || !receipt || typeof weekClient?.from !== 'function') return body(receipt)
  return h(KostDagsReferencer, { key: [receipt.coachId, receipt.athleteId, receipt.date].join('|'), receipt, client: weekClient, render: body })
}
