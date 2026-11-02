import { useEffect, useMemo, useState } from 'react'

// Entropi 2: kalenderdagens ur. Skærmene beregner "i dag" ved gengivelse; uret sørger for, at der
// gengives igen, når dagen skifter, også når appen står åben uden andre ændringer.
// today er appens egen dagsfunktion (calendarDay/today), så alle skærme bruger samme dag.
export function startDayClock({ today, onDay, every = 60 * 1000, timers = globalThis }) {
  if (typeof today !== 'function' || typeof onDay !== 'function') return undefined
  let seen = today()
  const id = timers.setInterval(() => {
    const now = today()
    if (now !== seen) { seen = now; onDay(now) }
  }, every)
  return () => timers.clearInterval(id)
}

// Kun med flaget tændt startes uret. refresh() læser dagen straks, fx når en skærm opdager en forældet dag.
export function useEntropi2Dag({ enabled = false, today }) {
  const [day, setDay] = useState(() => (typeof today === 'function' ? today() : ''))
  useEffect(() => (enabled === true ? startDayClock({ today, onDay: setDay }) : undefined), [enabled, today])
  const refresh = useMemo(() => () => { if (typeof today === 'function') setDay(today()) }, [today])
  return useMemo(() => ({ day, refresh }), [day, refresh])
}
