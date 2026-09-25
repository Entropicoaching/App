// ORDRE 370 · syntetiske atlet-uger til Coach Briefing. INGEN rigtige
// atletdata: navne, id'er, vaegte og kommentarer er opdigtede.
//
// En fixture er de raekker entropi_training_signals_v1 laeser, i samme form
// som tabellerne (athletes, weeks, sessions, exercise_logs, readiness_logs,
// personal_records), saa reglerne kan koeres uden database.
//
// Standarduge: 3 pas (man/ons/fre), 18 saet. Pas 1: Squat + Baenk, Pas 2:
// Doedloeft + Baenk, Pas 3: Squat + Kabelroning. 8 uger fra mandag 3. aug.;
// "i dag" er fredag 25. sep. 2026, saa uge 8 er i gang (man+ons logget).

export const TODAY = '2026-09-25'
export const FIRST_MONDAY = '2026-08-03'
export const WEEKS = 8

const DAY = 24 * 60 * 60 * 1000
export const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

// Standardprogression pr. uge-indeks (0..7). Hver loeft: topsaet + 2 backoff.
export const defaultTop = {
  Squat: i => 120 + 5 * i,
  'Bænk': i => 80 + 1.25 * i,
  'Dødløft': i => 150 + 5 * i,
}

const round25 = kg => Math.round(kg / 2.5) * 2.5

// Tre saet: topsaet 5 reps @8 og to backoffs paa 90 % 5 reps @7.
export const mainLift = (name, top, { reps = 5, rpe = 8, actual = rpe, backoffActual = actual - 1 } = {}) => [
  { name, weight: top, reps, rpe_planned: rpe, rpe_actual: actual },
  { name, weight: round25(top * 0.9), reps: 5, rpe_planned: rpe - 1, rpe_actual: backoffActual },
  { name, weight: round25(top * 0.9), reps: 5, rpe_planned: rpe - 1, rpe_actual: backoffActual },
]
export const accessory = (actualShift = 0) => [1, 2, 3].map(() => (
  { name: 'Kabelroning', weight: 50, reps: 10, rpe_planned: 8, rpe_actual: 8 + actualShift }
))

export const defaultSession = (weekIndex, sessionIndex, { shift = () => 0 } = {}) => {
  const s = lift => shift(weekIndex, lift)
  if (sessionIndex === 0) return [
    ...mainLift('Squat', defaultTop.Squat(weekIndex), { actual: 8 + s('Squat') }),
    ...mainLift('Bænk', defaultTop['Bænk'](weekIndex), { actual: 8 + s('Bænk') }),
  ]
  if (sessionIndex === 1) return [
    ...mainLift('Dødløft', defaultTop['Dødløft'](weekIndex), { actual: 8 + s('Dødløft') }),
    ...mainLift('Bænk', defaultTop['Bænk'](weekIndex) - 2.5, { actual: 8 + s('Bænk') }),
  ]
  return [
    ...mainLift('Squat', defaultTop.Squat(weekIndex) - 5, { actual: 8 + s('Squat') }),
    ...accessory(s('Kabelroning')),
  ]
}

// Bygger en fixture. `session(weekIndex, sessionIndex)` returnerer
// { sets, comment?, missed? } eller et array af saet; standard er defaultSession.
export function buildAthlete({ id, name, about, status = 'aktiv', vacation_until = null, session, readiness = [], personal_records = [] }) {
  const weeks = []
  const logs = []
  for (let w = 0; w < WEEKS; w += 1) {
    const start = addDays(FIRST_MONDAY, 7 * w)
    const week = { id: `${id}-w${w + 1}`, athlete_id: id, week_number: w + 1, start_date: start, sessions: [] }
    for (let p = 0; p < 3; p += 1) {
      const date = addDays(start, 2 * p)
      const sessionId = `${week.id}-p${p + 1}`
      const raw = session ? session(w, p) : null
      const spec = Array.isArray(raw) ? { sets: raw } : (raw || { sets: defaultSession(w, p) })
      week.sessions.push({ id: sessionId, title: `Pas ${p + 1}`, athlete_comment: spec.comment || null })
      // Pas der ligger i dag eller senere er planlagt, men endnu ikke traenet.
      if (date >= TODAY || spec.missed) continue
      spec.sets.forEach((set, index) => logs.push({
        athlete_id: id,
        session_id: sessionId,
        exercise_id: `${sessionId}-${set.name}`,
        logged_at: `${date}T17:${String(index).padStart(2, '0')}:00Z`,
        skipped: false,
        ...set,
        reps_completed: set.reps,
      }))
    }
    weeks.push(week)
  }
  return {
    about,
    today: TODAY,
    athlete: { id, name, status, vacation_until },
    weeks,
    logs,
    readiness,
    personal_records,
  }
}
