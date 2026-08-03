import { isTransientAccessClockError, isTransientNetworkError, loadMyAccess, retryTransientOperation } from './access.js'
import { validateBaselineLoads } from './baselineLoads.js'
import { validateCustomerSetLog } from './customerSetLogging.js'
import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION, validateTemplateInput } from './templateMatcher.js'
import {
  loadPilotOutbox,
  loadPilotSessions,
  savePilotSessions,
  updatePilotSyncState,
} from './pilotCache.js'

export const PILOT_REMOTE_HISTORY_LIMIT = 2080
const PILOT_REMOTE_HISTORY_PAGE_SIZE = 100

function normalizeProgramSession(session) {
  const sourceMovements = Array.isArray(session?.movements)
    ? session.movements
    : Array.isArray(session?.exercises) ? session.exercises : null
  if (!session?.id || !sourceMovements?.length) return null
  const movements = sourceMovements.map(movement => {
    const exerciseId = movement?.exerciseId || movement?.id
    const exerciseName = movement?.exerciseName || movement?.name
    const role = movement?.role
    const prescription = movement?.prescription || {
      sets: movement?.sets,
      reps: movement?.reps,
      restSeconds: movement?.restSeconds ?? movement?.rest,
      targetRpe: movement?.targetRpe,
      targetReps: movement?.targetReps,
      weekOnePercentOfEstimated1RM: movement?.weekOnePercentOfEstimated1RM,
      progressionPercent: movement?.progressionPercent,
      loadIncrementKg: movement?.loadIncrementKg,
      maximumRealizedProgressionPercent: movement?.maximumRealizedProgressionPercent,
    }
    if (!exerciseId || !exerciseName || !role
        || !Number.isInteger(Number(prescription.sets)) || Number(prescription.sets) < 1
        || !String(prescription.reps || '').trim() || !String(prescription.targetRpe || '').trim()) return null
    return {
      role,
      roleClass: movement.roleClass || (['squat-pattern', 'bench-pattern', 'hinge-pattern'].includes(role) ? 'main' : 'assistance'),
      exerciseId,
      exerciseName,
      selection: movement.selection || null,
      stylePreference: movement.stylePreference || null,
      equipment: movement.equipment || null,
      substitutionMode: movement.substitutionMode || 'manual-only',
      prescription,
    }
  })
  if (movements.some(movement => movement === null)) return null
  return {
    id: session.id,
    label: session.label || session.name || session.id,
    movements,
  }
}

