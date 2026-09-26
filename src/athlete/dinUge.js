// ORDRE 439 · blok 2 — "din uge": når ugens sidste pas er klaret, et lille
// kort med antal pas, samlet tonnage, ugens rekorder og atletens egne
// vurderinger (1-5). Rene funktioner over data appen allerede har (programmet,
// ugens exerciseLogs, Fremgangs historik); intet nyt hentes eller gemmes.
import { isSessionDone } from '../nextSet.js'
import { rekordListe, tidligereSaet, ugensSaet } from './rekorder.js'

// null = ugen er ikke klaret endnu (et pas med øvelser mangler sæt), eller
// intet blev gennemført (kun sprunget over / tom uge).
export function dinUge({ week, allWeeks, exerciseLogs, fremgangLogs }) {
  const sessioner = (week?.sessions || []).filter(s => (s.exercises || []).length > 0)
  if (sessioner.length === 0) return null
  if (!sessioner.every(s => isSessionDone(s, exerciseLogs))) return null
  const ids = new Set(sessioner.flatMap(s => s.exercises.map(e => e.id)))
  const ugensLogs = (exerciseLogs || []).filter(l => ids.has(l.exercise_id))
  const gennemfoert = ugensLogs.filter(l => !l.skipped)
  if (gennemfoert.length === 0) return null

  const pasKlaret = sessioner.filter(s => {
    const exIds = new Set(s.exercises.map(e => e.id))
    return gennemfoert.some(l => exIds.has(l.exercise_id))
  }).length
  const tonnage = Math.round(gennemfoert.reduce((sum, l) => sum + (Number(l.weight) || 0) * (Number(l.reps_completed) || 0), 0))

  // Ugens rekorder: samme regel som fejringen (rekorder.js). Kendes historikken
  // ikke (ikke hentet), er tallet ukendt (null), ikke 0.
  const rekorder = fremgangLogs
    ? rekordListe([...tidligereSaet(fremgangLogs, week), ...ugensSaet(exerciseLogs, week, allWeeks)]).filter(r => r.denneUge)
    : null

  // Vurderingen læses fra allWeeks (saveFeedback opdaterer den dér).
  const frisk = new Map((allWeeks || []).flatMap(w => w.sessions || []).map(s => [s.id, s]))
  const vurderinger = sessioner.map(s => ({ id: s.id, titel: s.title || 'Pas', rating: frisk.get(s.id)?.athlete_rating ?? s.athlete_rating ?? null }))

  return { ugeNr: week.week_number ?? null, pasKlaret, pasIalt: sessioner.length, tonnage, rekorder, vurderinger }
}

export function tonnageTekst(kg) {
  return `${Math.round(kg).toLocaleString('da-DK')} kg`
}

// Linjen til coachen bliver en almindelig besked (messages), som alle andre.
export function ugeBesked(ugeNr, tekst) {
  const t = String(tekst || '').trim()
  if (!t) return ''
  return ugeNr != null ? `Om uge ${ugeNr}: ${t}` : t
}

const noegle = (athleteId, weekId) => `entropi_din_uge_sendt:${athleteId}:${weekId}`

export function erUgeLinjeSendt(athleteId, weekId, storage = globalThis.localStorage) {
  try { return !!storage?.getItem(noegle(athleteId, weekId)) } catch { return false }
}

export function markerUgeLinjeSendt(athleteId, weekId, storage = globalThis.localStorage) {
  try { storage?.setItem(noegle(athleteId, weekId), '1') } catch { /* kun en bekvemmelighed */ }
}
