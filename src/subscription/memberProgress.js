import { isMemberBodyweightMovement } from './memberExerciseLogging.js'

const KNOWN_SYNC_STATES = new Set(['pending', 'syncing', 'synced', 'failed', 'local-only'])
const MEMBER_HISTORY_PRESENTATION_LIMIT = 64

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function timestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value) {
  const parsed = timestamp(value)
  return parsed === null ? null : new Date(parsed).toISOString()
}

function roundLoad(value) {
  return Math.round(value * 100) / 100
}

function formatKg(value) {
  return String(roundLoad(value)).replace('.', ',')
}

function assignmentIdentity(assignment) {
  const assignmentId = text(assignment?.id || assignment?.assignmentId)
  const programId = text(assignment?.program_id || assignment?.programId)
  return assignmentId && programId ? { assignmentId, programId } : null
}

function programRotation(program) {
  if (!program || !Array.isArray(program.sessions) || !program.sessions.length) {
    return { ok: false, reason: 'program-sessions-required' }
  }
  const sessions = program.sessions.map((session, index) => ({
    id: text(session?.id),
    label: text(session?.label || session?.name) || `Pas ${index + 1}`,
    movements: Array.isArray(session?.movements) ? session.movements : [],
  }))
  if (sessions.some(session => !session.id)) return { ok: false, reason: 'program-session-id-required' }
  if (new Set(sessions.map(session => session.id)).size !== sessions.length) {
    return { ok: false, reason: 'program-session-ids-must-be-unique' }
  }
  return { ok: true, sessions }
}

function sessionSortTime(session) {
  return timestamp(session?.startedAt) ?? timestamp(session?.completedAt) ?? Number.MAX_SAFE_INTEGER
}

function stableSessionId(session) {
  return text(session?.clientId || session?.id)
}

function normalizedLoggedSet(value) {
  const weightKg = value?.weightKg
  const reps = value?.reps
  const rpe = value?.rpe
  if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500) return null
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return null
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) return null
  return {
    weightKg,
    reps,
    rpe,
    loggedAt: iso(value?.loggedAt),
  }
}

function rawSets(session) {
  const rows = []
  for (const entry of Array.isArray(session?.entries) ? session.entries : []) {
    const exerciseId = text(entry?.exerciseId)
    for (const set of Array.isArray(entry?.sets) ? entry.sets : []) rows.push({ exerciseId, set })
  }
  return rows
}

function movementIndex(program) {
  const index = new Map()
  const rotation = programRotation(program)
  if (!rotation.ok) return index
  for (const session of rotation.sessions) {
    for (const movement of session.movements) {
      const exerciseId = text(movement?.exerciseId)
      if (exerciseId && !index.has(exerciseId)) {
        index.set(exerciseId, {
          ...movement,
          exerciseId,
          exerciseName: text(movement?.exerciseName || movement?.name) || exerciseId,
        })
      }
    }
  }
  return index
}

function loadPresentation(movement, weightKg) {
  const bodyweight = isMemberBodyweightMovement(movement)
  if (bodyweight && weightKg === 0) {
    return { loadKind: 'bodyweight', displayLoad: 'Kropsvægt' }
  }
  if (bodyweight) {
    return { loadKind: 'bodyweight-plus-external', displayLoad: `Kropsvægt + ${formatKg(weightKg)} kg` }
  }
  return { loadKind: 'external-load', displayLoad: `${formatKg(weightKg)} kg` }
}

// The assignment owns the database programme id. The resolved client programme
// may have a deterministic template id, so filtering never compares those two.
export function activeCompletedSessions({ sessions = [], assignment, program } = {}) {
  const identity = assignmentIdentity(assignment)
  if (!identity || !programRotation(program).ok || !Array.isArray(sessions)) return []
  return sessions
    .filter(session => session?.assignmentId === identity.assignmentId
      && session?.programId === identity.programId
      && timestamp(session?.completedAt) !== null)
    .slice()
    .sort((left, right) => sessionSortTime(left) - sessionSortTime(right)
      || timestamp(left.completedAt) - timestamp(right.completedAt)
      || stableSessionId(left).localeCompare(stableSessionId(right)))
}

function failedRotation(reason, details = {}) {
  return {
    ok: false,
    reason,
    completedWeeks: null,
    currentWeekNumber: null,
    completedInCurrentWeek: null,
    nextSessionIndex: null,
    nextSessionId: null,
    ...details,
  }
}

// Rotation is inferred only when every completed workout follows the immutable
// programme order. Unknown, duplicate or out-of-order data never becomes a
// guessed week number.
export function strictMemberRotationPosition(input = {}) {
  const identity = assignmentIdentity(input.assignment)
  if (!identity) return failedRotation('active-assignment-required')
  const rotation = programRotation(input.program)
  if (!rotation.ok) return failedRotation(rotation.reason)
  const sessions = activeCompletedSessions(input)
  const knownDayIds = new Set(rotation.sessions.map(session => session.id))
  const seenSessionIds = new Set()

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]
    const sessionId = stableSessionId(session)
    const actualSessionId = text(session?.dayId)
    if (!sessionId) return failedRotation('completed-session-id-required', { sessionIndex: index })
    if (seenSessionIds.has(sessionId)) {
      return failedRotation('duplicate-completed-session', { sessionIndex: index, sessionId })
    }
    seenSessionIds.add(sessionId)
    if (!knownDayIds.has(actualSessionId)) {
      return failedRotation('unknown-program-day', { sessionIndex: index, actualSessionId })
    }
    const expectedSessionId = rotation.sessions[index % rotation.sessions.length].id
    if (actualSessionId !== expectedSessionId) {
      return failedRotation('out-of-order-program-day', {
        sessionIndex: index,
        expectedSessionId,
        actualSessionId,
      })
    }
  }

  const completedWeeks = Math.floor(sessions.length / rotation.sessions.length)
  const completedInCurrentWeek = sessions.length % rotation.sessions.length
  const nextSessionIndex = completedInCurrentWeek
  return {
    ok: true,
    reason: null,
    completedWeeks,
    currentWeekNumber: completedWeeks + 1,
    completedInCurrentWeek,
    nextSessionIndex,
    nextSessionId: rotation.sessions[nextSessionIndex].id,
    completedSessionCount: sessions.length,
    sessionsPerWeek: rotation.sessions.length,
  }
}