export function mapProgramRow(row) {
  if (!row || !row.id || !Array.isArray(row.content?.sessions)) {
    throw new Error('Programversionen mangler pasdata.')
  }
  const sessions = row.content.sessions.map(normalizeProgramSession)
  if (row.content.sessions.length > 0 && sessions.some(session => session === null)) {
    throw new Error('Programversionen indeholder et ugyldigt pas.')
  }
  return {
    id: row.id,
    slug: row.slug,
    version: row.version,
    name: row.name,
    tagline: row.tagline,
    summary: row.summary,
    progression: row.progression_rule,
    days: row.days,
    minEquipment: row.min_equipment,
    levels: row.levels || [],
    minTier: row.min_tier,
    rationale: row.summary || row.tagline || '',
    contentContract: {
      setupSchemaVersion: row.content.setupSchemaVersion ?? null,
      engineVersion: row.content.engineVersion ?? null,
      templateSchemaVersion: row.content.templateSchemaVersion ?? null,
    },
    sessions,
  }
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function requireNumber(value, label, { min, max, integer = false }) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} er ugyldig.`)
  }
  return number
}

// This is the only client write contract for completed workouts. The server
// derives user_id and program_id from auth.uid() + the immutable assignment,
// then persists workout and sets atomically in one transaction.
export function workoutRpcArgs(assignment, session) {
  if (!assignment?.id || !assignment?.program_id) throw new Error('Programtildelingen mangler.')
  if (session?.assignmentId && session.assignmentId !== assignment.id) {
    throw new Error('Passet tilhører ikke den aktive programtildeling.')
  }
  if (session?.programId !== assignment.program_id) {
    throw new Error('Passet matcher ikke den tildelte programversion.')
  }
  if (!String(session?.dayId || '').trim() || !String(session?.clientId || '').trim()) {
    throw new Error('Passet mangler dag eller client-id.')
  }
  if (!validIso(session.startedAt) || !validIso(session.completedAt)
      || Date.parse(session.completedAt) < Date.parse(session.startedAt)) {
    throw new Error('Passets tidsstempler er ugyldige.')
  }

  const sets = []
  for (const entry of session.entries || []) {
    if (!String(entry?.exerciseId || '').trim() || !Array.isArray(entry.sets)) {
      throw new Error('Øvelsesloggen er ugyldig.')
    }
    entry.sets.forEach((set, index) => {
      if (set.loggedAt != null && !validIso(set.loggedAt)) throw new Error('Sættets tidsstempel er ugyldigt.')
      sets.push({
        exercise_id: entry.exerciseId,
        set_index: index + 1,
        reps: requireNumber(set.reps, 'Reps', { min: 1, max: 100, integer: true }),
        weight_kg: requireNumber(set.weightKg, 'Vægt', { min: 0, max: 500 }),
        rpe: requireNumber(set.rpe, 'RPE', { min: 5, max: 10 }),
        logged_at: set.loggedAt || session.completedAt,
      })
    })
  }
  if (!sets.length) throw new Error('Et afsluttet pas skal indeholde mindst ét sæt.')

  return {
    p_assignment_id: assignment.id,
    p_day_id: session.dayId,
    p_client_id: session.clientId,
    p_started_at: session.startedAt,
    p_completed_at: session.completedAt,
    p_sets: sets,
  }
}

export function mapRemoteHistory(workouts = [], sets = []) {
  const byWorkout = new Map()
  for (const row of sets) {
    if (!byWorkout.has(row.workout_id)) byWorkout.set(row.workout_id, [])
    byWorkout.get(row.workout_id).push(row)
  }
  return workouts.map(workout => {
    const entries = new Map()
    const ordered = (byWorkout.get(workout.id) || [])
      .sort((a, b) => a.set_index - b.set_index)
    for (const set of ordered) {
      if (!entries.has(set.exercise_id)) entries.set(set.exercise_id, [])
      entries.get(set.exercise_id).push({
        reps: set.reps,
        weightKg: Number(set.weight_kg),
        rpe: Number(set.rpe),
        loggedAt: set.logged_at,
      })
    }
    return {
      id: workout.id,
      clientId: workout.client_id,
      assignmentId: workout.assignment_id,
      programId: workout.program_id,
      dayId: workout.day_id,
      startedAt: workout.started_at,
      completedAt: workout.completed_at,
      entries: [...entries].map(([exerciseId, values]) => ({ exerciseId, sets: values })),
      syncStatus: 'synced',
      syncError: null,
    }
  })
}

export function mergeSessions(remote = [], local = []) {
  const merged = new Map(remote.map(item => [item.clientId || item.id, item]))
  for (const item of local) {
    const id = item.clientId || item.id
    const remoteItem = merged.get(id)
    if (!remoteItem || item.syncStatus !== 'synced') {
      merged.set(id, item)
    } else if (Number.isInteger(item.skippedSetCount) && item.skippedSetCount > 0) {
      merged.set(id, { ...remoteItem, skippedSetCount: item.skippedSetCount })
    }
  }
  return [...merged.values()].sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
}

async function loadActiveAssignment(client, userId) {
  const { data, error } = await client
    .from('sub_assignments')
    .select('id,user_id,program_id,match_input,assigned_at,ended_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()
  if (error) throw new Error(`Programtildelingen kunne ikke læses: ${error.message}`)
  return data || null
}

async function loadFreeProgram(client) {
  const { data, error } = await client
    .from('sub_programs')
    .select('id,slug,version,name,tagline,summary,progression_rule,days,min_equipment,levels,min_tier,content')
    .eq('slug', 'start-2')
    .eq('version', 1)
    .maybeSingle()
  if (error) throw new Error(`Startprogrammet kunne ikke l\u00e6ses: ${error.message}`)
  return data ? mapProgramRow(data) : null
}

async function loadProgram(client, programId) {
  const { data, error } = await client
    .from('sub_programs')
    .select('id,slug,version,name,tagline,summary,progression_rule,days,min_equipment,levels,min_tier,content')
    .eq('id', programId)
    .single()
  if (error) throw new Error(`Programmet kunne ikke læses: ${error.message}`)
  return mapProgramRow(data)
}

async function loadMember(client, userId) {
  const { data, error } = await client
    .from('sub_members')
    .select('display_name,goal,level,days_per_week,equipment,squat_style,deadlift_style,baselines,setup_schema_version,baseline_policy_version,onboarded_at,program_setup_completed_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Pilotprofilen kunne ikke læses: ${error.message}`)
  return data || null
}

