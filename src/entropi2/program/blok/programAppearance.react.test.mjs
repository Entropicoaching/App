// Real app React and ReactDOM; no fake React, service clients or browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from './programReactLoader.mjs'
installProgramReactLoader()
const { default: Program } = await import('../../../athlete/ProgramTab.jsx')

function fixture(extra = {}) {
  const week = { id: 'ssr-week', week_number: 1, start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ id: 'ssr-session', title: 'Pas A', weekday: 2,
      exercises: [{ id: 'ssr-exercise', name: 'Squat', sets: 1, reps: '5', intensity: 'RPE 8' }] }] }
  return { allWeeks: [week], currentWeek: week, viewingWeekIdx: 0, athlete: { id: 'ssr-athlete' },
    computeActiveWeekIdx: () => 0, weekStartDate: () => new Date('2026-11-02T12:00:00'), fmtWeekRange: () => null,
    WEEKDAYS_LONG: ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'],
    exerciseLogs: [], pastLogs: [], readinessLog: { readiness_score: 90 }, sessionRefs: { current: {} },
    dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {}, setConfirm: {}, lastLogByExerciseName: {},
    exerciseHistory: {}, exWarmupExpanded: {}, exWarmupWeightOverride: {}, warmupChecked: {},
    suggestNextWeight: () => null, calcWarmupSets: () => [], suggestWarmupOverride: () => null,
    parsePlannedRpe: () => 8, ...extra }
}
const render = props => renderToStaticMarkup(createElement(Program, props))

test('real React SSR renders mounted accents, today and the open set logger without a containing fold', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-04T10:00:00Z') })
  const html = render(fixture({ progOpenSession: 'ssr-session' }))
  assert.match(html, /border-inline-start:4px solid #c8923a/)
  assert.match(html, /Ugens intensitet · plan/)
  assert.match(html, />I dag<|>I dag<\/span>/)
  assert.match(html, /<h2[^>]*>Pas A<\/h2>/)
  assert.match(html, /<h3[^>]*data-exercise-heading="Squat"/)
  const button = html.indexOf('>Log</button>')
  assert.ok(button > 0)
  assert.equal((html.slice(0, button).match(/<details\b/g) || []).length,
    (html.slice(0, button).match(/<\/details>/g) || []).length, 'logger is outside all details elements')
})

test('real React distinguishes complete, skipped, unknown, OFF and empty/error states', () => {
  const log = { exercise_id: 'ssr-exercise', set_number: 1 }
  assert.match(render(fixture({ exerciseLogs: [log] })), /Gennemført ✓/)
  assert.match(render(fixture({ exerciseLogs: [{ ...log, skipped: true }] })), /Afsluttet · sæt sprunget over/)
  for (const entropi2 of [false, null, 'true', 1]) {
    const html = render(fixture({ entropi2, exerciseLogs: [log] }))
    assert.doesNotMatch(html, /data-program-intensity|Gennemført|>I dag</)
    assert.match(html, /Færdig ✓/)
  }
  const error = render(fixture({ programError: true, exerciseLogs: [log] }))
  assert.match(error, /Intensiteten er ikke tilgængelig/)
  assert.doesNotMatch(error, /Gennemført|RPE 8/)
  assert.match(render(fixture({ allWeeks: [], currentWeek: null })), /Dit program er på vej/)
  assert.match(render(fixture({ allWeeks: [], currentWeek: null, programError: true })), /Dit program kunne ikke hentes/)
})

test('real React escapes long coach text and wraps mobile week navigation', () => {
  const props = fixture()
  props.allWeeks[0].sessions[0].exercises[0].intensity = '<script>fixture()</script>'
  props.allWeeks.push({ ...props.allWeeks[0], id: 'ssr-next', week_number: 2 })
  const html = render(props)
  assert.match(html, /&lt;script&gt;fixture\(\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(html, /min-height:44px;white-space:normal/)
})
