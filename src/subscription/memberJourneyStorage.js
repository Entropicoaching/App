import { BASELINE_LIFTS, emptyBaselineLoads, validateBaselineLoads } from './baselineLoads.js'
import { validateCustomerSetLog } from './customerSetLogging.js'
import { isMemberBodyweightMovement, timedMovementInSession } from './memberExerciseLogging.js'
import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION, validateTemplateInput } from './templateMatcher.js'

export const MEMBER_JOURNEY_SCHEMA_VERSION = 1
export const ONGOING_CYCLE_SCHEMA_VERSION = 1
export const MEMBER_JOURNEY_MAX_WEEK = 520

const PREFIX = 'entropi:sub:member-journey:v1:'
const SETUP_STAGES = new Set(['match', 'baseline', 'submit', 'submitted'])
const ASSIGNED_STAGES = new Set([
  'week-one',
  'week-review',
  'week-two-proposal',
  'week-two-ready',
  'week-two-session',
  'week-two-complete',
  'ongoing-ready',
  'ongoing-session',
  'ongoing-review',
  'ongoing-proposal',
])
const ONGOING_STAGES = new Set(['ongoing-ready', 'ongoing-session', 'ongoing-review', 'ongoing-proposal'])
const REVIEW_RATINGS = new Set(['appropriate', 'too-hard', 'surplus'])
const WEEK_TWO_CHOICES = new Set(['accepted', 'kept'])
const MAX_WEEK_SESSIONS = 4
const MAX_REVIEW_HISTORY = 104
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hash(value) {
  let result = 2166136261
  for (const character of stableValue(value)) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function validText(value, max = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validRequestId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function validWeekNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= MEMBER_JOURNEY_MAX_WEEK
}

function validOngoingWeekNumber(value) {
  return validWeekNumber(value) && value >= 2
}

function normalizeMatchInput(input) {
  const checked = validateTemplateInput(input)
  if (!checked.valid) return null
  return {
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    ...checked.input,
    updatedAt: input?.updatedAt && validIso(input.updatedAt) ? input.updatedAt : null,
  }
}

function validMatchDraft(value) {
  if (!plainObject(value) || value.schemaVersion !== PROGRAM_MATCH_INPUT_SCHEMA_VERSION) return false
  if (!['', 'general-strength', 'powerlifting-foundation'].includes(value.goal)) return false
  if (!['', 'begynder', 'oevet'].includes(value.level)) return false
  if (![null, 2, 3, 4].includes(value.daysPerWeek)) return false
  if (!['', 'gym', 'home'].includes(value.equipment)) return false
  if (!['', 'high-bar', 'low-bar', 'not-sure'].includes(value.squatStyle)) return false
  if (!['', 'conventional', 'sumo', 'not-sure'].includes(value.deadliftStyle)) return false
  return value.updatedAt == null || validIso(value.updatedAt)
}

function validBaselineDraft(value) {
  if (!plainObject(value)) return false
  return BASELINE_LIFTS.every(lift => {
    const row = value[lift.id]
    return plainObject(row)
      && (row.weightKg === null || (Number.isFinite(row.weightKg) && row.weightKg >= 0 && row.weightKg <= 10000))
      && Number.isFinite(row.reps) && row.reps >= 0 && row.reps <= 1000
      && Number.isFinite(row.rpe) && row.rpe >= 0 && row.rpe <= 100
  })
}

function validBinding(binding, mode) {
  if (!plainObject(binding) || binding.mode !== mode) return false
  if (mode === 'setup') {
    return binding.assignmentId === null
      && (binding.seedMatchFingerprint === null || /^match-[a-f0-9]{8}$/.test(binding.seedMatchFingerprint))
  }
  return validText(binding.assignmentId)
    && validText(binding.programId)
    && /^match-[a-f0-9]{8}$/.test(binding.matchFingerprint)
    && /^program-[a-f0-9]{8}$/.test(binding.programFingerprint)
}

function validConfirmed(value, length) {
  if (!plainObject(value)) return false
  return Object.entries(value).every(([key, confirmed]) => {
    const index = Number(key)
    return Number.isInteger(index) && index >= 0 && index < length && typeof confirmed === 'boolean'
  })
}

function validSessionDraft(value) {
  if (!plainObject(value) || !validText(value.assignmentId) || !validRequestId(value.clientId)) return false
  if (!validWeekNumber(value.weekNumber) || !validText(value.sessionId) || !validIso(value.startedAt)) return false
  if (!Array.isArray(value.rows) || !value.rows.length) return false
  if (!validConfirmed(value.confirmed, value.rows.length)) return false
  const validRows = value.rows.every((row, index) => {
    if (validateCustomerSetLog(row).ok) return true
    if (value.confirmed[index]) return false
    return row?.actual?.skipped === false
      && row?.actual?.weightKg === null
      && validateCustomerSetLog({
        ...row,
        actual: { ...row.actual, weightKg: Number.isFinite(row?.planned?.weightKg) ? row.planned.weightKg : 0 },
      }).ok
  })
  if (!validRows
      || !value.rows.every(row => row.weekNumber === value.weekNumber && row.sessionId === value.sessionId)
      || !uniqueValues(value.rows.map(row => `${row.exerciseId}:${row.setNumber}`))) return false
  return value.activeIndex === null
    || (Number.isInteger(value.activeIndex) && value.activeIndex >= 0 && value.activeIndex < value.rows.length)
}

function validSummaryLog(value) {
  return plainObject(value)
    && validText(value.exerciseId)
    && Number.isFinite(value.loadKg) && value.loadKg >= 0
    && Number.isInteger(value.reps) && value.reps > 0
    && Number.isFinite(value.rpe) && value.rpe >= 1 && value.rpe <= 10
}

function validSessionEntry(value, expectedWeek = null) {
  if (!plainObject(value) || !validText(value.assignmentId) || !validRequestId(value.clientId)) return false
  if (!validWeekNumber(value.weekNumber) || (expectedWeek !== null && value.weekNumber !== expectedWeek)) return false
  if (!validText(value.sessionId) || !validIso(value.startedAt) || !validIso(value.completedAt)) return false
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) return false
  return Array.isArray(value.logs) && value.logs.every(validSummaryLog)
    && uniqueValues(value.logs.map(log => log.exerciseId))
    && Array.isArray(value.setLogs) && value.setLogs.length > 0
    && value.setLogs.every(log => validateCustomerSetLog(log).ok
      && log.weekNumber === value.weekNumber && log.sessionId === value.sessionId)
    && uniqueValues(value.setLogs.map(log => `${log.exerciseId}:${log.setNumber}`))
}

