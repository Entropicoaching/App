import { addCalendarDays } from '../calendarDate.js'
import { inputInteger, parseInputNumber } from '../inputValues.js'

export const DEFAULT_COACH_PLAN_COPY = false
const exerciseFields = ['name', 'sets', 'reps', 'intensity', 'note', 'recommended_weight', 'exercise_order']
const pick = (row, fields) => Object.fromEntries(fields.map(key => [key, row[key] ?? null]))

// Check the original decimal value before inputInteger can round its mantissa.
// Moving the decimal point by the exponent must leave only zero digits to its right.
function copyInteger(value) {
  if (typeof value === 'string') {
    const match = value.trim().match(/^[+]?(\d+(?:[.,]\d*)?|[.,]\d+)(?:e([+-]?\d+))?$/i)
    if (!match) return null
    const [whole, fraction = ''] = match[1].split(/[.,]/)
    const digits = whole + fraction
    const trailingZeros = digits.length - digits.replace(/0+$/, '').length
    // Compare scales exactly without expanding even very large exponents.
    if (trailingZeros < digits.length && BigInt(match[2] || '0') < BigInt(fraction.length - trailingZeros)) return null
  }
  return inputInteger(value)
}

// Only program fields cross the boundary. IDs, logs and athlete data never do.
export function createCopyDraft(source, athleteId) {
  const number = copyInteger(source?.week_number)
  const start = addCalendarDays(source?.start_date, 7)
  if (source?.athlete_id != null && source.athlete_id !== athleteId) throw new Error('Kildeugen tilhører en anden atlet.')
  if (!athleteId || number === null || number < 1 || !start) throw new Error('Kildeugen skal have et gyldigt ugenummer og en startdato.')
  return {
    athlete_id: athleteId, source_week_id: source.id,
    week_number: number + 1, start_date: start,
    ...pick(source, ['block_name', 'coach_note', 'block_description']),
    sessions: (source.sessions || []).map(session => ({
      ...pick(session, ['title', 'session_order', 'weekday']),
      exercises: (session.exercises || []).map(exercise => pick(exercise, exerciseFields)),
    })),
  }
}

export function sessionDate(draft, session) {
  // Existing sessions use Monday=0, Sunday=6.
  if (!addCalendarDays(draft.start_date, 0)) return null
  const startDay = (new Date(draft.start_date + 'T00:00:00Z').getUTCDay() + 6) % 7
  return Number.isInteger(session.weekday) && session.weekday >= 0 && session.weekday <= 6
    ? addCalendarDays(draft.start_date, (session.weekday - startDay + 7) % 7) : null
}

export function validateCopyDraft(draft, weeks, athleteId) {
  if (!draft || draft.athlete_id !== athleteId) return 'Kladden tilhører en anden atlet.'
  const weekNumber = copyInteger(draft.week_number)
  if (!addCalendarDays(draft.start_date, 0) || weekNumber === null || weekNumber < 1) return 'Kontrollér ugenummer og startdato.'
  if (weeks.some(week => copyInteger(week.week_number) === weekNumber || week.start_date === draft.start_date)) return 'Målugen findes allerede. Ret ugenummer eller dato i kladden.'
  if (!draft.sessions.length) return 'Kladden skal indeholde mindst ét pas.'
  for (const session of draft.sessions) {
    if (!session.title?.trim()) return 'Giv hvert pas et navn.'
    if (session.weekday !== null && (!Number.isInteger(session.weekday) || session.weekday < 0 || session.weekday > 6)) return 'Vælg en gyldig ugedag.'
    for (const exercise of session.exercises) {
      if (!exercise.name?.trim()) return 'Giv hver øvelse et navn.'
      const sets = copyInteger(exercise.sets)
      if (exercise.sets !== null && (sets === null || sets < 1)) return 'Sæt skal være et positivt heltal.'
      if (exercise.recommended_weight !== null && parseInputNumber(exercise.recommended_weight) === null) return 'Brug en gyldig vægt.'
    }
  }
  return null
}

// Called only by the explicit Send handler. Same table contract as copyWeek.
// On failure, keep the local draft and remove the incomplete new week.
export async function sendCopyDraft(database, draft, weeks, athleteId) {
  const problem = validateCopyDraft(draft, weeks, athleteId)
  if (problem) throw new Error(problem)
  let weekId
  try {
    const week = await database.from('weeks').insert({
      ...pick(draft, ['athlete_id', 'block_name', 'coach_note', 'block_description', 'start_date']),
      week_number: copyInteger(draft.week_number),
    }).select().single()
    if (week.error || !week.data?.id) throw new Error(week.error?.message || 'Ugen kunne ikke gemmes.')
    weekId = week.data.id
    for (const [index, session] of draft.sessions.entries()) {
      const result = await database.from('sessions').insert({
        week_id: weekId, title: session.title, weekday: session.weekday, session_order: index,
      }).select().single()
      if (result.error || !result.data?.id) throw new Error(result.error?.message || 'Passet kunne ikke gemmes.')
      for (const [order, exercise] of session.exercises.entries()) {
        const resultEx = await database.from('exercises').insert({
          ...pick(exercise, exerciseFields), session_id: result.data.id, exercise_order: order,
          sets: exercise.sets === null ? null : copyInteger(exercise.sets),
          recommended_weight: exercise.recommended_weight === null ? null : parseInputNumber(exercise.recommended_weight),
        })
        if (resultEx.error) throw new Error(resultEx.error.message || 'Øvelsen kunne ikke gemmes.')
      }
    }
    return weekId
  } catch (error) {
    if (weekId) {
      try {
        const cleanup = await database.from('weeks').delete().eq('id', weekId).eq('athlete_id', athleteId)
        if (cleanup.error) throw cleanup.error
      } catch {
        const failure = new Error('Ugen blev kun delvist gemt. Kontrollér programmet før et nyt forsøg.')
        failure.needsReview = true
        throw failure
      }
    }
    throw error
  }
}
