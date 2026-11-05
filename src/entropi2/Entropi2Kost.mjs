import { createElement, useEffect, useRef, useState } from 'react'
import { mountNutritionScreen } from './nutrition/index.mjs'
import { loadEntropi2Styles } from './styles.mjs'
import { mountExistingTracker } from './kostplan/atlet/trackerAdapter.mjs'
import { createKostDaySession } from './kostplan/atlet/daySession.mjs'
import KostDayFrame from './kostplan/atlet/KostDayFrame.mjs'

// Montering af kostskærmen med de aktuelle vægtprops. Navigation går altid til den nyeste handler.
export function mountKost(host, { athlete, date, client, foods, storage, contracts }, latest, weight = {}) {
  const mount = contracts ? mountExistingTracker : mountNutritionScreen
  return mount(host, {
    enabled: true, contracts,
    entropi2: true, athlete, date, client, foods, storage,
    onNavigate: route => latest.current.onNavigate?.(route),
    onCoach: () => latest.current.onCoach?.(),
    // Entropi 2: følger skærmen dags dato, bestemmes datoen ved gemning; ellers den valgte dato.
    currentDay: () => (typeof latest.current.currentDay === 'function' ? latest.current.currentDay() : date),
    onDayChanged: day => latest.current.onDayChanged?.(day),
    ...weight,
  })
}

// APP-KOST-START1: vægtprops videresendes uden genmontering. OFF-cleanup har ingen updateWeight.
export function forwardKostWeight(cleanup, { weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight } = {}) {
  cleanup?.updateWeight?.({ weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight })
}

// React may replace the outer host when the optional disclosure appears.
// The session moves its existing imperative content into that host, preserving
// unfinished tracker input, pending writes and weight handlers.
export function KostTrackerHost({ session, screen, weight }) {
  const root = useRef(null)
  useEffect(() => {
    if (!session || !root.current) return undefined
    return session.attachTracker(root.current, weight)
  }, [session])
  const { weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight } = weight
  useEffect(() => {
    forwardKostWeight(screen.current, { weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight })
  }, [weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight])
  return createElement('div', { ref: root, 'data-entropi2-kost': '' })
}

// React-ramme om én atlet/dag. Vægtopdateringer erstatter ikke dagssessionen.
export default function Entropi2Kost({ enabled = false, athlete, date, client, foods, onNavigate, onCoach,
  weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight, currentDay, onDayChanged }) {
  const screen = useRef(null)
  const [session, setSession] = useState(null)
  const latest = useRef({ onNavigate, onCoach, currentDay, onDayChanged })
  const weight = { weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight }
  useEffect(() => { latest.current = { onNavigate, onCoach, currentDay, onDayChanged } })
  useEffect(() => { if (enabled === true) loadEntropi2Styles() }, [enabled])
  useEffect(() => {
    if (enabled !== true || !athlete?.id) return undefined
    const storage = typeof localStorage === 'undefined' ? undefined : localStorage
    const day = createKostDaySession({ enabled: true, athleteId: athlete.id, date, client, storage,
      onDiaryChanged: () => screen.current?.refresh?.(),
      currentDay: () => (typeof latest.current.currentDay === 'function' ? latest.current.currentDay() : date) })
    let trackerHost, cleanup
    setSession({ ...day, attachTracker(container, currentWeight) {
      if (!trackerHost) {
        const target = container.ownerDocument.createElement('div')
        cleanup = mountKost(target, { athlete, date, client, foods, storage, contracts: day.contracts }, latest, currentWeight)
        trackerHost = target
        screen.current = cleanup
      }
      container.append(trackerHost)
      return () => { if (trackerHost.parentElement === container) trackerHost.remove() }
    } })
    void day.controller.load()
    return () => { day.dispose(); if (screen.current === cleanup) screen.current = null; cleanup?.() }
  }, [enabled, athlete?.id, athlete?.kcal_target, athlete?.protein_target, date, client, foods])
  const current = session?.athleteId === athlete?.id && session?.date === date && session?.client === client ? session : null
  return enabled === true && athlete?.id ? createElement(KostDayFrame, { controller: current?.controller,
    tracker: createElement(KostTrackerHost, { session: current, screen, weight }) }) : null
}
