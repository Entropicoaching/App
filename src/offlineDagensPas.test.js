// ORDRE 397 — de rene dele af "Dagens pas uden net" (docs/OFFLINE-PAS.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  saveOfflineSet, loadOfflineSets, countOfflineSets, clearOfflineSetIfSame, newSetClientId,
  orderedOfflineSets, pendingSetKeys, parkOfflineSet, loadParkedSets, overlayQueuedSets, queuedPayloadWithTime, noteOfflineSetFailure,
} from './offlineSetQueue.js'
import { saveOfflineSnapshot, loadOfflineSnapshot, snapshotLogsForWeek, clearOfflineSnapshots } from './athlete/offlineSnapshot.js'
import { readStoredSession, offlineAthleteSession, withSlowNetCutoff, seemsOffline, markNetworkSuccess, SLOW_NET_MS } from './offlineSession.js'
import { athleteAuthErrorMessage, NO_CONNECTION_MESSAGE } from './athleteOnboarding.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size },
  }
}

test('newSetClientId giver et UUID v4, også uden crypto.randomUUID', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  assert.match(newSetClientId(), re)
  assert.match(newSetClientId({ getRandomValues: (b) => b.fill(7) }), re)
  assert.notEqual(newSetClientId(), newSetClientId())
})

test('en "ret" beholder sættets række-id og plads i rækkefølgen', () => {
  const st = fakeStorage()
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 80 }, clientId: 'id-1' }, st)
  saveOfflineSet('a', 'e_2', { exerciseId: 'e', setNumber: 2, payload: { weight: 80 }, clientId: 'id-2' }, st)
  const firstAt = loadOfflineSets('a', st).e_1.queuedAt
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 85 } }, st)
  const q = loadOfflineSets('a', st)
  assert.equal(q.e_1.clientId, 'id-1')
  assert.equal(q.e_1.queuedAt, firstAt)
  assert.equal(q.e_1.payload.weight, 85)
  assert.deepEqual(orderedOfflineSets('a', st).map(([k]) => k), ['e_1', 'e_2'])
})

test('clearOfflineSetIfSame fjerner kun den post der blev sendt', () => {
  const st = fakeStorage()
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 80 } }, st)
  // Atleten retter, mens afsendelsen af 80 er undervejs.
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 85 } }, st)
  clearOfflineSetIfSame('a', 'e_1', { payload: { weight: 80 } }, st)
  assert.equal(countOfflineSets('a', st), 1)
  clearOfflineSetIfSame('a', 'e_1', { payload: { weight: 85 } }, st)
  assert.equal(countOfflineSets('a', st), 0)
})

test('en ventende sletning tæller ikke som et ventende sæt', () => {
  const st = fakeStorage()
  saveOfflineSet('a', 'e_1', { op: 'delete', exerciseId: 'e', setNumber: 1, clientId: 'x', payload: null }, st)
  saveOfflineSet('a', 'e_2', { exerciseId: 'e', setNumber: 2, payload: { weight: 80 } }, st)
  assert.equal(countOfflineSets('a', st), 1)
  assert.deepEqual(pendingSetKeys('a', st), ['e_2'])
})

test('parkerede sæt forlader køen, men forsvinder ikke', () => {
  const st = fakeStorage()
  const entry = { exerciseId: 'e', setNumber: 1, payload: { weight: 80, reps_completed: 5 }, exerciseName: 'Squat' }
  saveOfflineSet('a', 'e_1', entry, st)
  assert.equal(parkOfflineSet('a', 'e_1', loadOfflineSets('a', st).e_1, '23503', st), true)
  assert.equal(countOfflineSets('a', st), 0)
  const parked = loadParkedSets('a', st)
  assert.equal(parked.e_1.reason, '23503')
  assert.equal(parked.e_1.payload.weight, 80)
})

