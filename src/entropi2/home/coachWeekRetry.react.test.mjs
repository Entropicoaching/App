// Genuine React/ReactDOM gate: deliberately no skip or synthetic replacement.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from './AthleteHome.mjs'

const week = { id: 'synthetic-old-week', week_number: 1, start_date: '2026-11-02',
  sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-exercise', sets: 1 }] }] }
const nextWeek = { ...week, id: 'synthetic-new-week', week_number: 2, start_date: '2026-11-09' }
const render = extra => renderToStaticMarkup(h(Home, { enabled: true, coachOwnTraining: true,
  athlete: { id: 'synthetic-athlete' }, allWeeks: [week, nextWeek], currentWeek: week,
  now: new Date('2026-11-10T12:00:00Z'), exerciseLogs: [], storage: null,
  onStartSession() {}, onRetryProgram() {}, ...extra }))

test('real React: own coach sees the week retry and start remains disabled until host week matches', () => {
  const stale = render()
  assert.match(stale, /En ny uge er startet.*Hent programmet igen/)
  assert.match(stale, /<button[^>]*disabled=""[^>]*>Start (?:dagens|næste) pas<\/button>/)
  assert.match(stale, /<button[^>]*>Hent igen<\/button>/)
  const ready = render({ currentWeek: nextWeek })
  assert.doesNotMatch(ready, /Hent igen|En ny uge er startet/)
  assert.match(ready, /<button(?![^>]*disabled)[^>]*>Start (?:dagens|næste) pas<\/button>/)
})

test('real React: preview, regular athlete and OFF preserve their presentation', () => {
  assert.doesNotMatch(render({ sessionReadOnly: true }), /Hent igen|Start dagens pas|Start næste pas/)
  assert.match(render({ coachOwnTraining: false }), /Genindlæs siden/)
  assert.doesNotMatch(render({ coachOwnTraining: false }), /Hent igen/)
  assert.equal(render({ enabled: false }), '')
})
