import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  EXPECTED_SHADOW_REF,
  activationRequestId,
  authReadiness,
  normalizeUserId,
  normalizeValidUntil,
} from './manage-subscription-shadow-tester.mjs'

export const PUBLIC_SUBSCRIPTION_URL = 'https://app.entropicoaching.dk/subscription.html'
export const SYNTHETIC_MARKER_KEY = 'entropi_subscription_synthetic_qa'
export const SYNTHETIC_MARKER_VERSION = 1

const MAX_SYNTHETIC_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const LEGACY_RUN_ID_PATTERN = /^\d{13}$/
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,47}$/
const SYNTHETIC_EMAIL_PATTERN = /^qa\.subscription\.([a-z0-9][a-z0-9-]{7,47})@entropicoaching\.dk$/
const PROTECTED_USER_IDS = new Set(['ec2f969e-ae5d-4dcb-ad16-ee82ddef1c77'])
const PROTECTED_EMAILS = new Set(['coach@entropicoaching.dk'])
const LEGACY_SYNTHETIC_CUTOFF_MS = Date.parse('2026-08-03T00:00:00.000Z')
const LEGACY_TIMESTAMP_TOLERANCE_MS = 15 * 60 * 1000
const NEW_USER_CLOCK_WINDOW_MS = 5 * 60 * 1000
const HANDOFF_TIMEOUT_MS = 120_000
const root = resolve(import.meta.dirname, '..')

const USER_SCOPED_TABLES = Object.freeze([
  'sub_entitlements',
  'sub_members',
  'sub_assignments',
  'sub_workouts',
  'sub_workout_sets',
  'sub_pilot_member_activations',
  'sub_week_two_proposals',
  'sub_week_two_decisions',
])

const ACTION_FLAGS = {
  prepare: new Set(['run-id', 'valid-until', 'env-file', 'execute', 'confirm-project']),
  handoff: new Set(['email', 'user-id', 'env-file', 'execute', 'confirm-project', 'allow-legacy-unmarked']),
  inspect: new Set(['email', 'user-id', 'env-file', 'execute', 'confirm-project', 'allow-legacy-unmarked']),
  verify: new Set([
    'email', 'user-id', 'goal', 'level', 'days', 'equipment', 'squat-style', 'deadlift-style',
    'expected-workouts', 'expected-sets',
    'env-file', 'execute', 'confirm-project', 'allow-legacy-unmarked',
  ]),
}

function fail(message) {
  throw new Error(message)
}

function exactEmail(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase()
}

export function normalizeRunId(value) {
  const runId = String(value || '').trim().toLowerCase()
  if (!RUN_ID_PATTERN.test(runId)) {
    fail('--run-id skal være 8-48 små bogstaver, tal eller bindestreger.')
  }
  return runId
}

export function syntheticEmailForRun(runId) {
  return `qa.subscription.${normalizeRunId(runId)}@entropicoaching.dk`
}

export function normalizeSyntheticEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  const match = email.match(SYNTHETIC_EMAIL_PATTERN)
  if (!match || PROTECTED_EMAILS.has(email)) {
    fail('--email skal være en dedikeret qa.subscription.<run-id>@entropicoaching.dk-adresse.')
  }
  return { email, runId: match[1] }
}

export function parseQaEnv(source) {
  const allowed = new Set([
    'VITE_SUB_SUPABASE_URL',
    'VITE_SUB_SUPABASE_PROJECT_REF',
    'VITE_SUB_SUPABASE_ANON_KEY',
    'SUPABASE_SECRET_KEY',
  ])
  const values = {}
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || !allowed.has(match[1])) continue
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

