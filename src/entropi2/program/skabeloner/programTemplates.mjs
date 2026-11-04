// Standalone coach drafts. No persistence, UI, dates, athlete data or delivery.
// Array order defines exercise/set order; weekNumber must be 1..N in order.
export const PROGRAM_TEMPLATE_VERSION = 1

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const text = (value, max, min = 1) => typeof value === 'string'
  && value.trim().length >= min && value.trim().length <= max

/**
 * JSON-like v1 contract; unknown fields are errors, never silently carried over.
 * Numeric strings are invalid. rpe is a target in half steps 1..10, or explicit
 * null when no target is prescribed. Sessions may share a day; [] is a rest week.
 * exerciseKey is an opaque catalogue reference, not a persisted exercise-row id.
 * Validation does not change the input. Errors have stable paths and codes.
 */
export function validateProgramTemplate(input) {
  const errors = []
  const error = (path, code, message) => errors.push({ path, code, message })
  function shape(value, path, required, optional = []) {
    if (!record(value)) { error(path, 'object', 'Skal være et objekt.'); return false }
    for (const key of Object.keys(value)) {
      if (![...required, ...optional].includes(key))
        error(`${path}.${key}`, 'unknown_field', 'Ukendt felt i skabelonen.')
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) error(`${path}.${key}`, 'required', 'Feltet mangler.')
    }
    return true
  }
  function list(value, path, min, max, visit) {
    if (!Array.isArray(value) || value.length < min || value.length > max) {
      error(path, 'array', `Skal være en liste med ${min} til ${max} elementer.`)
      return
    }
    // Unlike forEach/map, this visits holes and rejects sparse lists.
    for (let i = 0; i < value.length; i++) visit(value[i], `${path}[${i}]`, i)
  }
  function label(value, path, max = 120, min = 1) {
    if (!text(value, max, min)) error(path, 'text', `Skal være tekst med ${min} til ${max} tegn efter trimning.`)
  }
  if (shape(input, '$', ['version', 'name', 'weeks'], ['description'])) {
    if (input.version !== PROGRAM_TEMPLATE_VERSION) error('$.version', 'version', 'Kun skabelonversion 1 understøttes.')
    label(input.name, '$.name')
    if (Object.hasOwn(input, 'description')) label(input.description, '$.description', 2000, 0)
    list(input.weeks, '$.weeks', 1, 52, (week, wp, index) => {
      if (!shape(week, wp, ['weekNumber', 'sessions'])) return
      if (week.weekNumber !== index + 1) error(`${wp}.weekNumber`, 'week_order', 'Uger skal være fortløbende fra 1.')
      list(week.sessions, `${wp}.sessions`, 0, 14, (session, sp) => {
        if (!shape(session, sp, ['name', 'dayOfWeek', 'exercises'])) return
        label(session.name, `${sp}.name`)
        if (!integer(session.dayOfWeek, 1, 7)) error(`${sp}.dayOfWeek`, 'day', 'Ugedag skal være et heltal fra 1 (mandag) til 7 (søndag).')
        list(session.exercises, `${sp}.exercises`, 1, 30, (exercise, ep) => {
          if (!shape(exercise, ep, ['exerciseKey', 'name', 'sets'])) return
          label(exercise.exerciseKey, `${ep}.exerciseKey`)
          label(exercise.name, `${ep}.name`)
          list(exercise.sets, `${ep}.sets`, 1, 20, (set, tp) => {
            if (!shape(set, tp, ['reps', 'rpe'])) return
            if (!integer(set.reps, 1, 100)) error(`${tp}.reps`, 'reps', 'Reps skal være et heltal fra 1 til 100.')
            if (set.rpe !== null && !(typeof set.rpe === 'number' && Number.isFinite(set.rpe)
                && set.rpe >= 1 && set.rpe <= 10 && Number.isInteger(set.rpe * 2)))
              error(`${tp}.rpe`, 'rpe', 'Mål-RPE skal være null eller 1 til 10 i halve trin.')
          })
        })
      })
    })
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Opt-in only: strict OFF returns null before reading template data.
 * Each success returns a detached, trimmed draft, including all nested arrays.
 * Reuse by calling again with an existing template. No IDs or dates are assigned;
 * mapping to a real program and coach approval belong to a later integration.
 */
export function createProgramTemplate(input, { enabled = false } = {}) {
  if (enabled !== true) return null
  const { valid, errors } = validateProgramTemplate(input)
  if (!valid) return { state: 'invalid', template: null, errors }
  return { state: 'ready', errors: [], template: {
    version: PROGRAM_TEMPLATE_VERSION,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    weeks: input.weeks.map(week => ({ weekNumber: week.weekNumber,
      sessions: week.sessions.map(session => ({ name: session.name.trim(), dayOfWeek: session.dayOfWeek,
        exercises: session.exercises.map(exercise => ({ exerciseKey: exercise.exerciseKey.trim(),
          name: exercise.name.trim(), sets: exercise.sets.map(set => ({ reps: set.reps, rpe: set.rpe })) })) })) })),
  } }
}