export async function loadRemoteHistory(client, userId, { assignmentId = null, programId = null } = {}) {
  const workouts = []
  while (workouts.length <= PILOT_REMOTE_HISTORY_LIMIT) {
    const remaining = PILOT_REMOTE_HISTORY_LIMIT + 1 - workouts.length
    const pageSize = Math.min(PILOT_REMOTE_HISTORY_PAGE_SIZE, remaining)
    let query = client
      .from('sub_workouts')
      .select('id,user_id,assignment_id,program_id,day_id,client_id,started_at,completed_at')
      .eq('user_id', userId)
    if (assignmentId) query = query.eq('assignment_id', assignmentId)
    if (programId) query = query.eq('program_id', programId)
    const { data, error } = await query
      .order('started_at', { ascending: true })
      .order('id', { ascending: true })
      .range(workouts.length, workouts.length + pageSize - 1)
    if (error) throw new Error(`Historikken kunne ikke læses: ${error.message}`)
    const page = Array.isArray(data) ? data : []
    workouts.push(...page)
    if (page.length < pageSize) break
  }
  if (workouts.length > PILOT_REMOTE_HISTORY_LIMIT) {
    throw new Error('Historikken er længere end den understøttede medlemsrejse.')
  }
  if (!workouts.length) return []

  const chronologicalWorkouts = [...workouts].sort((a, b) => {
    const byStartedAt = String(a.started_at).localeCompare(String(b.started_at))
    return byStartedAt || String(a.id).localeCompare(String(b.id))
  })
  const sets = []
  for (let offset = 0; offset < chronologicalWorkouts.length; offset += PILOT_REMOTE_HISTORY_PAGE_SIZE) {
    const ids = chronologicalWorkouts.slice(offset, offset + PILOT_REMOTE_HISTORY_PAGE_SIZE).map(row => row.id)
    const { data, error: setsError } = await client
      .from('sub_workout_sets')
      .select('workout_id,user_id,exercise_id,set_index,reps,weight_kg,rpe,logged_at')
      .eq('user_id', userId)
      .in('workout_id', ids)
    if (setsError) throw new Error(`Sættene kunne ikke læses: ${setsError.message}`)
    sets.push(...(data || []))
  }
  return mapRemoteHistory(chronologicalWorkouts, sets)
}

export async function loadPilotState(client, user) {
  const access = await loadMyAccess(client)
  if (access.tier !== 'member') {
    const program = await loadFreeProgram(client)
    return { access, accessGranted: false, assignment: null, program, member: null, sessions: [] }
  }

  // Member-preferences are useful even when a controlled assignment has not
  // been created yet. Loading both in parallel prevents an invited member from
  // falling into a terminal "unassigned" state with their setup data hidden.
  const [assignment, member] = await Promise.all([
    loadActiveAssignment(client, user.id),
    loadMember(client, user.id),
  ])
  if (!assignment) return { access, accessGranted: true, assignment: null, program: null, member, sessions: [] }

  const [program, remoteSessions] = await Promise.all([
    loadProgram(client, assignment.program_id),
    loadRemoteHistory(client, user.id, { assignmentId: assignment.id, programId: assignment.program_id }),
  ])
  const sessions = mergeSessions(remoteSessions, loadPilotSessions(user.id))
  savePilotSessions(user.id, sessions)
  return { access, accessGranted: true, assignment, program, member, sessions }
}

export function memberSetupRpcArgs({ requestId, matchInput, baselineLoads }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(requestId || ''))) {
    throw new Error('Ops\u00e6tningen mangler et gyldigt request-id.')
  }
  if (!matchInput || typeof matchInput !== 'object' || Array.isArray(matchInput)) {
    throw new Error('Programvalgene mangler.')
  }
  if (!baselineLoads || typeof baselineLoads !== 'object' || Array.isArray(baselineLoads)) {
    throw new Error('Startgrundlaget mangler.')
  }
  const checkedMatch = validateTemplateInput(matchInput)
  if (matchInput.schemaVersion !== PROGRAM_MATCH_INPUT_SCHEMA_VERSION || !checkedMatch.valid) {
    throw new Error('Programvalgene er ufuldstændige eller forældede.')
  }
  if (!validateBaselineLoads(baselineLoads).ok) {
    throw new Error('Startgrundlaget er ufuldstændigt.')
  }
  const canonicalMatchInput = {
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    ...checkedMatch.input,
  }
  const canonicalBaselines = Object.fromEntries(['squat', 'bench', 'deadlift'].map(liftId => {
    const value = baselineLoads[liftId]
    return [liftId, {
      weightKg: value?.weightKg,
      reps: value?.reps,
      rpe: value?.rpe,
    }]
  }))
  return {
    p_request_id: requestId,
    p_match_input: canonicalMatchInput,
    p_baselines: canonicalBaselines,
  }
}

