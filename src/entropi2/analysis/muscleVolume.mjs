import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { adaptPublicContract, uniqueLogs } from './publicContract.mjs'

// Exact names only (case/outer whitespace ignored). Each set belongs to one
// primary group; this is a small reporting table, not an anatomical inference.
const names = new Map([
  ['squat', 'Ben'], ['back squat', 'Ben'], ['front squat', 'Ben'],
  ['benpres', 'Ben'], ['leg press', 'Ben'],
  ['bænkpres', 'Bryst'], ['bench', 'Bryst'], ['bench press', 'Bryst'],
  ['dødløft', 'Ryg'], ['deadlift', 'Ryg'], ['sumo dødløft', 'Ryg'],
  ['sumo deadlift', 'Ryg'], ['barbell row', 'Ryg'], ['lat pulldown', 'Ryg'],
  ['skulderpres', 'Skuldre'], ['overhead press', 'Skuldre'],
  ['biceps curl', 'Arme'], ['triceps pushdown', 'Arme'], ['crunch', 'Mave'],
])
export const MUSCLE_GROUPS = Object.freeze(['Ben', 'Bryst', 'Ryg', 'Skuldre', 'Arme', 'Mave', 'Øvrigt'])
export const muscleGroup = name => typeof name === 'string'
  ? names.get(name.trim().toLowerCase()) ?? 'Øvrigt' : 'Øvrigt'
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 })
export const formatVolume = value => value === null ? 'Kan ikke beregnes' : number.format(value)
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/

// Uses the existing read-only log contract, but deliberately not its heavy-set
// rows: lighter sets and deloads also contribute to recorded training volume.
export function muscleVolume(props = {}, now = new Date()) {
  const contract = adaptPublicContract(props, now)
  if (!contract.today) return { weeks: [], message: 'Dato mangler. Volumen kan ikke vises.' }
  if (contract.loading || !contract.historyReady) return { weeks: [],
    message: contract.loading ? 'Henter logdata. Volumen er ikke klar.' : 'Loghistorik mangler. Volumen er ikke klar.' }
  const monday = addCalendarDays(contract.today,
    -((new Date(`${contract.today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = addCalendarDays(monday, (i - 3) * 7)
    const end = addCalendarDays(start, 6)
    return { start, end, label: `${date(start)} til ${date(end)}`,
      groups: MUSCLE_GROUPS.map(group => ({ group, sets: 0, tonnage: 0 })) }
  })
  // A local snapshot owns current program IDs, including edits and undo. Do
  // not reintroduce their saved history when the local snapshot is empty.
  const localIds = new Set(contract.weekLogs === null ? [] : contract.exercises.map(e => e.id))
  const history = props.fremgangLogs.filter(r => r && typeof r === 'object' && !localIds.has(r.exercise_id))
  const rows = uniqueLogs([...history, ...(contract.weekLogs ?? [])].filter(r => !r._optimistic))
  for (const row of rows) {
    if (row.skipped || typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)) continue
    const day = calendarDay(row.logged_at)
    if (!day || day > contract.today || (row.logged_at.includes('T') && Date.parse(row.logged_at) > new Date(now).getTime())) continue
    const week = weeks.find(w => day >= w.start && day <= w.end)
    if (!week) continue
    const group = week.groups.find(g => g.group === muscleGroup(row.exercises?.name))
    group.sets++
    const weight = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
    const tonnage = weight !== null && Number.isSafeInteger(reps) && reps > 0 ? weight * reps : NaN
    // Missing measurements are never silently treated as zero kilograms.
    group.tonnage = group.tonnage !== null && Number.isFinite(tonnage) && Number.isFinite(group.tonnage + tonnage)
      ? group.tonnage + tonnage : null
  }
  return { weeks, message: 'Registrerede sæt og tonnage (kg × gentagelser) pr. kalenderuge, inklusive denne uge. Ét sæt tælles i én fast primær muskelgruppe; ukendte navne vises som Øvrigt. Lettere sæt og deload indgår; oversprungne og afventende sæt gør ikke. Uger uden registreringer vises med 0. Manglende vægt eller gentagelser betyder, at tonnagen ikke kan beregnes. Denne uge kan være ufuldstændig.' }
}
