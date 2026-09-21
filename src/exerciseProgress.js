// ORDRE 284 · commit 1 — "er squatten rent faktisk blevet stærkere siden
// marts": for ÉN øvelse, det tungeste gennemførte sæt pr. kalenderuge over
// tid, plus det beregnede énrepetitionsmaksimum. Rene funktioner, ingen
// Supabase/React — samme mønster som volume/beregn.js, genbruger dens
// ugenoegle() (kalenderuge, mandag-søndag, ISO 8601) i stedet for at opfinde
// egen datologik.
//
// estimatedOneRepMax() er UDTRUKKET herfra til AthleteView.jsx's PR-
// detektion og hovedløfts-widget — samme tal flere steder er ordrens egen
// betingelse ("efter samme formel som resten af appen bruger"), ikke en ny
// formel.
import { ugenoegle } from './volume/beregn.js'

/** Epley: vægt × (1 + reps / 30). Samme formel i hele appen — se filens egen note. */
export function estimatedOneRepMax(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 1
  return w * (1 + r / 30)
}

/**
 * Det tungeste gennemførte sæt pr. kalenderuge, for ÉN øvelses logs
 * (kaldestedet filtrerer selv til ét øvelsesnavn). "Tungeste" = højest vægt;
 * ved lige vægt vinder flest reps (mere volumen på samme vægt er stadig
 * fremgang værd at vise).
 *
 * @param {Array<{weight: number, reps_completed: number, logged_at: string}>} logs
 *   Forventes allerede filtreret til skipped:false og weight > 0.
 * @returns {Array<{uge: string, weight: number, reps: number, e1rm: number}>}
 *   ÆLDSTE UGE FØRST (kronologisk, klar til en graf der læses venstre-mod-højre).
 */
export function heaviestSetPerWeek(logs) {
  const bedst = new Map()
  for (const log of logs || []) {
    const weight = Number(log.weight) || 0
    const reps = Number(log.reps_completed) || 0
    if (weight <= 0) continue
    const uge = ugenoegle(log.logged_at)
    const current = bedst.get(uge)
    if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) {
      bedst.set(uge, { uge, weight, reps })
    }
  }
  return [...bedst.values()]
    .sort((a, b) => (a.uge < b.uge ? -1 : 1))
    .map(p => ({ ...p, e1rm: Math.round(estimatedOneRepMax(p.weight, p.reps)) }))
}