// The browser can request one exact initial programme for auth.uid(). It never
// sends a target user, programme id, tier or assignment source; those remain
// server-owned in the shadow RPC.
export async function completeMyProgramSetup(client, input, retryOptions) {
  const args = memberSetupRpcArgs(input)
  return retryTransientOperation(async () => {
    const { data, error } = await client.rpc(
      'sub_complete_my_program_setup_v1',
      args,
    )
    if (error) throw new Error(`Programmet kunne ikke oprettes: ${error.message}`)
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.assignment_id || !row?.program_id) {
      throw new Error('Programops\u00e6tningen returnerede ikke en aktiv tildeling.')
    }
    return row
  }, {
    ...retryOptions,
    shouldRetry: error => isTransientAccessClockError(error) || isTransientNetworkError(error),
  })
}

// The member journey keeps the complete planned-vs-actual record, including
// deliberately skipped sets. The current immutable workout RPC represents
// completed sets only, so skipped rows stay in the user-scoped journey record
// and are never converted to fictitious zero-load database rows.
export function memberJourneySessionToPilotSession(assignment, entry) {
  if (!assignment?.id || !assignment?.program_id) throw new Error('Programtildelingen mangler.')
  if (!entry || entry.assignmentId !== assignment.id) {
    throw new Error('Passet tilhører ikke den aktive programtildeling.')
  }
  if (!String(entry.sessionId || '').trim() || !String(entry.clientId || '').trim()) {
    throw new Error('Passet mangler dag eller client-id.')
  }
  if (!validIso(entry.startedAt) || !validIso(entry.completedAt)
      || Date.parse(entry.completedAt) < Date.parse(entry.startedAt)) {
    throw new Error('Passets tidsstempler er ugyldige.')
  }
  if (!Array.isArray(entry.setLogs) || !entry.setLogs.length) {
    throw new Error('Passet mangler sætdata.')
  }

  const byExercise = new Map()
  for (const raw of entry.setLogs) {
    const checked = validateCustomerSetLog(raw)
    if (!checked.ok) throw new Error('Passet indeholder et ugyldigt sæt.')
    const log = checked.value
    if (log.sessionId !== entry.sessionId || log.weekNumber !== entry.weekNumber) {
      throw new Error('Sættet matcher ikke det afsluttede pas.')
    }
    if (log.actual.skipped) continue
    if (!byExercise.has(log.exerciseId)) byExercise.set(log.exerciseId, [])
    byExercise.get(log.exerciseId).push({
      reps: log.actual.repsCompleted,
      weightKg: log.actual.weightKg,
      rpe: log.actual.rpeActual,
      loggedAt: entry.completedAt,
    })
  }

  return {
    assignmentId: assignment.id,
    clientId: entry.clientId,
    programId: assignment.program_id,
    dayId: entry.sessionId,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    entries: [...byExercise].map(([exerciseId, sets]) => ({ exerciseId, sets })),
    skippedSetCount: entry.setLogs.filter(setLog => setLog.actual.skipped).length,
    localOnly: !byExercise.size,
  }
}

export async function syncOneSession(client, userId, assignment, session) {
  if (!session.clientId || !session.completedAt) throw new Error('Passet mangler client-id eller sluttid.')
  updatePilotSyncState(userId, session.clientId, 'syncing')
  try {
    const { error } = await client.rpc(
      'sub_persist_completed_workout_v1',
      workoutRpcArgs(assignment, session),
    )
    if (error) throw error
    updatePilotSyncState(userId, session.clientId, 'synced')
    return { ok: true, clientId: session.clientId }
  } catch (error) {
    const message = error?.message || 'Ukendt synkfejl'
    updatePilotSyncState(userId, session.clientId, 'failed', message)
    return { ok: false, clientId: session.clientId, error: message }
  }
}

export async function syncPilotOutbox(client, userId, assignment) {
  const results = []
  for (const session of loadPilotOutbox(userId)) {
    results.push(await syncOneSession(client, userId, assignment, session))
  }
  return results
}
