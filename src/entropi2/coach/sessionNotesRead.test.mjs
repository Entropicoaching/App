import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptCoachState } from './coachModel.mjs'
import { loadSessionNotes, SESSION_NOTES_LIMIT } from './sessionNotesRead.mjs'
import { notesModel, SessionNotesView } from './SessionNotesView.mjs'

// K-R3-ENTROPI-SAMLET fund 2: vaelgeren skal faa den valgte atlets logs.
const today = '2026-11-03'
const row = { id: 'log-a', athlete_id: 'synthetic-a', logged_at: today + 'T10:00:00Z', exercise_id: 'e', set_number: 1,
  note: 'Smerte i knæet, stoppede', exercises: { name: 'Squat', session_id: 's', sessions: { id: 's', title: 'Syntetisk pas' } } }
const props = () => ({ session: { user: { id: 'synthetic-coach' } },
  readContext: { coachId: 'synthetic-coach', day: today, athleteIds: ['synthetic-a'] },
  athletes: [{ id: 'synthetic-a', name: 'Syntetisk atlet A' }], loading: false, loadError: false })
const fakeClient = reply => {
  const calls = []
  const q = { select() { return q }, eq(k, v) { calls.push([k, v]); return q }, gte() { return q }, order() { return q },
    limit() { return Promise.resolve(reply) } }
  return { calls, from(table) { calls.push(['from', table]); return q } }
}

test('loadSessionNotes laeser netop den valgte atlet og markerer fuldstaendighed', async () => {
  const c = fakeClient({ data: [row], error: null })
  const r = await loadSessionNotes(c, 'synthetic-a', Date.parse(today + 'T12:00:00Z'))
  assert.equal(r.state, 'loaded')
  assert.deepEqual(c.calls.slice(0, 2), [['from', 'exercise_logs'], ['athlete_id', 'synthetic-a']])
  assert.deepEqual(r.logs.readEvidence, { athleteId: 'synthetic-a', complete: true })
  const full = await loadSessionNotes(fakeClient({ data: Array(SESSION_NOTES_LIMIT).fill(row), error: null }), 'synthetic-a')
  assert.equal(full.logs.readEvidence.complete, false)
})

test('loadSessionNotes giver fejl ved databasefejl, manglende klient eller kastet fejl', async () => {
  assert.equal((await loadSessionNotes(fakeClient({ data: null, error: { code: '42501' } }), 'synthetic-a')).state, 'error')
  assert.equal((await loadSessionNotes(null, 'synthetic-a')).state, 'error')
  assert.equal((await loadSessionNotes({ from() { throw Error('net') } }, 'synthetic-a')).state, 'error')
})

test('med laeste logs viser vaelgeren smerte- og stopnoten; foer var den ukendt', () => {
  const p = props(), context = adaptCoachState(p, today)
  const logs = Object.assign([row], { readEvidence: { athleteId: 'synthetic-a', complete: true } })
  const m = notesModel(p, context, 'synthetic-a', { athleteId: 'synthetic-a', state: 'loaded', logs })
  assert.equal(m.state, 'loaded')
  assert.deepEqual(m.entries[0].notes[0].marks, ['Smerte nævnt', 'Stop nævnt'])
  // Uden egen laesning (den gamle kontrakt uden athleteLogs) er grundlaget ukendt.
  assert.equal(notesModel(p, context, 'synthetic-a', null).state, 'unknown')
})

test('indlaesning, fejl og et forældet svar for en anden atlet vises ærligt', () => {
  const p = props(), context = adaptCoachState(p, today)
  assert.equal(notesModel(p, context, 'synthetic-a', { athleteId: 'synthetic-a', state: 'loading', logs: null }).state, 'loading')
  assert.equal(notesModel(p, context, 'synthetic-a', { athleteId: 'synthetic-a', state: 'error', logs: null }).state, 'error')
  assert.equal(notesModel(p, context, 'synthetic-a', { athleteId: 'synthetic-b', state: 'loaded', logs: [row] }).state, 'loading')
  const view = SessionNotesView({ model: { state: 'error', athlete: { id: 'synthetic-a' }, entries: [] },
    athletes: p.athletes, onSelect() {}, onRetry() {} })
  assert.match(JSON.stringify(view, (k, v) => typeof v === 'function' ? undefined : v), /kunne ikke hentes/)
})

test('Dashboard giver coachskaermen klienten til pasnoterne', () => {
  const src = readFileSync(new URL('../../Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(src, /<CoachScreen enabled=\{true\}[\s\S]*?notesClient=\{supabase\}[\s\S]*?\/>/)
})
