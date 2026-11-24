import { useEffect, useState } from 'react'
import { laesKostKlienter, civil } from './kostKlienter.mjs'

// Hook på coachforsiden: ét opslag pr. dag og atletliste. Svar for en gammel liste kasseres.
export function useKostKlienter({ client, athleteIds, day }) {
  const [result, setResult] = useState(null)
  const ids = Array.isArray(athleteIds) ? [...athleteIds].sort() : []
  const key = client && civil(day) && ids.length ? JSON.stringify([day, ids]) : null
  useEffect(() => {
    setResult(null)
    if (!key) return undefined
    let active = true
    const [keyDay, keyIds] = JSON.parse(key)
    laesKostKlienter(client, keyIds, keyDay).then(set => { if (active) setResult({ key, set }) }, () => {})
    return () => { active = false }
  }, [key, client])
  return result?.key === key ? result.set : null
}
