import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { isEmbeddedSocialBrowser, isTransientAccessClockError, normalizeAccess, retryTransientAccessClock } from '../access.js'
import { isProgramMatchPreviewEnabled, SHADOW_PROJECT_REF, SUBSCRIPTION_AUTH_STORAGE_KEY, validatePilotConfig } from '../pilotConfig.js'
import { clearPilotCache, clearProgramMatchDraft, enqueuePilotSession, loadPilotDraft, loadPilotOutbox, loadPilotSessions, loadProgramMatchDraft, pilotCachePrefix, savePilotDraft, savePilotSessions, saveProgramMatchDraft } from '../pilotCache.js'
import { completeMyProgramSetup, loadPilotState, loadRemoteHistory, mapProgramRow, mapRemoteHistory, memberJourneySessionToPilotSession, memberSetupRpcArgs, mergeSessions, PILOT_REMOTE_HISTORY_LIMIT, setupFailureDiagnostic, syncOneSession, workoutRpcArgs } from '../pilotRepository.js'

const url = `https://${SHADOW_PROJECT_REF}.supabase.co/`
const publishable = 'sb_publishable_test-only-placeholder'

test('pilotkonfiguration fejler lukket ved manglende eller forkert shadow-ref', () => {
  assert.equal(validatePilotConfig({}).ok, false)
  assert.equal(validatePilotConfig({ VITE_SUB_SUPABASE_URL: url, VITE_SUB_SUPABASE_PROJECT_REF: 'dsqgaxwgtcbqgphsofav', VITE_SUB_SUPABASE_ANON_KEY: publishable }).ok, false)
  assert.equal(validatePilotConfig({ VITE_SUB_SUPABASE_URL: 'https://dsqgaxwgtcbqgphsofav.supabase.co/', VITE_SUB_SUPABASE_PROJECT_REF: SHADOW_PROJECT_REF, VITE_SUB_SUPABASE_ANON_KEY: publishable }).ok, false)
  assert.equal(validatePilotConfig({ VITE_SUB_SUPABASE_URL: url, VITE_SUB_SUPABASE_PROJECT_REF: SHADOW_PROJECT_REF, VITE_SUB_SUPABASE_ANON_KEY: 'sb_secret_forbidden' }).ok, false)
  const valid = validatePilotConfig({ VITE_SUB_SUPABASE_URL: url, VITE_SUB_SUPABASE_PROJECT_REF: SHADOW_PROJECT_REF, VITE_SUB_SUPABASE_ANON_KEY: publishable })
  assert.equal(valid.ok, true)
  assert.equal(valid.storageKey, 'entropi-sub-auth')
})

test('tier-svar accepterer kun free/member og fejler ellers lukket', () => {
  assert.deepEqual(normalizeAccess([{ tier: 'member' }]), { tier: 'member', valid: true })
  assert.equal(normalizeAccess([{ tier: 'coaching', has_coaching: true }]).valid, false)
  assert.equal(normalizeAccess(null).tier, 'free')
})

test('transient JWT clock skew retries without requiring a new login link', async () => {
  const waits = []
  let attempts = 0
  const result = await retryTransientAccessClock(async () => {
    attempts += 1
    if (attempts < 3) throw new Error('Adgang kunne ikke laeses: JWT issued at future')
    return { tier: 'member' }
  }, {
    delays: [10, 20, 30],
    wait: async milliseconds => { waits.push(milliseconds) },
  })
  assert.deepEqual(result, { tier: 'member' })
  assert.equal(attempts, 3)
  assert.deepEqual(waits, [10, 20])
  assert.equal(isTransientAccessClockError(new Error('JWT not yet valid')), true)

  let permanentAttempts = 0
  await assert.rejects(
    retryTransientAccessClock(async () => {
      permanentAttempts += 1
      throw new Error('invalid JWT')
    }, { wait: async () => {} }),
    /invalid JWT/,
  )
  assert.equal(permanentAttempts, 1)
})

