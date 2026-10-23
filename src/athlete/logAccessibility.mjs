export function setAnnouncement(previous, last, logs = [], exercises = []) {
  const names = new Map(previous.names || [])
  for (const exercise of exercises || []) names.set(exercise.id, exercise.name)
  const count = previous.count || 0
  if (!last) return { last: null, text: '', names, count }
  const row = logs.find(log => log.exercise_id === last.exerciseId && log.set_number === last.setNumber && !log.skipped)
  if (!row) return { last: previous.last, text: '', names, count }
  if (previous.last === last) return { ...previous, names }
  const name = names.get(last.exerciseId) || `Øvelse ${last.exerciseId}`
  return { last, names, count: count + 1,
    text: `Godkendt, ${name}, sæt ${last.setNumber}. Loggen viser ${row.weight ?? 0} kg og ${row.reps_completed ?? 0} reps. Godkendelse ${count + 1}.` }
}

// Popupen har kun én kontrol. Native bundark håndteres fortsat af dialog.
export function bindFirstSetFocus({ dialog, trigger, close, dismiss }) {
  const doc = dialog.ownerDocument
  const contain = event => {
    if (!dialog.contains(event.target)) close.focus()
  }
  const keydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      dismiss()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      close.focus()
    }
  }
  doc.addEventListener('keydown', keydown)
  doc.addEventListener('focusin', contain)
  close.focus()
  return () => {
    doc.removeEventListener('keydown', keydown)
    doc.removeEventListener('focusin', contain)
    if (trigger?.isConnected) trigger.focus()
  }
}
