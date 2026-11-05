import { calendarDay } from '../../calendarDate.js'
import { personalRecords } from '../analysis/personalRecords.mjs'
import { adaptPublicContract, uniqueLogs } from '../analysis/publicContract.mjs'
import { weekSessions } from '../session/weekSessions.mjs'

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
const position = row => JSON.stringify([row.exercise_id, row.set_number])
const list = value => Array.isArray(value) ? value : []
const DAY = 86400000
const offsetFormat = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Copenhagen', timeZoneName: 'longOffset' })
const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

// Index Copenhagen midnight once per UTC date, not Intl per history row. Verify
// the boundary with the shared calendar before using it (also across DST).
function dateIndex() {
  const dates = new Map()
  return value => {
    if (typeof value !== 'string' || !(timestamp.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) || !calendarDay(value.slice(0, 10))) return null
    const at = Date.parse(value)
    if (!Number.isFinite(at)) return null
    const utc = Math.floor(at / DAY) * DAY
    if (!dates.has(utc)) {
      const day = new Date(utc).toISOString().slice(0, 10)
      const offset = offsetFormat.formatToParts(new Date(utc + DAY - 1)).find(p => p.type === 'timeZoneName')?.value
      const match = /^GMT\+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(offset ?? '')
      const midnight = match ? utc + DAY - (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0)) * 1000 : NaN
      const next = calendarDay(new Date(midnight))
      dates.set(utc, calendarDay(new Date(midnight - 1)) === day && next && next > day ? { day, next, midnight } : null)
    }
    const boundary = dates.get(utc)
    return boundary ? { at, day: at < boundary.midnight ? boundary.day : boundary.next } : null
  }
}

// For fixed lift/reps a lighter set cannot win either Analysis maximum. Keep
// the earliest equal weight, then let Analysis rank at most eight sets per lift.
function contenders(rows) {
  const best = new Map()
  for (const row of rows) {
    const key = JSON.stringify([row.lift, row.reps_completed]), old = best.get(key)
    if (!old || row.weight > old.weight || row.weight === old.weight && row.logged_at < old.logged_at) best.set(key, row)
  }
  return [...best.values()]
}

// Read-only projection of the existing program and confirmed history. Record
// eligibility, aliases, maxima and ties belong to Analysis, not to Home.
export function homeRecord(props = {}, history, now = new Date()) {
  return homeRecordSnapshot(props, history, now)?.record ?? null
}