test('sociale in-app browsere genkendes før member-setup', () => {
  assert.equal(isEmbeddedSocialBrowser('Mozilla/5.0 [FBAN/Instagram;FBAV/400.0]'), true)
  assert.equal(isEmbeddedSocialBrowser('Mozilla/5.0 FB_IAB/FB4A'), true)
  assert.equal(isEmbeddedSocialBrowser('Mozilla/5.0 Version/17.6 Mobile/15E148 Safari/604.1'), false)
  assert.equal(isEmbeddedSocialBrowser('Mozilla/5.0 Chrome/127.0.0.0 Mobile Safari/537.36'), false)
})

// ÆNDRET 6. august 2026. Testen krævede før at en gratis-bruger UDELUKKENDE
// læste sub_programs — rigtigt dengang free hverken kunne have en tildeling
// eller en profil. Da gratis-sporet fik sin egen opsætning
// (sub_complete_my_free_setup_v1), blev kravet forkert og fejlen usynlig:
// rækkerne stod i basen, men laget hentede dem ikke, så guiden viste setup
// igen for en bruger der lige havde gennemført den, og profilsiden var tom.
//
// Testen låser nu det der faktisk skal gælde: uden tildeling ser en
// gratis-bruger stadig startprogrammet, og accessGranted er fortsat false.
// Adgangskontrollen ligger i RLS, ikke i at klienten undlader at spørge.
test('free uden tildeling ser startprogrammet og er ikke accessGranted', async () => {
  const tableReads = []
  const client = {
    async rpc(name) {
      assert.equal(name, 'sub_my_access_v2')
      return { data: [{ tier: 'free' }], error: null }
    },
    from(table) {
      tableReads.push(table)
      const query = {
        select() { return query },
        eq() { return query },
        is() { return query },
        async maybeSingle() {
          if (table === 'sub_assignments') return { data: null, error: null }
          if (table === 'sub_members') return { data: null, error: null }
          if (table === 'sub_programs') {
            return {
              data: { id: 'free-program', slug: 'start-2', version: 1, name: 'Start 2', progression_rule: 'Fast plan.', days: 2, min_equipment: 2, levels: ['begynder', 'oevet'], min_tier: 'free', content: { sessions: [] } },
              error: null,
            }
          }
          throw new Error(`unexpected table ${table}`)
        },
      }
      return query
    },
  }
  const result = await loadPilotState(client, { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
  assert.equal(result.accessGranted, false)
  assert.equal(result.assignment, null)
  assert.equal(result.program.slug, 'start-2')
  assert.ok(tableReads.includes('sub_programs'))
})

test('free MED tildeling får sit eget program, sin profil og forbliver ikke-member', async () => {
  // Regressionen fra 6. august: begge disse felter blev kastet væk for alt der
  // ikke var 'member', så et gennemført gratis-setup så ud som om det aldrig
  // var sket. Programmet skal komme fra tildelingen, ikke fra free-opslaget.
  const tableReads = []
  const client = {
    async rpc(name) {
      assert.equal(name, 'sub_my_access_v2')
      return { data: [{ tier: 'free' }], error: null }
    },
    from(table) {
      tableReads.push(table)
      const query = {
        select() { return query },
        eq() { return query },
        is() { return query },
        order() { return query },
        limit() { return query },
        range() { return query },
        async single() { return query.maybeSingle() },
        async maybeSingle() {
          if (table === 'sub_assignments') return { data: { id: 'a1', program_id: 'start-2-id', user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ended_at: null }, error: null }
          if (table === 'sub_members') return { data: { display_name: null, level: 'oevet', days_per_week: 2, equipment: 'gym', onboarded_at: '2026-08-06T19:54:26Z' }, error: null }
          if (table === 'sub_programs') return { data: { id: 'start-2-id', slug: 'start-2', version: 1, name: 'Start 2', progression_rule: 'Fast plan.', days: 2, min_equipment: 2, levels: ['begynder', 'oevet'], min_tier: 'free', content: { sessions: [] } }, error: null }
          throw new Error(`unexpected table ${table}`)
        },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) },
      }
      return query
    },
  }
  const result = await loadPilotState(client, { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
  assert.equal(result.assignment.id, 'a1')
  assert.equal(result.member.level, 'oevet')
  assert.equal(result.program.slug, 'start-2')
  // Et gratis program gør ingen til medlem. Grænsen holder.
  assert.equal(result.accessGranted, false)
  assert.ok(tableReads.includes('sub_assignments'))
  assert.ok(tableReads.includes('sub_members'))
})

test('eksisterende member uden assignment beholder onboardingdata og får setup-state', async () => {
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const calls = []
  const client = {
    async rpc(name) {
      assert.equal(name, 'sub_my_access_v2')
      return { data: [{ tier: 'member' }], error: null }
    },
    from(table) {
      calls.push(table)
      const query = {
        select() { return query },
        eq() { return query },
        is() { return query },
        async maybeSingle() {
          if (table === 'sub_assignments') return { data: null, error: null }
          if (table === 'sub_members') return { data: { display_name: 'Marc', level: 'oevet', days_per_week: 3, equipment: 'gym', onboarded_at: null }, error: null }
          throw new Error(`unexpected table ${table}`)
        },
      }
      return query
    },
  }
  const result = await loadPilotState(client, { id: userId })
  assert.equal(result.accessGranted, true)
  assert.equal(result.assignment, null)
  assert.equal(result.member.display_name, 'Marc')
  assert.deepEqual(calls.sort(), ['sub_assignments', 'sub_members'])
})

test('setup-RPC kan kun sende request, valg og rå baseline — aldrig sikkerhedsfelter', async () => {
  const input = {
    requestId: '11111111-1111-4111-8111-111111111111',
    matchInput: { schemaVersion: 4, goal: 'general-strength', level: 'begynder', daysPerWeek: 2, equipment: 'home', squatStyle: 'high-bar', deadliftStyle: 'sumo' },
    baselineLoads: { squat: { weightKg: 30, reps: 5, rpe: 8 }, bench: { weightKg: 20, reps: 6, rpe: 8 }, deadlift: { weightKg: 40, reps: 5, rpe: 8 } },
  }
  const args = memberSetupRpcArgs(input)
  assert.deepEqual(Object.keys(args).sort(), ['p_baselines', 'p_match_input', 'p_request_id'])
  assert.deepEqual(args.p_match_input, input.matchInput)
  assert.deepEqual(args.p_baselines, input.baselineLoads)
  assert.throws(() => memberSetupRpcArgs({ ...input, matchInput: { ...input.matchInput, schemaVersion: 3 } }), /forældede/)
  const calls = []
  const client = { async rpc(name, args) { calls.push({ name, args }); return { data: [{ assignment_id: 'a1', program_id: 'p1', created: true }], error: null } } }
  assert.equal((await completeMyProgramSetup(client, input)).assignment_id, 'a1')
  assert.equal(calls[0].name, 'sub_complete_my_program_setup_v1')
  assert.equal('user_id' in calls[0].args, false)
  assert.equal('program_id' in calls[0].args, false)
  assert.equal('tier' in calls[0].args, false)
  assert.equal('assignment_source' in calls[0].args, false)
})

test('setup-fejlreference er kort, stabil og uden private data', () => {
  const requestId = '22222222-2222-4222-8222-222222222222'
  const failure = new Error('tester@example.dk token=super-secret baselines=200')
  failure.setupFailureKind = 'RPC'
  const now = Date.parse('2026-08-03T08:11:40.000Z')
  const diagnostic = setupFailureDiagnostic(requestId, failure, now)

  assert.deepEqual(diagnostic, {
    kind: 'RPC',
    shortReference: 'SET-22222222',
    timeUtc: '2026-08-03T08:11:40Z',
    label: 'SET-22222222 \u00b7 RPC \u00b7 2026-08-03T08:11:40Z',
  })
  assert.doesNotMatch(JSON.stringify(diagnostic), /tester@example\.dk|super-secret|baselines|22222222-2222/)
  assert.equal(setupFailureDiagnostic(requestId, new Error('Load failed'), now).kind, 'NET')
  assert.equal(setupFailureDiagnostic(requestId, new Error('assignment-not-readable'), now).kind, 'RESPONSE')
  assert.equal(setupFailureDiagnostic(requestId, new Error('lokal validering'), now).kind, 'LOCAL')
  assert.equal(setupFailureDiagnostic('ugyldigt-id', failure, now).shortReference, 'SET-UKENDT')
})

test('setup-RPC fjerner r\u00e5 fejltekst f\u00f8r den kan n\u00e5 brugerfladen', async () => {
  const input = {
    requestId: '33333333-3333-4333-8333-333333333333',
    matchInput: { schemaVersion: 4, goal: 'general-strength', level: 'begynder', daysPerWeek: 2, equipment: 'home', squatStyle: 'high-bar', deadliftStyle: 'sumo' },
    baselineLoads: { squat: { weightKg: 30, reps: 5, rpe: 8 }, bench: { weightKg: 20, reps: 6, rpe: 8 }, deadlift: { weightKg: 40, reps: 5, rpe: 8 } },
  }
  const privateError = 'tester@example.dk token=super-secret baselines=200'
  const client = { async rpc() { return { data: null, error: { message: privateError } } } }

  await assert.rejects(
    completeMyProgramSetup(client, input),
    error => {
      assert.equal(error.message, 'Programops\u00e6tningen kunne ikke gennemf\u00f8res.')
      assert.equal(error.setupFailureKind, 'RPC')
      assert.equal(error.setupFailureReason, 'UNKNOWN')
      assert.doesNotMatch(`${error.message} ${Object.values(error).join(' ')}`, /tester@example\.dk|super-secret|baselines/)
      return true
    },
  )

  const throwingClient = { async rpc() { throw new Error(`Load failed ${privateError}`) } }
  await assert.rejects(
    completeMyProgramSetup(throwingClient, input, { delays: [] }),
    error => {
      assert.equal(error.setupFailureKind, 'NET')
      assert.equal(error.setupFailureReason, 'NETWORK')
      assert.doesNotMatch(`${error.message} ${Object.values(error).join(' ')}`, /tester@example\.dk|super-secret|baselines/)
      return true
    },
  )

  const malformedClient = { async rpc() { return { data: [{}], error: null } } }
  await assert.rejects(
    completeMyProgramSetup(malformedClient, input),
    error => error.setupFailureKind === 'RESPONSE' && error.setupFailureReason === 'MISSING_ASSIGNMENT',
  )
})

test('member-sæt bindes til assignment og skipped bliver aldrig til falske 0 kg-sæt', () => {
  const assignment = { id: 'assignment-1', program_id: 'program-1' }
  const base = {
    assignmentId: assignment.id,
    clientId: '11111111-1111-4111-8111-111111111111',
    weekNumber: 1,
    sessionId: 'a',
    startedAt: '2026-08-02T10:00:00.000Z',
    completedAt: '2026-08-02T11:00:00.000Z',
  }
  const completed = {
    weekNumber: 1,
    sessionId: 'a',
    exerciseId: 'high-bar-squat',
    setNumber: 1,
    planned: { weightKg: 70, reps: 5, rpe: 7 },
    actual: { weightKg: 70, repsCompleted: 5, rpeActual: 7, note: '', skipped: false },
  }
  const skipped = {
    ...completed,
    setNumber: 2,
    actual: { weightKg: null, repsCompleted: null, rpeActual: null, note: 'Knæet drillede.', skipped: true },
  }
  const session = memberJourneySessionToPilotSession(assignment, { ...base, setLogs: [completed, skipped] })
  assert.equal(session.programId, assignment.program_id)
  assert.equal(session.entries[0].sets.length, 1)
  assert.equal(session.entries[0].sets[0].weightKg, 70)
  assert.equal(session.skippedSetCount, 1)
  const localOnly = memberJourneySessionToPilotSession(assignment, { ...base, setLogs: [skipped] })
  assert.equal(localOnly.localOnly, true)
  assert.equal(localOnly.skippedSetCount, 1)
  assert.deepEqual(localOnly.entries, [])
  assert.throws(
    () => memberJourneySessionToPilotSession({ ...assignment, id: 'other' }, { ...base, setLogs: [completed] }),
    /aktive programtildeling/,
  )
})

test('programforslag er feature-gated og slukket som standard', () => {
  assert.equal(isProgramMatchPreviewEnabled({}), false)
  assert.equal(isProgramMatchPreviewEnabled({ VITE_SUB_ENABLE_MATCH_PREVIEW: 'false' }), false)
  assert.equal(isProgramMatchPreviewEnabled({ VITE_SUB_ENABLE_MATCH_PREVIEW: 'true' }), true)
})

class MemoryStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}

test('et helt sprunget pas beholder en brugerbundet local-only markør efter reload', () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const marker = {
    assignmentId: 'assignment-1',
    programId: 'program-1',
    clientId: '11111111-1111-4111-8111-111111111111',
    dayId: 'a',
    startedAt: '2026-08-01T10:00:00Z',
    completedAt: '2026-08-01T11:00:00Z',
    entries: [],
    skippedSetCount: 8,
    localOnly: true,
    syncStatus: 'local-only',
  }
  assert.equal(savePilotSessions(userId, [marker]), true)
  assert.deepEqual(loadPilotSessions(userId), [marker])
  delete globalThis.window
})

