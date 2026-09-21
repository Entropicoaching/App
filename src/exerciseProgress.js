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
// GRÆNSE: hovedløft-familierne (SQUAT/BAENK/DOEDLOEFT nedenfor) er kun til
// at ORGANISERE øvelsesvælgeren (blok 2's "Squat, bænk og dødløft øverst,
// variationer hører til") — hver eksakt øvelsesnavn (fx "Squat" og
// "Frontsquat") får sin EGEN kurve i heaviestSetPerWeek, de blandes aldrig
// sammen. NON_BARBELL-udelukkelsen er samme liste som den eksisterende
// hovedløfts-widget allerede brugte (maskiner/håndvægte giver misvisende
// høje 1RM-tal for et hovedløft).

import { ugenoegle } from './volume/beregn.js'

/** Epley: vægt × (1 + reps / 30). Samme formel i hele appen — se filens egen note. */
export function estimatedOneRepMax(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 1
  return w * (1 + r / 30)
}

const NON_BARBELL = /belt|hack|split|bulgar|goblet|smith|pendul|maskine|machine|leg press|sissy|db |dumbbell|håndvægt/

export const HOVEDLOEFT_FAMILIER = [
  { key: 'squat', label: 'Squat', color: '#4e8fcf', match: n => n.includes('squat') && !NON_BARBELL.test(n) },
  { key: 'baenk', label: 'Bænk', color: '#c8923a', match: n => (n.includes('bænk') || n.includes('bench')) && !NON_BARBELL.test(n) },
  { key: 'doedloeft', label: 'Dødløft', color: '#6cba6c', match: n => (n.includes('dødløft') || n.includes('deadlift') || /(^|\s)dl(\s|$)/.test(n)) && !NON_BARBELL.test(n) },
]

/**
 * Hvilken hovedløft-familie hører et øvelsesnavn til (kun til at organisere
 * øvelsesvælgeren) — null hvis navnet ikke matcher nogen af de tre.
 */
export function hovedloeftFamilie(navn) {
  const n = String(navn ?? '').toLowerCase()
  return HOVEDLOEFT_FAMILIER.find(f => f.match(n))?.key ?? null
}

/**
 * Grupperer en liste af ØVELSESNAVNE (typisk alle distinkte navne atleten
 * har logget) til øvelsesvælgeren: de tre hovedløft-familier (hver med sine
 * matchende navne, inkl. varianter som "Frontsquat"), og "andre" — resten,
 * i den rækkefølge de kom ind (kaldestedet sorterer selv om nødvendigt).
 *
 * @param {string[]} navne
 * @returns {{ squat: string[], baenk: string[], doedloeft: string[], andre: string[] }}
 */
export function grupperOevelsesnavne(navne) {
  const grupper = { squat: [], baenk: [], doedloeft: [], andre: [] }
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
