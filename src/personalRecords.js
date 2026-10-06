import { exerciseSetView } from './exerciseSetView.js'
import { erTungtSaet } from './exerciseProgress.js'
// ORDRE 456 (A5 i docs/kritik-446): personal_records har dubletter fra før 456
// (samme øvelse, vægt og reps skrevet 2-3 gange, når næste sæt blev logget,
// før registreringen var færdig). Rækkerne slettes ikke; visningen viser hver
// (øvelse, vægt, reps) én gang, med den første registrering. Ren funktion.
const tid = (r) => String(r?.logged_at || r?.created_at || '')

export function unikkeRekorder(rows) {
  const foerste = new Map()
  for (const r of rows || []) {
    const k = `${exerciseSetView(r?.exercise_name).key}|${Number(r?.weight)}|${Number(r?.reps)}`
    const cur = foerste.get(k)
    if (!cur || (tid(r) && tid(r) < tid(cur))) foerste.set(k, r)
  }
  const behold = new Set(foerste.values())
  return (rows || []).filter(r => behold.has(r))
}

export function normaliserRekorder(rows) {
  return unikkeRekorder(rows).map(r => ({ ...r, exercise_name: exerciseSetView(r.exercise_name).name }))
}

export function bedsteRekorder(rows) {
  const best = new Map()
  for (const r of normaliserRekorder(rows)) {
    const key = exerciseSetView(r.exercise_name).key
    const cur = best.get(key)
    if (!cur || Number(r.weight) > Number(cur.weight) ||
      (Number(r.weight) === Number(cur.weight) && Number(r.reps) > Number(cur.reps))) best.set(key, r)
  }
  return [...best.values()]
}

// Ordre 1429: coachens rekordlister bruger samme regel som atletens Fremgang
// (ordre 1421): kun tunge saet (ikke backoff/teknik-single/volumen, hoejst 8
// reps). Filtreres paa det RAA navn, foer normaliserRekorder folder det.
export const tungeRekorder = (rows) => (rows || []).filter(r => erTungtSaet(r?.exercise_name, r?.reps))
