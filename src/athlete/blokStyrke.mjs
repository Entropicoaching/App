import { HOVEDLOEFT_FAMILIER, estimatedOneRepMax, erTungtSaet, erDeloadBlok } from '../exerciseProgress.js'
import { calendarDay, addCalendarDays } from '../calendarDate.js'
import { parseInputNumber } from '../inputValues.js'

export const DEFAULT_BLOK_STYRKE = false
const lifts = HOVEDLOEFT_FAMILIER.filter(lift => lift.key !== 'sumo')
const unknown = () => ({ status: 'unknown', lifts: [] })

// Program IDs define membership; dates define the seven-day bucket. Repeated
// block names separated by another block must never become one series.
export function blockStrength({ allWeeks = [], currentWeek, fremgangLogs, exerciseLogs, now = new Date() } = {}) {
  const today = calendarDay(now)
  if (!today || !Array.isArray(allWeeks) || !allWeeks.length || !Array.isArray(fremgangLogs) || !currentWeek) return unknown()
  if (allWeeks.some(w => !w || !Number.isSafeInteger(w.week_number))) return unknown()
  const weeks = [...allWeeks].sort((a, b) => a.week_number - b.week_number)
  const ids = new Set()
  for (const [i, w] of weeks.entries()) {
    const prev = weeks[i - 1]
    if (w.id == null || ids.has(w.id) || typeof w.block_name !== 'string' || !w.block_name.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(w.start_date || '') || calendarDay(w.start_date) !== w.start_date
      || (currentWeek.athlete_id != null && w.athlete_id !== currentWeek.athlete_id)
      || (prev && (w.week_number !== prev.week_number + 1 || addCalendarDays(prev.start_date, 7) !== w.start_date))) return unknown()
    ids.add(w.id)
  }
  if (!weeks.some(w => w.id === currentWeek.id)) return unknown()
  // currentWeek can be a week selected in Program. The chart follows today.
  const index = weeks.findIndex(w => w.start_date <= today && today < addCalendarDays(w.start_date, 7))
  if (index < 0) return unknown()
  let first = index, last = index
  while (first > 0 && weeks[first - 1].block_name === weeks[index].block_name) first--
  while (last + 1 < weeks.length && weeks[last + 1].block_name === weeks[index].block_name) last++
  const block = weeks.slice(first, last + 1)
  const byExercise = new Map()
  for (const w of weeks) for (const session of w.sessions || []) for (const ex of session.exercises || []) {
    if (ex.id == null) continue
    if (byExercise.has(ex.id)) return unknown()
    byExercise.set(ex.id, { week: w, name: ex.name })
  }
  const currentIds = new Set([...byExercise].filter(([, ex]) => ex.week.id === currentWeek.id).map(([id]) => id))
  // An explicitly supplied local snapshot owns edits, undo and queued sets.
  const rows = Array.isArray(exerciseLogs)
    ? [...fremgangLogs.filter(log => !currentIds.has(log?.exercise_id)), ...exerciseLogs.filter(log => currentIds.has(log?.exercise_id))]
    : fremgangLogs
  const series = lifts.map(lift => ({ key: lift.key, name: lift.label, color: lift.color,
    weeks: block.map(w => ({ id: w.id, number: w.week_number, start: w.start_date, best: null })) }))
  for (const log of rows) {
    if (!log || log.skipped || (currentWeek.athlete_id != null && log.athlete_id != null && log.athlete_id !== currentWeek.athlete_id)) continue
    const ex = byExercise.get(log.exercise_id)
    if (!ex || erDeloadBlok(ex.week.block_name)) continue
    const lift = lifts.find(l => l.match(ex.name))
    if (!lift || (log.exercises?.name != null && !lift.match(log.exercises.name))) continue
    const bucket = series.find(l => l.key === lift.key).weeks.find(w => w.id === ex.week.id)
    const day = calendarDay(log.logged_at ?? null)
    const weight = parseInputNumber(log.weight), reps = parseInputNumber(log.reps_completed)
    if (!bucket || !day || day < bucket.start || day >= addCalendarDays(bucket.start, 7) || day > today
      || !(weight > 0) || !Number.isSafeInteger(reps) || !erTungtSaet(ex.name, reps)
      || (log.exercises?.name != null && !erTungtSaet(log.exercises.name, reps))) continue
    const value = estimatedOneRepMax(weight, reps)
    if (!(value > 0) || !Number.isFinite(value)) continue
    if (!bucket.best || value > bucket.best.value || (value === bucket.best.value && weight > bucket.best.weight))
      bucket.best = { value, e1rm: Math.round(value), weight, reps, day }
  }
  return { status: 'ready', name: weeks[index].block_name, lifts: series }
}