test('draft/outbox genoptages efter reload og holdes isoleret pr. bruger', () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const draft = { clientId: 'client-a', entries: [{ exerciseId: 'squat', sets: [] }] }
  savePilotDraft(a, draft)
  assert.deepEqual(loadPilotDraft(a), draft)
  assert.equal(loadPilotDraft(b), null)

  const done = { ...draft, dayId: 'a', programId: 'p1', startedAt: '2026-08-01T10:00:00Z', completedAt: '2026-08-01T11:00:00Z' }
  enqueuePilotSession(a, done)
  assert.equal(loadPilotOutbox(a).length, 1)
  assert.equal(loadPilotSessions(a)[0].syncStatus, 'pending')

  localStorage.setItem(SUBSCRIPTION_AUTH_STORAGE_KEY, 'auth-must-survive')
  savePilotDraft(b, { clientId: 'client-b' })
  saveProgramMatchDraft(a, { schemaVersion: 1, goal: 'general-strength' })
  clearPilotCache(a)
  assert.equal(loadPilotDraft(a), null)
  assert.deepEqual(loadPilotDraft(b), { clientId: 'client-b' })
  assert.equal(localStorage.getItem(SUBSCRIPTION_AUTH_STORAGE_KEY), 'auth-must-survive')
  assert.equal(loadProgramMatchDraft(a), null)
  assert.notEqual(pilotCachePrefix(a), pilotCachePrefix(b))
  delete globalThis.window
})