export function verifyQaContext({ env, binding }) {
  if (binding?.expectedProjectRef !== EXPECTED_SHADOW_REF) {
    fail('Den autoritative binding matcher ikke subscription-shadow.')
  }
  if (String(env.VITE_SUB_SUPABASE_PROJECT_REF || '').trim().toLowerCase() !== EXPECTED_SHADOW_REF) {
    fail('VITE_SUB_SUPABASE_PROJECT_REF peger ikke på subscription-shadow.')
  }
  let url
  try {
    url = new URL(env.VITE_SUB_SUPABASE_URL)
  } catch {
    fail('VITE_SUB_SUPABASE_URL mangler eller er ugyldig.')
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== `${EXPECTED_SHADOW_REF}.supabase.co`
    || url.port
    || url.username
    || url.password
  ) fail('Supabase-URL peger ikke præcist på subscription-shadow.')

  const secretKey = String(env.SUPABASE_SECRET_KEY || '').trim()
  const publishableKey = String(env.VITE_SUB_SUPABASE_ANON_KEY || '').trim()
  if (!secretKey || /replace|placeholder|example|^</i.test(secretKey)) fail('Shadow operator-key mangler.')
  if (!publishableKey || /replace|placeholder|example|^</i.test(publishableKey)) fail('Shadow publishable key mangler.')
  return { projectRef: EXPECTED_SHADOW_REF, url: url.toString(), secretKey, publishableKey }
}

export function parseQaArgs(argv) {
  const action = argv[0]
  if (!ACTION_FLAGS[action]) fail('Vælg handling: prepare, handoff, inspect eller verify.')
  const options = {}
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) fail(`Ukendt argument: ${token}`)
    const key = token.slice(2)
    if (!ACTION_FLAGS[action].has(key)) fail(`--${key} kan ikke bruges med ${action}.`)
    if (Object.hasOwn(options, key)) fail(`--${key} må kun angives én gang.`)
    if (['execute', 'allow-legacy-unmarked'].includes(key)) {
      options[key] = true
      continue
    }
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) fail(`--${key} mangler en værdi.`)
    options[key] = next
    index += 1
  }
  return { action, options }
}

function normalizeSyntheticExpiry(value, now) {
  const validUntil = normalizeValidUntil(value, now)
  if (Date.parse(validUntil) - now.getTime() > MAX_SYNTHETIC_DURATION_MS) {
    fail('Syntetisk QA-adgang må højst vare syv dage.')
  }
  return validUntil
}

function normalizeExpectedAxes(options) {
  const days = Number(options.days)
  const hasExpectedWorkouts = options['expected-workouts'] !== undefined
  const hasExpectedSets = options['expected-sets'] !== undefined
  if (hasExpectedWorkouts !== hasExpectedSets) {
    fail('--expected-workouts og --expected-sets skal angives sammen.')
  }
  const expected = {
    goal: String(options.goal || ''),
    level: String(options.level || ''),
    days,
    equipment: String(options.equipment || ''),
    squatStyle: String(options['squat-style'] || ''),
    deadliftStyle: String(options['deadlift-style'] || ''),
    workoutCount: hasExpectedWorkouts ? Number(options['expected-workouts']) : null,
    setCount: hasExpectedSets ? Number(options['expected-sets']) : null,
  }
  if (
    !['general-strength', 'powerlifting-foundation'].includes(expected.goal)
    || !['begynder', 'oevet'].includes(expected.level)
    || ![2, 3, 4].includes(expected.days)
    || !['gym', 'home'].includes(expected.equipment)
    || !['high-bar', 'low-bar'].includes(expected.squatStyle)
    || !['conventional', 'sumo'].includes(expected.deadliftStyle)
    || (hasExpectedWorkouts && (!Number.isInteger(expected.workoutCount) || expected.workoutCount < 0 || expected.workoutCount > 52))
    || (hasExpectedSets && (!Number.isInteger(expected.setCount) || expected.setCount < 0 || expected.setCount > 2000))
  ) fail('Verify kræver alle seks reviewede programakser og gyldige, hele QA-kardinaliteter.')
  return expected
}

