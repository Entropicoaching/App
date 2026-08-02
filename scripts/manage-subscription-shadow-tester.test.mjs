import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_REDIRECT_TO,
  EXPECTED_SHADOW_REF,
  activationRequestId,
  authReadiness,
  buildPlan,
  executePlan,
  normalizeRedirectTo,
  normalizeValidUntil,
  parseArgs,
  parseEnv,
  validateGeneratedInviteLink,
  verifyShadowContext,
} from './manage-subscription-shadow-tester.mjs'

const NOW = new Date('2026-08-02T10:00:00.000Z')
const VALID_UNTIL = '2026-09-01T21:59:59Z'
const USER_ID = '12345678-1234-4123-8123-123456789abc'
const ACTIVATION_ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef'

function baseOptions(overrides = {}) {
  return {
    email: ' Tester@Example.dk ',
    'valid-until': VALID_UNTIL,
    ...overrides,
  }
}

function context() {
  return {
    projectRef: EXPECTED_SHADOW_REF,
    url: `https://${EXPECTED_SHADOW_REF}.supabase.co/`,
    secretKey: 'shadow-secret-never-printed',
  }
}

test('env parser reads only the three allowlisted shadow settings', () => {
  assert.deepEqual(parseEnv(`
    VITE_SUB_SUPABASE_URL=https://${EXPECTED_SHADOW_REF}.supabase.co/
    VITE_SUB_SUPABASE_PROJECT_REF=${EXPECTED_SHADOW_REF}
    SUPABASE_SECRET_KEY=REPLACE_ME
    PRODUCTION_DATABASE_URL=must-not-be-read
  `), {
    VITE_SUB_SUPABASE_URL: `https://${EXPECTED_SHADOW_REF}.supabase.co/`,
    VITE_SUB_SUPABASE_PROJECT_REF: EXPECTED_SHADOW_REF,
    SUPABASE_SECRET_KEY: 'REPLACE_ME',
  })
})

test('binding requires exact authorised ref, host and a local operator secret', () => {
  const binding = { expectedProjectRef: EXPECTED_SHADOW_REF }
  const env = {
    VITE_SUB_SUPABASE_URL: `https://${EXPECTED_SHADOW_REF}.supabase.co/`,
    VITE_SUB_SUPABASE_PROJECT_REF: EXPECTED_SHADOW_REF,
    SUPABASE_SECRET_KEY: 'operator-secret',
  }
  assert.equal(verifyShadowContext({ env, binding }).projectRef, EXPECTED_SHADOW_REF)
  assert.throws(() => verifyShadowContext({
    env: { ...env, VITE_SUB_SUPABASE_URL: 'https://production-ref.supabase.co/' },
    binding,
  }), /godkendte subscription-shadow/)
  assert.throws(() => verifyShadowContext({
    env: { ...env, SUPABASE_SECRET_KEY: 'REPLACE_ME' },
    binding,
  }), /SUPABASE_SECRET_KEY/)
})

test('plans canonicalise email, expiry and local callback without network', () => {
  const parsed = parseArgs(['invite', '--email', ' Tester@Example.dk ', '--valid-until', VALID_UNTIL])
  const plan = buildPlan({ ...parsed, now: NOW })
  assert.deepEqual(plan, {
    action: 'invite',
    execute: false,
    email: 'tester@example.dk',
    envFile: '.env.local',
    projectRef: EXPECTED_SHADOW_REF,
    redirectTo: DEFAULT_REDIRECT_TO,
    validUntil: '2026-09-01T21:59:59.000Z',
  })
})

test('expiry is UTC, future and time-bounded', () => {
  assert.equal(normalizeValidUntil(VALID_UNTIL, NOW), '2026-09-01T21:59:59.000Z')
  assert.throws(() => normalizeValidUntil('2026-09-01T21:59:59+02:00', NOW), /UTC/)
  assert.throws(() => normalizeValidUntil('2026-08-01T21:59:59Z', NOW), /fremtiden/)
  assert.throws(() => normalizeValidUntil('2028-09-01T21:59:59Z', NOW), /366 dage/)
})

test('redirect is exact localhost pilot path or an HTTPS subscription path', () => {
  assert.equal(normalizeRedirectTo(DEFAULT_REDIRECT_TO), DEFAULT_REDIRECT_TO)
  assert.equal(normalizeRedirectTo('https://members.entropicoaching.dk/subscription.html'), 'https://members.entropicoaching.dk/subscription.html')
  assert.throws(() => normalizeRedirectTo('http://members.entropicoaching.dk/subscription.html'), /HTTPS/)
  assert.throws(() => normalizeRedirectTo('http://localhost:5173/subscription.html'), /5199/)
  assert.throws(() => normalizeRedirectTo('https://members.entropicoaching.dk/subscription.html?token=bad'), /query/)
})

test('all network actions need an explicit exact project confirmation', () => {
  assert.throws(() => buildPlan({
    action: 'invite',
    options: baseOptions({ execute: true }),
    now: NOW,
  }), /--confirm-project/)
  const plan = buildPlan({
    action: 'invite',
    options: baseOptions({ execute: true, 'confirm-project': EXPECTED_SHADOW_REF }),
    now: NOW,
  })
  assert.equal(plan.execute, true)
})

