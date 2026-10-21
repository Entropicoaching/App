// Pure visningsmodel. Ingen skrivning til pas, logs eller logInputs.
export function pasOverblik(session, logs, activeId, selectedId = null) {
  const rows = (session?.exercises || []).map((exercise, index) => {
    const sets = Array.from({ length: exercise.sets || 0 }, (_, i) => {
      const number = i + 1
      const log = (logs || []).find(l => l.exercise_id === exercise.id && l.set_number === number)
      return { number, status: !log ? 'Planlagt' : log.skipped ? 'Sprunget over' : 'Færdigt' }
    })
    return { exercise, index, sets, done: sets.filter(set => set.status !== 'Planlagt').length, total: sets.length, current: exercise.id === activeId }
  })
  const currentIndex = rows.findIndex(row => row.current)
  const next = currentIndex >= 0 ? rows[currentIndex + 1] : null
  const selected = rows.find(row => row.exercise.id === selectedId) || rows[currentIndex] || rows[0] || null
  const summary = currentIndex >= 0
    ? `Øvelse ${currentIndex + 1} af ${rows.length} · ${next ? `næste: ${next.exercise.name}` : 'sidste øvelse'}`
    : `${rows.length} øvelser`
  return { rows, selected, summary, nextId: next?.exercise.id ?? null }
}