test('et afsluttet pas behandles ikke som gemt, hvis synkkøen ikke kan persisteres', () => {
  const localStorage = new MemoryStorage()
  const originalSetItem = localStorage.setItem.bind(localStorage)
  localStorage.setItem = (storageKey, value) => {
    if (storageKey.endsWith(':outbox')) throw new Error('quota')
    originalSetItem(storageKey, value)
  }
  globalThis.window = { localStorage }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const session = { clientId: 'c1', dayId: 'a' }

  assert.throws(() => enqueuePilotSession(userId, session), /kunne ikke gemmes sikkert/)
  assert.deepEqual(loadPilotSessions(userId), [])
  assert.deepEqual(loadPilotOutbox(userId), [])
  delete globalThis.window
})

test('lokal historik holder kun de seneste 64 pas i kronologisk rækkefølge', () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const sessions = Array.from({ length: 70 }, (_, index) => ({
    clientId: `session-${index}`,
    startedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  })).reverse()
  assert.equal(savePilotSessions(userId, sessions), true)
  const loaded = loadPilotSessions(userId)
  assert.equal(loaded.length, 64)
  assert.equal(loaded[0].clientId, 'session-6')
  assert.equal(loaded.at(-1).clientId, 'session-69')
  delete globalThis.window
})

test('local-only skip-markører bevares uden for den rekonstruerbare 64-pas cache', () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const marker = {
    clientId: 'local-only-old',
    startedAt: '2025-01-01T10:00:00.000Z',
    localOnly: true,
    syncStatus: 'local-only',
    skippedSetCount: 8,
  }
  const remoteReconstructible = Array.from({ length: 70 }, (_, index) => ({
    clientId: `remote-${index}`,
    startedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    syncStatus: 'synced',
  }))
  assert.equal(savePilotSessions(userId, [marker, ...remoteReconstructible]), true)
  const loaded = loadPilotSessions(userId)
  assert.equal(loaded.length, 65)
  assert.equal(loaded[0].clientId, marker.clientId)
  assert.equal(loaded[1].clientId, 'remote-6')
  delete globalThis.window
})

