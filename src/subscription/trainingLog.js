// Rene funktioner til træningsloggen: oprettelse, logning af sæt, rotation
// mellem programmets pas og opsummering til historik.
//
// Alt her er uden sideeffekter og uden browser-API'er, så det kan køres i
// node:test uden DOM. localStorage håndteres i storage.js.

export function bestSet(sets) {
  if (!sets || !sets.length) return null
  return sets.reduce((a, b) => {
    if (b.weightKg !== a.weightKg) return b.weightKg > a.weightKg ? b : a
    if (b.reps !== a.reps) return b.reps > a.reps ? b : a
    return a
  })
}

export function createClientId(now = Date.now()) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `sub_${now}_${Math.random().toString(36).slice(2, 12)}`
}

export function startSession(program, sessionId, now = Date.now(), clientId = createClientId(now)) {
  return {
    id: `s_${now}`,
    clientId,
    programId: program.id,
    dayId: sessionId,
    startedAt: new Date(now).toISOString(),
    completedAt: null,
    entries: [],
  }
}

// Hvilket pas står for tur: programmets pas køres i fast rotation ud fra hvor
// mange pas der allerede er gennemført i netop dette program. Ingen kalender —
// misser man en uge, står man samme sted, og det er med vilje.
export function nextDayId(program, sessions) {
  const done = (sessions || []).filter(s => s.programId === program.id && s.completedAt).length
  return program.sessions[done % program.sessions.length].id
}

export function logSet(session, exerciseId, set) {
  const entries = session.entries.some(e => e.exerciseId === exerciseId)
    ? session.entries.map(e =>
        e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e
      )
    : [...session.entries, { exerciseId, sets: [set] }]
  return { ...session, entries }
}

export function removeLastSet(session, exerciseId) {
  const entries = session.entries
    .map(e => (e.exerciseId === exerciseId ? { ...e, sets: e.sets.slice(0, -1) } : e))
    .filter(e => e.sets.length > 0)
  return { ...session, entries }
}

export function setsFor(session, exerciseId) {
  if (!session) return []
  const entry = session.entries.find(e => e.exerciseId === exerciseId)
  return entry ? entry.sets : []
}

export function sessionTotals(session) {
  let sets = 0
  let volume = 0
  for (const entry of session?.entries || []) {
    for (const set of entry.sets) {
      sets += 1
      volume += (Number(set.weightKg) || 0) * (Number(set.reps) || 0)
    }
  }
  return { sets, volume: Math.round(volume) }
}

export function completeSession(session, now = Date.now()) {
  return { ...session, completedAt: new Date(now).toISOString() }
}

// Seneste loggede sæt for en øvelse — bruges til at forudfylde felterne, så
// et sæt kan gemmes med få tryk. Det er en gentagelse af hvad brugeren selv
// skrev sidst, ikke et forslag fra appen.
export function lastSetFor(sessions, exerciseId) {
  const ordered = [...(sessions || [])].sort((a, b) =>
    String(b.startedAt).localeCompare(String(a.startedAt))
  )
  for (const session of ordered) {
    const sets = setsFor(session, exerciseId)
    if (sets.length) return sets[sets.length - 1]
  }
  return null
}

// Historik for én øvelse — kun denne brugers egne pas, aldrig sammenligning
// på tværs af brugere.
export function exerciseHistory(sessions, exerciseId, limit = 8) {
  return (sessions || [])
    .filter(s => s.completedAt && setsFor(s, exerciseId).length)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
    .slice(0, limit)
    .map(s => {
      const sets = setsFor(s, exerciseId)
      return {
        sessionId: s.id,
        date: s.completedAt,
        sets,
        best: bestSet(sets),
        volume: sets.reduce((sum, set) => sum + (set.weightKg || 0) * (set.reps || 0), 0),
      }
    })
}

export function completedSessions(sessions, limit = 20) {
  return (sessions || [])
    .filter(s => s.completedAt)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
    .slice(0, limit)
}

// Hvilke øvelser brugeren rent faktisk har logget, nyeste først.
export function loggedExerciseIds(sessions) {
  const seen = []
  for (const session of completedSessions(sessions, 1000)) {
    for (const entry of session.entries) {
      if (!seen.includes(entry.exerciseId)) seen.push(entry.exerciseId)
    }
  }
  return seen
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}
