// ORDRE 450: fælles opsætning. Den syntetiske uge fra 419/439 (opdigtet
// Testatlet, tre forgangne uger, denne uge ulogget) plus, når `lang` er sat,
// en lang opdigtet historik før dem: ARKIV_RAEKKER sæt over ca. to år, på en
// arkiv-uge med de samme øvelsesnavne. Vægtene ligger under de tre forgangne
// ugers, så 439's rekorder (fx Squat 100 × 5 → e1RM 117, +3 kg) er de samme.
// Ingen prod, ingen atletdata.
import { bygSeed as bygSeed419 } from '../419/uge-faelles.mjs'

export const ARKIV_RAEKKER = 3900
const uid = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ARKIV_OEVELSER = [
  ['Squat', 80], ['Bænkpres', 55], ['Dødløft', 110], ['Pause squat', 60], ['Bulgarsk split squat', 15],
  ['Rows', 15], ['Triceps pushdown', 20], ['Pull-ups', 0],
]

export function bygSeed(buildSeed, fx, { lang = false } = {}) {
  const { seed, exerciseIds } = bygSeed419(buildSeed, fx)
  if (!lang) return { seed, exerciseIds }
  // Arkiv-ugen ligger først i programmet (week_number 0), som en gammel blok.
  const foersteMandag = new Date(seed.tables.weeks[0].start_date + 'T12:00:00Z')
  const start = new Date(foersteMandag.getTime() - 730 * 86400000)
  const weekId = uid(1)
  const sessId = uid(2)
  seed.tables.weeks.unshift({ id: weekId, athlete_id: fx.ATHLETE_ID, week_number: 0, block_name: 'Arkiv', start_date: start.toISOString().slice(0, 10) })
  seed.tables.sessions.push({ id: sessId, week_id: weekId, title: 'Arkiv', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
  const exIds = ARKIV_OEVELSER.map(([navn], i) => {
    const id = uid(10 + i)
    seed.tables.exercises.push({ id, session_id: sessId, name: navn, sets: 3, reps: '5', intensity: null, note: null, exercise_order: i + 1, recommended_weight: null })
    return id
  })
  const spaend = foersteMandag.getTime() - 86400000 - start.getTime()
  for (let i = 0; i < ARKIV_RAEKKER; i++) {
    const o = i % ARKIV_OEVELSER.length
    const [, kg] = ARKIV_OEVELSER[o]
    const t = start.getTime() + Math.floor((spaend * i) / ARKIV_RAEKKER)
    seed.tables.exercise_logs.push({
      id: uid(1000 + i), exercise_id: exIds[o], athlete_id: fx.ATHLETE_ID, set_number: (i % 3) + 1,
      weight: kg === 0 ? 0 : kg + (i % 5) * 2.5, reps_completed: 5, note: null, rpe_actual: 7, rpe_planned: 7, skipped: false,
      logged_at: new Date(t).toISOString(),
    })
  }
  return { seed, exerciseIds }
}