export function buildQaPlan({ action, options, now = new Date() }) {
  const execute = options.execute === true
  if (execute && options['confirm-project'] !== EXPECTED_SHADOW_REF) {
    fail(`Netværk kræver --confirm-project ${EXPECTED_SHADOW_REF}.`)
  }
  if (!execute && options['confirm-project']) fail('--confirm-project bruges kun sammen med --execute.')

  const plan = {
    action,
    execute,
    envFile: options['env-file'] || '.env.local',
    projectRef: EXPECTED_SHADOW_REF,
  }
  if (action === 'prepare') {
    plan.runId = normalizeRunId(options['run-id'])
    plan.email = syntheticEmailForRun(plan.runId)
    plan.validUntil = normalizeSyntheticExpiry(options['valid-until'], now)
    plan.redirectTo = PUBLIC_SUBSCRIPTION_URL
    plan.createdAfter = new Date(now.getTime() - NEW_USER_CLOCK_WINDOW_MS).toISOString()
    plan.createdBefore = new Date(now.getTime() + NEW_USER_CLOCK_WINDOW_MS).toISOString()
  } else {
    const identity = normalizeSyntheticEmail(options.email)
    plan.email = identity.email
    plan.runId = identity.runId
    plan.userId = normalizeUserId(options['user-id'])
    plan.allowLegacyUnmarked = options['allow-legacy-unmarked'] === true
    if (PROTECTED_USER_IDS.has(plan.userId)) fail('Den beskyttede pilotkonto kan aldrig være syntetisk QA.')
    if (plan.allowLegacyUnmarked) {
      const legacyTimestamp = Number(plan.runId)
      if (
        !LEGACY_RUN_ID_PATTERN.test(plan.runId)
        || legacyTimestamp < LEGACY_SYNTHETIC_CUTOFF_MS
        || legacyTimestamp > now.getTime() + LEGACY_TIMESTAMP_TOLERANCE_MS
      ) fail('--allow-legacy-unmarked kræver den tidligere timestamp-baserede QA-mail.')
    }
  }
  if (action === 'verify') plan.expected = normalizeExpectedAxes(options)
  return plan
}

export function loadQaContext(envFile) {
  const envPath = resolve(root, envFile)
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (!envPath.startsWith(rootPrefix)) fail('--env-file skal ligge inde i app-worktreet.')
  try {
    const env = parseQaEnv(readFileSync(envPath, 'utf8'))
    const binding = JSON.parse(readFileSync(resolve(root, 'config', 'subscription-shadow-binding.json'), 'utf8'))
    return verifyQaContext({ env, binding })
  } catch (error) {
    if (error instanceof Error && !/ENOENT|JSON/.test(error.message)) throw error
    fail('Den lokale env-fil eller shadow-binding kunne ikke læses.')
  }
}

function makeClients(context) {
  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  return {
    operator: createClient(context.url, context.secretKey, { auth: authOptions }),
    verifier: createClient(context.url, context.publishableKey, { auth: authOptions }),
  }
}

export function syntheticIdentityFacts(user, plan) {
  if (!user?.id || user.id.toLowerCase() !== plan.userId || !exactEmail(user.email, plan.email)) {
    fail('Auth-identiteten matcher ikke det præcise syntetiske QA UUID og e-mail.')
  }
  if (PROTECTED_USER_IDS.has(user.id.toLowerCase()) || PROTECTED_EMAILS.has(String(user.email).toLowerCase())) {
    fail('En beskyttet pilotkonto kan aldrig behandles som syntetisk QA.')
  }

  const marker = user.user_metadata?.[SYNTHETIC_MARKER_KEY]
  if (marker !== undefined) {
    if (marker?.schemaVersion !== SYNTHETIC_MARKER_VERSION || marker?.runId !== plan.runId) {
      fail('Auth-brugerens syntetiske QA-markør matcher ikke run-id.')
    }
    return { marked: true, legacyUnmarked: false, runId: plan.runId }
  }
  if (!plan.allowLegacyUnmarked) {
    fail('Den ældre QA-bruger mangler markør; brug kun --allow-legacy-unmarked efter manuel identitetskontrol.')
  }
  if (!LEGACY_RUN_ID_PATTERN.test(plan.runId)) fail('Kun den tidligere timestamp-baserede QA-identitet kan være legacy.')
  const runTimestamp = Number(plan.runId)
  const createdAt = Date.parse(user.created_at)
  if (
    !Number.isFinite(createdAt)
    || runTimestamp < LEGACY_SYNTHETIC_CUTOFF_MS
    || Math.abs(createdAt - runTimestamp) > LEGACY_TIMESTAMP_TOLERANCE_MS
  ) fail('Legacy QA-mailens timestamp matcher ikke Auth-oprettelsen.')
  return { marked: false, legacyUnmarked: true, runId: plan.runId }
}

