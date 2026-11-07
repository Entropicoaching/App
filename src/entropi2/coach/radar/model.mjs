import { activityDay } from '../../../dashboard/coachInactive.mjs'
import { civilDay, ordinal, shiftDay, compare, rankRadar } from './rules.mjs'
import { scopeKey, validId } from './read.mjs'

export function radarScope(source, context) {
  if (!context?.rosterReady || !civilDay(context.day) || source?.loading || source?.loadError ||
    source.readContext?.day !== context.day || source.readContext?.coachId !== source.session?.user?.id) return null
  const scope = { coachId: source.readContext.coachId, day: context.day, athleteIds: context.athletes.map(a => a.id) }
  return scopeKey(scope) ? scope : null
}

function snapshotDomain(snapshot, key, scope) {
  if (!scope || !['ready', 'partial'].includes(snapshot?.state) || scopeKey(snapshot) !== scopeKey(scope) ||
    snapshot.from !== shiftDay(scope.day, -13) || snapshot.through !== scope.day) return null
  const domain = snapshot[key]
  if (domain?.state !== 'ready' || domain.complete !== true || !Array.isArray(domain.rows) || domain.rows.length >= 10000) return null
  const seen = new Set()
  for (const row of domain.rows) {
    if (!scope.athleteIds.includes(row?.athlete_id) || row._optimistic) return null
    const day = key === 'logs' ? typeof row.logged_at === 'string' && activityDay(row.logged_at) : row.day
    const id = key === 'logs' ? row.id : `${row.athlete_id}:${day}`
    if (!civilDay(day) || day < snapshot.from || day > scope.day ||
      key === 'logs' && (!validId(id) || typeof row.skipped !== 'boolean') || seen.has(id)) return null
    seen.add(id)
  }
  return domain.rows
}

function pendingMessages(context, id) {
  if (!context.messages.complete) return undefined
  const tracks = new Map(), invalid = new Set()
  for (const row of context.messages.rows.filter(r => r.athlete_id === id)) {
    const track = row.category === 'teknik' ? 'teknik' : 'besked'
    const day = typeof row.created_at === 'string' && activityDay(row.created_at)
    if (!day || day > context.day || !['athlete', 'coach'].includes(row.sender_role)) { invalid.add(track); continue }
    const prior = tracks.get(track), at = Date.parse(row.created_at)
    if (!prior || at > prior.at) tracks.set(track, { at, role: row.sender_role, ambiguous: false })
    else if (at === prior.at && row.sender_role !== prior.role) prior.ambiguous = true
  }
  return [...tracks].filter(([track, row]) => !invalid.has(track) && !row.ambiguous && row.role === 'athlete').length
}
function pendingVideos(context, id) {
  if (!context.videos.complete) return undefined
  return new Set(context.videos.rows.filter(row => row.athlete_id === id && validId(row.id) &&
    row.status === 'draft' && row.source_mode === 'athlete_submission' &&
    typeof row.created_at === 'string' && activityDay(row.created_at) && activityDay(row.created_at) <= context.day).map(row => row.id)).size
}
function rpeDays(logs) {
  const days = new Map()
  for (const row of logs) {
    if (row.skipped === true || row.rpe_actual == null) continue
    const value = row.rpe_actual
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) return undefined
    const day = activityDay(row.logged_at)
    if (!days.has(day)) days.set(day, [])
    days.get(day).push(value)
  }
  return [...days].map(([day, values]) => ({ day,
    value: values.sort((a, b) => a - b).reduce((sum, value) => sum + value, 0) / values.length }))
}
function missed(context, id, logs) {
  if (!context.calendarReady || !logs) return undefined
  const weeks = context.plans[id]
  if (!Array.isArray(weeks) || weeks.some(w => w.exercise_count > 0 && !civilDay(w.start_date))) return undefined
  const ended = weeks.filter(w => civilDay(w.start_date) && w.start_date >= shiftDay(context.day, -13) &&
    shiftDay(w.start_date, 6) < context.day).sort((a, b) => compare(b.start_date, a.start_date))
  const week = ended[0]
  if (!week || ended.filter(w => w.start_date === week.start_date).length !== 1 || !Array.isArray(week.actionSessions)) return undefined
  const sessions = week.actionSessions
  if (sessions.some(s => !validId(s?.id) || !Number.isSafeInteger(s.plannedSets) || s.plannedSets < 0) ||
    new Set(sessions.map(s => s.id)).size !== sessions.length) return undefined
  // An unidentifiable log cannot prove a missing planned session.
  const actual = logs.filter(row => row.skipped !== true)
  if (actual.some(row => !validId(row.sessionId))) return undefined
  const logged = new Set(actual.map(row => row.sessionId))
  return sessions.filter(session => session.plannedSets > 0 && !logged.has(session.id)).length
}
function blockEnd(context, id) {
  if (!context.calendarReady) return undefined
  const weeks = context.plans[id]?.filter(w => w.exercise_count > 0) ?? []
  if (weeks.some(w => !civilDay(w.start_date) || typeof w.block_name !== 'string' || !w.block_name.trim())) return undefined
  const current = weeks.filter(w => w.start_date <= context.day && shiftDay(w.start_date, 6) >= context.day)
  if (current.length !== 1) return undefined
  const name = current[0].block_name
  // A block label reused after another block is ambiguous. Hide it.
  const ordered = [...weeks].sort((a, b) => compare(a.start_date, b.start_date))
  const matching = ordered.map((week, i) => week.block_name === name ? i : -1).filter(i => i >= 0)
  if (matching.at(-1) - matching[0] + 1 !== matching.length) return undefined
  return shiftDay(ordered[matching.at(-1)].start_date, 6)
}

