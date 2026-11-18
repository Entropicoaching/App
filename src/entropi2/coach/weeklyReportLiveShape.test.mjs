import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { weeklyReportModel } from './weeklyReportModel.mjs'

// Ordre 1696: coachens Ugerapport faar sine log-raekker fra select-strengen i
// src/dashboard/laesninger.js. exercise_logs -> exercises og exercises ->
// sessions er begge mange-til-en, saa PostgREST returnerer indlejrede OBJEKTER.
const today = '2026-11-18'
const source = await readFile(new URL('../../dashboard/laesninger.js', import.meta.url), 'utf8')
const select = source.match(/\.from\('exercise_logs'\)\s*\.select\('([^']*)'\)\s*\.in\('athlete_id', athleteIds\)/)?.[1] ?? ''

// Raekker i den form PostgREST returnerer for den select-streng, der sendes.
function postgrestRows() {
  const row = { athlete_id: 'p', logged_at: '2026-11-18T08:00:00Z' }
  if (/exercises\(sessions\(id\)\)/.test(select)) row.exercises = { sessions: { id: 's1' } }
  return [row]
}
const props = rows => ({ session: { user: { id: 'synthetic-owner' } },
  readContext: { coachId: 'synthetic-owner', day: today, athleteIds: ['p'] },
  athletes: [{ id: 'p', name: 'Syntetisk Atlet P' }], loading: false, loadError: false,
  calendarWeeks: { p: [{ start_date: '2026-11-16', session_count: 1, exercise_count: 3 }] },
  coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day: today, ids: ['p'], rows } } })

test('aktivitetslaesningens select findes i laesninger.js', () => {
  assert.match(select, /^athlete_id, logged_at/)
})

test('Atlet P med ét planlagt pas og en log i dag faar logget 1 af 1', () => {
  const t = weeklyReportModel(props(postgrestRows()), today).rows[0].training
  assert.equal(t.planned, 1)
  assert.equal(t.completed, 1)
})
