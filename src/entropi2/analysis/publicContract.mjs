import { calendarDay, calendarDaysBetween } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { erTungtSaet, erDeloadLog } from '../../exerciseProgress.js'
import { repZone } from '../../dataEvidence.mjs'

const list = x => Array.isArray(x) ? x.filter(r => r && typeof r === 'object') : []
const signature = r => JSON.stringify([r.exercise_id, r.logged_at, r.weight,
  r.reps_completed, r.skipped ?? false, r.exercises])

// History has no id/set_number in fremgangLogsQuery. Never guess a winner
// for conflicting rows at the same exercise/timestamp. Exact repeats count once.
export function uniqueLogs(rows) {
  const groups = new Map()
  for (const row of list(rows)) {
    const key = row.id != null ? `id:${row.id}` :
      row.exercise_id != null && row.set_number != null
        ? JSON.stringify(['position', row.exercise_id, row.set_number]) :
        JSON.stringify(['time', row.exercise_id, row.logged_at])
    const group = groups.get(key) || []
    group.push(row); groups.set(key, group)
  }
  return [...groups.values()].filter(rs => new Set(rs.map(signature)).size === 1).map(rs => rs[0])
}

// Read-only adapter for AthleteView's existing props. No queries or writes.
// An explicit local snapshot owns edits/undo for this week's exercise IDs.
export function adaptPublicContract(props = {}, now = new Date()) {
  const today = calendarDay(now)
  const week = props.currentWeek
  const start = typeof week?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.start_date)
    ? calendarDay(week.start_date) : null
  const exercises = list(week?.sessions).flatMap(s => list(s.exercises))
  const byId = new Map(exercises.filter(e => e.id != null).map(e => [e.id, e]))
  const localPresent = Array.isArray(props.exerciseLogs) && byId.size === exercises.length
  const local = localPresent ? list(props.exerciseLogs).filter(r => {
    const day = typeof r.logged_at === 'string' ? calendarDay(r.logged_at) : null
    const age = start && day ? calendarDaysBetween(start, day) : null
    return byId.has(r.exercise_id) && age !== null && age >= 0 && age < 7
  }).map(r => ({
    ...r, exercises: { name: byId.get(r.exercise_id).name,
      sessions: { weeks: { block_name: week?.block_name } } },
  })) : []
  const history = list(props.fremgangLogs).filter(r => !localPresent || !byId.has(r.exercise_id))
  const rows = uniqueLogs([...history, ...local]).flatMap(r => {
    const rawName = r.exercises?.name
    const timestamp = typeof r.logged_at === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(r.logged_at)
    const day = timestamp ? calendarDay(r.logged_at) : null
    const weight = parseInputNumber(r.weight), reps = parseInputNumber(r.reps_completed)
    const block = r.exercises?.sessions?.weeks?.block_name
    if (!today || !day || day > today || (r.logged_at.includes('T') && Date.parse(r.logged_at) > new Date(now).getTime()) || calendarDaysBetween(day, today) > 84 ||
        typeof rawName !== 'string' || !rawName.trim() || r.skipped ||
        !(weight > 0) || !Number.isSafeInteger(reps) || !erTungtSaet(rawName, reps) ||
        typeof block !== 'string' || !block.trim() || erDeloadLog(r)) return []
    const view = exerciseSetView(rawName)
    return [{ ...r, weight, reps_completed: reps, logged_at: day,
      lift: view.name, liftKey: view.key, repZone: repZone(reps) }]
  })
  return { today, rows, week, exercises, start,
    weekLogs: localPresent ? uniqueLogs(local) : null,
    activeWeek: !!(today && start && calendarDaysBetween(start, today) >= 0 && calendarDaysBetween(start, today) < 7),
    loading: props.fremgangLoading === true,
    historyReady: Array.isArray(props.fremgangLogs),
    // Keep the established callback itself, including its return value/errors.
    setTab: props.setTab,
  }
}
