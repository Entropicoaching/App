// Lille pure visningsmodel. Samme logmatch og skipped-semantik som APP1.
export function pasOverblik(session, logs, activeId) {
  const rows = (session?.exercises || []).map((exercise, index) => {
    const sets = Array.from({ length: exercise.sets || 0 }, (_, i) => {
      const number = i + 1
      const log = (logs || []).find(l => l.exercise_id === exercise.id && l.set_number === number)
      return { number, status: !log ? 'Planlagt' : log.skipped ? 'Sprunget over' : 'Færdigt' }
    })
    return { exercise, index, sets, done: sets.filter(set => set.status !== 'Planlagt').length,
      total: sets.length, current: exercise.id === activeId }
  })
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const done = rows.reduce((sum, row) => sum + row.done, 0)
  return { rows, total, done, percent: total ? Math.round(done / total * 100) : 0 }
}
