import { activityDay } from '../../dashboard/coachInactive.mjs'
import { visibleRpeNote } from '../../rpeEvidence.mjs'
import { mentionsPain } from '../../coachBriefingRules.js'

const text = value => typeof value === 'string' ? value.trim() : ''
const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const mentionsStop = value => /\b(stop|stoppet|stoppede|afbrudt|afbrød|aborted|stopped)\b/i.test(
  value.replace(/\b(ikke|aldrig|not|never)\s+(stop|stoppet|stoppede|afbrudt|afbrød|aborted|stopped)\b/gi, ''))
const marks = value => [mentionsPain(value) && 'Smerte nævnt', mentionsStop(value) && 'Stop nævnt'].filter(Boolean)

// Only the existing detailed athleteLogs contain notes. The overview activity
// read has timestamps alone; never treat it as evidence that notes are absent.
export function sessionNotesModel(props, context, athleteId) {
  const result = { state: 'select', athlete: null, entries: [] }
  if (!context.rosterReady || !context.day) return { ...result, state: 'unknown' }
  const athlete = context.athletes.find(a => a.id === athleteId)
  if (!athlete) return result
  result.athlete = athlete
  const logs = props.athleteLogs
  if (!Array.isArray(logs) || logs.readEvidence &&
    (logs.readEvidence.athleteId !== athlete.id || logs.readEvidence.complete !== true))
    return { ...result, state: 'unknown' }
  const groups = new Map(), seen = new Set()
  let invalid = false
  const rows = logs.filter(r => r?.athlete_id === athlete.id).map((log, index) => ({ log, index }))
  // Stable order makes deduplication independent of the caller's array order.
  rows.sort((a, b) => (Date.parse(b.log.logged_at) || 0) - (Date.parse(a.log.logged_at) || 0) || a.index - b.index)
  for (const { log, index } of rows) {
    const day = typeof log.logged_at === 'string' ? activityDay(log.logged_at) : null
    if (!day) { invalid = true; continue }
    const age = ordinal(context.day) - ordinal(day)
    if (age < 0 || age > 6) continue
    if (log.id && seen.has(log.id)) continue
    if (log.id) seen.add(log.id)
    const session = log.exercises?.sessions
    const key = JSON.stringify([day, session?.id || log.exercises?.session_id || log.exercise_id || log.id || index])
    if (!groups.has(key)) groups.set(key, { key, day, loggedAt: log.logged_at,
      title: text(session?.title) || 'Pas', comments: [], notes: [] })
    const entry = groups.get(key)
    const comment = text(session?.athlete_comment)
    if (comment && !entry.comments.some(c => c.text === comment))
      entry.comments.push({ text: comment, marks: marks(comment) })
    const note = typeof log.note === 'string' ? visibleRpeNote(log.note).trim() : ''
    if (note || log.skipped === true) entry.notes.push({ key: String(log.id || index),
      exercise: text(log.exercises?.name) || 'Øvelse',
      set: Number.isSafeInteger(log.set_number) && log.set_number > 0 ? log.set_number : null,
      text: note, marks: [...marks(note), ...(log.skipped === true ? ['Sprunget sæt over'] : [])] })
  }
  result.entries = [...groups.values()].filter(e => e.comments.length || e.notes.length)
    .sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt) || a.key.localeCompare(b.key))
  // No receipt for empty or foreign-only data can establish an empty history.
  result.state = invalid || !rows.length && logs.readEvidence?.complete !== true ? 'unknown' : 'loaded'
  return result
}
