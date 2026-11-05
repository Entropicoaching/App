import { messageText } from '../../conversation/conversationModel.mjs'
import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber, finiteMean } from '../../../inputValues.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadBlok } from '../../../exerciseProgress.js'
import { mainLiftName } from '../../../exerciseSetView.js'
import { explicitRpe } from '../../../dataEnough.mjs'
import { visibleRpeNote } from '../../../rpeEvidence.mjs'
import { mentionsPain } from '../../../coachBriefingRules.js'

export const EVALUATION_LIFTS = Object.freeze(['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
const civil = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && calendarDay(v) === v
const text = v => typeof v === 'string' ? v.trim() : ''
const id = v => typeof v === 'string' && v.trim().length > 0
const stamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const dayOf = v => typeof v === 'string' && stamp.test(v) ? calendarDay(v) : null
const within = (d, start, end) => !!d && d >= start && d <= end
const unknown = Object.freeze({ state: 'unknown' })

// Completed, authorized read receipts are supplied by the future caller.
// This model does no I/O and does not infer permission from an athlete ID.
function source(value, athleteId, start, end) {
  return value?.athleteId === athleteId && value.state === 'ready' && value.complete === true &&
    civil(value.from) && civil(value.through) && value.from <= start && value.through >= end &&
    Array.isArray(value.rows) && value.rows.every(r => r && r.athlete_id === athleteId)
      ? value : null
}

// Identical retries count once. Conflicts are removed, never resolved by order.
function unique(rows, key) {
  const groups = new Map()
  for (const r of rows) {
    const k = key(r), group = groups.get(k) || []
    group.push(r); groups.set(k, group)
  }
  let conflicts = 0
  const values = [...groups.values()].flatMap(group => {
    if (new Set(group.map(r => JSON.stringify(r))).size > 1) { conflicts++; return [] }
    return [group[0]]
  })
  return { values, conflicts }
}

function trainingModel(s, start, end) {
  const week = s?.week
  if (!s || week?.start_date !== start || (week.athlete_id && week.athlete_id !== s.athleteId) ||
    !Array.isArray(week.sessions)) return unknown
  const exercises = new Map(), sessions = [], sessionIds = new Set()
  for (const session of week.sessions) {
    if (!id(session?.id) || sessionIds.has(session.id) || !Array.isArray(session.exercises) ||
      (session.athlete_id && session.athlete_id !== s.athleteId)) return unknown
    sessionIds.add(session.id)
    for (const ex of session.exercises) {
      if (!id(ex?.id) || exercises.has(ex.id) || !Number.isSafeInteger(ex.sets) || ex.sets <= 0 ||
        (ex.athlete_id && ex.athlete_id !== s.athleteId)) return unknown
      exercises.set(ex.id, ex)
    }
    if (session.exercises.length) sessions.push(session)
  }
  const invalidRows = s.rows.some(r => !id(r.id) || !dayOf(r.logged_at) ||
    within(dayOf(r.logged_at), start, end) && exercises.has(r.exercise_id) &&
    (!Number.isSafeInteger(r.set_number) || r.set_number < 1 || r.set_number > exercises.get(r.exercise_id).sets))
  const identified = unique(s.rows, r => r.id)
  const candidates = identified.values.filter(r => id(r.id) && within(dayOf(r.logged_at), start, end) &&
    exercises.has(r.exercise_id) && Number.isSafeInteger(r.set_number) &&
    r.set_number >= 1 && r.set_number <= exercises.get(r.exercise_id).sets)
  // Retry IDs may differ; the planned position is authoritative.
  const normalized = candidates.map(r => ({ ...r, id: undefined }))
  const { values, conflicts } = unique(normalized, r => JSON.stringify([r.exercise_id, r.set_number]))
  const rows = values.filter(r => !r._optimistic &&
    (r.skipped === undefined || typeof r.skipped === 'boolean'))
  const confirmed = rows.filter(r => r.skipped !== true)
  const rated = confirmed.filter(explicitRpe).map(r => r.rpe_actual ?? r.rpe)
  const lifts = EVALUATION_LIFTS.map(lift => {
    const best = confirmed.flatMap(r => {
      const ex = exercises.get(r.exercise_id), reps = parseInputNumber(r.reps_completed)
      if (mainLiftName(ex.name) !== lift || !Number.isSafeInteger(reps) || !erTungtSaet(ex.name, reps) ||
        !text(week.block_name) || erDeloadBlok(week.block_name)) return []
      const value = estimatedOneRepMax(r.weight, reps)
      return value > 0 ? [value] : []
    })
    return { lift, value: best.length ? best.reduce((a, b) => Math.max(a, b)) : null }
  })
  const done = sessions.filter(session => session.exercises.every(ex =>
    rows.filter(r => r.exercise_id === ex.id).length === ex.sets)).length
  const notes = []
  for (const session of sessions) {
    if (text(session.athlete_comment)) notes.push({ key: `session-${session.id}`, day: null,
      title: text(session.title) || 'Paskommentar', text: text(session.athlete_comment) })
  }
  for (const r of rows) {
    const note = visibleRpeNote(r.note).trim()
    if (note || r.skipped) notes.push({ key: `${r.exercise_id}-${r.set_number}`, day: dayOf(r.logged_at),
      title: `${text(exercises.get(r.exercise_id).name) || 'Øvelse'} · Sæt ${r.set_number}`,
      text: note || 'Sprunget sæt over' })
  }
  return { state: invalidRows || identified.conflicts || conflicts || rows.length !== values.length ? 'partial' : 'ready',
    planned: sessions.length, done, plannedSets: [...exercises.values()].reduce((n, ex) => n + ex.sets, 0),
    sets: confirmed.length, skipped: rows.length - confirmed.length, rpe: finiteMean(rated), rpeCount: rated.length,
    lifts, notes }
}

function nutritionModel(s, start, end) {
  if (!s) return unknown
  const { values, conflicts } = unique(s.rows, r => r.id)
  const days = new Map()
  let partial = conflicts > 0
  for (const r of values) {
    if (!id(r.id) || !civil(r.date)) { partial = true; continue }
    if (!within(r.date, start, end)) continue
    if (r._optimistic) { partial = true; continue }
    if (text(r.meal).startsWith('[appData2-day-v1]')) continue
    const kcal = parseInputNumber(r.kcal), protein = parseInputNumber(r.protein)
    if (!text(r.meal) || kcal === null || protein === null || kcal < 0 || protein < 0) { partial = true; continue }
    const d = days.get(r.date) || { kcal: 0, protein: 0 }
    d.kcal += kcal; d.protein += protein; days.set(r.date, d)
  }
  const totals = [...days.values()]
  if (totals.some(d => !Number.isFinite(d.kcal) || !Number.isFinite(d.protein))) return unknown
  const target = s.target?.athlete_id === s.athleteId ? s.target : null
  const goal = key => parseInputNumber(target?.[key]) > 0 ? parseInputNumber(target[key]) : null
  return { state: partial ? 'partial' : 'ready', days: days.size,
    kcal: finiteMean(totals.map(d => d.kcal)), protein: finiteMean(totals.map(d => d.protein)),
    kcalTarget: goal('kcal_target'), proteinTarget: goal('protein_target') }
}

function weightModel(s, start, end) {
  if (!s) return unknown
  const previousStart = addCalendarDays(start, -7), previousEnd = addCalendarDays(start, -1)
  const { values, conflicts } = unique(s.rows, r => r.id)
  const days = new Map()
  let partial = conflicts > 0
  for (const r of values) {
    const day = dayOf(r.logged_at), weight = parseInputNumber(r.weight)
    if (!id(r.id) || !day || !(weight > 0)) { partial = true; continue }
    if (!within(day, previousStart, end)) continue
    if (r._optimistic) { partial = true; continue }
    const items = days.get(day) || []; items.push(weight); days.set(day, items)
  }
  const average = (a, b) => finiteMean([...days].filter(([d]) => within(d, a, b)).map(([, ws]) => finiteMean(ws)))
  const current = average(start, end)
  const previousLoaded = s.from <= previousStart
  const previous = previousLoaded ? average(previousStart, previousEnd) : null
  return { state: partial ? 'partial' : 'ready', average: current, previous,
    days: [...days.keys()].filter(d => within(d, start, end)).length,
    previousDays: previousLoaded ? [...days.keys()].filter(d => within(d, previousStart, previousEnd)).length : null,
    delta: current !== null && previous !== null ? current - previous : null }
}

function messageModel(s, start, end) {
  if (!s) return { ...unknown, entries: [] }
  const { values, conflicts } = unique(s.rows, r => r.id)
  let partial = conflicts > 0
  const entries = values.flatMap(r => {
    const day = dayOf(r.created_at)
    if (!id(r.id) || !day || !['athlete', 'coach'].includes(r.sender_role) || !text(r.content)) { partial = true; return [] }
    if (!within(day, start, end)) return []
    if (r._optimistic) { partial = true; return [] }
    return [{ key: `message-${r.id}`, day, title: r.sender_role === 'athlete' ? 'Atlet' : 'Coach', text: messageText(r) }]
  }).sort((a, b) => a.day.localeCompare(b.day) || a.key.localeCompare(b.key))
  return { state: partial ? 'partial' : 'ready', entries }
}

export function evaluationMarks(value) {
  const withoutNegation = value.replace(/\b(ikke|aldrig|not|never)\s+(stop|stoppet|stoppede|afbrudt|afbrød|stopped)\b/gi, '')
  return [mentionsPain(value) && 'Smerte nævnt', /\b(stop|stoppet|stoppede|afbrudt|afbrød|stopped)\b/i.test(withoutNegation) && 'Stop nævnt'].filter(Boolean)
}

/** Pure snapshot for a completed seven-day week. No reads, writes or clock. */
export function weekEvaluation(input = {}) {
  if (!input || typeof input !== 'object') return { state: 'invalid' }
  const { athleteId, athleteName, today } = input
  if (!id(athleteId) || !civil(today)) return { state: 'invalid' }
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const start = input.weekStart ?? addCalendarDays(monday, -7)
  const end = civil(start) ? addCalendarDays(start, 6) : null
  if (!end || end >= today) return { state: 'invalid' }
  const read = key => source(input[key], athleteId, start, end)
  const training = trainingModel(read('training'), start, end)
  const messages = messageModel(read('messages'), start, end)
  return { state: 'ready', athleteId, athleteName: text(athleteName) || 'Atlet', start, end,
    training, nutrition: nutritionModel(read('nutrition'), start, end), weights: weightModel(read('weights'), start, end),
    notes: { trainingState: training.state, messageState: messages.state,
      entries: [...(training.notes || []), ...messages.entries].map(n => ({ ...n, marks: evaluationMarks(n.text) })) } }
}