export function compactMemberSessionSummaries(input = {}) {
  const rotation = programRotation(input.program)
  if (!rotation.ok) return []
  const sessionById = new Map(rotation.sessions.map(session => [session.id, session]))
  return activeCompletedSessions(input).slice(-MEMBER_HISTORY_PRESENTATION_LIMIT).reverse().map(session => {
    const sets = rawSets(session)
    const validSetCount = sets.filter(({ exerciseId, set }) => exerciseId && normalizedLoggedSet(set)).length
    const completedAt = iso(session.completedAt)
    const knownSession = sessionById.get(text(session.dayId))
    const syncStatus = KNOWN_SYNC_STATES.has(session.syncStatus) ? session.syncStatus : 'unknown'
    return {
      clientId: stableSessionId(session),
      dayId: text(session.dayId),
      date: completedAt,
      sessionLabel: knownSession?.label || 'Ukendt pas',
      setCount: validSetCount,
      skippedSetCount: Number.isInteger(session.skippedSetCount) && session.skippedSetCount > 0 ? session.skippedSetCount : 0,
      invalidSetCount: sets.length - validSetCount,
      syncStatus,
    }
  })
}

function exerciseSetsInSession(session, exerciseId) {
  return rawSets(session)
    .filter(row => row.exerciseId === exerciseId)
    .map(row => normalizedLoggedSet(row.set))
    .filter(Boolean)
}

function exposureFact(session, movement, sessionLabels) {
  const sets = exerciseSetsInSession(session, movement.exerciseId)
  if (!sets.length) return null
  const lastSet = sets.at(-1)
  return {
    clientId: stableSessionId(session),
    dayId: text(session.dayId),
    date: iso(session.completedAt),
    sessionLabel: sessionLabels.get(text(session.dayId)) || 'Ukendt pas',
    setCount: sets.length,
    lastSet: {
      weightKg: lastSet.weightKg,
      reps: lastSet.reps,
      rpe: lastSet.rpe,
      ...loadPresentation(movement, lastSet.weightKg),
    },
  }
}

function conservativeComparison(previous, latest) {
  if (!latest) return { basis: 'no-recorded-exposure', comparable: false, loadDeltaKg: null }
  if (!previous) return { basis: 'first-recorded-exposure', comparable: false, loadDeltaKg: null }
  if (previous.lastSet.reps !== latest.lastSet.reps) {
    return { basis: 'different-reps', comparable: false, loadDeltaKg: null }
  }
  if (previous.lastSet.rpe !== latest.lastSet.rpe) {
    return { basis: 'different-rpe', comparable: false, loadDeltaKg: null }
  }
  return {
    basis: 'same-reps-and-rpe',
    comparable: true,
    loadDeltaKg: roundLoad(latest.lastSet.weightKg - previous.lastSet.weightKg),
  }
}

// These are two raw, recent exposure facts. A load difference is emitted only
// when reps and reported RPE match, and is never labelled as a record or proof
// of training progress.
export function mainMovementTrendFacts(input = {}) {
  const rotation = programRotation(input.program)
  if (!rotation.ok) return []
  const sessions = activeCompletedSessions(input)
  const labels = new Map(rotation.sessions.map(session => [session.id, session.label]))
  const movements = [...movementIndex(input.program).values()].filter(movement => movement.roleClass === 'main')
  return movements.map(movement => {
    const exposures = sessions.map(session => exposureFact(session, movement, labels)).filter(Boolean)
    const latest = exposures.at(-1) || null
    const previous = exposures.at(-2) || null
    return {
      exerciseId: movement.exerciseId,
      exerciseName: movement.exerciseName,
      latest,
      previous,
      comparison: conservativeComparison(previous, latest),
    }
  })
}

// The map contains only complete, programme-known logged sets. Its values are
// suitable for explicit "senest logget" recovery, not automatic progression.
export function latestLoggedLoadMap(input = {}) {
  const rotation = programRotation(input.program)
  if (!rotation.ok) return new Map()
  const movements = movementIndex(input.program)
  const labels = new Map(rotation.sessions.map(session => [session.id, session.label]))
  const latest = new Map()
  for (const session of activeCompletedSessions(input)) {
    for (const [exerciseId, movement] of movements) {
      const sets = exerciseSetsInSession(session, exerciseId)
      if (!sets.length) continue
      const lastSet = sets.at(-1)
      latest.set(exerciseId, {
        exerciseId,
        exerciseName: movement.exerciseName,
        weightKg: lastSet.weightKg,
        reps: lastSet.reps,
        rpe: lastSet.rpe,
        date: iso(session.completedAt),
        clientId: stableSessionId(session),
        dayId: text(session.dayId),
        sessionLabel: labels.get(text(session.dayId)) || 'Ukendt pas',
        ...loadPresentation(movement, lastSet.weightKg),
      })
    }
  }
  return latest
}

export function buildMemberProgress(input = {}) {
  return {
    completedSessions: activeCompletedSessions(input),
    rotation: strictMemberRotationPosition(input),
    sessionSummaries: compactMemberSessionSummaries(input),
    mainMovementTrends: mainMovementTrendFacts(input),
    latestLoads: latestLoggedLoadMap(input),
  }
}
