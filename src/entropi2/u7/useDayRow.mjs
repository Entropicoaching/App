import * as React from 'react'
import { readDaily, saveDaily, readTargets, appendTarget, targetOn, moveLocalOnce } from './dayData.mjs'

// Hooks hentes via navnerummet som i U3/U5: lukkede prøveharnesser kan erstatte 'react'.
// Dagens række i tracking_daily_v1 for én atlet. status er 'off' uden flag, 'missing' uden
// tabellen (så viser kalderen det samme som U6), 'ready' når tabellen findes, ellers 'error'.
// Første gang tabellen findes, flyttes telefonens data op én gang (moveLocalOnce).
export function useDayRow({ enabled, client, athleteId, date, storage }) {
  const key = enabled === true && client && athleteId && date ? `${athleteId}|${date}` : null
  const [state, setState] = React.useState({ key: null, status: 'off', row: null })
  const latest = React.useRef(null)
  latest.current = key
  React.useEffect(() => {
    if (!key) return undefined
    let active = true
    readDaily({ client, athleteId, from: date, to: date }).then(async result => {
      if (!active) return
      setState({ key, status: result.state, row: result.rows.find(r => r.logged_date === date) ?? null })
      if (result.state !== 'ready') return
      if (await moveLocalOnce({ client, athleteId, storage, today: date }) !== 'moved' || !active) return
      const again = await readDaily({ client, athleteId, from: date, to: date })
      if (active && again.state === 'ready') setState({ key, status: 'ready', row: again.rows.find(r => r.logged_date === date) ?? null })
    })
    return () => { active = false }
  }, [key, client, athleteId, date, storage])
  const current = state.key === key ? state : { status: key ? 'loading' : 'off', row: null }
  const save = React.useCallback(async patch => {
    if (!key) return 'off'
    const result = await saveDaily({ client, athleteId, date, patch })
    if (result === 'saved' && latest.current === key)
      setState(s => s.key === key ? { ...s, status: 'ready', row: { ...(s.row ?? { athlete_id: athleteId, logged_date: date }), ...patch } } : s)
    return result
  }, [key, client, athleteId, date])
  return { status: current.status, row: current.row, save }
}

// Atletens eget væskemål fra nutrition_targets_v1 (det, der gælder i dag), og en gem-funktion,
// der lægger en ny dateret række. Uden tabellen: status 'missing', og målet bliver på telefonen.
export function useWaterTarget({ enabled, client, athleteId, date }) {
  const key = enabled === true && client && athleteId && date ? `${athleteId}|${date}` : null
  const [state, setState] = React.useState({ key: null, status: 'off', goal: null })
  React.useEffect(() => {
    if (!key) return undefined
    let active = true
    readTargets({ client, athleteIds: [athleteId] }).then(result => {
      if (active) setState({ key, status: result.state, goal: targetOn(result.rows, athleteId, date, 'water_ml')?.value ?? null })
    })
    return () => { active = false }
  }, [key, client, athleteId, date])
  const current = state.key === key ? state : { status: key ? 'loading' : 'off', goal: null }
  const save = React.useCallback(async ml => {
    if (!key || current.status !== 'ready') return current.status
    const result = await appendTarget({ client, athleteId, day: date, fields: { water_ml: ml } })
    if (result === 'saved') setState(s => s.key === key ? { ...s, goal: ml } : s)
    return result
  }, [key, client, athleteId, date, current.status])
  return { status: current.status, goal: current.goal, save }
}
