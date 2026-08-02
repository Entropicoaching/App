import { buildMemberProgress } from './memberProgress.js'
import {
  createAssignedSnapshot,
  createAssignmentBinding,
  createMemberSessionDraft,
  createOngoingCycle,
  memberSessionEntryFromDraft,
  memberSessionEntryMatches,
  validateMemberJourneySnapshot,
} from './memberJourneyStorage.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function sameBinding(left, right) {
  return Boolean(left) && Boolean(right)
    && left.mode === right.mode
    && left.assignmentId === right.assignmentId
    && left.programId === right.programId
    && left.matchFingerprint === right.matchFingerprint
    && left.programFingerprint === right.programFingerprint
}

function blocked(reason) {
  return { status: 'blocked', reason }
}

function validPilotSet(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Number.isFinite(value.weightKg) && value.weightKg >= 0 && value.weightKg <= 500
    && Number.isInteger(value.reps) && value.reps >= 1 && value.reps <= 100
    && Number.isFinite(value.rpe) && value.rpe >= 5 && value.rpe <= 10
    && (value.loggedAt == null || validIso(value.loggedAt))
}

function exactRemoteEntries(session, prescribedSession) {
  if (!Array.isArray(session?.entries)) return null
  if (!Array.isArray(prescribedSession?.movements) || !prescribedSession.movements.length) return null

  const prescribedIds = prescribedSession.movements.map(movement => text(movement?.exerciseId))
  if (prescribedIds.some(id => !id) || new Set(prescribedIds).size !== prescribedIds.length) return null

  const remoteByExercise = new Map()
  for (const entry of session.entries) {
    const exerciseId = text(entry?.exerciseId)
    if (!exerciseId || remoteByExercise.has(exerciseId) || !Array.isArray(entry.sets)) return null
    remoteByExercise.set(exerciseId, entry.sets)
  }
  if ([...remoteByExercise.keys()].some(exerciseId => !prescribedIds.includes(exerciseId))) return null

  for (const movement of prescribedSession.movements) {
    const expectedSets = movement?.prescription?.sets
    const sets = remoteByExercise.get(movement.exerciseId) || []
    if (!Number.isInteger(expectedSets) || expectedSets < 1 || sets.length > expectedSets) return null
    if (!sets.every(validPilotSet)) return null
  }
  const remoteSetCount = [...remoteByExercise.values()].reduce((sum, sets) => sum + sets.length, 0)
  const expectedSetCount = prescribedSession.movements.reduce((sum, movement) => sum + movement.prescription.sets, 0)
  if (remoteSetCount === 0
      && !(session.localOnly === true && session.syncStatus === 'local-only'
        && session.skippedSetCount === expectedSetCount)) return null
  return remoteByExercise
}

function reconstructEntry({ assignmentId, remote, prescribedSession, weekNumber }) {
  if (!UUID_PATTERN.test(text(remote?.clientId))) return null
  if (remote?.dayId !== prescribedSession?.id || !validIso(remote?.startedAt) || !validIso(remote?.completedAt)) return null
  if (Date.parse(remote.completedAt) < Date.parse(remote.startedAt)) return null

  const remoteByExercise = exactRemoteEntries(remote, prescribedSession)
  if (!remoteByExercise) return null

  const draft = createMemberSessionDraft({
    assignmentId,
    session: prescribedSession,
    weekNumber,
    clientId: remote.clientId,
    now: Date.parse(remote.startedAt),
  })
  if (!draft) return null

  const rows = draft.rows.map(row => {
    const remoteSet = remoteByExercise.get(row.exerciseId)?.[row.setNumber - 1]
    if (!remoteSet) {
      return {
        ...row,
        actual: {
          weightKg: null,
          repsCompleted: null,
          rpeActual: null,
          note: 'Gendannet som sprunget over; serverhistorikken har ikke sætdetaljen.',
          skipped: true,
        },
      }
    }
    return {
      ...row,
      actual: {
        weightKg: remoteSet.weightKg,
        repsCompleted: remoteSet.reps,
        rpeActual: remoteSet.rpe,
        note: '',
        skipped: false,
      },
    }
  })
  const confirmed = Object.fromEntries(rows.map((_, index) => [index, true]))
  const entry = memberSessionEntryFromDraft(
    { ...draft, rows, confirmed, activeIndex: null },
    prescribedSession,
    Date.parse(remote.completedAt),
  )
  if (!entry || !memberSessionEntryMatches(entry, { assignmentId, session: prescribedSession, weekNumber })) return null
  return entry
}

