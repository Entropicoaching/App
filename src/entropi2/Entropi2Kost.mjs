import { createElement, useEffect, useRef, useState } from 'react'
import { sharePlanCapabilityProbes } from './kostplan/planAdapter.mjs'
import { mountNutritionScreen } from './nutrition/index.mjs'
import { loadEntropi2Styles } from './styles.mjs'
import { mountExistingTracker } from './kostplan/atlet/trackerAdapter.mjs'
import { createKostDaySession } from './kostplan/atlet/daySession.mjs'
import KostDayFrame from './kostplan/atlet/KostDayFrame.mjs'
import ApprovedPlanShopping from './kostplan/atlet/ApprovedPlanShopping.mjs'

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
  return createElement('div', { ref: root, 'data-entropi2-kost': '' },
    !session && createElement('p', { role: 'status', style: { padding: 16 } },
      'Henter kostlog og vejning… Her kan du logge dagens mad og vejning og arbejde videre med din lokale Ugeplan.'))
}

// Independent read-only shopping state; the normal tracker remains mounted.
function KostShoppingFrame(props) {
  return createElement('div', null,
    createElement(KostDayFrame, props),
    createElement(ApprovedPlanShopping, { enabled: true, athleteId: props.athleteId,
      today: props.date, client: props.client, currentDay: props.currentDay }))
}

// React-ramme om én atlet/dag. Vægtopdateringer erstatter ikke dagssessionen.
export default function Entropi2Kost({ enabled = false, athlete, date, client, foods, onNavigate, onCoach,
  weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight, currentDay, onDayChanged }) {
  const planClient = enabled === true && athlete?.id ? sharePlanCapabilityProbes(client) : client
  const screen = useRef(null)
  const [session, setSession] = useState(null)
  const [checkin, setCheckin] = useState(null)
  const latest = useRef({ onNavigate, onCoach, currentDay, onDayChanged })
  const weight = { weightLogs, weightInput, onWeightInput, logWeight, savingWeight, weightStatus, retryWeight }
  useEffect(() => { latest.current = { onNavigate, onCoach, currentDay, onDayChanged } })
  useEffect(() => { if (enabled === true) loadEntropi2Styles() }, [enabled])
  useEffect(() => {
    if (enabled !== true || !athlete?.id) return undefined
    // Resolve from this effect's client owner. The memoized boundary is also
    // used by render/shopping, while the tracker keeps the original client.
    const planClient = sharePlanCapabilityProbes(client)
    const storage = typeof localStorage === 'undefined' ? undefined : localStorage
    const day = createKostDaySession({ enabled: true, athleteId: athlete.id, date, client: planClient, storage,
      onDiaryChanged: () => screen.current?.refresh?.(),
      currentDay: () => (typeof latest.current.currentDay === 'function' ? latest.current.currentDay() : date) })
    let trackerHost, cleanup, active = true
    // Capture this exact session and cleanup, never a later screen owner.
    const foodEntry = { openFoodLog(outer) {
      if (!active || !cleanup || screen.current !== cleanup || !trackerHost?.isConnected) return false
      return cleanup.openFoodLog?.(outer) === true
    } }
    setSession({ ...day, foodEntry, attachTracker(container, currentWeight) {
      if (!trackerHost) {
        const target = container.ownerDocument.createElement('div')
        cleanup = mountKost(target, { athlete, date, client, foods, storage, contracts: day.contracts }, latest, currentWeight)
        trackerHost = target
        screen.current = cleanup
        if (active && cleanup?.checkin) setCheckin({ athleteId: athlete.id, date, tracker: cleanup.checkin })
      }
      container.append(trackerHost)
      return () => { if (trackerHost.parentElement === container) trackerHost.remove() }
    } })
    void day.controller.load()
    return () => { active = false; setCheckin(null); day.dispose(); if (screen.current === cleanup) screen.current = null; cleanup?.() }
  }, [enabled, athlete?.id, athlete?.kcal_target, athlete?.protein_target, date, client, foods])
  const current = session?.athleteId === athlete?.id && session?.date === date && session?.client === planClient ? session : null
  return enabled === true && athlete?.id ? createElement(KostShoppingFrame, { controller: current?.controller, athleteId: athlete.id, date, client: planClient, currentDay,
    foodEntry: current?.foodEntry,
    checkin: checkin?.athleteId === athlete?.id && checkin?.date === date && current ? checkin.tracker : null, tracker: createElement(KostTrackerHost, { session: current, screen, weight }) }) : null
}
