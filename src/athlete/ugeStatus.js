// ORDRE 268 · commit 1 — atletens egen "planlagt mod gennemført", ugens 7
// dage. Stå på skuldre af src/volume/planlagt.js (ordre 210): samme
// grundregel — planlagt tælles fra PROGRAMMET (weeks→sessions→exercises),
// gennemført fra LOGGEN, og et sæt markeret skipped:true tæller ALDRIG som
// gennemført (samme linje som planlagt.js's egen kommentar, "kun
// gennemførte sæt tælles"). Forskellen: enheden her er ikke muskelgrupper
// (det er en coach-fane, VolumenKort.jsx) men SÆT OG TONNAGE — det atleten
// selv kan se med det samme, uden at skulle vide hvad en "muskelgruppe,
// ialt" betyder.
//
// Planlagt tonnage kræver en kendt vægt OG et kendt reps-tal pr. øvelse.
// exercises.recommended_weight er ofte tom (coachen sætter den ikke altid),
// og reps kan være et interval ("4-6", laveste ende brugt — samme
// konvention som DagensPasCard's repsDefault) eller "frit" (ukendt,
// parseRepsPrescription). Mangler blot ÉN øvelse i dagen et af de to, er
// planlagt tonnage UKENDT for hele dagen (null) — ikke et tal der lyver ved
// kun at tælle de kendte øvelser med. Samme "– frem for et forkert 0"-
// princip som planlagt.js's ugePlaceret.

import { parseRepsPrescription } from '../repsPrescription.js'
import { ugenoegle } from '../volume/ugenoegle.js'

