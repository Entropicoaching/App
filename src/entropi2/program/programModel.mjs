const text = value => typeof value === 'string' ? value.trim() : ''
const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0

// Read-only projection of the already loaded active week. No clock, logs or IO.
export function programModel(week) {
  if (!week) return { kind: 'missing', sessions: [] }
  if (!Array.isArray(week.sessions)) return { kind: 'incomplete', sessions: [] }
  return {
    kind: week.sessions.length ? 'ready' : 'empty',
    label: Number.isInteger(week.week_number) && week.week_number > 0 ? `Uge ${week.week_number}` : 'Denne uge',
    block: text(week.block_name), note: text(week.coach_note),
    sessions: week.sessions.map(session => ({
      title: text(session?.title) || 'Træningspas',
      day: Number.isInteger(session?.weekday) && session.weekday >= 0 && session.weekday < 7
        ? weekdays[session.weekday] : 'Dag ikke fastlagt',
      kind: !Array.isArray(session?.exercises) ? 'incomplete' : session.exercises.length ? 'training' : 'rest',
      exercises: (Array.isArray(session?.exercises) ? session.exercises : []).map(ex => ({
        name: text(ex?.name) || 'Øvelse uden navn',
        sets: Number.isInteger(ex?.sets) && ex.sets >= 0 ? `${ex.sets} sæt` : 'Sæt ikke angivet',
        reps: text(ex?.reps) || (number(ex?.reps) ? String(ex.reps) : ''),
        intensity: text(ex?.intensity),
        weight: number(ex?.recommended_weight) ? `${ex.recommended_weight.toLocaleString('da-DK')} kg` : '',
        note: text(ex?.note),
      })),
    })),
  }
}