function validWeeklyReviewDraft(value) {
  return plainObject(value)
    && ['', ...REVIEW_RATINGS].includes(value.rating)
    && typeof value.note === 'string'
    && value.note.trim().length <= 500
    && (value.completedAt === null || validIso(value.completedAt))
}

function completeWeeklyReview(value) {
  return validWeeklyReviewDraft(value) && REVIEW_RATINGS.has(value.rating) && validIso(value.completedAt)
}

function validReviewHistoryEntry(value) {
  return plainObject(value)
    && validWeekNumber(value.weekNumber)
    && REVIEW_RATINGS.has(value.rating)
    && typeof value.note === 'string'
    && value.note.trim().length <= 500
    && validIso(value.completedAt)
}

function uniqueValues(values) {
  return new Set(values).size === values.length
}

function validOngoingSessions(values, expectedWeek, expectedAssignmentId, { required = false } = {}) {
  if (!Array.isArray(values) || values.length > MAX_WEEK_SESSIONS || (required && values.length === 0)) return false
  if (!values.every(item => validSessionEntry(item, expectedWeek)
      && (!expectedAssignmentId || item.assignmentId === expectedAssignmentId))) return false
  return uniqueValues(values.map(item => item.clientId)) && uniqueValues(values.map(item => item.sessionId))
}