function planlagtRepsForExercise(reps) {
  const prescription = parseRepsPrescription(reps)
  if (prescription.type === 'range') return prescription.min
  if (prescription.type === 'free') return null
  const n = Number(reps)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Planlagt sæt + tonnage for én øvelse. tonnage er null hvis vægt eller reps er ukendt. */
function planlagtForExercise(ex) {
  const saet = Number(ex.sets) || 0
  if (saet <= 0) return { saet: 0, tonnage: 0 }
  const vaegt = ex.recommended_weight
  const reps = planlagtRepsForExercise(ex.reps)
  const tonnage = (vaegt != null && reps != null) ? saet * reps * vaegt : null
  return { saet, tonnage }
}

/** Lægger én sessions øvelser oveni en { saet, tonnage, tonnageKendt }-bucket. */
function laegSessionOveni(bucket, sess) {
  for (const ex of sess.exercises || []) {
    const { saet, tonnage } = planlagtForExercise(ex)
    bucket.saet += saet
    if (tonnage == null) bucket.tonnageKendt = false
    else bucket.tonnage += tonnage
  }
}

const WEEKDAY_COUNT = 7

/**
 * Ugens 7 dage (mandag=0..søndag=6), planlagt mod gennemført, sæt og
 * tonnage. Gennemført matches via exercise_id (samme mekanisme som
 * WeekCalendar/DagensPasCard's sessDone i AthleteView.jsx) i stedet for
 * kalenderdato — så dagslinjen virker uændret selv når ugen ikke har en
 * start_date sat (weekStart null), ligesom resten af Hjem-fanen allerede
 * gør. Sessioner uden fast ugedag (weekday: null, "fleksible" sessioner) er
 * ikke med i nogen dag her — de har ingen dag at stå på — talt i stedet i
 * det returnerede `flexSessioner`.
 *
 * @param {{ sessions?: Array<{ weekday?: number|null, title?: string, exercises?: Array<{ id, sets, reps, recommended_weight }> }> }} week
 * @param {Date|null} weekStart Mandag i ugen (AthleteView.jsx's weekStartDate), eller null hvis ukendt.
 * @param {Array<{ exercise_id: string, weight?: number, reps_completed?: number, skipped?: boolean }>} logs
 * @returns {{
 *   dage: Array<{ weekday: number, date: Date|null, harSession: boolean, titler: string[],
 *     planlagtSaet: number, gennemfoertSaet: number,
 *     planlagtTonnage: number|null, gennemfoertTonnage: number, fuldtLogget: boolean }>,
 *   flexSessioner: number,
 * }}
 */
export function beregnUgeDage(week, weekStart, logs) {
  const buckets = Array.from({ length: WEEKDAY_COUNT }, () => ({
    harSession: false, titler: [], saet: 0, tonnage: 0, tonnageKendt: true, exerciseIds: new Set(),
  }))
  let flexSessioner = 0

  for (const sess of week?.sessions || []) {
    if (sess.weekday == null || sess.weekday < 0 || sess.weekday >= WEEKDAY_COUNT) { flexSessioner += 1; continue }
    const bucket = buckets[sess.weekday]
    bucket.harSession = true
    if (sess.title) bucket.titler.push(sess.title)
    laegSessionOveni(bucket, sess)
    for (const ex of sess.exercises || []) bucket.exerciseIds.add(ex.id)
  }

  const dage = buckets.map((bucket, weekday) => {
    let gennemfoertSaet = 0, gennemfoertTonnage = 0
    for (const log of logs || []) {
      if (log.skipped || !bucket.exerciseIds.has(log.exercise_id)) continue
      gennemfoertSaet += 1
      gennemfoertTonnage += (Number(log.weight) || 0) * (Number(log.reps_completed) || 0)
    }
    return {
      weekday,
      date: weekStart ? new Date(weekStart.getTime() + weekday * 86400000) : null,
      harSession: bucket.harSession,
      titler: bucket.titler,
      planlagtSaet: bucket.saet,
      gennemfoertSaet,
      planlagtTonnage: bucket.tonnageKendt ? Math.round(bucket.tonnage) : null,
      gennemfoertTonnage: Math.round(gennemfoertTonnage),
      fuldtLogget: bucket.harSession && bucket.saet > 0 && gennemfoertSaet >= bucket.saet,
    }
  })

  return { dage, flexSessioner }
}

/**
 * ORDRE 268 · commit 2 — samme "hele forløbet"-ramme som
 * beregnPlanlagtPrUge (planlagt.js), sæt og tonnage i stedet for
 * muskelgrupper: PR. KALENDERUGE, kun uger der har mindst én dateret
 * programuge, gennemført matches udelukkende på kalenderdato (logged_at),
 * ikke på exercise_id — nøjagtig samme regel som planlagt.js (se dens egen
 * kommentar: "der er intet at sammenligne dem MOD" for uger uden dato).
 *
 * @param {Array<{ start_date?: string|null, sessions?: Array<{ exercises?: Array }> }>} weeks
 * @param {Array<{ weight?: number, reps_completed?: number, skipped?: boolean, logged_at: string|Date }>} logs
 * @returns {{
 *   uger: Array<{ uge: string,
 *     planlagt: { saet: number, tonnage: number|null },
 *     gennemfoert: { saet: number, tonnage: number } }>,
 *   ugerUdenDato: number,
 * }} `uger` ældste først, ligesom beregnPlanlagtPrUge.
 */
export function beregnForloebUger(weeks, logs) {
  const buckets = new Map()
  let ugerUdenDato = 0

  for (const uge_ of weeks || []) {
    if (!uge_.start_date) { ugerUdenDato += 1; continue }
    const noegle = ugenoegle(uge_.start_date)
    if (!buckets.has(noegle)) {
      buckets.set(noegle, {
        planlagt: { saet: 0, tonnage: 0, tonnageKendt: true },
        gennemfoert: { saet: 0, tonnage: 0 },
      })
    }
    const bucket = buckets.get(noegle)
    for (const sess of uge_.sessions || []) laegSessionOveni(bucket.planlagt, sess)
  }

  for (const log of logs || []) {
    if (log.skipped) continue
    const bucket = buckets.get(ugenoegle(log.logged_at))
    if (!bucket) continue // ingen dateret programuge denne kalenderuge — intet at sammenligne mod
    bucket.gennemfoert.saet += 1
    bucket.gennemfoert.tonnage += (Number(log.weight) || 0) * (Number(log.reps_completed) || 0)
  }

  const uger = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uge, bucket]) => ({
      uge,
      planlagt: { saet: bucket.planlagt.saet, tonnage: bucket.planlagt.tonnageKendt ? Math.round(bucket.planlagt.tonnage) : null },
      gennemfoert: { saet: bucket.gennemfoert.saet, tonnage: Math.round(bucket.gennemfoert.tonnage) },
    }))

  return { uger, ugerUdenDato }
}