test('programforslagets lokale valg kan nulstilles uden at røre login eller pas', () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  localStorage.setItem(SUBSCRIPTION_AUTH_STORAGE_KEY, 'auth-must-survive')
  saveProgramMatchDraft(userId, { schemaVersion: 1, goal: 'general-strength' })
  clearProgramMatchDraft(userId)
  assert.equal(loadProgramMatchDraft(userId), null)
  assert.equal(localStorage.getItem(SUBSCRIPTION_AUTH_STORAGE_KEY), 'auth-must-survive')
  delete globalThis.window
})

test('program og remote historik mappes til det eksisterende UI-format', () => {
  const program = mapProgramRow({ id: 'p1', slug: 'start-2', version: 1, name: 'Start', progression_rule: 'Gentag.', days: 1, min_equipment: 0, levels: ['begynder'], min_tier: 'free', content: { sessions: [{ id: 'a', name: 'Pas A', exercises: [{ id: 'high-bar-squat', name: 'High-bar squat', role: 'squat-pattern', sets: 2, reps: '5–7', targetRpe: '7' }] }] } })
  assert.equal(program.sessions[0].id, 'a')
  assert.equal(program.sessions[0].movements[0].exerciseId, 'high-bar-squat')
  assert.equal(program.sessions[0].movements[0].roleClass, 'main')
  const sessions = mapRemoteHistory([{ id: 'w1', client_id: 'c1', program_id: 'p1', day_id: 'a', started_at: 'a', completed_at: 'b' }], [{ workout_id: 'w1', exercise_id: 'squat', set_index: 1, reps: 5, weight_kg: '100', rpe: '8', logged_at: 'x' }])
  assert.equal(sessions[0].entries[0].sets[0].weightKg, 100)
  assert.equal(mergeSessions(sessions, [{ ...sessions[0], syncStatus: 'pending' }])[0].syncStatus, 'pending')
})