function validReviewHistory(values, currentWeek) {
  if (!Array.isArray(values) || values.length > MAX_REVIEW_HISTORY || !values.every(validReviewHistoryEntry)) return false
  if (!uniqueValues(values.map(item => item.weekNumber))) return false
  if (!values.every(item => item.weekNumber < currentWeek)) return false
  return values.every((item, index) => index === 0 || values[index - 1].weekNumber < item.weekNumber)
}

function validOngoingChoice(choice, proposalId) {
  if (!WEEK_TWO_CHOICES.has(choice)) return false
  return choice === 'accepted'
    ? validText(proposalId, 240)
    : proposalId === null
}

function validOngoingCycle(value, stage, expectedAssignmentId = null) {
  if (!plainObject(value) || value.schemaVersion !== ONGOING_CYCLE_SCHEMA_VERSION
      || !validOngoingWeekNumber(value.weekNumber)) return false
  if (!validOngoingChoice(value.currentChoice, value.currentProposalId)) return false
  if (typeof value.recoveredFromHistory !== 'boolean') return false
  if (!validOngoingSessions(value.previousCompleted, value.weekNumber - 1, expectedAssignmentId, { required: true })) return false
  if (!validOngoingSessions(value.completed, value.weekNumber, expectedAssignmentId)) return false
  if (!uniqueValues([...value.previousCompleted, ...value.completed].map(item => item.clientId))) return false
  if (value.review !== null && !validWeeklyReviewDraft(value.review)) return false
  if (!validReviewHistory(value.reviews, value.weekNumber)) return false
  if (stage === 'ongoing-session') return value.review === null
  if (stage === 'ongoing-ready') return value.review === null
  if (stage === 'ongoing-review') return value.completed.length > 0
    && (value.review === null || validWeeklyReviewDraft(value.review))
  if (stage === 'ongoing-proposal') return value.completed.length > 0
    && completeWeeklyReview(value.review)
  return false
}

function validateSetupSnapshot(value) {
  if (!SETUP_STAGES.has(value.stage) || !validBinding(value.binding, 'setup')) return false
  if (!validRequestId(value.requestId) || !validMatchDraft(value.matchInput) || !validBaselineDraft(value.baselineLoads)) return false
  const normalizedMatch = normalizeMatchInput(value.matchInput)
  if (['baseline', 'submit', 'submitted'].includes(value.stage) && !normalizedMatch) return false
  if (['submit', 'submitted'].includes(value.stage) && !validateBaselineLoads(value.baselineLoads).ok) return false
  return true
}

