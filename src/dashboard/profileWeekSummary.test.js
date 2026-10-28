import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { effects, requests, respond, nodes, text, parseDashboard } from './profileWeekHarness.mjs'
const { ProfileWeekSummary, profileWeekLines, profileWeekFlag } = await import('./profileWeekSummary.mjs')
const { reduceFourWeekRead, readFourWeekSource } = await import('./coachFourWeeks.mjs')
const { useDashboardEffekter } = await import('./useDashboardEffekter.js')
const { lavLaesninger } = await import('./laesninger.js')
const day = '2026-10-28'
const athleteId = 'synthetic-a'
const log = (weight = 100, extra = {}) => ({ athlete_id: athleteId, exercise_id: 'ex', set_number: 1, logged_at: day, weight, reps_completed: 5, exercises: { name: 'Squat' }, ...extra })
function fixture(overrides = {}) {
  const rows = { weeks: [{ athlete_id: athleteId, start_date: '2026-10-26', sessions: [{ id: 's', exercises: [{ id: 'ex', sets: 1 }] }] }], logs: [log()], messages: [{ athlete_id: athleteId, sender_role: 'athlete', created_at: day, content: 'Godt pas' }], videos: [] , ...overrides }
  return Object.fromEntries(Object.entries(rows).map(([kind, rows]) => [kind, { athleteId, status: 'ready', rows }]))
}
const model = reads => profileWeekLines({ athleteId, reads, today: day })
test('default OFF and exact explicit flag, no input access', () => {
  assert.equal(ProfileWeekSummary({ reads: new Proxy({}, { get() { throw Error('OFF read') } }) }), null)
  for (const value of ['', '?rel1030=1', '?coachProfilUge=0', '?coachProfilUge=true', '?coachProfilUge=1&coachProfilUge=1']) assert.equal(profileWeekFlag(value), false)
  assert.equal(profileWeekFlag('?coachProfilUge=1'), true)
  assert.equal(ProfileWeekSummary({ enabled: '1' }), null)
})
test('full week has exactly three visible lines and existing heaviest-set tie rule', () => {
  const reads = fixture({ logs: [log(90), log(100), log(100, { reps_completed: 6 })] })
  const tree = ProfileWeekSummary({ enabled: true, athleteId, reads, today: day })
  assert.equal(nodes(tree).filter(n => n.type === 'p').length, 3)
  assert.match(text(tree), /1 af 1 gennemført/)
  assert.match(text(tree), /Squat 100 kg × 6/)
  assert.match(text(tree), /Godt pas/)
})
test('empty week and no messages have honest empty states', () => {
  const lines = model(fixture({ logs: [], messages: [] })).lines
  assert.match(lines[0], /0 af 1/)
  assert.match(lines[1], /Ingen gennemførte/)
  assert.match(lines[2], /Ingen besked eller video/)
  assert.match(model(fixture({ weeks: [] })).lines[0], /Ingen dateret plan/)
})
test('latest athlete video wins over message; coach replies and other athletes excluded', () => {
  const reads = fixture({ videos: [
    { athlete_id: athleteId, created_at: day + 'T10:00:00Z', source_mode: 'athlete_submission', lift: 'Dødløft' },
    { athlete_id: 'other', created_at: day + 'T12:00:00Z', source_mode: 'athlete_submission', lift: 'PRIVATE' },
    { athlete_id: athleteId, created_at: day + 'T13:00:00Z', source_mode: 'coach_recording', lift: 'COACH' },
  ], messages: [{ athlete_id: athleteId, sender_role: 'coach', created_at: day, content: 'COACH REPLY' }] })
  assert.match(model(reads).lines[2], /Video: Dødløft/)
  assert.doesNotMatch(model(reads).lines.join(' '), /PRIVATE|COACH/)
})
test('old, future, skipped and partial sessions cannot become completed or best', () => {
  const lines = model(fixture({ logs: [log(999, { skipped: true }), log(998, { logged_at: '2026-10-25' }), log(997, { logged_at: '2026-11-01' })] })).lines
  assert.match(lines[0], /0 af 1/)
  assert.match(lines[1], /Ingen gennemførte/)
})
test('profile switch, loading, error and truncated data never become zero success', () => {
  const reads = fixture()
  reads.logs.athleteId = 'other'
  assert.match(model(reads).lines[0], /Indlæser/)
  reads.logs = { athleteId, status: 'error', rows: [] }
  assert.match(model(reads).lines[1], /Kunne ikke/)
  reads.logs = { athleteId, status: 'ready', rows: Array(2000).fill(log()) }
  assert.match(model(reads).lines[1], /Ufuldstændigt/)
})
test('token reducer rejects stale completion and scopes results per athlete', () => {
  const first = Symbol(), second = Symbol()
  let state = reduceFourWeekRead({}, { athleteId, kind: 'logs', token: first, status: 'loading' })
  state = reduceFourWeekRead(state, { athleteId, kind: 'logs', token: second, status: 'loading' })
  assert.equal(reduceFourWeekRead(state, { athleteId, kind: 'logs', token: first, status: 'ready', rows: [log(999)] }), state)
})
test('real message reader observes exact scoped result without writes and exposes errors', async () => {
  const events = [], messages = [], errors = []
  const reader = lavLaesninger({ profileWeekCapture: e => events.push(e), messageThreadAthleteRef: { current: athleteId }, setMessages: rows => messages.push(rows), setMessageThreadError: error => errors.push(error) })
  requests.length = 0
  respond({ data: fixture().messages.rows, error: null })
  await reader.fetchMessages(athleteId)
  assert.deepEqual(events.map(e => e.status), ['loading', 'ready'])
  assert.equal(messages[0][0].athlete_id, athleteId)
  assert.ok(requests.some(r => r[0] === 'eq' && r[1] === 'athlete_id' && r[2] === athleteId))
  assert.ok(!requests.some(r => ['update', 'insert', 'delete', 'upsert'].includes(r[0])))
  respond({ data: null, error: Error('synthetic failure') })
  await reader.fetchMessages(athleteId)
  assert.equal(events.at(-1).status, 'error')
  assert.ok(errors.at(-1))
})
function runProfileEffects(enabled, activeTab = 'hub') {
  effects.length = 0
  const calls = []
  const props = new Proxy({ coachProfileWeek: enabled, activeTab, selectedAthlete: { id: athleteId }, athletes: [], snoozeMigratedRef: { current: true }, weeksLogsLoadedForRef: { current: null }, videoReviewOpenedRef: {}, view: 'profile' }, { get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]) } })
  useDashboardEffekter(props)
  // Actual plan/log, message and video effects. Unrelated browser effects never run.
  for (const index of [3, 5, 7]) effects[index].fn()
  return calls.map(c => c[0])
}
test('real effects fetch shared data only on opt-in and never mark messages read on hub', () => {
  assert.deepEqual(runProfileEffects(false), ['fetchVideoCoachHistory'])
  assert.deepEqual(runProfileEffects(true), ['fetchWeeks', 'fetchAthleteLogs', 'fetchMessages', 'fetchVideoCoachHistory'])
  assert.ok(runProfileEffects(true, 'beskeder').includes('markMessagesRead'))
})
test('exact final Dashboard JSX parses and summary precedes existing profile actions', () => {
  const flat = new URL('./Dashboard.jsx', import.meta.url)
  const source = readFileSync(existsSync(flat) ? flat : new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  const transformed = parseDashboard(source).replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*;?/gm, '').replace('export default function', 'function')
  assert.doesNotThrow(() => new Function(transformed))
  assert.ok(source.indexOf('<ProfileWeekSummary ') < source.indexOf('<ProfilHoved '))
  assert.match(source, /profileWeekCapture: coachProfileWeek \? fourWeekCapture : undefined/)
})
