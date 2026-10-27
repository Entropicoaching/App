import { calendarDay, addCalendarDays, calendarDaysBetween } from '../calendarDate.js'

export const COACH_FOUR_WEEKS_ENABLED = false

// Result ownership comes from the existing athlete-filtered request, not its rows.
// A token prevents a slower earlier refresh from replacing a newer result.
export function reduceFourWeekRead(state, event) {
  const previous = state[event.athleteId]?.[event.kind]
  if (event.status !== 'loading' && previous?.token !== event.token) return state
  return { ...state, [event.athleteId]: {
    ...state[event.athleteId], [event.kind]: event,
  } }
}

export async function readFourWeekSource(capture, kind, athleteId, read) {
  if (!capture) return read()
  const token = Symbol(kind)
  const emit = (status, rows = []) => capture({ kind, athleteId, token, status, rows })
  emit('loading')
  try {
    const result = await read()
    emit(result.error ? 'error' : 'ready', result.error ? [] : (result.data || []))
    return result
  } catch (error) {
    emit('error')
    throw error
  }
}

const numeric = value => {
  if (value == null || String(value).trim() === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const rpe = value => { const n = numeric(value); return n >= 0 && n <= 10 ? n : null }
export function fourWeekRpe(log) {
  if (log.skipped) return null
  const actual = rpe(log.rpe_actual)
  const match = String(log.exercises?.intensity || '').match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  const planned = rpe(log.rpe_planned) ?? (match ? rpe(match[1]) : null)
  return actual === null || planned === null ? null : Math.round((actual - planned) * 10) / 10
}
const own = (rows, id) => rows.filter(row => row && (row.athlete_id == null || row.athlete_id === id))

// Four calendar weeks: current Monday plus three previous Mondays, Danish dates.
// Plan totals cover the entire week; logs and videos stop at today.
export function buildFourWeeks({ athleteId, reads = {}, today = new Date() } = {}) {
  const day = calendarDay(today)
  if (!athleteId || !day) return { weeks: [], undated: 0 }
  const offset = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7
  const monday = addCalendarDays(day, -offset)
  const weeks = Array.from({ length: 4 }, (_, n) => ({
    start: addCalendarDays(monday, -7 * n), end: addCalendarDays(monday, 6 - 7 * n),
    plans: [], logs: [], videos: [], notes: [],
  }))
  const rows = kind => reads[kind]?.status === 'ready' && reads[kind]?.athleteId === athleteId
    ? own(reads[kind].rows, athleteId) : []
  let undated = 0
  for (const plan of rows('weeks')) {
    const start = calendarDay(plan.start_date)
    if (!start) { undated++; continue }
    // A program week belongs to the calendar week of its start date. Do not
    // invent training dates from session_order or weekday indexes.
    const bucket = weeks.find(w => start >= w.start && start <= w.end)
    if (!bucket) continue
    bucket.plans.push(plan)
    for (const session of plan.sessions || []) {
      if (session.athlete_comment?.trim()) bucket.notes.push({ text: session.athlete_comment, source: session.title || 'Pas' })
    }
  }
  for (const log of rows('logs')) {
    const at = calendarDay(log.logged_at)
    const bucket = at && at <= day && weeks.find(w => at >= w.start && at <= w.end)
    if (!bucket) continue
    bucket.logs.push({ ...log, day: at, delta: fourWeekRpe(log) })
    if (log.note?.trim()) bucket.notes.push({ text: log.note, source: `${at} ${log.exercises?.name || 'Sæt'}` })
  }
  for (const video of rows('videos')) {
    const at = calendarDay(video.created_at || video.analyzed_at)
    const bucket = at && at <= day && weeks.find(w => at >= w.start && at <= w.end)
    if (bucket) bucket.videos.push({ ...video, day: at })
  }
  for (const week of weeks) {
    week.plannedSets = week.plans.reduce((sum, plan) => sum + (plan.sessions || []).reduce((n, session) => n + (session.exercises || []).reduce((m, ex) => m + Math.max(0, Math.trunc(numeric(ex.sets) || 0)), 0), 0), 0)
    week.completed = week.logs.filter(log => !log.skipped).length
    week.skipped = week.logs.filter(log => log.skipped).length
    week.logs.sort((a, b) => b.day.localeCompare(a.day) || (a.set_number || 0) - (b.set_number || 0))
    week.videos.sort((a, b) => b.day.localeCompare(a.day))
  }
  return { weeks, undated, day, start: weeks[3].start, end: weeks[0].end,
    days: calendarDaysBetween(weeks[3].start, weeks[0].end) + 1 }
}
