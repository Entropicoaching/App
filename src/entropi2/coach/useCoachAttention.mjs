import { useEffect, useState } from 'react'
import { readCoachAttention, startAttentionRefresh } from './coachAttentionRead.mjs'

// L1-hooken på coachforsiden. Gør intet, når U3 er slukket eller der mangler en
// klient. Skifter dag eller atleter, stoppes den gamle takt, og dens svar kasseres.
export function useCoachAttention({ enabled, client, athleteIds, day }) {
  const [result, setResult] = useState(null)
  const ids = Array.isArray(athleteIds) ? [...athleteIds].sort() : []
  const key = enabled === true && client && day ? JSON.stringify([day, ids]) : null
  useEffect(() => {
    setResult(null)
    if (!key) return undefined
    const [keyDay, keyIds] = JSON.parse(key)
    const control = startAttentionRefresh(() => readCoachAttention(client, keyIds, keyDay), setResult)
    return () => control.stop()
  }, [key, client])
  return result
}