export function validateGeneratedAuthLink({ response, type, plan, expectedUserId }) {
  if (response?.error) fail(`${type}-linket fejlede: ${response.error.message}`)
  const properties = response?.data?.properties
  const user = response?.data?.user
  if (!user?.id || !exactEmail(user.email, plan.email) || (expectedUserId && user.id !== expectedUserId)) {
    fail(`${type}-linket returnerede en anden Auth-identitet.`)
  }
  if (properties?.verification_type !== type || properties?.redirect_to !== PUBLIC_SUBSCRIPTION_URL) {
    fail(`${type}-linkets type eller callback er forkert.`)
  }
  let actionLink
  try {
    actionLink = new URL(properties.action_link)
  } catch {
    fail(`${type}-linket er ugyldigt.`)
  }
  const keys = [...actionLink.searchParams.keys()].sort().join(',')
  if (
    actionLink.protocol !== 'https:'
    || actionLink.hostname !== `${EXPECTED_SHADOW_REF}.supabase.co`
    || actionLink.port
    || actionLink.username
    || actionLink.password
    || actionLink.pathname !== '/auth/v1/verify'
    || actionLink.hash
    || keys !== 'redirect_to,token,type'
    || actionLink.searchParams.get('type') !== type
    || actionLink.searchParams.get('redirect_to') !== PUBLIC_SUBSCRIPTION_URL
    || !properties.hashed_token
    || actionLink.searchParams.get('token') !== properties.hashed_token
  ) fail(`${type}-linket matcher ikke den præcise subscription-shadow-kontrakt.`)
  return { actionLink, tokenHash: properties.hashed_token, user }
}

export async function prepareSyntheticQa(plan, dependencies) {
  let createdUserId = null
  try {
    const inviteResponse = await dependencies.generateLink({
      type: 'invite',
      email: plan.email,
      options: {
        redirectTo: PUBLIC_SUBSCRIPTION_URL,
        data: {
          [SYNTHETIC_MARKER_KEY]: {
            schemaVersion: SYNTHETIC_MARKER_VERSION,
            runId: plan.runId,
          },
        },
      },
    })
    const invite = validateGeneratedAuthLink({ response: inviteResponse, type: 'invite', plan })
    createdUserId = invite.user.id.toLowerCase()
    const identityPlan = { ...plan, userId: createdUserId, allowLegacyUnmarked: false }
    syntheticIdentityFacts(invite.user, identityPlan)
    const createdAt = Date.parse(invite.user.created_at)
    if (
      !Number.isFinite(createdAt)
      || createdAt < Date.parse(plan.createdAfter)
      || createdAt > Date.parse(plan.createdBefore)
    ) fail('Run-id ser ud til at tilhøre en eksisterende Auth-bruger; invitationen bruges ikke.')

    const verified = await dependencies.verifyInvite(invite.tokenHash)
    if (verified.error || verified.data?.user?.id?.toLowerCase() !== createdUserId) {
      fail(`Invite-verifikation fejlede: ${verified.error?.message || 'forkert Auth-bruger'}`)
    }

    const authResult = await dependencies.getUserById(createdUserId)
    if (authResult.error || !authResult.data?.user) fail(`Auth-status fejlede: ${authResult.error?.message || 'mangler bruger'}`)
    syntheticIdentityFacts(authResult.data.user, identityPlan)
    const readiness = authReadiness(authResult.data.user, plan.email, createdUserId)
    if (!readiness.invited || !readiness.confirmed || !readiness.loggedInAfterInvite) {
      fail('Den syntetiske invitation blev ikke bekræftet som første login.')
    }

    const requestId = activationRequestId({ userId: createdUserId, validUntil: plan.validUntil })
    const activation = await dependencies.activate({
      p_request_id: requestId,
      p_target_user_id: createdUserId,
      p_invited_email: plan.email,
      p_valid_until: plan.validUntil,
    })
    const row = Array.isArray(activation.data) ? activation.data[0] : activation.data
    if (activation.error || row?.tier !== 'member' || row?.valid_until !== plan.validUntil) {
      fail(`Kontrolleret aktivering fejlede: ${activation.error?.message || 'forkert svar'}`)
    }
    return {
      state: 'SYNTHETIC_QA_PREPARED',
      projectRef: EXPECTED_SHADOW_REF,
      email: plan.email,
      userId: createdUserId,
      validUntil: plan.validUntil,
      tokenExposed: false,
    }
  } catch (error) {
    error.syntheticQaIdentity = { email: plan.email, userId: createdUserId }
    throw error
  } finally {
    await dependencies.clearVerifierSession().catch(() => {})
  }
}

