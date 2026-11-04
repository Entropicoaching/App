import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'

const list = rows => Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object') : []
const owned = (row, props) => row.athlete_id == null || row.athlete_id === props.athlete?.id
const position = row => JSON.stringify([row.exercise_id, row.set_number])
const day = (value, now) => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(value) &&
  (!value.includes('T') || Date.parse(value) <= new Date(now).getTime()) ? calendarDay(value) : null

// Existing host snapshots only. Never infer a historical session from a row
// count: the strength history lacks set positions and excludes skipped sets.
export function analysisSessions(props, now) {
  const state = props.exerciseLogsError ? 'error' : props.exerciseLogsLoading ? 'loading' : 'unavailable'
  const missing = { state, rows: [] }
  const week = props.currentWeek, today = calendarDay(now)
  const start = typeof week?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.start_date)
    ? calendarDay(week.start_date) : null
  if (state !== 'unavailable' || !today || !start || start > today || start < addCalendarDays(today, -27) ||
      !Array.isArray(week?.sessions) ||
      !Array.isArray(props.exerciseLogs)) return missing
  const ids = new Set(), sessionIds = new Set()
  for (const session of week.sessions) {
    if (!session || session.id == null || sessionIds.has(session.id) || !Array.isArray(session.exercises)) return missing
    sessionIds.add(session.id)
    for (const ex of session.exercises) {
      if (!ex || ex.id == null || ids.has(ex.id) || !Number.isSafeInteger(ex.sets) || ex.sets < 1) return missing
      ids.add(ex.id)
    }
  }
  const groups = new Map()
  for (const row of list(props.exerciseLogs).filter(r => owned(r, props))) {
    const key = position(row), rows = groups.get(key) ?? []
    rows.push(row); groups.set(key, rows)
  }
  const end = addCalendarDays(start, 6), rows = []
  for (const session of week.sessions) {
    let complete = session.exercises.length > 0, last = start
    for (const ex of session.exercises) {
      if (ex.sets > groups.size) { complete = false; continue }
      for (let n = 1; n <= ex.sets; n++) {
        const candidates = groups.get(position({ exercise_id: ex.id, set_number: n })) ?? []
        const signatures = new Set(candidates.map(r => JSON.stringify([
          r.logged_at, r.weight, r.reps_completed, !!r.skipped, !!r.pending, !!r._optimistic,
        ])))
        const row = signatures.size === 1 ? candidates[0] : null
        const date = row && day(row.logged_at, now), reps = parseInputNumber(row?.reps_completed)
        if (!row || row.skipped || row.pending || row._optimistic || !date || date < start || date > end ||
            date > today || !Number.isSafeInteger(reps) || reps <= 0) complete = false
        else if (date > last) last = date
      }
    }
    if (complete) rows.push({ athlete_id: props.athlete?.id,
      id: JSON.stringify([start, session.id]), date: last, status: 'completed' })
  }
  return { state: 'ready', rows }
}

// Current-week edits/undo own their exercise IDs. Keep conflicts for the
// intensity model; pending positions suppress confirmed stale copies as well.
// Reference values are passed through, never derived from the measured set.
export function analysisIntensity(props) {
  if (props.fremgangLoading || props.fremgangError || props.exerciseLogsLoading || props.exerciseLogsError ||
      !Array.isArray(props.fremgangLogs)) return undefined
  const ids = new Set(list(props.currentWeek?.sessions).flatMap(s => list(s.exercises)).map(e => e.id))
  const hasLocal = Array.isArray(props.exerciseLogs)
  const start = calendarDay(props.currentWeek?.start_date), end = start && addCalendarDays(start, 6)
  const rows = [...props.fremgangLogs.filter(r => r && (!hasLocal || !ids.has(r.exercise_id))),
    ...(hasLocal ? props.exerciseLogs.filter(r => {
      const date = typeof r?.logged_at === 'string' ? calendarDay(r.logged_at) : null
      return r && ids.has(r.exercise_id) && start && date && date >= start && date <= end
    }) : [])].filter(r => owned(r, props))
  const pending = new Set(rows.filter(r => r.pending || r._optimistic).map(position))
  return rows.filter(r => !pending.has(position(r)))
}