test('overlayQueuedSets: ventende værdi vinder, manglende vises optimistisk, sletning skjuler', () => {
  const rows = [
    { id: 'r1', exercise_id: 'e', set_number: 1, weight: 80, reps_completed: 5 },
    { id: 'r2', exercise_id: 'e', set_number: 2, weight: 80, reps_completed: 5 },
  ]
  const queue = {
    e_1: { exerciseId: 'e', setNumber: 1, payload: { weight: 85, reps_completed: 5 } },
    e_2: { op: 'delete', exerciseId: 'e', setNumber: 2, clientId: 'r2' },
    e_3: { exerciseId: 'e', setNumber: 3, payload: { weight: 82.5, reps_completed: 4 } },
  }
  const out = overlayQueuedSets(rows, queue, 'a')
  assert.equal(out.length, 2)
  assert.equal(out.find(l => l.set_number === 1).weight, 85)
  assert.equal(out.find(l => l.set_number === 1).id, 'r1')
  const third = out.find(l => l.set_number === 3)
  assert.equal(third._optimistic, true)
  assert.equal(third.athlete_id, 'a')
  assert.equal(rows[0].weight, 80, 'input muteres ikke')
})

test('øjebliksbillede: uge og logs hører sammen; ny uge nulstiller logs', () => {
  const st = fakeStorage()
  saveOfflineSnapshot('u', { athlete: { id: 'a' } }, st, 1)
  saveOfflineSnapshot('u', { week: { id: 'w1' } }, st, 2)
  saveOfflineSnapshot('u', { logs: [{ id: 'l' }], logsWeekId: 'w1' }, st, 3)
  let snap = loadOfflineSnapshot('u', st)
  assert.equal(snap.athlete.id, 'a')
  assert.equal(snap.savedAt, 3)
  assert.equal(snapshotLogsForWeek(snap).length, 1)
  saveOfflineSnapshot('u', { week: { id: 'w1', sessions: [] } }, st, 4)
  assert.equal(snapshotLogsForWeek(loadOfflineSnapshot('u', st)).length, 1, 'samme uge beholder logs')
  saveOfflineSnapshot('u', { week: { id: 'w2' } }, st, 5)
  snap = loadOfflineSnapshot('u', st)
  assert.equal(snapshotLogsForWeek(snap).length, 0)
  assert.equal(loadOfflineSnapshot('anden', st), null)
})

test('clearOfflineSnapshots rydder kun øjebliksbilleder, ikke køen', () => {
  const st = fakeStorage()
  saveOfflineSnapshot('u', { athlete: { id: 'a' } }, st)
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: {} }, st)
  clearOfflineSnapshots(st)
  assert.equal(loadOfflineSnapshot('u', st), null)
  assert.equal(countOfflineSets('a', st), 1)
})

test('offlineAthleteSession: kun gemt session + rollehukommelse "athlete"', () => {
  const session = { access_token: 't', refresh_token: 'r', user: { id: 'u1' } }
  const tokenKey = 'sb-proj-auth-token'
  assert.equal(offlineAthleteSession(fakeStorage()), null)
  assert.equal(readStoredSession(fakeStorage({ [tokenKey]: JSON.stringify(session) })).user.id, 'u1')
  assert.equal(offlineAthleteSession(fakeStorage({ [tokenKey]: JSON.stringify(session) })), null, 'ukendt rolle')
  assert.equal(offlineAthleteSession(fakeStorage({ [tokenKey]: JSON.stringify(session), entropi_role_guess_u1: 'coach' })), null)
  assert.equal(offlineAthleteSession(fakeStorage({ [tokenKey]: JSON.stringify(session), entropi_role_guess_u1: 'athlete' })).user.id, 'u1')
  assert.equal(offlineAthleteSession(fakeStorage({ [tokenKey]: 'ikke json', entropi_role_guess_u1: 'athlete' })), null)
  assert.equal(offlineAthleteSession(fakeStorage({ [tokenKey]: JSON.stringify({ user: { id: 'u1' } }), entropi_role_guess_u1: 'athlete' })), null, 'uden refresh-token')
})