function validateAssignedSnapshot(value) {
  if (!ASSIGNED_STAGES.has(value.stage) || !validBinding(value.binding, 'assigned')) return false
  const normalizedMatch = normalizeMatchInput(value.matchInput)
  const baseline = validateBaselineLoads(value.baselineLoads)
  if (!normalizedMatch || !baseline.ok) return false
  if (memberMatchFingerprint(normalizedMatch) !== value.binding.matchFingerprint) return false
  if (!Array.isArray(value.completedWeekOne) || !value.completedWeekOne.every(item => validSessionEntry(item, 1))) return false
  if (!Array.isArray(value.completedWeekTwo) || !value.completedWeekTwo.every(item => validSessionEntry(item, 2))) return false
  if (value.sessionDraft !== null && !validSessionDraft(value.sessionDraft)) return false
  if (value.weeklyReview !== null && !validWeeklyReviewDraft(value.weeklyReview)) return false
  if (value.weekTwoChoice !== null && !WEEK_TWO_CHOICES.has(value.weekTwoChoice)) return false
  if (ONGOING_STAGES.has(value.stage)) {
    if (!validOngoingCycle(value.ongoing, value.stage, value.binding.assignmentId)) return false
    if (value.stage === 'ongoing-session'
        && (value.sessionDraft?.weekNumber !== value.ongoing.weekNumber
          || value.sessionDraft.assignmentId !== value.binding.assignmentId
          || value.ongoing.completed.some(item => item.sessionId === value.sessionDraft.sessionId
            || item.clientId === value.sessionDraft.clientId)
          || value.ongoing.previousCompleted.some(item => item.clientId === value.sessionDraft.clientId))) return false
    if (value.stage !== 'ongoing-session' && value.sessionDraft !== null) return false
    return true
  }
  if (value.ongoing !== null && value.ongoing !== undefined) return false
  if (['week-review', 'week-two-proposal', 'week-two-ready', 'week-two-session', 'week-two-complete'].includes(value.stage)
      && value.completedWeekOne.length === 0) return false
  if (['week-two-proposal', 'week-two-ready', 'week-two-session', 'week-two-complete'].includes(value.stage)
      && !completeWeeklyReview(value.weeklyReview)) return false
  if (['week-two-ready', 'week-two-session', 'week-two-complete'].includes(value.stage)
      && value.weekTwoChoice === null) return false
  if (value.stage === 'week-two-session' && value.sessionDraft?.weekNumber !== 2) return false
  if (value.stage === 'week-two-complete' && value.completedWeekTwo.length === 0) return false
  return true
}

export function memberJourneyFingerprint(value) {
  return hash(value)
}

export function memberMatchFingerprint(input) {
  const normalized = normalizeMatchInput(input)
  if (!normalized) return null
  const identity = {
    schemaVersion: normalized.schemaVersion,
    goal: normalized.goal,
    level: normalized.level,
    daysPerWeek: normalized.daysPerWeek,
    equipment: normalized.equipment,
    squatStyle: normalized.squatStyle,
    deadliftStyle: normalized.deadliftStyle,
  }
  return `match-${hash(identity)}`
}

export function memberProgramFingerprint(program) {
  if (!plainObject(program) || !Array.isArray(program.sessions) || !program.sessions.length) return null
  const canonical = program.sessions.every(session => validText(session?.id)
    && Array.isArray(session.movements) && session.movements.length
    && session.movements.every(movement => validText(movement?.exerciseId) && plainObject(movement.prescription)))
  return canonical ? `program-${hash(program)}` : null
}

export function createSetupBinding(initialMatchInput = null) {
  return {
    mode: 'setup',
    assignmentId: null,
    seedMatchFingerprint: memberMatchFingerprint(initialMatchInput),
  }
}

export function createAssignmentBinding({ assignmentId, programId, matchInput, program }) {
  const matchFingerprint = memberMatchFingerprint(matchInput)
  const programFingerprint = memberProgramFingerprint(program)
  if (!validText(assignmentId) || !validText(programId) || !matchFingerprint || !programFingerprint) return null
  return { mode: 'assigned', assignmentId: String(assignmentId), programId: String(programId), matchFingerprint, programFingerprint }
}

