// Ordre 2118: en kostklient (kostpakke, ingen uge, ingen løftehistorik) ser ingen løfte- eller programtekst i Fremgang
// og får Åbn kost i stedet for Åbn program. Atleter med program eller løftehistorik er uændrede. Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Analysis from './Analysis.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const base = extra => ({ entropi2: true, now, athlete: { id: 'synthetic-k', kostPakke: true }, currentWeek: null, exerciseLogs: [], fremgangLogs: [],
  historicalMealLogs: [], weightLogs: [{ athlete_id: 'synthetic-k', logged_at: '2026-11-03', weight: 80 }], setTab: () => {}, ...extra })
const html = p => renderToStaticMarkup(h(Analysis, p))
const TRAENING = /gentagelser i programmet|styrke på vej|Blok for blok|Åbn program|Om datagrundlaget/

test('kostklient: ingen løfte- eller programtekst, Åbn kost som vej videre', () => {
  const r = html(base())
  assert.doesNotMatch(r, TRAENING)
  assert.match(r, /data-analysis-destination="kost"/)
  assert.match(r, />Åbn kost</)
  assert.match(r, /Din analyse/)
})

test('kostklient mens historikken hentes: samme visning, ingen blink af løftetekst', () => {
  const r = html(base({ fremgangLoading: true, exerciseLogsLoading: true }))
  assert.doesNotMatch(r, TRAENING)
})

test('atlet med kostpakke og program er uændret', () => {
  const r = html(base({ currentWeek: { start_date: '2026-11-02', sessions: [] } }))
  assert.match(r, /Din udvikling/)
  assert.match(r, /Åbn program/)
  assert.doesNotMatch(r, /data-analysis-destination="kost"/)
})

test('atlet med kostpakke uden uge, men med løftehistorik, er uændret', () => {
  const r = html(base({ exerciseLogs: [{ exercise_id: 'e', set_number: 1, logged_at: '2026-11-03T10:00:00Z', weight: 80, reps_completed: 3 }] }))
  assert.match(r, /Din udvikling/)
  assert.doesNotMatch(r, /data-analysis-destination="kost"/)
})

test('atlet uden kostpakke og uden program er uændret', () => {
  const r = html(base({ athlete: { id: 'synthetic-t' } }))
  assert.match(r, /Din udvikling/)
  assert.match(r, /Åbn program/)
})
