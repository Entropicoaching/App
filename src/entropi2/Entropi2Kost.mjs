import { createElement, useEffect, useRef } from 'react'
import { mountNutritionScreen } from './nutrition/index.mjs'
import './nutrition/nutrition.css'
import './entropi2.css'

// React-ramme om kostskærmens egen DOM-montering. Monteres om ved atlet- eller datoskift.
export default function Entropi2Kost({ enabled = false, athlete, date, client, foods, onNavigate, onCoach }) {
  const root = useRef(null)
  const latest = useRef({ onNavigate, onCoach })
  useEffect(() => { latest.current = { onNavigate, onCoach } })
  useEffect(() => {
    if (enabled !== true || !root.current || !athlete?.id) return undefined
    return mountNutritionScreen(root.current, {
      entropi2: true, athlete, date, client, foods,
      storage: typeof localStorage === 'undefined' ? undefined : localStorage,
      onNavigate: route => latest.current.onNavigate?.(route),
      onCoach: () => latest.current.onCoach?.(),
    })
  // Atlet, dato, klient eller hentede fødevarer giver ny montering.
  }, [enabled, athlete?.id, date, client, foods])
  return enabled === true && athlete?.id ? createElement('div', { ref: root, 'data-entropi2-kost': '' }) : null
}