// ORDRE 401 — sættets tid er "Godkendt", ikke afsendelsen.
test('queuedPayloadWithTime: medsendt logged_at bevares; ældre køposter får køtiden', () => {
  const st = fakeStorage()
  const godkendt = '2026-09-26T15:10:00.000Z'
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 80, logged_at: godkendt } }, st)
  // En "ret" 80 min. senere sender samme tid med (updateLoggedSet).
  saveOfflineSet('a', 'e_1', { exerciseId: 'e', setNumber: 1, payload: { weight: 85, logged_at: godkendt } }, st)
  assert.equal(queuedPayloadWithTime(loadOfflineSets('a', st).e_1).logged_at, godkendt)
  const gammel = { exerciseId: 'e', setNumber: 2, payload: { weight: 80 }, queuedAt: Date.parse('2026-09-26T15:13:00.000Z') }
  assert.equal(queuedPayloadWithTime(gammel).logged_at, '2026-09-26T15:13:00.000Z')
  assert.equal(gammel.payload.logged_at, undefined, 'køposten muteres ikke')
  assert.equal(queuedPayloadWithTime({ op: 'delete', payload: null }), null)
})

test('overlayQueuedSets: et ventende sæt viser sin egen tid, ikke nu', () => {
  const queue = { e_1: { exerciseId: 'e', setNumber: 1, payload: { weight: 80, logged_at: '2026-09-26T15:10:00.000Z' } } }
  assert.equal(overlayQueuedSets([], queue, 'a')[0].logged_at, '2026-09-26T15:10:00.000Z')
})

// ORDRE 401 — wifi uden internet: et kald der hænger, regnes som offline.
test('withSlowNetCutoff: et hængende kald giver SLOW_NET og markerer nettet dødt', async () => {
  markNetworkSuccess()
  assert.equal(SLOW_NET_MS, 8000)
  const haenger = new Promise(() => {})
  const t0 = Date.now()
  const res = await withSlowNetCutoff(haenger, 50)
  assert.equal(res.error.code, 'SLOW_NET')
  assert.ok(Date.now() - t0 < 1000)
  assert.equal(seemsOffline(), true)
  markNetworkSuccess()
  assert.equal(seemsOffline(), false)
})

test('withSlowNetCutoff: et hurtigt svar går igennem uændret og rører ikke nettets tilstand', async () => {
  markNetworkSuccess()
  const svar = { data: { id: 'x' }, error: null }
  assert.deepEqual(await withSlowNetCutoff(Promise.resolve(svar), 50), svar)
  const thenable = { then: (ok) => ok({ data: [], error: null }) }
  assert.deepEqual(await withSlowNetCutoff(thenable, 50), { data: [], error: null })
  await new Promise(r => setTimeout(r, 80))
  assert.equal(seemsOffline(), false, 'timeren er ryddet')
})

// ORDRE 406 (O6 i docs/kritik-403)
test('noteOfflineSetFailure tæller afviste forsøg, melder ny fejlkode én gang og starter forfra ved et nyt "Godkendt"', () => {
  const st = fakeStorage()
  const entry = { exerciseId: 'e', setNumber: 1, payload: { weight: 80 }, clientId: 'c' }
  saveOfflineSet('a', 'e_1', entry, st)
  const sendt = loadOfflineSets('a', st).e_1
  assert.deepEqual(noteOfflineSetFailure('a', 'e_1', sendt, '42501', {}, st), { failures: 1, newCode: true })
  assert.deepEqual(noteOfflineSetFailure('a', 'e_1', sendt, '42501', {}, st), { failures: 2, newCode: false })
  assert.deepEqual(noteOfflineSetFailure('a', 'e_1', sendt, 'ukendt', { count: false }, st), { failures: 2, newCode: true })
  assert.equal(loadOfflineSets('a', st).e_1.clientId, 'c', 'posten er stadig i køen med sit række-id')
  saveOfflineSet('a', 'e_1', { ...entry, payload: { weight: 82.5 } }, st)
  assert.deepEqual(noteOfflineSetFailure('a', 'e_1', sendt, '42501', {}, st), { failures: 0, newCode: false }, 'en rettet post tælles ikke med den gamles fejl')
  assert.equal(loadOfflineSets('a', st).e_1.failures, undefined)
})

// ORDRE 406 (O3 i docs/kritik-403)
test('login uden net siger "Ingen forbindelse", ikke "tjek oplysningerne"', () => {
  assert.equal(athleteAuthErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), NO_CONNECTION_MESSAGE)
  assert.equal(athleteAuthErrorMessage({ message: 'Load failed' }), NO_CONNECTION_MESSAGE)
  assert.equal(athleteAuthErrorMessage({ message: 'Invalid login credentials', status: 400 }), 'Email eller adgangskode er forkert.')
})
