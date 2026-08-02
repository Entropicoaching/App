import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const EXPECTED_REF = 'maxhsefxbrvsgolscqwh'
const MEMBER_B_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MEMBER_B_EMAIL = 'sub-free@example.test'

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
}

const root = resolve(import.meta.dirname, '..')
const env = readEnv(resolve(root, '.env.local'))
const url = env.VITE_SUB_SUPABASE_URL
const ref = env.VITE_SUB_SUPABASE_PROJECT_REF
const publishableKey = env.VITE_SUB_SUPABASE_ANON_KEY
const secretKey = env.SUPABASE_SECRET_KEY

assert.equal(ref, EXPECTED_REF, 'wrong shadow project ref')
assert.equal(new URL(url).hostname, `${EXPECTED_REF}.supabase.co`, 'wrong shadow project host')
assert.ok(publishableKey && secretKey, 'shadow client/operator keys are unavailable')

const operator = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})
const member = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

const initialPassword = `${randomBytes(24).toString('base64url')}Aa1!`
const rotatedPassword = `${randomBytes(24).toString('base64url')}Bb2!`

try {
  const { data: authUser, error: getUserError } = await operator.auth.admin.getUserById(MEMBER_B_ID)
  assert.ifError(getUserError)
  assert.equal(authUser.user?.id, MEMBER_B_ID, 'memberB Auth id mismatch')
  assert.equal(authUser.user?.email, MEMBER_B_EMAIL, 'memberB Auth email mismatch')

  const { error: updatePasswordError } = await operator.auth.admin.updateUserById(MEMBER_B_ID, {
    password: initialPassword,
  })
  assert.ifError(updatePasswordError)

  const { data: signIn, error: signInError } = await member.auth.signInWithPassword({
    email: MEMBER_B_EMAIL,
    password: initialPassword,
  })
  assert.ifError(signInError)
  assert.equal(signIn.user?.id, MEMBER_B_ID, 'authenticated memberB id mismatch')

  const { data: accessRows, error: accessError } = await member.rpc('sub_my_access_v2')
  assert.ifError(accessError)
  assert.deepEqual(accessRows, [{ tier: 'member', has_coaching: false }])

  const { data: assignments, error: assignmentError } = await member
    .from('sub_assignments')
    .select('id,program_id,assigned_at,ended_at')
    .is('ended_at', null)
  assert.ifError(assignmentError)
  assert.equal(assignments.length, 1, 'memberB must have one active assignment')

  const { data: programs, error: programError } = await member
    .from('sub_programs')
    .select('id,slug,version,content')
    .eq('id', assignments[0].program_id)
  assert.ifError(programError)
  assert.equal(programs.length, 1, 'memberB assigned program must be readable')

  const session = programs[0].content.sessions[0]
  const exercise = session.exercises[0]
  const startedAt = new Date()
  const completedAt = new Date(startedAt.getTime() + 10_000)
  const clientId = `authenticated-pilot-${startedAt.getTime()}`
  const sets = [{
    exercise_id: exercise.id,
    set_index: 1,
    reps: Number(String(exercise.reps).match(/(\d+)\D*$/)?.[1] || 5),
    weight_kg: 50,
    rpe: 6,
    logged_at: completedAt.toISOString(),
  }]
  const payload = {
    p_assignment_id: assignments[0].id,
    p_day_id: session.id,
    p_client_id: clientId,
    p_started_at: startedAt.toISOString(),
    p_completed_at: completedAt.toISOString(),
    p_sets: sets,
  }

  const first = await member.rpc('sub_persist_completed_workout_v1', payload)
  assert.ifError(first.error)
  const replay = await member.rpc('sub_persist_completed_workout_v1', payload)
  assert.ifError(replay.error)
  assert.equal(replay.data, first.data, 'authenticated replay must return the same workout id')

  await member.auth.signOut()
  const relogin = await member.auth.signInWithPassword({ email: MEMBER_B_EMAIL, password: initialPassword })
  assert.ifError(relogin.error)
  const persisted = await member
    .from('sub_workouts')
    .select('id,client_id,persisted_payload')
    .eq('client_id', clientId)
  assert.ifError(persisted.error)
  assert.equal(persisted.data.length, 1, 'persisted workout must survive sign-out/re-login')
  assert.equal(persisted.data[0].id, first.data, 'persisted workout identity changed')

  console.log(JSON.stringify({
    state: 'AUTHENTICATED_SHADOW_FLOW_PASS',
    targetRef: EXPECTED_REF,
    actor: 'legacy-free-reused-as-memberB',
    access: accessRows[0],
    assignmentCount: assignments.length,
    program: `${programs[0].slug}@${programs[0].version}`,
    persistedWorkoutId: first.data,
    exactReplaySameId: replay.data === first.data,
    persistedAfterRelogin: persisted.data.length === 1,
  }))
} finally {
  await member.auth.signOut().catch(() => {})
  await operator.auth.admin.updateUserById(MEMBER_B_ID, { password: rotatedPassword }).catch(() => {})
}