export function newMemberRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const random = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`
}

export function emptyMemberMatchInput(initialMatchInput = null) {
  const normalized = normalizeMatchInput(initialMatchInput)
  return normalized || {
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    goal: '',
    level: '',
    daysPerWeek: null,
    equipment: '',
    squatStyle: '',
    deadliftStyle: '',
    updatedAt: null,
  }
}

export function createSetupSnapshot(userId, initialMatchInput = null, requestId = newMemberRequestId()) {
  return {
    schemaVersion: MEMBER_JOURNEY_SCHEMA_VERSION,
    userId: String(userId || ''),
    mode: 'setup',
    binding: createSetupBinding(initialMatchInput),
    stage: 'match',
    requestId,
    matchInput: emptyMemberMatchInput(initialMatchInput),
    baselineLoads: emptyBaselineLoads(),
  }
}

export function createAssignedSnapshot({ userId, binding, matchInput, baselineLoads }) {
  const normalizedMatch = normalizeMatchInput(matchInput)
  const baseline = validateBaselineLoads(baselineLoads)
  if (!normalizedMatch || !baseline.ok || !validBinding(binding, 'assigned')) return null
  return {
    schemaVersion: MEMBER_JOURNEY_SCHEMA_VERSION,
    userId: String(userId || ''),
    mode: 'assigned',
    binding,
    stage: 'week-one',
    matchInput: normalizedMatch,
    baselineLoads: baseline.values,
    completedWeekOne: [],
    completedWeekTwo: [],
    weeklyReview: null,
    weekTwoChoice: null,
    sessionDraft: null,
    ongoing: null,
  }
}

export function createOngoingCycle({
  stage = 'ongoing-ready',
  weekNumber,
  previousCompleted,
  completed = [],
  currentChoice,
  currentProposalId = null,
  review = null,
  reviews = [],
  recoveredFromHistory = false,
} = {}) {
  if (!ONGOING_STAGES.has(stage)) return null
  const value = {
    schemaVersion: ONGOING_CYCLE_SCHEMA_VERSION,
    weekNumber,
    previousCompleted: Array.isArray(previousCompleted) ? [...previousCompleted] : previousCompleted,
    completed: Array.isArray(completed) ? [...completed] : completed,
    currentChoice,
    currentProposalId,
    review: review && plainObject(review) ? { ...review } : review,
    reviews: Array.isArray(reviews) ? reviews.map(item => plainObject(item) ? { ...item } : item) : reviews,
    recoveredFromHistory,
  }
  const expectedAssignmentId = value.previousCompleted?.[0]?.assignmentId || null
  return validOngoingCycle(value, stage, expectedAssignmentId) ? value : null
}

export function advanceOngoingCycle(value, { choice, proposalId = null } = {}) {
  const expectedAssignmentId = value?.previousCompleted?.[0]?.assignmentId || null
  if (!validOngoingCycle(value, 'ongoing-proposal', expectedAssignmentId)) return null
  if (value.weekNumber >= MEMBER_JOURNEY_MAX_WEEK || !validOngoingChoice(choice, proposalId)) return null
  const completedReview = {
    weekNumber: value.weekNumber,
    rating: value.review.rating,
    note: value.review.note,
    completedAt: value.review.completedAt,
  }
  if (value.reviews.some(item => item.weekNumber === completedReview.weekNumber)) return null
  const next = {
    schemaVersion: ONGOING_CYCLE_SCHEMA_VERSION,
    weekNumber: value.weekNumber + 1,
    previousCompleted: [...value.completed],
    completed: [],
    currentChoice: choice,
    currentProposalId: choice === 'accepted' ? proposalId : null,
    review: null,
    reviews: [...value.reviews, completedReview].slice(-MAX_REVIEW_HISTORY),
    recoveredFromHistory: value.recoveredFromHistory,
  }
  return validOngoingCycle(next, 'ongoing-ready', expectedAssignmentId) ? next : null
}

export function validateMemberJourneySnapshot(value) {
  if (!plainObject(value) || value.schemaVersion !== MEMBER_JOURNEY_SCHEMA_VERSION || !validText(value.userId)) {
    return { ok: false }
  }
  const valid = value.mode === 'setup'
    ? validateSetupSnapshot(value)
    : value.mode === 'assigned' && validateAssignedSnapshot(value)
  return valid ? { ok: true, value } : { ok: false }
}

function storageKey(userId) {
  return `${PREFIX}${hash(String(userId || ''))}`
}

function sameBinding(left, right) {
  return plainObject(left) && plainObject(right) && stableValue(left) === stableValue(right)
}

export function loadMemberJourneySnapshot({ userId, expectedBinding, storage = browserStorage() }) {
  if (!storage || !validText(userId) || !plainObject(expectedBinding)) return null
  const key = storageKey(userId)
  try {
    const raw = storage.getItem(key)
    const checked = validateMemberJourneySnapshot(raw ? JSON.parse(raw) : null)
    if (checked.ok && checked.value.userId === userId && sameBinding(checked.value.binding, expectedBinding)) return checked.value
    if (raw) storage.removeItem(key)
  } catch {
    try { storage.removeItem(key) } catch { /* best effort */ }
  }
  return null
}

export function saveMemberJourneySnapshot(snapshot, storage = browserStorage()) {
  const checked = validateMemberJourneySnapshot(snapshot)
  if (!storage || !checked.ok) return false
  try {
    storage.setItem(storageKey(snapshot.userId), JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

export function clearMemberJourneySnapshot(userId, storage = browserStorage()) {
  if (!storage || !validText(userId)) return
  try { storage.removeItem(storageKey(userId)) } catch { /* best effort */ }
}

function plannedReps(prescription = {}) {
  if (Number.isInteger(prescription.targetReps) && prescription.targetReps > 0) return prescription.targetReps
  const range = String(prescription.reps || '').match(/\d+/g)?.map(Number) || []
  return range.length > 1 ? Math.round((range[0] + range[range.length - 1]) / 2) : range[0] || 1
}

function plannedRpe(prescription = {}) {
  const range = String(prescription.targetRpe || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  return range.length ? Math.max(...range) : 7
}

export function createMemberSetRows(session, weekNumber = 1) {
  if (!validWeekNumber(weekNumber) || !plainObject(session) || !validText(session.id) || !Array.isArray(session.movements)) return []
  // Set-log v1 has no duration field. Reject the whole session instead of
  // silently turning seconds into reps or dropping the timed movement.
  if (timedMovementInSession(session)) return []
  const rows = []
  for (const movement of session.movements) {
    const sets = Number(movement?.prescription?.sets)
    if (!validText(movement?.exerciseId) || !Number.isInteger(sets) || sets < 1) return []
    const hasWeekLoad = Number.isFinite(movement.weekStartingLoadKg)
    const hasWeekTwoLoad = Number.isFinite(movement.weekTwoStartingLoadKg)
    const hasStartingLoad = Number.isFinite(movement.startingLoadKg)
    const weightKg = hasWeekLoad
      ? movement.weekStartingLoadKg
      : hasWeekTwoLoad ? movement.weekTwoStartingLoadKg : hasStartingLoad ? movement.startingLoadKg : null
    const loadSource = hasWeekLoad
      ? movement.weekLoadSource || 'accepted-week-proposal'
      : hasWeekTwoLoad
      ? movement.weekTwoLoadSource || 'accepted-week-two-proposal'
      : hasStartingLoad ? movement.startingLoadRule || 'programme-start' : 'athlete-entry-required'
    const reps = plannedReps(movement.prescription)
    const rpe = plannedRpe(movement.prescription)
    const initialActualWeightKg = weightKg === null && isMemberBodyweightMovement(movement) ? 0 : weightKg
    rows.push(...Array.from({ length: sets }, (_, index) => ({
      weekNumber,
      sessionId: session.id,
      exerciseId: movement.exerciseId,
      exerciseName: movement.exerciseName,
      roleClass: movement.roleClass,
      setNumber: index + 1,
      planned: { weightKg, reps, rpe, loadSource },
      actual: { weightKg: initialActualWeightKg, weightTouched: false, repsCompleted: reps, rpeActual: rpe, note: '', skipped: false },
    })))
  }
  return rows
}

export function createMemberSessionDraft({ assignmentId, session, weekNumber = 1, clientId = newMemberRequestId(), now = Date.now() }) {
  const rows = createMemberSetRows(session, weekNumber)
  if (!validText(assignmentId) || !rows.length || !validRequestId(clientId)) return null
  return {
    assignmentId: String(assignmentId),
    clientId,
    weekNumber,
    sessionId: session.id,
    startedAt: new Date(now).toISOString(),
    rows,
    confirmed: {},
    activeIndex: 0,
  }
}

// Carry only a confirmed assistance load into the immediately following set of
// the same exercise. A numeric value already present on that set—including
// explicit bodyweight 0—is athlete-owned and is never overwritten.
export function prefillNextAssistanceSetLoad(draft, confirmedIndex) {
  if (!plainObject(draft) || !Array.isArray(draft.rows) || draft.confirmed?.[confirmedIndex] !== true) return draft
  const source = draft.rows[confirmedIndex]
  if (source?.roleClass !== 'assistance' || source?.actual?.skipped !== false
      || !Number.isFinite(source.actual.weightKg) || source.actual.weightKg < 0) return draft
  const nextIndex = draft.rows.findIndex((row, index) => index > confirmedIndex && row?.exerciseId === source.exerciseId)
  if (nextIndex < 0) return draft
  const target = draft.rows[nextIndex]
  const targetIsUntouched = target?.actual?.weightTouched !== true
    && (target?.actual?.weightKg === null || target.actual.weightKg === target?.planned?.weightKg)
  if (draft.confirmed?.[nextIndex] === true || target?.actual?.skipped !== false || !targetIsUntouched) return draft
  return {
    ...draft,
    rows: draft.rows.map((row, index) => index === nextIndex
      ? { ...row, actual: { ...row.actual, weightKg: source.actual.weightKg, weightTouched: false } }
      : row),
  }
}

function samePlannedSet(actual, expected) {
  return actual.weekNumber === expected.weekNumber
    && actual.sessionId === expected.sessionId
    && actual.exerciseId === expected.exerciseId
    && actual.setNumber === expected.setNumber
    && actual.planned.weightKg === expected.planned.weightKg
    && actual.planned.reps === expected.planned.reps
    && actual.planned.rpe === expected.planned.rpe
    && actual.planned.loadSource === expected.planned.loadSource
}

export function memberSessionDraftMatches(draft, { assignmentId, session, weekNumber }) {
  if (!validSessionDraft(draft) || draft.assignmentId !== assignmentId || draft.weekNumber !== weekNumber || draft.sessionId !== session?.id) return false
  const expected = createMemberSetRows(session, weekNumber)
  return expected.length === draft.rows.length && draft.rows.every((row, index) => samePlannedSet(row, expected[index]))
}

export function memberSessionEntryFromDraft(draft, session, now = Date.now()) {
  if (!memberSessionDraftMatches(draft, { assignmentId: draft?.assignmentId, session, weekNumber: draft?.weekNumber })) return null
  const setLogs = draft.rows.map(row => validateCustomerSetLog(row))
  if (setLogs.some(result => !result.ok) || draft.rows.some((_, index) => draft.confirmed[index] !== true)) return null
  const normalized = setLogs.map(result => result.value)
  const logs = session.movements
    .filter(movement => movement.roleClass === 'main')
    .map(movement => {
      const last = normalized.filter(row => row.exerciseId === movement.exerciseId && !row.actual.skipped).at(-1)
      return last ? {
        exerciseId: movement.exerciseId,
        loadKg: last.actual.weightKg,
        reps: last.actual.repsCompleted,
        rpe: last.actual.rpeActual,
      } : null
    })
    .filter(Boolean)
  return {
    assignmentId: draft.assignmentId,
    clientId: draft.clientId,
    weekNumber: draft.weekNumber,
    sessionId: draft.sessionId,
    startedAt: draft.startedAt,
    completedAt: new Date(now).toISOString(),
    logs,
    setLogs: normalized,
  }
}

export function memberSessionEntryMatches(entry, { assignmentId, session, weekNumber }) {
  if (!validSessionEntry(entry, weekNumber) || entry.assignmentId !== assignmentId || entry.sessionId !== session?.id) return false
  const expected = createMemberSetRows(session, weekNumber)
  return expected.length === entry.setLogs.length
    && entry.setLogs.every((row, index) => samePlannedSet(row, expected[index]))
}