// Memoize this snapshot on data/day changes; clock ticks only check expiresAt.
export function homeRecordSnapshot(props = {}, history, now = new Date()) {
  if (props.enabled !== true || props.sessionReadOnly || props.readOnly) return null
  const athleteId = props.athlete?.id, at = new Date(now).getTime()
  if (!athleteId || !Number.isFinite(at) || props.programError || props.offlineSnapshotAt != null ||
      props.exerciseLogsError || props.exerciseLogsLoading || props.fremgangError || props.fremgangLoading ||
      history?.status !== 'ready' || history.complete !== true || history.athleteId !== athleteId ||
      !Array.isArray(history.rows) || !Array.isArray(props.allWeeks) || !Array.isArray(props.exerciseLogs)) return null
  const current = props.currentWeek
  const weeks = Array.from(props.allWeeks, w => w?.id === current?.id ? current : w)
  if (!current || !weeks.some(w => w?.id === current.id) || new Set(weeks.map(w => w?.id)).size !== weeks.length ||
      weeks.some(w => !w || w.id == null || (w.athlete_id != null && w.athlete_id !== athleteId) || !Array.isArray(w.sessions) ||
        Array.from(w.sessions).some(s => !s || s.id == null || !Array.isArray(s.exercises) ||
          Array.from(s.exercises).some(e => !e || e.id == null || !Number.isSafeInteger(e.sets) || e.sets < 0)))) return null
  if (current.athlete_id != null && current.athlete_id !== athleteId) return null
  const sessions = weeks.flatMap(w => w.sessions)
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) return null
  const exercises = weeks.flatMap(w => w.sessions.flatMap(s => list(s?.exercises)))
  if (exercises.some(e => !e || e.id == null) || new Set(exercises.map(e => e.id)).size !== exercises.length) return null
  const localNames = new Map(list(current.sessions).flatMap(s => list(s?.exercises)).map(e => [e.id, e.name]))
  if (Array.from(history.rows).some(r => !r || r.athlete_id !== athleteId)) return null
  const local = props.exerciseLogs.filter(r => r && localNames.has(r.exercise_id) &&
    (r.athlete_id == null || r.athlete_id === athleteId)).map(r => ({ ...r,
    exercises: { name: localNames.get(r.exercise_id), sessions: { weeks: { block_name: current.block_name } } } }))
  const raw = [...history.rows.filter(r => !localNames.has(r.exercise_id)), ...local]
  const pending = new Set(raw.filter(r => r.pending || r._optimistic).map(position))
  const queued = new Set(list(props.pendingSyncKeys))
  const parked = new Set(list(props.parkedSets).map(p => JSON.stringify([p?.exerciseId, p?.setNumber])))
  // Resolve conflicting positions before either completion or record selection.
  // The explicit local snapshot owns edits and undo, including an empty array.
  const rows = uniqueLogs(raw.filter(r => !pending.has(position(r)) &&
    !queued.has(`${r.exercise_id}_${r.set_number}`) &&
    !parked.has(position(r)))
    .map(r => ({ ...r, id: undefined })))
  const dayOf = dateIndex(), metadata = new Map(), byExercise = new Map()
  for (const row of rows) {
    const date = dayOf(row.logged_at)
    if (!date) continue
    metadata.set(row, date)
    if (!timestamp.test(row.logged_at) || date.at > at || !Number.isSafeInteger(row.set_number) || row.set_number < 1 ||
        (row.skipped != null && typeof row.skipped !== 'boolean')) continue
    if (!byExercise.has(row.exercise_id)) byExercise.set(row.exercise_id, [])
    byExercise.get(row.exercise_id).push(row)
  }
  const completed = []
  for (const week of weeks) {
    // Shared prescription validation, without rescanning/formatting all rows for
    // every week. Conflicting, unconfirmed slots were removed above.
    const snapshot = weekSessions({ week, exerciseLogs: [], athleteId, now })
    if (snapshot.dataMissing) continue
    for (const [index, session] of snapshot.sessions.entries()) {
      if (session.dataMissing || !(session.planned > 0)) continue
      const logs = week.sessions[index].exercises.flatMap(e => (byExercise.get(e.id) ?? []).filter(r =>
        r.set_number <= e.sets && metadata.get(r).day >= snapshot.start && metadata.get(r).day <= snapshot.end))
      if (logs.length === session.planned) completed.push({ logs, at: Math.max(...logs.map(r => metadata.get(r).at)) })
    }
  }
  completed.sort((a, b) => b.at - a.at)
  const latest = completed[0]
  // An ambiguous latest session cannot select an arbitrary celebration.
  if (!latest || completed[1]?.at === latest.at || at - latest.at >= THREE_DAYS) return null
  const knownIds = new Set(exercises.map(e => e.id))
  // A newer log outside the supplied program may belong to a newer session.
  // Without its prescription we cannot honestly identify the latest completion.
  if (rows.some(r => !knownIds.has(r.exercise_id) && Date.parse(r.logged_at) > latest.at && Date.parse(r.logged_at) <= at)) return null
  const cutoff = new Date(latest.at)
  const latestPositions = new Set(latest.logs.map(position))
  const normalized = rows.filter(r => metadata.has(r) && metadata.get(r).at <= latest.at)
    .map(r => ({ ...r, logged_at: metadata.get(r).day }))
  const confirmed = adaptPublicContract({ fremgangLogs: normalized }, cutoff, { maxAgeDays: Infinity }).rows.filter(r => !r._optimistic)
  const full = personalRecords({ fremgangLogs: contenders(confirmed) }, cutoff)
  const before = personalRecords({ fremgangLogs: contenders(confirmed.filter(r => !latestPositions.has(position(r)))) }, cutoff)
  const eligible = confirmed.filter(r => latestPositions.has(position(r)))
  for (const record of full.lifts) {
    const old = before.lifts.find(r => r.lift === record.lift)
    // A first recorded session establishes a baseline, never a celebration.
    if (!old) continue
    for (const kind of ['heaviest', 'bestEstimate']) {
      const best = record[kind], previous = old?.[kind]
      if (previous && (kind === 'bestEstimate' ? best.value <= previous.value
        : best.weight === previous.weight && best.reps === previous.reps)) continue
      const source = eligible.find(r => r.lift === record.lift && r.weight === best.weight &&
        r.reps_completed === best.reps && r.logged_at === best.date)
      if (!source) continue
      const original = latest.logs.find(r => position(r) === position(source))
      if (at - Date.parse(original.logged_at) >= THREE_DAYS) continue
      return { record: { lift: record.lift, weight: best.weight, reps: best.reps, date: best.date },
        expiresAt: Date.parse(original.logged_at) + THREE_DAYS }
    }
  }
  return null
}
