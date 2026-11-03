import { calendarDay, calendarDaysBetween, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../inputValues.js'
import { mainLiftName } from '../../../exerciseSetView.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadBlok } from '../../../exerciseProgress.js'
import { explicitRpe } from '../../../dataEnough.mjs'
import { visibleRpeNote } from '../../../rpeEvidence.mjs'
import { mentionsPain } from '../../../coachBriefingRules.js'

export const LIFTS = Object.freeze(['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
const fmt = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
export const formatBasis = value => value === null ? 'Data mangler' : fmt.format(value)
const id = value => typeof value === 'string' && value.trim().length > 0
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDay(value) === value
const text = value => typeof value === 'string' ? value.trim() : ''
const objects = rows => Array.isArray(rows) && rows.every(r => r && typeof r === 'object')
const mean = values => values.length ? values.reduce((sum, v) => sum + v / values.length, 0) : null
const unknown = message => ({ state: 'unknown', message, weeks: [], lifts: [], observations: [] })

function receipt(source, athleteId, block) {
  return source?.complete === true && source.athleteId === athleteId && source.blockId === block.id &&
    source.from === block.start_date && source.through === block.end_date && objects(source.rows)
}

// Only an explicit, complete block catalogue can establish which block is last.
function lastBlock(input, today) {
  if (!id(input.athleteId) || input.blocks?.complete !== true ||
      input.blocks.athleteId !== input.athleteId || input.blocks.through !== today || !objects(input.blocks.rows)) return null
  const own = input.blocks.rows.filter(b => b.athlete_id === input.athleteId)
  if (own.some(b => !id(b.id) || !date(b.start_date) || !date(b.end_date) || b.end_date < b.start_date)) return null
  if (new Set(own.map(b => b.id)).size !== own.length) return null
  const ended = own.filter(b => b.end_date < today).sort((a, b) => b.end_date.localeCompare(a.end_date))
  if (!ended.length || ended.length > 1 && ended[0].end_date === ended[1].end_date) return null
  const block = ended[0], days = calendarDaysBetween(block.start_date, block.end_date) + 1
  return [28, 35, 42].includes(days) ? { ...block, weekCount: days / 7 } : null
}

function planRows(source, athleteId, block) {
  if (!receipt(source, athleteId, block)) return null
  const weeks = source.rows.filter(w => w.athlete_id === athleteId && w.block_id === block.id)
    .slice().sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
  if (weeks.length !== block.weekCount) return null
  const exercises = new Map(), sessions = new Set()
  for (const [index, week] of weeks.entries()) {
    if (week.start_date !== addCalendarDays(block.start_date, index * 7) || !objects(week.sessions)) return null
    for (const session of week.sessions) {
      if (!id(session.id) || sessions.has(session.id) || !objects(session.exercises)) return null
      sessions.add(session.id)
      for (const ex of session.exercises) {
        if (!id(ex.id) || exercises.has(ex.id) || !text(ex.name) || !Number.isSafeInteger(ex.sets) || ex.sets <= 0) return null
        exercises.set(ex.id, { ...ex, session, week: index })
      }
    }
  }
  if (!Number.isSafeInteger([...exercises.values()].reduce((sum, ex) => sum + ex.sets, 0))) return null
  return { weeks, exercises }
}

function logRows(source, athleteId, block, plan) {
  if (!plan || !receipt(source, athleteId, block)) return null
  const positions = new Map(), ids = new Map()
  for (const r of source.rows.filter(r => r.athlete_id === athleteId)) {
    if (r._optimistic) continue
    const ex = plan.exercises.get(r.exercise_id)
    const stamp = typeof r.logged_at === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(r.logged_at)
    const day = stamp ? calendarDay(r.logged_at) : null
    if (!day) return null
    if (day < block.start_date || day > block.end_date) continue
    if (!ex || !Number.isSafeInteger(r.set_number) || r.set_number < 1 || r.set_number > ex.sets ||
        Math.floor(calendarDaysBetween(block.start_date, day) / 7) !== ex.week ||
        r.skipped != null && typeof r.skipped !== 'boolean') return null
    const weight = parseInputNumber(r.weight), reps = parseInputNumber(r.reps_completed)
    if (!r.skipped && (weight === null || !(weight >= 0) || !Number.isSafeInteger(reps) || reps <= 0 || !Number.isFinite(weight * reps))) return null
    const note = visibleRpeNote(text(r.note)).trim()
    const rating = explicitRpe(r) ? (r.rpe_actual ?? r.rpe) : null
    const key = JSON.stringify([r.exercise_id, r.set_number])
    const signature = JSON.stringify([key, day, weight, reps, r.skipped === true, note, rating])
    if (positions.has(key) && positions.get(key).signature !== signature ||
        r.id != null && ids.has(r.id) && ids.get(r.id) !== signature) return null
    if (r.id != null) ids.set(r.id, signature)
    positions.set(key, { signature, day, weight, reps, skipped: r.skipped === true, note, rating, ex,
      lift: mainLiftName(ex.name), key })
  }
  return [...positions.values()].sort((a, b) => a.day.localeCompare(b.day) || a.key.localeCompare(b.key))
}

function weightSeries(source, athleteId, block, weeks) {
  if (!receipt(source, athleteId, block)) return { state: 'unknown', points: [], delta: null }
  const days = new Map()
  for (const r of source.rows.filter(r => r.athlete_id === athleteId)) {
    if (!date(r.date)) return { state: 'unknown', points: [], delta: null }
    if (r.date < block.start_date || r.date > block.end_date) continue
    const kg = parseInputNumber(r.weight)
    if (!(kg > 0) || days.has(r.date) && days.get(r.date) !== kg) return { state: 'unknown', points: [], delta: null }
    days.set(r.date, kg)
  }
  const points = weeks.map(w => {
    const values = [...days].filter(([day]) => day >= w.start && day <= w.end).map(([, kg]) => kg)
    return { start: w.start, days: values.length, value: mean(values) }
  })
  // Compare the block's two endpoint weeks, never a convenient pair in the middle.
  const first = points[0], last = points.at(-1)
  const delta = first.days >= 3 && last.days >= 3 ? last.value - first.value : null
  return { state: 'ready', points, delta: Number.isFinite(delta) ? delta : null }
}

function noteMarks(note) {
  return { pain: mentionsPain(note),
    stop: /\b(stop|stoppet|stoppede|afbrudt|afbrød|stopped|aborted)\b/i.test(note.replace(/\b(ikke|aldrig|not|never)\s+(stop|stoppet|stoppede|afbrudt|afbrød|stopped|aborted)\b/gi, '')) }
}

/** Read-only, explicit snapshot contract; see ADAPTER.md. No implicit clock or IO. */
export function planGrundlag(input = {}, now) {
  const today = now == null ? null : calendarDay(now)
  const block = today && lastBlock(input, today)
  if (!block) return unknown('Seneste afsluttede blok på 4–6 uger er ikke dokumenteret.')
  const plan = planRows(input.plan, input.athleteId, block)
  const logs = logRows(input.logs, input.athleteId, block, plan)
  const weeks = Array.from({ length: block.weekCount }, (_, i) => ({
    start: addCalendarDays(block.start_date, i * 7), end: addCalendarDays(block.start_date, i * 7 + 6),
  }))
  const lifts = LIFTS.map(lift => {
    const points = weeks.map((week, i) => {
      const rows = logs?.filter(r => r.lift === lift && r.ex.week === i && !r.skipped)
      const rated = rows?.filter(r => r.rating !== null) ?? []
      const estimates = (rows ?? []).filter(r => text(plan.weeks[i].block_name ?? block.name) &&
        r.weight > 0 && erTungtSaet(r.ex.name, r.reps) &&
        !erDeloadBlok(plan.weeks[i].block_name ?? block.name))
        .map(r => ({ value: estimatedOneRepMax(r.weight, r.reps), zone: r.reps <= 3 ? '1–3' : r.reps <= 5 ? '4–5' : '6–8' }))
        .filter(e => e.value > 0)
      const zones = Object.fromEntries(['1–3', '4–5', '6–8'].map(zone => [zone,
        estimates.filter(e => e.zone === zone).reduce((best, e) => Math.max(best, e.value), 0) || null]))
      const tonnage = rows ? rows.reduce((sum, r) => sum + r.weight * r.reps, 0) : null
      return { ...week, sets: rows?.length ?? null, tonnage: Number.isFinite(tonnage) ? tonnage : null,
        e1rm: estimates.length ? Math.max(...estimates.map(e => e.value)) : null, zones,
        rpe: mean(rated.map(r => r.rating)), rated: logs ? rated.length : null }
    })
    // Compare only matching rep zones in the endpoint weeks. Report the zone.
    const zone = ['1–3', '4–5', '6–8'].find(z => points[0].zones[z] && points.at(-1).zones[z])
    const percent = zone ? (points.at(-1).zones[zone] / points[0].zones[zone] - 1) * 100 : null
    return { lift, points, comparison: Number.isFinite(percent) ? { zone, percent } : null }
  })
  const planned = plan ? [...plan.exercises.values()].reduce((sum, ex) => sum + ex.sets, 0) : null
  const confirmed = logs ? logs.filter(r => !r.skipped).length : null
  const skipped = logs ? logs.filter(r => r.skipped).length : null
  const compliance = { planned, confirmed, skipped, percent: planned > 0 && logs ? confirmed / planned * 100 : null }
  const notes = []
  for (const row of logs ?? []) {
    if (row.note || row.skipped) notes.push({ key: row.key, day: row.day, sessionId: row.ex.session.id,
      exercise: row.ex.name, text: row.note, skipped: row.skipped, ...noteMarks(row.note) })
  }
  // A dated plan owns session comments, including sessions without set logs.
  if (logs) for (const [i, week] of plan.weeks.entries()) for (const session of week.sessions) {
    const comment = text(session.athlete_comment)
    if (comment) notes.push({ key: `session:${session.id}`, day: null, weekStart: weeks[i].start,
      sessionId: session.id, exercise: 'Paskommentar', text: comment, skipped: false, ...noteMarks(comment) })
  }
  const painSessions = logs ? new Set(notes.filter(n => n.pain).map(n => n.sessionId)).size : null
  const stopSessions = logs ? new Set(notes.filter(n => n.stop).map(n => n.sessionId)).size : null
  const weight = weightSeries(input.weights, input.athleteId, block, weeks)
  const observations = lifts.filter(l => l.comparison).map(l =>
    `${l.lift}: e1RM ændrede sig ${formatBasis(l.comparison.percent)} % mellem første og sidste blokuge (${l.comparison.zone} reps).`)
  if (logs) observations.push(`${painSessions} pas med omtale af smerte. ${stopSessions} pas med omtale af stop.`)
  if (compliance.percent !== null) observations.push(`${formatBasis(compliance.percent)} % af planlagte sæt er registreret gennemført.`)
  if (weight.delta !== null) observations.push(`Kropsvægtens ugegennemsnit ændrede sig ${formatBasis(weight.delta)} kg mellem første og sidste blokuge.`)
  return { state: 'ready', block, weeks, lifts, compliance, notes, painSessions, stopSessions, weight,
    logsReady: logs !== null, planReady: plan !== null, observations,
    message: 'Registreringer fra den seneste afsluttede blok. Observationerne beskriver data; coachen vurderer næste blok.' }
}