test('remote historik henter hele den aktive, understøttede historik i sider og afleverer den kronologisk', async () => {
  const calls = { orders: [], ranges: [], workoutIds: null }
  const workouts = [
    { id: 'w3', client_id: 'c3', started_at: '2026-08-03T10:00:00Z', completed_at: '2026-08-03T11:00:00Z' },
    { id: 'w2', client_id: 'c2', started_at: '2026-08-02T10:00:00Z', completed_at: '2026-08-02T11:00:00Z' },
    { id: 'w1', client_id: 'c1', started_at: '2026-08-01T10:00:00Z', completed_at: '2026-08-01T11:00:00Z' },
  ]
  const client = {
    from(table) {
      if (table === 'sub_workouts') {
        const query = {
          select() { return query },
          eq() { return query },
          order(column, options) { calls.orders.push({ column, options }); return query },
          async range(from, to) { calls.ranges.push([from, to]); return { data: workouts, error: null } },
        }
        return query
      }
      assert.equal(table, 'sub_workout_sets')
      const query = {
        select() { return query },
        eq() { return query },
        async in(column, ids) {
          assert.equal(column, 'workout_id')
          calls.workoutIds = ids
          return { data: [], error: null }
        },
      }
      return query
    },
  }

  const result = await loadRemoteHistory(client, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  assert.deepEqual(calls.orders, [
    { column: 'started_at', options: { ascending: true } },
    { column: 'id', options: { ascending: true } },
  ])
  assert.deepEqual(calls.ranges, [[0, 99]])
  assert.equal(PILOT_REMOTE_HISTORY_LIMIT, 2080)
  assert.deepEqual(calls.workoutIds, ['w1', 'w2', 'w3'])
  assert.deepEqual(result.map(session => session.clientId), ['c1', 'c2', 'c3'])
})

test('remote recovery-grundlag fortsætter efter første side og henter sæt i afgrænsede batches', async () => {
  const workouts = Array.from({ length: 105 }, (_, index) => ({
    id: `w-${String(index).padStart(3, '0')}`,
    client_id: `c-${String(index).padStart(3, '0')}`,
    assignment_id: 'assignment-1',
    program_id: 'program-1',
    day_id: index % 2 === 0 ? 'a' : 'b',
    started_at: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    completed_at: new Date(Date.UTC(2026, 0, 1, index, 30)).toISOString(),
  }))
  const ranges = []
  const setBatchSizes = []
  const client = {
    from(table) {
      if (table === 'sub_workouts') {
        const query = {
          select() { return query },
          eq() { return query },
          order() { return query },
          async range(from, to) {
            ranges.push([from, to])
            return { data: workouts.slice(from, to + 1), error: null }
          },
        }
        return query
      }
      const query = {
        select() { return query },
        eq() { return query },
        async in(_column, ids) {
          setBatchSizes.push(ids.length)
          return { data: [], error: null }
        },
      }
      return query
    },
  }

  const result = await loadRemoteHistory(client, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
    assignmentId: 'assignment-1',
    programId: 'program-1',
  })
  assert.equal(result.length, 105)
  assert.deepEqual(ranges, [[0, 99], [100, 199]])
  assert.deepEqual(setBatchSizes, [100, 5])
})