function activeAssignmentSessions(sessions, assignmentId) {
  return sessions.filter(session => session?.assignmentId === assignmentId)
}

// Remote workout rows do not carry a week number, plan, skips or reviews. We
// therefore infer only the immutable session rotation and rebuild the planned
// rows from the resolved programme. Any ambiguity blocks recovery; it never
// becomes a silent week-one reset or invented athlete data.
export function recoverMemberJourneyFromHistory({
  userId,
  assignmentId,
  programId,
  matchInput,
  baselineLoads,
  binding,
  program,
  sessions = [],
} = {}) {
  if (!Array.isArray(sessions)) return blocked('pilot-sessions-must-be-an-array')
  if (sessions.length === 0) return { status: 'none' }

  const expectedBinding = createAssignmentBinding({ assignmentId, programId, matchInput, program })
  if (!text(userId) || !text(assignmentId) || !text(programId) || !expectedBinding || !sameBinding(binding, expectedBinding)) {
    return blocked('assigned-context-invalid')
  }

  const assignmentSessions = activeAssignmentSessions(sessions, assignmentId)
  if (assignmentSessions.length === 0) return { status: 'none' }
  if (assignmentSessions.some(session => session?.programId !== programId)) {
    return blocked('active-assignment-program-mismatch')
  }

  const base = createAssignedSnapshot({ userId, binding, matchInput, baselineLoads })
  if (!base) return blocked('assigned-context-invalid')

  const assignment = { id: assignmentId, program_id: programId }
  const progress = buildMemberProgress({ sessions, assignment, program })
  if (progress.completedSessions.length !== assignmentSessions.length) {
    return blocked('active-history-is-incomplete-or-invalid')
  }
  if (!progress.rotation.ok) return blocked(`unsafe-session-rotation:${progress.rotation.reason}`)
  if (progress.completedSessions.length === 0) return { status: 'none' }
  if (progress.rotation.sessionsPerWeek < 1 || progress.rotation.sessionsPerWeek > 4) {
    return blocked('unsupported-week-session-count')
  }

  const reconstructed = []
  for (let index = 0; index < progress.completedSessions.length; index += 1) {
    const remote = progress.completedSessions[index]
    const prescribedSession = program.sessions[index % program.sessions.length]
    const weekNumber = Math.floor(index / program.sessions.length) + 1
    const entry = reconstructEntry({ assignmentId, remote, prescribedSession, weekNumber })
    if (!entry) return blocked(`unsafe-session-shape:${index + 1}`)
    reconstructed.push(entry)
  }

  const weekOne = reconstructed.filter(entry => entry.weekNumber === 1)
  if (progress.rotation.currentWeekNumber === 1) {
    const snapshot = { ...base, stage: 'week-one', completedWeekOne: weekOne }
    return validateMemberJourneySnapshot(snapshot).ok
      ? { status: 'recovered', snapshot }
      : blocked('recovered-snapshot-invalid')
  }

  const currentWeek = progress.rotation.currentWeekNumber
  const previousCompleted = reconstructed.filter(entry => entry.weekNumber === currentWeek - 1)
  const completed = reconstructed.filter(entry => entry.weekNumber === currentWeek)
  if (previousCompleted.length !== progress.rotation.sessionsPerWeek
      || completed.length !== progress.rotation.completedInCurrentWeek) {
    return blocked('history-week-boundary-is-ambiguous')
  }

  const ongoing = createOngoingCycle({
    stage: 'ongoing-ready',
    weekNumber: currentWeek,
    previousCompleted,
    completed,
    currentChoice: 'kept',
    currentProposalId: null,
    review: null,
    reviews: [],
    recoveredFromHistory: true,
  })
  if (!ongoing) return blocked('ongoing-recovery-invalid')

  const snapshot = {
    ...base,
    stage: 'ongoing-ready',
    completedWeekOne: weekOne,
    completedWeekTwo: reconstructed.filter(entry => entry.weekNumber === 2),
    sessionDraft: null,
    weeklyReview: null,
    weekTwoChoice: null,
    ongoing,
  }
  return validateMemberJourneySnapshot(snapshot).ok
    ? { status: 'recovered', snapshot }
    : blocked('recovered-snapshot-invalid')
}
