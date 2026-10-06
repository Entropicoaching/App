// ORDRE 284 · commit 1 — "er squatten rent faktisk blevet stærkere siden
// marts": for ÉN øvelse (ikke et hovedløft-bundt), det tungeste gennemførte
// sæt pr. kalenderuge over tid, plus det beregnede énrepetitionsmaksimum.
// Rene funktioner, ingen Supabase/React — samme mønster som volume/beregn.js,
// genbruger dens ugenoegle() (kalenderuge, mandag-søndag, ISO 8601) i stedet
// for at opfinde egen datologik.
//
// estimatedOneRepMax() er UDTRUKKET herfra til AthleteView.jsx's PR-
// detektion og hovedløfts-widget (E1RMChart/fetchWeeklyTonnage) — samme tal
// tre steder er ordrens egen betingelse ("efter samme formel som resten af
// appen bruger"), ikke en ny formel.
//
// The four main-lift series match exact normalized lifts. Picker families can
// organize variants, but estimates for a variant never enter a main-lift series.
// Strength curves use bestEstimatedSetPerWeek; heaviestSetPerWeek remains the
// weight-only summary API for existing consumers.

import { exerciseSetView } from './exerciseSetView.js'
import { erLetSaetNavn } from './exerciseNames.js'
import { ugenoegle } from './volume/ugenoegle.js'

/** Epley: vægt × (1 + reps / 30). Samme formel i hele appen — se filens egen note. */
export function estimatedOneRepMax(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 1
  return w * (1 + r / 30)
}

export const HOVEDLOEFT_FAMILIER = [
  { key: 'squat', label: 'Squat', color: '#4e8fcf', match: n => exerciseSetView(n).key === 'squat' },
  { key: 'baenk', label: 'Bænkpres', color: '#c8923a', match: n => exerciseSetView(n).key === 'baenkpres' },
  { key: 'doedloeft', label: 'Dødløft', color: '#6cba6c', match: n => exerciseSetView(n).key === 'doedloeft' },
  { key: 'sumo', label: 'Sumo dødløft', color: '#b68bd1', match: n => exerciseSetView(n).key === 'sumo doedloeft' },
]

/**
 * Hvilken hovedløft-familie et øvelsesnavn hører til: PRÆCIS de fire (Marcs dom
 * 6. okt, V17: "Hovedløft er præcis fire: squat, bænkpres, konventionel
 * dødløft og sumo dødløft. Alt andet (front squat, pause, close-grip, goblet,
 * RDL osv.) er varianter/assistance"). Sættype-suffikser og stavemåder
 * ("Bænkpres top set", "baenk teknik single", "Bench") foldes til samme løft.
 * Varianter giver null og havner under "Andre øvelser".
 */
export function hovedloeftFamilie(navn) {
  return HOVEDLOEFT_FAMILIER.find(f => f.match(navn))?.key ?? null
}

/**
 * Grupperer en liste af ØVELSESNAVNE (typisk alle distinkte navne atleten
 * har logget) til øvelsesvælgeren: de fire hovedløft (ét navn hver) og
 * "andre" (varianter og assistance) — resten,
 * i den rækkefølge de kom ind (kaldestedet sorterer selv om nødvendigt).
 *
 * @param {string[]} navne
 * @returns {{ squat: string[], baenk: string[], doedloeft: string[], sumo: string[], andre: string[] }}
 */
export function grupperOevelsesnavne(navne) {
  const grupper = { squat: [], baenk: [], doedloeft: [], sumo: [], andre: [] }
  for (const navn of navne || []) {
    const familie = hovedloeftFamilie(navn)
    grupper[familie || 'andre'].push(navn)
  }
  return grupper
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

// Strength estimate uses the best estimate, which can come from a lighter backoff.
export function bestEstimatedSetPerWeek(logs) {
  const best = new Map()
  for (const log of logs || []) {
    const weight = Number(log.weight), reps = Number(log.reps_completed)
    if (log.skipped || !(weight > 0) || !(reps > 0)) continue
    const uge = ugenoegle(log.logged_at)
    const val = estimatedOneRepMax(weight, reps)
    const cur = best.get(uge)
    if (!cur || val > cur.val || (val === cur.val && weight > cur.weight))
      best.set(uge, { uge, weight, reps, val })
  }
  return [...best.values()].sort((a, b) => a.uge.localeCompare(b.uge))
    .map(({ val, ...p }) => ({ ...p, e1rm: Math.round(val) }))
}

// Ordre 1421: styrke-kurven (Fremgang og forsidens hovedloeft-graf) bygges kun
// af RIGTIGE TUNGE saet. Et saet taeller ikke hvis det er et let saet efter
// navnet (backoff, teknik-single(r), volumen, sekundaer) eller har mere end
// MAX_TUNGE_REPS reps (Epley er upaalidelig langt ude, og det er opvarmning/
// volumen, ikke et styrketal). Saa kan et let saet aldrig traekke kurven ned.
export const MAX_TUNGE_REPS = 8

export function erTungtSaet(navn, reps) {
  const r = Number(reps)
  return !erLetSaetNavn(navn) && r > 0 && r <= MAX_TUNGE_REPS
}

const dagNoegle = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Hoejeste e1RM pr. DAG, kun fra tunge saet. Logs er raekker med
 * exercises.name (det RAA navn, saa saettypen kan ses), weight, reps_completed,
 * logged_at. Dage uden et tungt saet faar intet punkt (hul, ikke et lavt tal).
 * Aeldste dag foerst.
 */
export function bestHeavySetPerDay(logs) {
  const best = new Map()
  for (const log of logs || []) {
    const weight = Number(log.weight), reps = Number(log.reps_completed)
    if (log.skipped || !(weight > 0) || !erTungtSaet(log.exercises?.name ?? log.navn, reps)) continue
    const dag = dagNoegle(log.logged_at)
    if (!dag) continue
    const val = estimatedOneRepMax(weight, reps)
    const cur = best.get(dag)
    if (!cur || val > cur.val || (val === cur.val && weight > cur.weight)) best.set(dag, { dag, weight, reps, val, navn: log.exercises?.name ?? log.navn })
  }
  return [...best.values()].sort((a, b) => a.dag.localeCompare(b.dag))
    .map(({ val, ...p }) => ({ ...p, e1rm: Math.round(val) }))
}