import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ExerciseHistoryView from './ExerciseHistoryView.mjs'

const props = (extra = {}) => ({ enabled: true, athleteId: 'synthetic-a', exerciseId: 'exercise-a',
  exerciseName: 'Squat', now: Date.parse('2026-11-04T12:00:00Z'), logs: [], ...extra })
const row = (extra = {}) => ({ id: 'set-a', athlete_id: 'synthetic-a', exercise_id: 'exercise-a',
  set_number: 1, logged_at: '2026-10-28T10:00:00Z', weight: 80, reps_completed: 5, rpe_actual: 8, ...extra })
const render = extra => renderToStaticMarkup(h(ExerciseHistoryView, props(extra)))

test('actual React renders set, date, estimate and collapsed explanation', () => {
  const html = render({ logs: [row(), row({ id: 'set-b', logged_at: '2026-11-03T10:00:00Z', weight: 85 })] })
  assert.match(html, /Seneste tunge sæt/)
  assert.match(html, /80 kg × 5 @ RPE 8/)
  assert.match(html, /28\. okt\. 2026/)
  assert.match(html, /Estimeret 1RM/)
  assert.match(html, /role="img"/)
  assert.match(html, /aria-label="Estimeret 1RM:.*93,3 kg/)
  assert.match(html, /<polyline /)
  assert.match(html, /<details><summary/)
  assert.doesNotMatch(html, /<details open|NaN|Infinity/)
})

test('actual React renders honest empty and error, never stale sets on error', () => {
  const empty = render()
  assert.match(empty, /Ingen bekræftede tunge sæt/)
  assert.doesNotMatch(empty, /<svg|<ol|role="alert"/)
  const error = render({ error: new Error('PRIVATE RAW ERROR'), logs: [row()] })
  assert.match(error, /role="alert"/)
  assert.match(error, /Historikken kunne ikke vises/)
  assert.doesNotMatch(error, /PRIVATE|80 kg|<svg|Ingen bekræftede/)
})

test('OFF exits before inputs; single day and missing RPE stay honest', () => {
  assert.equal(ExerciseHistoryView(), null)
  assert.equal(ExerciseHistoryView({ enabled: false, get logs() { assert.fail('OFF read') } }), null)
  assert.equal(renderToStaticMarkup(h(ExerciseHistoryView, { enabled: false })), '')
  const html = render({ logs: [row({ rpe_actual: null })] })
  assert.match(html, /RPE ikke angivet/)
  assert.match(html, /Én træningsdag endnu/)
  assert.doesNotMatch(html, /<polyline/)
  assert.equal((html.match(/<circle /g) || []).length, 1)
})

test('safe text, eight-set cap and per-render identity isolation', () => {
  const logs = Array.from({ length: 10 }, (_, i) => row({ id: `set-${i}`, set_number: i + 1,
    logged_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z` }))
  const html = render({ exerciseName: '<img src=x onerror=bad>', logs })
  assert.equal((html.match(/<li /g) || []).length, 8)
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/)
  const changed = render({ athleteId: 'synthetic-b', logs })
  assert.match(changed, /Ingen bekræftede/); assert.doesNotMatch(changed, /80 kg/)
})

test('invalid rows disclose omissions; constant curve has finite geometry', () => {
  const html = render({ logs: [row(), row({ id: 'second', logged_at: '2026-11-01T10:00:00Z' }),
    row({ id: 'invalid', weight: -5 })] })
  assert.match(html, /ugyldige eller fremtidige/)
  assert.match(html, /<polyline /)
  assert.doesNotMatch(html, /NaN|Infinity/)
})
