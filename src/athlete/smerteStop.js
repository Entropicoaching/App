// Ordre 1502 (D3, Marcs V10 3A): en smerte-note standser appens stigningsforslag.
// Ordre 1509 (fund 2): stoppet rammer kun de loeft, som notens kropsdel handler om,
// og regnes fra notens dato (ikke ugens start). Uklar kropsdel: alle loeft.
import { bodyPartsOf, mentionsPain } from '../coachBriefingRules.js'

const DAG = 86400000
export const FRIST_DAGE = 14 // samme graense som coachens smerte-linje

// Ordre 1509 fund 1 (ESKALERING): den rolige linje, bag flag og slaaet FRA.
// Tavst (false) er standard, indtil Marc vaelger.
export const SMERTE_BESKED_AKTIV = false
export const SMERTE_BESKED = 'Ingen forslag i dag: tal med din coach om smerten'

const BEN = /squat|b[øo]j|\bben\b|benpres|lunge|split|\bleg\b|hack|step|calf|l[æa]g|hip ?thrust|bridge/i
const RYG_LOEFT = /d[øo]dl[øo]ft|deadlift|rdl|good ?morning|\brow\b|roning|hyperext|rygstr/i
const OVERKROP = /b[æa]nk|bench|press|pres\b|skulder|shoulder|dips|pull-?up|chin|curl|triceps|fly|lateral|push-?up|face ?pull|pulldown|r[æa]kk|row|roning/i
const GRUPPER = { ben: BEN, ryg: RYG_LOEFT, over: OVERKROP }
const REGION_GRUPPER = {
  'knæet': ['ben'], anklen: ['ben'], hoften: ['ben', 'ryg'], lysken: ['ben', 'ryg'],
  ryggen: ['ben', 'ryg'], skulderen: ['over'], albuen: ['over'], 'håndleddet': ['over'],
}

/** Rammer en smerte i de naevnte kropsdele dette loeft? Uklar kropsdel eller uklassificeret loeft: ja (sikker side). */
export function ramtAfSmerte(kropsdele, oevelsesnavn) {
  if (!kropsdele?.length) return true
  const navn = String(oevelsesnavn || '')
  const klasse = Object.keys(GRUPPER).filter(g => GRUPPER[g].test(navn))
  if (!klasse.length) return true
  return kropsdele.some(del => {
    const grupper = REGION_GRUPPER[del]
    return !grupper || grupper.some(g => klasse.includes(g)) // nakken m.fl.: alle
  })
}

const dagMs = d => new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime()

// Sessioner har ingen dato; notens dato = seneste loggede saet af sessionens oevelser
// inden for ugen +14 dage (noten skrives efter passet). Mangler logs: ugens sidste dag (dog senest i dag).
function noteDato(week, session, historik, i_dag) {
  const start = dagMs(week.start_date)
  const slut = start + 13 * DAG
  let seneste = null
  for (const ex of session.exercises || []) {
    for (const h of historik?.[String(ex.name || '').toLowerCase()] || []) {
      const t = dagMs(h.date)
      if (t >= start && t <= slut && (seneste == null || t > seneste)) seneste = t
    }
  }
  return seneste ?? Math.min(start + 6 * DAG, i_dag)
}

export function smerteStopAktiv(weeks, oevelsesnavn, nu = Date.now(), historik = {}) {
  const i_dag = dagMs(new Date(nu).toISOString())
  for (const w of weeks || []) {
    if (!w?.start_date || !Number.isFinite(dagMs(w.start_date)) || dagMs(w.start_date) > i_dag) continue
    for (const s of w.sessions || []) {
      if (!mentionsPain(s.athlete_comment)) continue
      const dato = noteDato(w, s, historik, i_dag)
      if (dato > i_dag || i_dag - dato > FRIST_DAGE * DAG) continue
      if (ramtAfSmerte(bodyPartsOf(s.athlete_comment), oevelsesnavn)) return true
    }
  }
  return false
}

/** Pakker suggestNextWeight: ingen forslag for loeft, som en frisk smerte-note rammer. */
export function udenForslagVedSmerte(suggestNextWeight, weeks, historik = {}, nu = Date.now()) {
  const f = (navn, intensitet) => (smerteStopAktiv(weeks, navn, nu, historik) ? null : suggestNextWeight(navn, intensitet))
  f.smerteStop = navn => smerteStopAktiv(weeks, navn, nu, historik)
  return f
}

/** Den rolige linje: kun naar flaget er taendt og stoppet rammer netop dette loeft. */
export const smerteBeskedFor = (suggestNextWeight, navn, aktiv = SMERTE_BESKED_AKTIV) =>
  aktiv && suggestNextWeight?.smerteStop?.(navn) ? SMERTE_BESKED : null