test('synk bruger kun den atomiske, ejerbundne workout-RPC', async () => {
  const localStorage = new MemoryStorage()
  globalThis.window = { localStorage }
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push({ name, args })
      return { data: 'w1', error: null }
    },
  }
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const assignment = { id: 'a1', program_id: 'p1' }
  const session = { clientId: 'stable-client-id', programId: 'p1', dayId: 'a', startedAt: '2026-08-01T10:00:00Z', completedAt: '2026-08-01T11:00:00Z', entries: [{ exerciseId: 'squat', sets: [{ reps: 5, weightKg: 100, rpe: 8, loggedAt: 'x' }] }] }
  session.entries[0].sets[0].loggedAt = '2026-08-01T10:30:00Z'
  enqueuePilotSession(userId, session)
  assert.equal((await syncOneSession(client, userId, assignment, session)).ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'sub_persist_completed_workout_v1')
  assert.equal(calls[0].args.p_client_id, 'stable-client-id')
  assert.equal(calls[0].args.p_sets[0].set_index, 1)
  assert.equal('user_id' in calls[0].args, false)
  assert.equal('program_id' in calls[0].args, false)
  assert.equal(loadPilotOutbox(userId).length, 0)
  delete globalThis.window
})

test('workout-RPC payload fejler lukket ved assignment-mismatch eller ugyldigt sæt', () => {
  const assignment = { id: 'a1', program_id: 'p1' }
  const valid = { assignmentId: 'a1', clientId: 'c1', programId: 'p1', dayId: 'a', startedAt: '2026-08-01T10:00:00Z', completedAt: '2026-08-01T11:00:00Z', entries: [{ exerciseId: 'squat', sets: [{ reps: 5, weightKg: 100, rpe: 8, loggedAt: '2026-08-01T10:30:00Z' }] }] }
  assert.equal(workoutRpcArgs(assignment, valid).p_sets.length, 1)
  assert.throws(() => workoutRpcArgs(assignment, { ...valid, assignmentId: 'other' }), /aktive programtildeling/)
  assert.throws(() => workoutRpcArgs(assignment, { ...valid, programId: 'other' }), /programversion/)
  assert.throws(() => workoutRpcArgs(assignment, { ...valid, entries: [] }), /mindst ét sæt/)
  assert.throws(() => workoutRpcArgs(assignment, { ...valid, entries: [{ exerciseId: 'squat', sets: [{ reps: 5.5, weightKg: 100, rpe: 8 }] }] }), /Reps/)
})

