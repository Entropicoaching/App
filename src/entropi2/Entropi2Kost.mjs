import { createElement, useEffect, useRef } from 'react'
import { mountNutritionScreen } from './nutrition/index.mjs'
import { loadEntropi2Styles } from './styles.mjs'

// Montering af kostskærmen med de aktuelle vægtprops. Navigation går altid til den nyeste handler.
export function mountKost(host, { athlete, date, client, foods, storage }, latest, weight = {}) {
  return mountNutritionScreen(host, {
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
export function forwardKostWeight(cleanup, { weightLogs, weightInput, onWeightInput, logWeight, savingWeight } = {}) {
  cleanup?.updateWeight?.({ weightLogs, weightInput, onWeightInput, logWeight, savingWeight })
}

// React-ramme om kostskærmens egen DOM-montering. Monteres om ved atlet-, dato- eller målskift.
// Efter hver relevant gengivelse følger den nyeste logWeight-closure det tilhørende weightInput.
export default function Entropi2Kost({ enabled = false, athlete, date, client, foods, onNavigate, onCoach,
  weightLogs, weightInput, onWeightInput, logWeight, savingWeight, currentDay, onDayChanged }) {
  const root = useRef(null)
  const screen = useRef(null)
  const latest = useRef({ onNavigate, onCoach, currentDay, onDayChanged })
  const weight = { weightLogs, weightInput, onWeightInput, logWeight, savingWeight }
  const latestWeight = useRef(weight)
  // Kører før monteringen i samme commit, så en ny montering får de aktuelle vægtprops.
  useEffect(() => { latest.current = { onNavigate, onCoach, currentDay, onDayChanged }; latestWeight.current = weight })
  useEffect(() => { if (enabled === true) loadEntropi2Styles() }, [enabled])
  useEffect(() => {
    if (enabled !== true || !root.current || !athlete?.id) return undefined
    const cleanup = mountKost(root.current, { athlete, date, client, foods,
      storage: typeof localStorage === 'undefined' ? undefined : localStorage }, latest, latestWeight.current)
    screen.current = cleanup
    return () => { if (screen.current === cleanup) screen.current = null; cleanup() }
  // Atlet, mål, dato, klient eller hentede fødevarer giver ny montering. Vægt gør ikke.
  // athlete læses kun ved montering; id og mål er afhængighederne.
  }, [enabled, athlete?.id, athlete?.kcal_target, athlete?.protein_target, date, client, foods])
  useEffect(() => {
    forwardKostWeight(screen.current, { weightLogs, weightInput, onWeightInput, logWeight, savingWeight })
  }, [weightLogs, weightInput, onWeightInput, logWeight, savingWeight])
  return enabled === true && athlete?.id ? createElement('div', { ref: root, 'data-entropi2-kost': '' }) : null
}
