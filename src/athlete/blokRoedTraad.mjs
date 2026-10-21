// APP-PROG1: pure read model. No dates, logs, storage or inferred prescriptions.
const text = value => typeof value === 'string' && value.trim() ? value : null
const nameKey = value => text(value)?.trim().toLocaleLowerCase('da-DK') ?? null
const exercises = week => (week?.sessions || []).flatMap(session =>
  (session.exercises || []).map(ex => ({ session: text(session.title), ex })))
const present = value => (typeof value === 'string' && value.trim()) ||
  (typeof value === 'number' && Number.isFinite(value))

export function prescription(ex) {
  return [
    present(ex.sets) ? `${ex.sets} sæt` : 'Sæt ikke angivet',
    present(ex.reps) ? `${ex.reps} reps` : 'Reps ikke angivet',
    present(ex.recommended_weight) ? `${ex.recommended_weight} kg` : 'Vægt ikke angivet',
    text(ex.intensity) ?? 'Intensitet ikke angivet',
  ].join(' · ')
}

export function blokRoedTraad(allWeeks = [], viewedWeekId) {
  // Require a unique identity, so an outdated selection never picks another week.
  if (viewedWeekId == null) return null
  const matches = allWeeks.map((w, i) => w.id === viewedWeekId ? i : -1).filter(i => i >= 0)
  if (matches.length !== 1) return null
  const index = matches[0]
  const selected = allWeeks[index]
  const blockName = text(selected.block_name)
  // Same contiguous-name grouping as the pinned athlete computePhases.
  // A missing name is not evidence that neighbouring weeks form a block.
  let first = index, last = index
  if (blockName) {
    while (first > 0 && allWeeks[first - 1].block_name === selected.block_name) first--
    while (last + 1 < allWeeks.length && allWeeks[last + 1].block_name === selected.block_name) last++
  }
  const weeks = allWeeks.slice(first, last + 1)
  const ordered = weeks.every((w, i) => Number.isInteger(w.week_number) &&
    (i === 0 || w.week_number > weeks[i - 1].week_number))
  const identified = weeks.every(w => w.id != null && allWeeks.filter(v => v.id === w.id).length === 1)
  const reliable = !!blockName && ordered && identified
  const blockWeeks = reliable ? weeks : [selected]
  const descriptions = [...new Set(weeks.map(w => text(w.block_description)).filter(Boolean))]
  const seen = new Set()
  const lifts = []
  for (const { ex } of exercises(selected)) {
    const key = nameKey(ex.name)
    // Unnamed exercises cannot safely be matched across weeks.
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    lifts.push({
      name: text(ex.name) ?? 'Øvelse uden navn',
      weeks: blockWeeks.map(w => ({
        id: w.id, number: w.week_number ?? null, selected: w.id === viewedWeekId,
        entries: exercises(w).filter(row => key ? nameKey(row.ex.name) === key : row.ex === ex)
          .map(row => ({ session: row.session, prescription: prescription(row.ex) })),
      })),
    })
  }
  return {
    weekNumber: selected.week_number ?? null, blockName,
    position: reliable ? index - first + 1 : null,
    count: reliable ? weeks.length : null,
    description: text(selected.block_description),
    descriptionConflict: reliable && descriptions.length > 1,
    coachNote: text(selected.coach_note),
    status: reliable ? 'known' : blockName ? 'ambiguous' : 'unnamed',
    lifts,
  }
}
