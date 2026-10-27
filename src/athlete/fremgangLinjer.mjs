import { HOVEDLOEFT_FAMILIER, hovedloeftFamilie, erTungtSaet, erDeloadBlok, estimatedOneRepMax } from '../exerciseProgress.js'
import { parseInputNumber } from '../inputValues.js'
import { calendarDay, addCalendarDays, calendarDaysBetween } from '../calendarDate.js'

export const DEFAULT_FREMGANG_LINJER = false
// Local presentation gate only. No APP-DATA2 gate exists in the pinned base.
// Three heavy training days spanning at least fourteen days, including both
// the first and the current program week. Missing evidence gives raw sets.
export const FREMGANG_MIN_DAGE = 3
export const FREMGANG_MIN_SPAEND = 14

function activeBlock(allWeeks, currentWeek) {
  if (!currentWeek?.id || !currentWeek.block_name?.trim()) return []
  const weeks = [...(allWeeks || [])].filter(Boolean).sort((a, b) => a.week_number - b.week_number)
  const i = weeks.findIndex(w => w.id === currentWeek.id)
  if (i < 0 || !Number.isSafeInteger(weeks[i].week_number)) return []
  if (weeks.some((w, n) => n > 0 && w.week_number === weeks[n - 1].week_number)) return []
  let start = i
  while (start > 0 && weeks[start - 1].block_name === weeks[i].block_name &&
    weeks[start - 1].week_number === weeks[start].week_number - 1) start--
  const block = weeks.slice(start, i + 1)
  if (block.some((w, n) => typeof w.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.start_date) || !calendarDay(w.start_date) ||
    (n > 0 && addCalendarDays(block[n - 1].start_date, 7) !== w.start_date))) return []
  return block
}

function validSet(log, name, week, today) {
  if (!log || log.skipped) return null
  const weight = parseInputNumber(log.weight), reps = parseInputNumber(log.reps_completed)
  const day = calendarDay(log.logged_at ?? null)
  if (!(weight > 0) || !Number.isSafeInteger(reps) || reps < 1 || !day || day > today) return null
  const family = hovedloeftFamilie(name)
  if (!family) return null
  return { family, name, weight, reps, day, at: new Date(log.logged_at).getTime(), week,
    heavy: erTungtSaet(name, reps) && !erDeloadBlok(week?.block_name ?? log.exercises?.sessions?.weeks?.block_name),
    e1rm: estimatedOneRepMax(weight, reps) }
}

// Current-week local rows replace fetched rows by exercise ID, including edits,
// undo and queued sets. No database, storage, URL or environment flag access.
export function fremgangLinjer({ fremgangLogs = [], exerciseLogs = [], allWeeks = [], currentWeek, now = new Date() } = {}) {
  const today = calendarDay(now)
  if (!today) return []
  const byExercise = new Map()
  for (const week of allWeeks || []) for (const session of week.sessions || [])
    for (const e of session.exercises || []) byExercise.set(e.id, { name: e.name, week })
  const currentIds = new Set((currentWeek?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id)))
  for (const session of currentWeek?.sessions || []) for (const e of session.exercises || [])
    byExercise.set(e.id, { name: e.name, week: currentWeek })
  const rows = []
  for (const log of fremgangLogs || []) {
    if (currentIds.has(log?.exercise_id)) continue
    const ref = byExercise.get(log?.exercise_id)
    const row = validSet(log, ref?.name ?? log?.exercises?.name, ref?.week, today)
    if (row) rows.push(row)
  }
  for (const log of exerciseLogs || []) {
    if (!currentIds.has(log?.exercise_id)) continue
    const ref = byExercise.get(log.exercise_id)
    const row = validSet(log, ref?.name, ref?.week, today)
    if (row) rows.push(row)
  }
  const block = activeBlock(allWeeks, currentWeek)
  const blockIds = new Set(block.map(w => w.id))
  const best = sets => sets.reduce((b, s) => !b || s.e1rm > b.e1rm ||
    (s.e1rm === b.e1rm && s.at > b.at) ? s : b, null)
  return HOVEDLOEFT_FAMILIER.map(f => {
    const sets = rows.filter(s => s.family === f.key).sort((a, b) => a.at - b.at)
    const latest = sets.at(-1)
    if (!latest) return null
    const heavy = sets.filter(s => s.heavy && Number.isFinite(s.e1rm) && s.e1rm > 0 && blockIds.has(s.week?.id) &&
      s.day >= s.week.start_date && s.day < addCalendarDays(s.week.start_date, 7))
    const days = [...new Set(heavy.map(s => s.day))].sort()
    const start = best(heavy.filter(s => s.week.id === block[0]?.id))
    const current = best(heavy.filter(s => s.week.id === currentWeek?.id))
    const enough = start && current && start.week.id !== current.week.id && days.length >= FREMGANG_MIN_DAGE &&
      calendarDaysBetween(days[0], days.at(-1)) >= FREMGANG_MIN_SPAEND
    return enough
      ? { key: f.key, name: f.label, mode: 'comparison', start, current, delta: Math.round(current.e1rm) - Math.round(start.e1rm) }
      : { key: f.key, name: f.label, mode: 'raw', latest }
  }).filter(Boolean)
}

const kg = n => String(n).replace('.', ',')
const setText = s => `${kg(s.weight)} kg × ${s.reps}`
export function fremgangLinjeTekst(row) {
  if (row.mode === 'raw') return `${row.name}: seneste sæt ${setText(row.latest)} (${row.latest.day})`
  const change = row.delta > 0 ? `+${row.delta} kg` : row.delta < 0 ? `${row.delta} kg` : 'uændret'
  return `${row.name}: bedste sæt nu ${setText(row.current)} mod ${setText(row.start)} ved blokstart (e1RM-skøn ${change})`
}

// The app and synthetic DOM tests call this same renderer.
export function renderFremgangLinjer(h, { enabled = DEFAULT_FREMGANG_LINJER, ...props } = {}) {
  if (enabled !== true) return null
  const rows = fremgangLinjer(props)
  return h('section', { 'aria-label': 'Hovedløft siden blokstart', 'data-fremgang-linjer': true },
    ...(rows.length ? rows.map(row => h('p', { key: row.key, 'data-hovedloeft': row.key,
      'data-grundlag': row.mode, style: { fontSize: '0.95rem', lineHeight: 1.5, overflowWrap: 'anywhere' } }, fremgangLinjeTekst(row)))
      : [h('p', null, 'Du har ikke logget et hovedløft endnu.')]))
}