async function countRowsForUser(operator, table, userId) {
  const result = await operator.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', userId)
  if (result.error) fail(`Inventory kunne ikke læse ${table}: ${result.error.message}`)
  if (!Number.isInteger(result.count)) fail(`Inventory modtog intet præcist antal fra ${table}.`)
  return result.count
}

async function getInventory(operator, userId) {
  const counts = {}
  for (const table of USER_SCOPED_TABLES) counts[table] = await countRowsForUser(operator, table, userId)
  const entitlement = await operator
    .from('sub_entitlements')
    .select('tier,source,valid_until')
    .eq('user_id', userId)
    .maybeSingle()
  if (entitlement.error) fail(`Entitlement kunne ikke kontrolleres: ${entitlement.error.message}`)
  return { counts, entitlement: entitlement.data }
}

export function assertSubscriptionFixtureInventory(inventory) {
  if (inventory.counts?.sub_pilot_member_activations !== 1) {
    fail('QA-fixturen kræver præcis én kontrolleret pilotaktivering.')
  }
  if (
    inventory.counts?.sub_entitlements !== 1
    || inventory.entitlement?.source !== 'pilot_invite'
    || inventory.entitlement?.tier !== 'member'
  ) fail('QA-fixturen kræver præcis ét pilot_invite member-entitlement.')
  return true
}

export function assertSyntheticFixtureEligible({ identity, inventory }) {
  if (!identity?.marked && !identity?.legacyUnmarked) fail('QA-identiteten er ikke dokumenteret som syntetisk.')
  return assertSubscriptionFixtureInventory(inventory)
}

async function requireSyntheticIdentity(operator, plan) {
  const result = await operator.auth.admin.getUserById(plan.userId)
  if (result.error || !result.data?.user) fail(`Auth-brugeren kunne ikke læses: ${result.error?.message || 'mangler bruger'}`)
  const identity = syntheticIdentityFacts(result.data.user, plan)
  return { user: result.data.user, identity }
}