const kg = value => String(value).replace('.', ',')
export function renderBlockStrength(h, { enabled = DEFAULT_BLOK_STYRKE, loading = false, ...options } = {}) {
  if (enabled !== true) return null
  const model = loading ? null : blockStrength(options)
  return h('section', { 'aria-label': 'Estimeret 1RM gennem blokken', 'data-blok-styrke': loading ? 'loading' : model.status,
    style: { padding: '1rem', marginBottom: '1rem', border: '1px solid #59564c', color: '#edeae2' } },
    h('h2', { style: { fontSize: '1rem' } }, 'Styrke gennem blokken'),
    loading ? h('p', { role: 'status' }, 'Henter løftehistorik…') : model.status === 'unknown'
      ? h('p', null, 'Den aktuelle blok eller løftehistorikken er ikke klar endnu.')
      : h('div', null,
        h('p', null, `${model.name}. Estimeret 1RM er et skøn over vægten for én gentagelse, beregnet med Epley. Kun tunge sæt på højst 8 reps tæller. Tomme uger vises som huller.`),
        ...model.lifts.map(lift => {
          const values = lift.weeks.filter(w => w.best).map(w => w.best.e1rm)
          const min = Math.min(...values), max = Math.max(...values)
          const x = i => 28 + i * 264 / Math.max(1, lift.weeks.length - 1)
          const y = value => 66 - (value - min) * 42 / (max - min || 1)
          const segments = []
          for (const [i, week] of lift.weeks.entries()) {
            if (!week.best) continue
            if (i === 0 || !lift.weeks[i - 1].best) segments.push([])
            segments.at(-1).push(`${x(i)},${y(week.best.e1rm)}`)
          }
          return h('article', { key: lift.key, 'data-blok-styrke-loeft': lift.key },
            h('h3', { style: { fontSize: '0.95rem' } }, lift.name),
            !values.length ? h('p', null, 'Ingen tunge sæt i denne blok endnu.') : h('svg', {
              viewBox: '0 0 320 98', role: 'img', 'aria-label': `${lift.name}, estimeret 1RM pr. programuge`, style: { display: 'block', width: '100%', height: 'auto' } },
              h('title', null, `${lift.name}, ${model.name}. Estimeret 1RM i kg.`),
              ...segments.filter(segment => segment.length > 1).map((segment, i) => h('polyline', { key: `line-${i}`, points: segment.join(' '), fill: 'none', stroke: lift.color, strokeWidth: 2 })),
              ...lift.weeks.map((week, i) => h('g', { key: week.id },
                week.best && h('circle', { cx: x(i), cy: y(week.best.e1rm), r: 3, fill: lift.color },
                  h('title', null, `Uge ${week.number}: estimeret 1RM ${week.best.e1rm} kg, ${kg(week.best.weight)} kg × ${week.best.reps}, ${week.best.day}`)),
                h('text', { x: x(i), y: 90, textAnchor: 'middle', fontSize: 12, fill: '#a8a498' }, String(week.number))))),
            h('ul', { style: { fontSize: '0.8rem', paddingLeft: '1.2rem' } }, ...lift.weeks.map(week => h('li', { key: week.id },
              week.best ? `Uge ${week.number}: estimeret 1RM ${week.best.e1rm} kg (${kg(week.best.weight)} kg × ${week.best.reps}, ${week.best.day}).` : `Uge ${week.number}: ingen måling.`))))
        })))
}
