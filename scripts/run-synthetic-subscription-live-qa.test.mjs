import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLIC_SUBSCRIPTION_URL,
  SYNTHETIC_MARKER_KEY,
  SYNTHETIC_MARKER_VERSION,
  assertSyntheticFixtureEligible,
  assertSubscriptionFixtureInventory,
  buildQaPlan,
  executeQaPlan,
  normalizeSyntheticEmail,
  parseQaArgs,
  prepareSyntheticQa,
  syntheticEmailForRun,
  syntheticIdentityFacts,
  validateGeneratedAuthLink,
} from './run-synthetic-subscription-live-qa.mjs'
import { EXPECTED_SHADOW_REF } from './manage-subscription-shadow-tester.mjs'

const NOW = new Date('2026-08-03T10:00:00.000Z')
const RUN_ID = '20260803t100000z'
const EMAIL = syntheticEmailForRun(RUN_ID)
const USER_ID = '12345678-1234-4123-8123-123456789abc'
const VALID_UNTIL = '2026-08-05T10:00:00.000Z'

function user(overrides = {}) {
  return {
    id: USER_ID,
    email: EMAIL,
    created_at: NOW.toISOString(),
    invited_at: NOW.toISOString(),
    email_confirmed_at: new Date(NOW.getTime() + 1000).toISOString(),
    last_sign_in_at: new Date(NOW.getTime() + 2000).toISOString(),
    user_metadata: {
      [SYNTHETIC_MARKER_KEY]: { schemaVersion: SYNTHETIC_MARKER_VERSION, runId: RUN_ID },
    },
    ...overrides,
  }
}

function plan(overrides = {}) {
  return {
    action: 'inspect',
    execute: true,
    projectRef: EXPECTED_SHADOW_REF,
    email: EMAIL,
    runId: RUN_ID,
    userId: USER_ID,
    allowLegacyUnmarked: false,
    ...overrides,
  }
}

function inventory(overrides = {}) {
  return {
    counts: {
      sub_entitlements: 1,
      sub_members: 1,
      sub_assignments: 1,
      sub_workouts: 0,
      sub_workout_sets: 0,
      sub_pilot_member_activations: 1,
      sub_week_two_proposals: 0,
      sub_week_two_decisions: 0,
    },
    entitlement: { tier: 'member', source: 'pilot_invite', valid_until: VALID_UNTIL },
    ...overrides,
  }
}

function generatedLink(type, authUser = user()) {
  const token = `${type}-secret-token`
  const actionLink = new URL(`https://${EXPECTED_SHADOW_REF}.supabase.co/auth/v1/verify`)
  actionLink.searchParams.set('token', token)
  actionLink.searchParams.set('type', type)
  actionLink.searchParams.set('redirect_to', PUBLIC_SUBSCRIPTION_URL)
  return {
    data: {
      user: authUser,
      properties: {
        action_link: actionLink.toString(),
        hashed_token: token,
        redirect_to: PUBLIC_SUBSCRIPTION_URL,
        verification_type: type,
      },
    },
    error: null,
  }
}

test('synthetic identity is derived from a bounded dedicated email, never a person', () => {
  assert.equal(EMAIL, 'qa.subscription.20260803t100000z@entropicoaching.dk')
  assert.deepEqual(normalizeSyntheticEmail(EMAIL.toUpperCase()), { email: EMAIL, runId: RUN_ID })
  assert.throws(() => normalizeSyntheticEmail('coach@entropicoaching.dk'), /dedikeret/)
  assert.throws(() => normalizeSyntheticEmail('mitch@example.dk'), /dedikeret/)
})

test('prepare is dry-run by default and live network needs exact shadow confirmation', () => {
  const parsed = parseQaArgs(['prepare', '--run-id', RUN_ID, '--valid-until', VALID_UNTIL])
  const dry = buildQaPlan({ ...parsed, now: NOW })
  assert.equal(dry.execute, false)
  assert.equal(dry.email, EMAIL)
  assert.throws(() => buildQaPlan({
    ...parseQaArgs(['prepare', '--run-id', RUN_ID, '--valid-until', VALID_UNTIL, '--execute']),
    now: NOW,
  }), /--confirm-project/)
})

test('protected owner UUID and every delete-like action are rejected locally', () => {
  assert.throws(() => buildQaPlan({
    action: 'inspect',
    options: {
      email: EMAIL,
      'user-id': 'ec2f969e-ae5d-4dcb-ad16-ee82ddef1c77',
    },
    now: NOW,
  }), /beskyttede pilotkonto/)
  assert.throws(() => normalizeSyntheticEmail('person@example.dk'), /dedikeret/)
  assert.throws(() => parseQaArgs(['cleanup', '--email', EMAIL, '--user-id', USER_ID]), /Vælg handling/)
})

test('verify accepts optional exact workout/set cardinalities only as a pair', () => {
  const base = [
    'verify', '--email', EMAIL, '--user-id', USER_ID,
    '--goal', 'powerlifting-foundation', '--level', 'oevet', '--days', '3',
    '--equipment', 'gym', '--squat-style', 'low-bar', '--deadlift-style', 'sumo',
  ]
  const verified = buildQaPlan({
    ...parseQaArgs([...base, '--expected-workouts', '3', '--expected-sets', '28']),
    now: NOW,
  })
  assert.equal(verified.expected.workoutCount, 3)
  assert.equal(verified.expected.setCount, 28)
  assert.throws(() => buildQaPlan({
    ...parseQaArgs([...base, '--expected-workouts', '3']),
    now: NOW,
  }), /skal angives sammen/)
})