test('activation request id is deterministic for safe RPC replay', () => {
  const input = { userId: USER_ID, validUntil: '2026-09-01T21:59:59.000Z' }
  assert.match(activationRequestId(input), /^[0-9a-f-]{36}$/)
  assert.equal(activationRequestId(input), activationRequestId(input))
  assert.notEqual(activationRequestId(input), activationRequestId({
    ...input,
    validUntil: '2026-10-01T21:59:59.000Z',
  }))
})

test('invite dry-run never constructs a Supabase client', async () => {
  const plan = buildPlan({ action: 'invite', options: baseOptions(), now: NOW })
  let called = false
  const result = await executePlan(plan, context(), () => {
    called = true
  })
  assert.equal(called, false)
  assert.equal(result.state, 'DRY_RUN')
  assert.equal(result.networkAttempted, false)
})

test('execute invite sends one Auth invitation and never grants entitlement', async () => {
  const plan = buildPlan({
    action: 'invite',
    options: baseOptions({ execute: true, 'confirm-project': EXPECTED_SHADOW_REF }),
    now: NOW,
  })
  const calls = []
  const fakeClient = {
    auth: {
      admin: {
        inviteUserByEmail: async (...args) => {
          calls.push(args)
          return { data: { user: { id: USER_ID, email: plan.email } }, error: null }
        },
      },
    },
    rpc: async () => assert.fail('invite must not call an entitlement RPC'),
  }
  const result = await executePlan(plan, context(), () => fakeClient)
  assert.deepEqual(calls, [[plan.email, { redirectTo: DEFAULT_REDIRECT_TO }]])
  assert.equal(result.state, 'INVITE_SENT')
  assert.equal(result.memberGranted, false)
  assert.equal(result.userId, USER_ID)
})

function generatedInviteData(plan, overrides = {}) {
  const token = 'hashed-invite-token-123'
  const actionLink = new URL(`https://${EXPECTED_SHADOW_REF}.supabase.co/auth/v1/verify`)
  actionLink.searchParams.set('token', token)
  actionLink.searchParams.set('type', 'invite')
  actionLink.searchParams.set('redirect_to', plan.redirectTo)
  return {
    properties: {
      action_link: actionLink.toString(),
      email_otp: '123456',
      hashed_token: token,
      redirect_to: plan.redirectTo,
      verification_type: 'invite',
      ...overrides.properties,
    },
    user: {
      id: USER_ID,
      email: plan.email,
      ...overrides.user,
    },
  }
}

test('invite-link dry-run stays entirely local', async () => {
  const plan = buildPlan({ action: 'invite-link', options: baseOptions(), now: NOW })
  let called = false
  const result = await executePlan(plan, context(), () => {
    called = true
  })
  assert.equal(called, false)
  assert.equal(result.state, 'DRY_RUN')
  assert.equal(result.networkAttempted, false)
})

test('execute invite-link calls only generateLink and marks the returned link sensitive', async () => {
  const plan = buildPlan({
    action: 'invite-link',
    options: baseOptions({ execute: true, 'confirm-project': EXPECTED_SHADOW_REF }),
    now: NOW,
  })
  const calls = []
  const response = generatedInviteData(plan)
  const fakeClient = {
    auth: { admin: {
      generateLink: async payload => {
        calls.push(payload)
        return { data: response, error: null }
      },
    } },
    rpc: async () => assert.fail('invite-link must never call an RPC'),
  }
  const result = await executePlan(plan, context(), () => fakeClient)
  assert.deepEqual(calls, [{
    type: 'invite',
    email: 'tester@example.dk',
    options: { redirectTo: DEFAULT_REDIRECT_TO },
  }])
  assert.equal(result.state, 'SENSITIVE_INVITE_LINK_CREATED')
  assert.equal(result.sensitivity, 'SECRET_SINGLE_USE_AUTH_LINK')
  assert.equal(result.actionLink, response.properties.action_link)
  assert.equal(result.memberGranted, false)
  assert.equal(Object.hasOwn(result, 'emailOtp'), false)
  assert.equal(Object.hasOwn(result, 'hashedToken'), false)
})