// Only a current, authorized visible roster and captured reads enter ranking.
// No raw profile data, clock, AI call, writes or inferred missing measurements.
export function coachRadarModel(options = {}) {
  if (options.enabled !== true) return null
  const { source, context, snapshot } = options
  const scope = radarScope(source, context)
  if (!scope) return { state: context?.isLoading ? 'loading' : 'unavailable', rows: [] }
  const logs = snapshotDomain(snapshot, 'logs', scope), readiness = snapshotDomain(snapshot, 'readiness', scope)
  const entries = context.athletes.map(athlete => {
    const ownLogs = logs?.filter(row => row.athlete_id === athlete.id)
    const daily = readiness?.filter(row => row.athlete_id === athlete.id && (row.source == null || row.source === 'athlete_manual'))
    const pain = new Map()
    for (const row of daily ?? []) {
      if (typeof row.location !== 'string' || !row.location.trim()) continue
      const location = row.location.trim()
      if (!pain.has(location)) pain.set(location, [])
      pain.get(location).push({ day: row.day, value: row.pain })
    }
    return { athlete, facts: {
      pendingMessages: pendingMessages(context, athlete.id), pendingVideos: pendingVideos(context, athlete.id),
      missedSessions: missed(context, athlete.id, ownLogs), blockEnd: blockEnd(context, athlete.id),
      competitionDate: athlete.competition_date,
      rpe: ownLogs && rpeDays(ownLogs), pain: [...pain].map(([location, points]) => ({ location, points })),
      readiness: daily?.map(row => ({ day: row.day, value: row.readiness })),
      sleep: daily?.map(row => ({ day: row.day, value: row.sleep })),
      noLogFiveDays: ownLogs ? !ownLogs.some(row => row.skipped !== true && ordinal(context.day) - ordinal(activityDay(row.logged_at)) < 5) : undefined,
    } }
  })
  return { state: !logs || !readiness || !context.messages.complete || !context.videos.complete || !context.calendarReady ? 'partial' : 'ready',
    rows: rankRadar({ enabled: true, entries, today: context.day }) }
}