test('inspect and verify accept only the strict timestamp-based legacy fixture flag', () => {
  const legacyRunId = String(NOW.getTime())
  const legacyEmail = syntheticEmailForRun(legacyRunId)
  const inspected = buildQaPlan({
    ...parseQaArgs(['inspect', '--email', legacyEmail, '--user-id', USER_ID, '--allow-legacy-unmarked']),
    now: NOW,
  })
  assert.equal(inspected.allowLegacyUnmarked, true)

  const verifyArgs = [
    'verify', '--email', legacyEmail, '--user-id', USER_ID,
    '--goal', 'powerlifting-foundation', '--level', 'oevet', '--days', '3',
    '--equipment', 'gym', '--squat-style', 'low-bar', '--deadlift-style', 'sumo',
    '--expected-workouts', '3', '--expected-sets', '28', '--allow-legacy-unmarked',
  ]
  assert.equal(buildQaPlan({ ...parseQaArgs(verifyArgs), now: NOW }).allowLegacyUnmarked, true)
  assert.throws(() => buildQaPlan({
    ...parseQaArgs(['inspect', '--email', EMAIL, '--user-id', USER_ID, '--allow-legacy-unmarked']),
    now: NOW,
  }), /timestamp-baserede/)
})

test('new users require the exact metadata marker; legacy is narrow and explicit', () => {
  assert.deepEqual(syntheticIdentityFacts(user(), plan()), {
    marked: true,
    legacyUnmarked: false,
    runId: RUN_ID,
  })
  assert.throws(() => syntheticIdentityFacts(user({ user_metadata: {} }), plan()), /--allow-legacy-unmarked/)

  const legacyRunId = String(NOW.getTime())
  const legacyEmail = syntheticEmailForRun(legacyRunId)
  const legacyPlan = plan({
    email: legacyEmail,
    runId: legacyRunId,
    allowLegacyUnmarked: true,
  })
  const legacyUser = user({ email: legacyEmail, user_metadata: {} })
  assert.equal(syntheticIdentityFacts(legacyUser, legacyPlan).legacyUnmarked, true)
  assert.throws(() => syntheticIdentityFacts(
    { ...legacyUser, created_at: '2026-07-01T00:00:00.000Z' },
    legacyPlan,
  ), /timestamp matcher ikke/)
})

test('generated auth links fail closed and return token only to in-memory callers', () => {
  const prepared = { ...plan(), action: 'handoff' }
  const valid = validateGeneratedAuthLink({
    response: generatedLink('magiclink'),
    type: 'magiclink',
    plan: prepared,
    expectedUserId: USER_ID,
  })
  assert.equal(valid.tokenHash, 'magiclink-secret-token')
  const wrong = generatedLink('magiclink')
  wrong.data.properties.action_link = wrong.data.properties.action_link.replace(
    `${EXPECTED_SHADOW_REF}.supabase.co`,
    'wrong-project.supabase.co',
  )
  assert.throws(() => validateGeneratedAuthLink({ response: wrong, type: 'magiclink', plan: prepared }), /kontrakt/)
})

test('prepare rejects a stale returned Auth user and never includes an invite token in its result', async () => {
  const preparePlan = {
    ...plan(),
    action: 'prepare',
    validUntil: VALID_UNTIL,
    createdAfter: new Date(NOW.getTime() - 60_000).toISOString(),
    createdBefore: new Date(NOW.getTime() + 60_000).toISOString(),
  }
  await assert.rejects(() => prepareSyntheticQa(preparePlan, {
    generateLink: async () => generatedLink('invite', user({ created_at: '2026-07-01T00:00:00.000Z' })),
    clearVerifierSession: async () => {},
  }), /eksisterende Auth-bruger/)

  let generatedPayload
  const result = await prepareSyntheticQa(preparePlan, {
    generateLink: async payload => {
      generatedPayload = payload
      return generatedLink('invite')
    },
    verifyInvite: async () => ({ data: { user: user() }, error: null }),
    getUserById: async () => ({ data: { user: user() }, error: null }),
    activate: async () => ({ data: [{ tier: 'member', valid_until: VALID_UNTIL }], error: null }),
    clearVerifierSession: async () => {},
  })
  assert.equal(generatedPayload.options.data[SYNTHETIC_MARKER_KEY].runId, RUN_ID)
  assert.equal(result.tokenExposed, false)
  assert.doesNotMatch(JSON.stringify(result), /secret-token/)
})

test('fixture eligibility requires controlled activation and pilot-only access', () => {
  const identity = syntheticIdentityFacts(user(), plan())
  assert.equal(assertSyntheticFixtureEligible({ identity, inventory: inventory() }), true)
  assert.equal(assertSubscriptionFixtureInventory(inventory()), true)
  assert.throws(() => assertSubscriptionFixtureInventory(
    inventory({ counts: { ...inventory().counts, sub_pilot_member_activations: 0 } }),
  ), /præcis én/)
  assert.throws(() => assertSubscriptionFixtureInventory(
    inventory({ entitlement: { tier: 'member', source: 'stripe', valid_until: VALID_UNTIL } }),
  ), /pilot_invite/)
})

test('inspect reads subscription tables only and redacts the synthetic identity', async () => {
  let authReads = 0
  const counts = inventory().counts
  const operator = {
    auth: { admin: { getUserById: async () => {
      authReads += 1
      throw new Error('inspect must not read Auth')
    } } },
    from: table => ({
      select: (_columns, options) => options?.head
        ? { eq: async () => ({ count: counts[table], error: null }) }
        : { eq: () => ({ maybeSingle: async () => ({ data: inventory().entitlement, error: null }) }) },
    }),
  }
  const result = await executeQaPlan(
    { ...plan(), action: 'inspect' },
    {},
    () => ({ operator, verifier: {} }),
  )
  assert.equal(authReads, 0)
  assert.equal(result.identity, 'synthetic-qa-redacted')
  assert.equal(Object.hasOwn(result, 'userId'), false)
})