test('subscription-klienten importerer ikke 1:1-klienten og entry har noindex uden service worker', async () => {
  const clientSource = await readFile(new URL('../supabaseClient.js', import.meta.url), 'utf8')
  const authSource = await readFile(new URL('../auth.jsx', import.meta.url), 'utf8')
  const mainSource = await readFile(new URL('../main.jsx', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../PilotSubscriptionApp.jsx', import.meta.url), 'utf8')
  const html = await readFile(new URL('../../../subscription.html', import.meta.url), 'utf8')
  assert.doesNotMatch(clientSource, /\.\.\/supabase\.js/)
  assert.match(clientSource, /storageKey: config\.storageKey/)
  assert.match(clientSource, /detectSessionInUrl: true/)
  assert.match(authSource, /signInWithPassword/)
  assert.match(authSource, /<Button type="submit" disabled=\{busy\}>/)
  assert.match(authSource, /finally\s*\{\s*setBusy\(false\)/)
  assert.match(authSource, /window\.location\.assign\(actionLink\)/)
  assert.match(authSource, /<Button type="button" disabled=\{opening\}/)
  assert.doesNotMatch(authSource, /<a[^>]+href=\{?actionLink/)
  const handoffCaptureIndex = mainSource.indexOf('captureMagicLinkHandoff()')
  const clientCreationIndex = mainSource.indexOf('createSubscriptionClient()')
  assert.ok(handoffCaptureIndex >= 0 && clientCreationIndex > handoffCaptureIndex)
  assert.match(authSource, /signOut/)
  // Kontooprettelse er åbnet 6. august — appen skal være selvkørende. Men
  // magic-link må stadig aldrig oprette en konto som sidegevinst, og
  // oprettelsen må ikke røbe hvilke mails der findes.
  assert.match(authSource, /signUp/)
  assert.match(authSource, /signUpRevealsExistingAccount/)
  assert.match(authSource, /shouldCreateUser: false/)
  // Nulstilling er derimod påkrævet. Den kan kun ramme en konto der allerede
  // findes, og er den eneste selvbetjente vej til en adgangskode — som igen er
  // den eneste vej ind i en app på hjemmeskærmen, hvor mail-links ikke virker.
  assert.match(authSource, /resetPasswordForEmail/)
  assert.match(authSource, /updateUser\(\{ password \}\)/)
  assert.doesNotMatch(mainSource, /from ['"]\.\.\/appUpdate|navigator\.serviceWorker/)
  assert.match(appSource, /setupFailureDiagnostic\(input\.requestId, error\)/)
  assert.match(appSource, /\$\{friendly\.message\} Ref\. \$\{diagnostic\.label\}/)
  assert.doesNotMatch(appSource, /\{ cause: error \}/)
  assert.match(html, /noindex/)
  assert.doesNotMatch(html, /manifest\.webmanifest|navigator\.serviceWorker/)
})

test('setup RPC retries interrupted Instagram transport with the same idempotent request', async () => {
  const input = {
    requestId: '22222222-2222-4222-8222-222222222222',
    matchInput: { schemaVersion: 4, goal: 'general-strength', level: 'begynder', daysPerWeek: 3, equipment: 'gym', squatStyle: 'high-bar', deadliftStyle: 'conventional' },
    baselineLoads: { squat: { weightKg: 60, reps: 5, rpe: 8 }, bench: { weightKg: 40, reps: 5, rpe: 8 }, deadlift: { weightKg: 80, reps: 5, rpe: 8 } },
  }
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push({ name, args })
      if (calls.length === 1) return { data: null, error: { message: 'Load failed' } }
      return { data: [{ assignment_id: 'a2', program_id: 'p2', created: true }], error: null }
    },
  }
  const result = await completeMyProgramSetup(client, input, {
    delays: [10],
    wait: async () => {},
  })
  assert.equal(result.assignment_id, 'a2')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].name, 'sub_complete_my_program_setup_v1')
  assert.deepEqual(calls[0].args, calls[1].args)
})
