import { calendarDay, addCalendarDays, calendarDaysBetween } from '../../calendarDate.js'
import { mainLiftName } from '../../exerciseSetView.js'
import { explicitRpe } from '../../dataEnough.mjs'

const LIFTS = Object.freeze(['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
const objects = rows => Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object') : []
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}`
const format = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })

// RPE is descriptive, per confirmed set, independent of strength eligibility.
// Conflicting ratings must not be resolved by input order or the strength adapter.
function uniqueRatings(rows) {
  const groups = new Map()
  const ids = new Map()
  for (const row of rows) {
    const key = row.exercise_id != null && row.set_number != null
        ? JSON.stringify(['position', row.exercise_id, row.set_number])
        : row.exercise_id != null ? JSON.stringify(['time', row.exercise_id, row.logged_at])
          : JSON.stringify(['id', row.id, row.logged_at])
    const signature = JSON.stringify([row.exercise_id, row.set_number, row.logged_at,
      row.weight, row.reps_completed, row.skipped ?? false, row._optimistic ?? false,
      row.exercises?.name, row.rpe_actual, row.rpe, row.rpe_source, row.note])
    const group = groups.get(key) ?? new Map()
    group.set(signature, row)
    groups.set(key, group)
    if (row.id != null) {
      const signatures = ids.get(row.id) ?? new Set()
      signatures.add(signature)
      ids.set(row.id, signatures)
    }
  }
  const conflicting = new Set([...ids.values()].filter(values => values.size > 1).flatMap(values => [...values]))
  return [...groups.values()].filter(group => group.size === 1 && !conflicting.has([...group.keys()][0]))
    .map(group => [...group.values()][0])
}

function validDay(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(value)) return null
  if (value.includes('T') && !(Date.parse(value) <= new Date(now).getTime())) return null
  return calendarDay(value)
}

export function rpeHistory(props = {}, now = new Date()) {
  const today = calendarDay(now)
  if (!today) return { message: 'Dato mangler. RPE kan ikke vises.', series: [] }
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = addCalendarDays(monday, (i - 5) * 7), end = addCalendarDays(start, 6)
    return { start, end, label: `${date(start)}–${date(end)}` }
  })
  const week = props.currentWeek
  const start = typeof week?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.start_date)
    ? calendarDay(week.start_date) : null
  const exercises = objects(week?.sessions).flatMap(s => objects(s.exercises))
  const byId = new Map(exercises.filter(ex => ex.id != null).map(ex => [ex.id, ex]))
  const localPresent = Array.isArray(props.exerciseLogs) && byId.size === exercises.length
  // Match existing edit/undo ownership: a local snapshot replaces saved rows
  // for its exercise IDs, including an explicitly empty snapshot.
  const history = objects(props.fremgangLogs).filter(r => !localPresent || !byId.has(r.exercise_id))
  const local = localPresent ? objects(props.exerciseLogs).filter(r => {
    const day = validDay(r.logged_at, now)
    const age = start && day ? calendarDaysBetween(start, day) : null
    return byId.has(r.exercise_id) && age !== null && age >= 0 && age < 7
  }).map(r => ({ ...r, exercises: { name: byId.get(r.exercise_id).name } })) : []
  const unavailable = props.fremgangLoading === true ? 'Henter løftehistorik. RPE-data er ikke klar.'
    : !Array.isArray(props.fremgangLogs) ? 'Løftehistorik mangler. RPE-data er ikke klar.' : null
  const rows = unavailable ? [] : uniqueRatings([...history, ...local]).flatMap(r => {
    const day = validDay(r.logged_at, now)
    const lift = typeof r.exercises?.name === 'string' ? mainLiftName(r.exercises.name) : null
    if (!day || day < weeks[0].start || day > today || !lift || r.skipped || r._optimistic) return []
    return [{ day, lift, rpe: explicitRpe(r) ? (r.rpe_actual ?? r.rpe) : null }]
  })
  return {
    message: unavailable || 'Gennemsnit af registrerede RPE-svar pr. sæt i de seneste 6 kalenderuger, inklusive denne ufuldstændige uge. Kun hovedløft indgår. Manglende, ugyldige eller ikke bekræftede egne RPE-svar er udeladt af gennemsnittet. Kun uger med dokumenterede egne RPE-svar vises. Tallene beskriver svarene, ikke årsag eller parathed.',
    series: [null, ...LIFTS].map(lift => ({
      lift: lift ?? 'Alle hovedløft',
      points: weeks.map(week => {
        const sets = rows.filter(r => (!lift || r.lift === lift) && r.day >= week.start && r.day <= week.end)
        const rated = sets.filter(r => r.rpe !== null)
        const value = rated.length ? rated.reduce((sum, r) => sum + r.rpe, 0) / rated.length : null
        return { ...week, value, count: rated.length, excluded: sets.length - rated.length,
          text: unavailable || (value === null ? 'Ingen RPE-data' : `RPE ${format.format(value)}`),
          coverage: unavailable ? 'Datagrundlag ikke klar.' : `${rated.length} svar af ${sets.length} registrerede sæt. ${sets.length - rated.length} uden gyldigt eget RPE-svar.` }
      }),
    })),
  }
}