async function verifyWeekOne(operator, plan) {
  const member = await operator
    .from('sub_members')
    .select('goal,level,days_per_week,equipment,squat_style,deadlift_style,setup_schema_version,baseline_policy_version,program_setup_completed_at')
    .eq('user_id', plan.userId)
  if (member.error) fail(`Member-state kunne ikke læses: ${member.error.message}`)
  const assignments = await operator
    .from('sub_assignments')
    .select('id,program_id,assignment_source,match_input,ended_at')
    .eq('user_id', plan.userId)
    .is('ended_at', null)
  if (assignments.error) fail(`Assignment kunne ikke læses: ${assignments.error.message}`)
  if (member.data?.length !== 1 || assignments.data?.length !== 1) {
    fail('QA-brugeren skal have præcis én member-række og én aktiv assignment.')
  }
  const program = await operator
    .from('sub_programs')
    .select('slug,version,status,days,min_tier,levels,content')
    .eq('id', assignments.data[0].program_id)
    .single()
  if (program.error) fail(`Programmet kunne ikke læses: ${program.error.message}`)

  const row = member.data[0]
  const assignment = assignments.data[0]
  const content = program.data.content || {}
  const expected = plan.expected
  const workouts = await operator
    .from('sub_workouts')
    .select('id,day_id')
    .eq('user_id', plan.userId)
    .eq('assignment_id', assignment.id)
    .eq('program_id', assignment.program_id)
    .not('completed_at', 'is', null)
  if (workouts.error) fail(`Workout-kardinalitet kunne ikke læses: ${workouts.error.message}`)
  const workoutIds = (workouts.data || []).map(workout => workout.id)
  let persistedSetCount = 0
  if (workoutIds.length) {
    const setCount = await operator
      .from('sub_workout_sets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', plan.userId)
      .in('workout_id', workoutIds)
    if (setCount.error || !Number.isInteger(setCount.count)) {
      fail(`Set-kardinalitet kunne ikke læses: ${setCount.error?.message || 'mangler antal'}`)
    }
    persistedSetCount = setCount.count
  }
  const plannedSetCount = Array.isArray(content.sessions)
    ? content.sessions.reduce((weekTotal, session) => weekTotal + (
        Array.isArray(session.exercises)
          ? session.exercises.reduce((sessionTotal, exercise) => sessionTotal + Number(exercise.sets || 0), 0)
          : 0
      ), 0)
    : 0
  const expectedDayIds = Array.isArray(content.sessions) ? content.sessions.map(session => session.id).sort() : []
  const completedDayIds = (workouts.data || []).map(workout => workout.day_id).sort()
  const completeSessionCoverage = completedDayIds.length === expectedDayIds.length
    && completedDayIds.every((dayId, index) => dayId === expectedDayIds[index])
  const axesMatch = row.goal === expected.goal
    && row.level === expected.level
    && row.days_per_week === expected.days
    && row.equipment === expected.equipment
    && row.squat_style === expected.squatStyle
    && row.deadlift_style === expected.deadliftStyle
  const programMatches = program.data.version === 1
    && program.data.status === 'published'
    && program.data.days === expected.days
    && program.data.min_tier === 'member'
    && program.data.levels?.length === 1
    && program.data.levels[0] === expected.level
    && content.goal === expected.goal
    && content.level === expected.level
    && content.equipment === expected.equipment
    && content.squatStyle === expected.squatStyle
    && content.deadliftStyle === expected.deadliftStyle
    && content.sessions?.length === expected.days
  const assignmentMatches = assignment.assignment_source === 'member_self_setup_v1'
    && assignment.match_input?.goal === expected.goal
    && assignment.match_input?.level === expected.level
    && assignment.match_input?.daysPerWeek === expected.days
    && assignment.match_input?.equipment === expected.equipment
    && assignment.match_input?.squatStyle === expected.squatStyle
    && assignment.match_input?.deadliftStyle === expected.deadliftStyle
  const cardinalityMatches = expected.workoutCount === null
    || (
      workoutIds.length === expected.workoutCount
      && persistedSetCount === expected.setCount
      && plannedSetCount === expected.setCount
      && (expected.workoutCount !== expected.days || completeSessionCoverage)
    )
  if (
    !axesMatch
    || row.setup_schema_version !== 1
    || row.baseline_policy_version !== 1
    || !row.program_setup_completed_at
    || !programMatches
    || !assignmentMatches
    || !cardinalityMatches
  ) fail('Uge-1-binding matcher ikke de eksplicit forventede programakser.')
  return {
    state: 'SYNTHETIC_WEEK_ONE_BOUND',
    identity: 'synthetic-qa-redacted',
    activeAssignmentCount: 1,
    assignmentSource: assignment.assignment_source,
    programSlug: program.data.slug,
    days: program.data.days,
    completedWorkoutCount: workoutIds.length,
    persistedSetCount,
    plannedSetCount,
    completeSessionCoverage,
  }
}