test('generated invitation fails closed on wrong user, host, type, redirect or token', () => {
  const plan = buildPlan({ action: 'invite-link', options: baseOptions(), now: NOW })
  const valid = generatedInviteData(plan)
  assert.equal(validateGeneratedInviteLink({ ...valid, plan }).userId, USER_ID)

  const wrongEmail = generatedInviteData(plan, { user: { email: 'wrong@example.dk' } })
  assert.throws(() => validateGeneratedInviteLink({ ...wrongEmail, plan }), /Auth-bruger/)

  const wrongType = generatedInviteData(plan, { properties: { verification_type: 'magiclink' } })
  assert.throws(() => validateGeneratedInviteLink({ ...wrongType, plan }), /invitationstypen/)

  const wrongRedirect = generatedInviteData(plan, { properties: { redirect_to: 'https://evil.example/subscription.html' } })
  assert.throws(() => validateGeneratedInviteLink({ ...wrongRedirect, plan }), /callback/)

  const wrongHost = generatedInviteData(plan)
  wrongHost.properties.action_link = wrongHost.properties.action_link.replace(
    `${EXPECTED_SHADOW_REF}.supabase.co`,
    'wrong-project.supabase.co',
  )
  assert.throws(() => validateGeneratedInviteLink({ ...wrongHost, plan }), /subscription-shadow/)

  const wrongPort = generatedInviteData(plan)
  wrongPort.properties.action_link = wrongPort.properties.action_link.replace('.supabase.co/', '.supabase.co:444/')
  assert.throws(() => validateGeneratedInviteLink({ ...wrongPort, plan }), /subscription-shadow/)

  const wrongToken = generatedInviteData(plan)
  wrongToken.properties.hashed_token = 'different-token'
  assert.throws(() => validateGeneratedInviteLink({ ...wrongToken, plan }), /type, token eller callback/)
})

test('generated invitation rejects unexpected and duplicate action-link parameters', () => {
  const plan = buildPlan({ action: 'invite-link', options: baseOptions(), now: NOW })
  const unexpected = generatedInviteData(plan)
  unexpected.properties.action_link += '&provider=email'
  assert.throws(() => validateGeneratedInviteLink({ ...unexpected, plan }), /uventede eller duplikerede/)

  const duplicate = generatedInviteData(plan)
  duplicate.properties.action_link += '&type=invite'
  assert.throws(() => validateGeneratedInviteLink({ ...duplicate, plan }), /uventede eller duplikerede/)
})

test('status reads only the exact Auth user and reports readiness', async () => {
  const plan = buildPlan({
    action: 'status',
    options: {
      email: 'tester@example.dk',
      'user-id': USER_ID,
      execute: true,
      'confirm-project': EXPECTED_SHADOW_REF,
    },
    now: NOW,
  })
  const fakeClient = {
    auth: { admin: { getUserById: async id => {
      assert.equal(id, USER_ID)
      return {
        data: { user: {
          id,
          email: plan.email,
          invited_at: '2026-08-03T08:00:00Z',
          email_confirmed_at: '2026-08-03T08:03:00Z',
          last_sign_in_at: '2026-08-03T08:04:00Z',
        } },
        error: null,
      }
    } } },
    rpc: async () => assert.fail('status must not call an RPC'),
  }
  const result = await executePlan(plan, context(), () => fakeClient)
  assert.equal(result.state, 'AUTH_STATUS')
  assert.equal(result.readyForActivation, true)
  assert.equal(result.memberGranted, false)
})

test('activation refuses a user who has not logged in after invitation', () => {
  assert.deepEqual(authReadiness({
    id: USER_ID,
    email: 'tester@example.dk',
    invited_at: '2026-08-03T08:00:00Z',
    email_confirmed_at: '2026-08-03T08:03:00Z',
    last_sign_in_at: '2026-08-03T07:59:00Z',
  }, 'tester@example.dk'), {
    invited: true,
    confirmed: true,
    loggedInAfterInvite: false,
  })
})

test('Auth readiness fails closed on an unexpected user id or email', () => {
  const readyUser = {
    id: USER_ID,
    email: 'tester@example.dk',
    invited_at: '2026-08-03T08:00:00Z',
    email_confirmed_at: '2026-08-03T08:03:00Z',
    last_sign_in_at: '2026-08-03T08:04:00Z',
  }
  assert.throws(() => authReadiness(readyUser, 'another@example.dk', USER_ID), /e-mail matcher ikke/)
  assert.throws(() => authReadiness(readyUser, readyUser.email, ACTIVATION_ID), /UUID matcher ikke/)
})

test('activation validates Auth facts then calls only the controlled service RPC', async () => {
  const plan = buildPlan({
    action: 'activate',
    options: {
      ...baseOptions(),
      'user-id': USER_ID,
      execute: true,
      'confirm-project': EXPECTED_SHADOW_REF,
    },
    now: NOW,
  })
  const calls = []
  const fakeClient = {
    auth: { admin: { getUserById: async () => ({
      data: { user: {
        id: USER_ID,
        email: plan.email,
        invited_at: '2026-08-03T08:00:00Z',
        email_confirmed_at: '2026-08-03T08:03:00Z',
        last_sign_in_at: '2026-08-03T08:04:00Z',
      } },
      error: null,
    }) } },
    rpc: async (...args) => {
      calls.push(args)
      return {
        data: [{ activation_id: ACTIVATION_ID, tier: 'member', valid_until: plan.validUntil }],
        error: null,
      }
    },
  }
  const result = await executePlan(plan, context(), () => fakeClient)
  assert.deepEqual(calls, [[
    'sub_controlled_activate_invited_member',
    {
      p_request_id: plan.requestId,
      p_target_user_id: USER_ID,
      p_invited_email: 'tester@example.dk',
      p_valid_until: '2026-09-01T21:59:59.000Z',
    },
  ]])
  assert.equal(result.state, 'MEMBER_ACTIVATED')
  assert.equal(result.tier, 'member')
})
