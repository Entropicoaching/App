export function mergeAthleteSetInputs(previous = {}, loggedRows = []) {
  const logged = {}
  for (const row of loggedRows) {
    if (!row?.exercise_id || !Number.isInteger(Number(row.set_number))) continue
    logged[`${row.exercise_id}_${row.set_number}`] = {
      weight: row.weight?.toString() || '',
      note: row.note || '',
      rpe: row.rpe_actual?.toString() || '',
    }
  }
  // Bevar det, atleten allerede har tastet, men lad bekræftede logs vinde.
  // Anbefalet vægt er bevidst ikke en del af input-state: første sæt starter tomt.
  return { ...previous, ...logged }
}

export function nextAthleteSetInput(current = {}, next = {}) {
  return {
    ...next,
    weight: next.weight || current.weight || '',
    note: next.note || '',
    rpe: next.rpe || '',
  }
}