async function serveOneTimeHandoff(actionLink, onReady) {
  const nonce = randomBytes(24).toString('hex')
  let used = false
  const server = createServer((request, response) => {
    if (used || request.method !== 'GET' || request.url !== `/handoff/${nonce}`) {
      response.writeHead(404, {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'",
      })
      response.end('Not found')
      return
    }
    used = true
    response.writeHead(302, {
      Location: actionLink.toString(),
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      'Referrer-Policy': 'no-referrer',
    })
    response.end()
    setImmediate(() => server.close())
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  onReady(`http://127.0.0.1:${address.port}/handoff/${nonce}`)
  const timeout = setTimeout(() => server.close(), HANDOFF_TIMEOUT_MS)
  await once(server, 'close')
  clearTimeout(timeout)
  return used
}

export async function executeQaPlan(plan, context, clientFactory = makeClients, onHandoffReady = console.log) {
  if (!plan.execute) {
    return {
      state: 'DRY_RUN',
      action: plan.action,
      projectRef: plan.projectRef,
      email: plan.email,
      userId: plan.userId,
      validUntil: plan.validUntil,
      expected: plan.expected,
      networkAttempted: false,
    }
  }
  const { operator, verifier } = clientFactory(context)
  if (plan.action === 'prepare') {
    return prepareSyntheticQa(plan, {
      generateLink: payload => operator.auth.admin.generateLink(payload),
      verifyInvite: tokenHash => verifier.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' }),
      getUserById: userId => operator.auth.admin.getUserById(userId),
      activate: payload => operator.rpc('sub_controlled_activate_invited_member', payload),
      clearVerifierSession: () => verifier.auth.signOut({ scope: 'local' }),
    })
  }

  const inventory = await getInventory(operator, plan.userId)

  if (plan.action === 'inspect') {
    assertSubscriptionFixtureInventory(inventory)
    return {
      state: 'SYNTHETIC_QA_INVENTORY',
      projectRef: EXPECTED_SHADOW_REF,
      identity: 'synthetic-qa-redacted',
      counts: inventory.counts,
      entitlement: inventory.entitlement,
    }
  }
  if (plan.action === 'verify') {
    assertSubscriptionFixtureInventory(inventory)
    return verifyWeekOne(operator, plan)
  }
  if (plan.action === 'handoff') {
    const { identity } = await requireSyntheticIdentity(operator, plan)
    assertSyntheticFixtureEligible({ identity, inventory })
    if (Date.parse(inventory.entitlement.valid_until) <= Date.now()) fail('QA-entitlement er udløbet.')
    const response = await operator.auth.admin.generateLink({
      type: 'magiclink',
      email: plan.email,
      options: { redirectTo: PUBLIC_SUBSCRIPTION_URL },
    })
    const validated = validateGeneratedAuthLink({ response, type: 'magiclink', plan, expectedUserId: plan.userId })
    const consumed = await serveOneTimeHandoff(validated.actionLink, localUrl => onHandoffReady(JSON.stringify({
      state: 'SYNTHETIC_QA_HANDOFF_READY',
      userId: plan.userId,
      oneTimeLocalHandoff: localUrl,
      expiresInSeconds: HANDOFF_TIMEOUT_MS / 1000,
      tokenExposed: false,
    })))
    return { state: consumed ? 'HANDOFF_CONSUMED' : 'HANDOFF_EXPIRED', userId: plan.userId }
  }
  fail('Ukendt QA-handling.')
}

function printUsage() {
  console.log(`Reusable live-QA mod subscription-shadow ${EXPECTED_SHADOW_REF}.

Alle handlinger er dry-run uden --execute. Netværk kræver desuden:
  --confirm-project ${EXPECTED_SHADOW_REF}

1. Opret og aktivér en markeret syntetisk QA-bruger (token bliver kun i hukommelsen):
  node scripts/run-synthetic-subscription-live-qa.mjs prepare --run-id RUN_ID --valid-until UTC [--execute --confirm-project REF]

2. Opret et 120-sekunders loopback-handoff til browserens magic-link:
  node scripts/run-synthetic-subscription-live-qa.mjs handoff --email QA_EMAIL --user-id UUID [--execute --confirm-project REF]

3. Se kun user-scoped inventory eller verificér den valgte uge-1-binding:
  node scripts/run-synthetic-subscription-live-qa.mjs inspect --email QA_EMAIL --user-id UUID [--execute --confirm-project REF]
  node scripts/run-synthetic-subscription-live-qa.mjs verify --email QA_EMAIL --user-id UUID --goal GOAL --level LEVEL --days 3 --equipment gym --squat-style low-bar --deadlift-style sumo --expected-workouts 3 --expected-sets 28 [--execute --confirm-project REF]

Den tidligere timestamp-baserede, umarkerede QA-bruger kræver kun --allow-legacy-unmarked ved handoff, hvor Auth-identiteten læses.
Fixturens adgang udløber automatisk. Runneren har bevidst ingen slettehandling og læser kun Auth-identiteten samt subscription-tabeller.
Ingen handling må bruges mod Marc, Mitch, andre testere eller 1:1-data.`)
}

async function cli() {
  if (!process.argv[2] || process.argv.includes('--help')) {
    printUsage()
    return
  }
  let plan
  try {
    plan = buildQaPlan({ ...parseQaArgs(process.argv.slice(2)), now: new Date() })
    const context = plan.execute ? loadQaContext(plan.envFile) : null
    const result = await executeQaPlan(plan, context)
    console.log(JSON.stringify(result, null, 2))
    if (result.state === 'DRY_RUN') console.log('Ingen netværks- eller Supabase-handling blev forsøgt.')
  } catch (error) {
    console.error(`STOP: ${error.message}`)
    if (error.syntheticQaIdentity?.email) {
      console.error(JSON.stringify({ state: 'SYNTHETIC_QA_PARTIAL', ...error.syntheticQaIdentity }))
      console.error('Fixturen bliver stående med tidsbegrænset adgang. Brug inspect til den videre QA-vurdering.')
    }
    console.error('Ingen automatisk retry udføres.')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await cli()
