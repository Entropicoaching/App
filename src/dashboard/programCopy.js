import { mainLiftName } from '../exerciseSetView.js'
import { parseInputNumber } from '../inputValues.js'
import { nextWeekStartDate } from '../weekDates.js'
import { addCalendarDays } from '../calendarDate.js'

export function copyBlockName(name, weeks) {
  const base = name || 'Blok'
  const used = new Set(weeks.map(w => w.block_name))
  let candidate = `${base} (kopi)`
  for (let n = 2; used.has(candidate); n++) candidate = `${base} (kopi ${n})`
  return candidate
}

export function progressedPrescription(exercise, progression) {
  const prescription = { reps: exercise.reps, recommended_weight: exercise.recommended_weight ?? null }
  if (!mainLiftName(exercise.name)) return prescription
  if (progression === 'weight') {
    const weight = parseInputNumber(exercise.recommended_weight)
    if (weight !== null && weight >= 0) prescription.recommended_weight = weight + 2.5
  }
  if (progression === 'reps') {
    const raw = String(exercise.reps ?? '').trim()
    const numbers = raw.match(/^\d+(?:\s*[-–]\s*\d+)?$/)?.[0].match(/\d+/g)?.map(Number)
    if (numbers?.every(n => Number.isSafeInteger(n + 1)) && numbers[0] <= numbers.at(-1)) {
      prescription.reps = raw.replace(/\d+/g, n => String(Number(n) + 1))
    }
  }
  return prescription
}

export function skippedProgressions(weeks, progression) {
  if (progression === 'none') return []
  return weeks.flatMap(w => w.sessions || []).flatMap(s => s.exercises || []).filter(ex => {
    if (!mainLiftName(ex.name)) return false
    const result = progressedPrescription(ex, progression)
    return progression === 'weight'
      ? result.recommended_weight === (ex.recommended_weight ?? null)
      : result.reps === ex.reps
  })
}

// Kun planfelter kopieres. Id'er, logs og gennemført træning følger aldrig med.
export async function copyProgramWeeks({ client, athleteId, existingWeeks, sourceWeeks, progression = 'none', blockName }) {
  if (!['none', 'weight', 'reps'].includes(progression)) throw new Error('Vælg en progression.')
  if (!athleteId || !sourceWeeks.length) throw new Error('Vælg en uge eller blok.')
  const firstNumber = Math.max(0, ...existingWeeks.map(w => Number(w.week_number))) + 1
  const startDate = nextWeekStartDate(existingWeeks)
  const created = []
  try {
    for (const [index, week] of sourceWeeks.entries()) {
      const { data: newWeek, error } = await client.from('weeks').insert({
        athlete_id: athleteId,
        week_number: firstNumber + index,
        block_name: blockName ?? week.block_name,
        coach_note: week.coach_note,
        block_description: week.block_description,
        start_date: addCalendarDays(startDate, index * 7),
      }).select().single()
      if (error || !newWeek?.id) throw error || new Error('Ugen kunne ikke oprettes.')
      created.push({ ...newWeek, week_number: firstNumber + index })
      for (const session of week.sessions || []) {
        const { data: newSession, error } = await client.from('sessions').insert({
          week_id: newWeek.id, title: session.title,
          session_order: session.session_order, weekday: session.weekday ?? null,
        }).select().single()
        if (error || !newSession?.id) throw error || new Error('Passet kunne ikke oprettes.')
        for (const ex of session.exercises || []) {
          const { error } = await client.from('exercises').insert({
            session_id: newSession.id, name: ex.name, sets: ex.sets,
            intensity: ex.intensity, note: ex.note, exercise_order: ex.exercise_order,
            ...progressedPrescription(ex, progression),
          })
          if (error) throw error
        }
      }
    }
    return created
  } catch (error) {
    // Appens eksisterende ugesletning sletter også tilhørende pas og øvelser.
    // Ryd kun de uger, som dette forsøg selv oprettede.
    let cleanupFailed = false
    for (const week of [...created].reverse()) {
      try {
        const result = await client.from('weeks').delete().eq('id', week.id)
        if (result.error) cleanupFailed = true
      } catch { cleanupFailed = true }
    }
    if (cleanupFailed) throw new Error('Kopieringen fejlede. En delvis kopi kan være gemt. Kontrollér programmet.', { cause: error })
    throw new Error('Kopieringen fejlede. Prøv igen.', { cause: error })
  }
}
