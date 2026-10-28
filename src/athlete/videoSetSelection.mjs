import { calendarDay } from '../calendarDate.js'

// Explicit opt-in only. No URL, storage or environment activation.
export const VIDEO_SET_SELECTION_ENABLED = false

function number(value, max, integer = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (value == null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= max && (!integer || Number.isInteger(n) && n > 0) ? n : null
}

export function videoSetOptions(session, logs = []) {
  if (!session?.id) return []
  return (session.exercises || []).flatMap(ex => {
    const name = String(ex.name || '')
    const folded = name.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe')
    const lift = /squat/.test(folded) ? 'squat' : /baenk|bench/.test(folded) ? 'bench'
      : /doedl|deadlift/.test(folded) ? 'deadlift' : null
    if (!ex.id || !lift || !Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 100) return []
    return Array.from({ length: ex.sets }, (_, index) => {
      const n = index + 1
      const log = logs.find(row => row.exercise_id === ex.id && row.set_number === n)
      if (log?.skipped) return null
      return { key: JSON.stringify([session.id, ex.id, n]), training_session_id: session.id,
        program_item_id: ex.id, set_id: log?.id || null, set_number: n,
        exercise_name: name, lift, load_kg: log ? log.weight : ex.recommended_weight,
        reps: log ? log.reps_completed : ex.reps }
    }).filter(Boolean)
  })
}

// Keep today's completed sets selectable after the last set advances Dagens pas.
export function videoOptionsForDay(pas, week, logs, day) {
  const sessions = pas?.session ? [pas.session] : []
  for (const session of week?.sessions || []) {
    if (sessions.some(row => row.id === session.id)) continue
    const touchedToday = logs.some(log => {
      if (log.skipped || !session.exercises?.some(ex => ex.id === log.exercise_id)) return false
      const key = calendarDay(log.logged_at)
      return key === day
    })
    if (touchedToday) sessions.push(session)
  }
  return sessions.flatMap(session => videoSetOptions(session, logs))
}

export function resolveVideoSet(options, choice) {
  const option = options.find(row => row.key === choice?.key)
  if (!option) return null
  const kg = number(choice.loadKg, 1000)
  const reps = number(choice.reps, 20, true)
  if (kg == null || reps == null) return null
  return { ...option, load_kg: kg, reps }
}

export function bindVideoSet(row, selected) {
  row.lift = selected.lift
  row.load_kg = selected.load_kg
  // Reps belong to the selected set, not to unperformed tracking measurements.
  row.session_context = { ...row.session_context,
    training_session_id: selected.training_session_id, program_item_id: selected.program_item_id,
    video_set: { set_id: selected.set_id, set_key: selected.key, set_number: selected.set_number,
      exercise_id: selected.program_item_id, exercise_name: selected.exercise_name,
      lift: selected.lift, load_kg: selected.load_kg, reps: selected.reps } }
  return row
}

export function videoSetQueueDetail(video) {
  const set = video.session_context?.video_set
  return set && typeof set.exercise_name === 'string' && Number.isInteger(set.set_number)
    && number(set.load_kg, 1000) != null && number(set.reps, 20, true) != null
    ? `${set.exercise_name} · sæt ${set.set_number} · ${set.load_kg} kg · ${set.reps} gentagelser` : null
}

export function renderVideoSetPicker(h, { options, choice, onChange, onContinue, onClose }) {
  const selected = resolveVideoSet(options, choice)
  const style = { minHeight: 44, fontSize: '1rem', maxWidth: '100%' }
  return h('section', { 'aria-label': 'Vælg løft og sæt', style: { padding: '1rem', color: '#edeae2' } },
    h('h2', null, 'Hvilket sæt viser videoen?'),
    options.length ? h('label', null, 'Løft og sæt i dagens pas',
      h('select', { style, value: choice?.key || '', onChange: e => {
        const option = options.find(row => row.key === e.target.value)
        onChange(option ? { key: option.key, loadKg: option.load_kg ?? '', reps: option.reps ?? '' } : null)
      } }, h('option', { value: '' }, 'Vælg løft og sæt'), ...options.map(row =>
        h('option', { key: row.key, value: row.key }, `${row.exercise_name}, sæt ${row.set_number}`))))
      : h('p', { role: 'status' }, 'Der er ingen sæt til video i dagens pas.'),
    choice && h('div', null,
      h('label', null, 'Vægt i kg', h('input', { style, type: 'number', min: 0, max: 1000, step: 'any', value: choice.loadKg,
        onChange: e => onChange({ ...choice, loadKg: e.target.value }) })),
      h('label', null, 'Gentagelser', h('input', { style, type: 'number', min: 1, max: 20, step: 1, value: choice.reps,
        onChange: e => onChange({ ...choice, reps: e.target.value }) }))),
    h('button', { type: 'button', style, disabled: !selected, onClick: () => { if (selected) onContinue() } }, 'Fortsæt til video'),
    h('button', { type: 'button', style, onClick: onClose }, 'Annuller'))
}
