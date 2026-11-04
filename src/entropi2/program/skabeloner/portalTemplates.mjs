import { createProgramTemplate } from './programTemplates.mjs'

// Export only prescriptions which this v1 format can represent losslessly.
// Do not copy IDs, logs, notes, weights or another athlete's identity.
export function templateFromWeek(week, name, athleteId) {
  if (!week || week.athlete_id !== athleteId || !Array.isArray(week.sessions)) throw Error('Vælg en uge for den aktuelle atlet.')
  const sessions = week.sessions.map(session => {
    if (!Number.isInteger(session.weekday) || session.weekday < 0 || session.weekday > 6 || !Array.isArray(session.exercises))
      throw Error('Alle pas skal have en fast ugedag og en øvelsesliste.')
    return { name: session.title, dayOfWeek: session.weekday + 1, exercises: session.exercises.map(exercise => {
      const sets = Number(exercise.sets), reps = Number(exercise.reps)
      const intensity = String(exercise.intensity ?? '').trim()
      const match = /^RPE\s*(\d+(?:[.,]\d+)?)$/i.exec(intensity)
      if (!Number.isInteger(sets) || sets < 1 || sets > 20 || !/^\d+$/.test(String(exercise.reps).trim()) ||
          !Number.isInteger(reps) || reps < 1 || reps > 100 || intensity && !match ||
          exercise.recommended_weight != null || exercise.note?.trim())
        throw Error('Skabelon v1 kræver 1–20 sæt, faste reps og valgfri mål-RPE. Vægte, noter, procent og rep-intervaller kan ikke kopieres uden tab.')
      return { exerciseKey: exercise.name, name: exercise.name,
        sets: Array.from({ length: sets }, () => ({ reps, rpe: match ? Number(match[1].replace(',', '.')) : null })) }
    }) }
  })
  const result = createProgramTemplate({ version: 1, name, weeks: [{ weekNumber: 1, sessions }] }, { enabled: true })
  if (result.state !== 'ready') throw Error(result.errors.map(e => e.message).join(' '))
  return result.template
}

export function readTemplateLibrary(raw) {
  if (raw === null) return []
  if (typeof raw !== 'string' || raw.length > 400000) throw Error('Skabelonlageret kan ikke læses.')
  const input = JSON.parse(raw)
  if (!Array.isArray(input) || input.length > 25) throw Error('Skabelonlageret har et ugyldigt format.')
  return input.map(template => {
    const result = createProgramTemplate(template, { enabled: true })
    if (result.state !== 'ready') throw Error('En gemt skabelon er ugyldig. Lageret er ikke overskrevet.')
    return result.template
  })
}
