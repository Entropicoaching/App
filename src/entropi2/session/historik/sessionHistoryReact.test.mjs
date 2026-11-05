import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ExerciseHistoryView from './ExerciseHistoryView.mjs'
import { sessionHistoryProps } from './exerciseHistoryDom.mjs'

// Real React, using the exact session adapter and shared production content.
const ex = { id: 'lift', name: 'Løft' }, now = Date.parse('2026-11-04T12:00:00Z')
const row = { id: 'old', athlete_id: 'synthetic-a', exercise_id: 'lift', set_number: 20,
  weight: 80, reps_completed: 5, rpe_actual: 8, logged_at: '2026-10-28T10:00:00Z' }
const render = extra => renderToStaticMarkup(h(ExerciseHistoryView,
  sessionHistoryProps({ athleteId: 'synthetic-a', exerciseLogs: [], ...extra }, ex, now)))

test('session adapter renders actual React history, empty, error and loading', () => {
  assert.match(render({ exerciseLogs: [row] }), /80 kg × 5 @ RPE 8/)
  assert.match(render({ exerciseLogs: [row] }), /Estimeret 1RM/)
  assert.equal(render(), '')
  const error = render({ exerciseLogs: [row], exerciseLogsError: Error('RAW ERROR') })
  assert.match(error, /role="alert"/); assert.doesNotMatch(error, /80 kg|RAW ERROR|<svg/)
  const loading = render({ exerciseLogs: [row], exerciseLogsLoading: true })
  assert.match(loading, /Historikken hentes/); assert.doesNotMatch(loading, /80 kg|<svg|Ingen bekræftede/)
})

test('session adapter forwards exact identity, pending and parked protection to actual React', () => {
  for (const extra of [{ athleteId: 'synthetic-b' }, { pendingSyncKeys: ['lift_20'] },
    { parkedSets: [{ exerciseId: 'lift', setNumber: 20 }] }]) {
    const html = render({ exerciseLogs: [row], ...extra })
    assert.equal(html, '')
  }
})
