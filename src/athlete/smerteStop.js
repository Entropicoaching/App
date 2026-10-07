// Ordre 1502 (D3, Marcs V10 3A): en smerte-note standser appens stigningsforslag.
// Samme smerteord som coachens briefing (mentionsPain, "ingen smerter" taeller ikke).
// Uger har start_date, pas har ikke; en uge taeller i uge-start + 7 dage + 14 dages
// frist, dvs. den samme 14-dages graense som coachens smerte-linje.
import { mentionsPain } from '../coachBriefingRules.js'

const DAG = 86400000
const FRIST_DAGE = 21

export function smerteStopAktiv(weeks, nu = Date.now()) {
  for (const w of weeks || []) {
    if (!w?.start_date) continue
    const start = new Date(w.start_date).getTime()
    if (!Number.isFinite(start) || start > nu || nu - start > FRIST_DAGE * DAG) continue
    if ((w.sessions || []).some(s => mentionsPain(s.athlete_comment))) return true
  }
  return false
}

/** Pakker suggestNextWeight: ingen forslag mens en smerte-note staar. */
export function udenForslagVedSmerte(suggestNextWeight, weeks, nu = Date.now()) {
  return (navn, intensitet) => (smerteStopAktiv(weeks, nu) ? null : suggestNextWeight(navn, intensitet))
}
