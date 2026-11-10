import { createElement as h, useEffect, useRef, useState } from 'react'
import { readWeekNutrition, weekTargetLine, syncCoachTargets } from './coachData.mjs'

// U7 del 4: under en række i "Kræver dit blik" står ugens kost mod det mål, der gjaldt den
// uge, når nutrition_targets_v1 findes og der er loggede dage. Ellers intet, som i U6.
export function WeekTargetLine({ client, athleteId, day, read = readWeekNutrition }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    setData(null)
    if (!client || !athleteId || !day) return undefined
    let active = true
    Promise.resolve(read({ client, athleteId, day })).then(result => { if (active) setData({ athleteId, day, result }) },
      () => { if (active) setData({ athleteId, day, result: null }) })
    return () => { active = false }
  }, [client, athleteId, day, read])
  if (data?.athleteId !== athleteId || data.day !== day || !data.result) return null
  const line = weekTargetLine({ ...data.result, athleteId, day })
  return line && h('p', { 'data-u7-week-target': athleteId, style: { margin: '0 0 12px', paddingInline: 4, color: '#b9b4a8' } }, line.text)
}

// Coachens nuværende mål (athletes.kcal_target/protein_target fra coachNutrition) dateres én
// gang pr. ændring. Uden tabellen sker intet.
export function useTargetSync({ enabled, client, targets, day }) {
  const done = useRef('')
  const signature = enabled && client && day && Array.isArray(targets)
    ? `${day}|${targets.map(t => `${t?.athlete_id}:${t?.kcal_target}:${t?.protein_target}`).sort().join(',')}` : ''
  const latest = useRef(targets)
  latest.current = targets
  useEffect(() => {
    if (!signature || done.current === signature) return
    done.current = signature
    syncCoachTargets({ client, targets: latest.current, day }).catch(() => {})
  }, [signature, client, day])
}
