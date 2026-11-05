import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from './AthleteHome.mjs'
import WeekPlan from './ugeplan/WeekPlan.mjs'

// Real React gate, without loaders or package substitution. Run by npm test too.
const athlete = { id: 'synthetic-a' }, now = new Date('2026-11-03T12:00:00Z')
const week = { id: 'synthetic-w', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-s', title: 'Syntetisk pas', weekday: null,
    exercises: [{ id: 'synthetic-e', name: '', sets: 2 }] }] }
const render = extra => renderToStaticMarkup(h(Home, { enabled: true, athlete, now, allWeeks: [week],
  currentWeek: week, exerciseLogs: [], storage: null, ...extra }))

test('real React: empty home keeps check-in but has no empty coach card or unknown exercise/date text', () => {
  const html = render({ messages: [{ sender_role: 'coach', content: '  ' }] })
  assert.doesNotMatch(html, /Fra din coach|Ingen beskeder|Besked uden tekst|Øvelse uden navn|Dag ikke fastlagt/)
  assert.match(html, /Din coach/)
  assert.match(html, /data-home-checkin/)
  assert.match(render({ allWeeks: [], currentWeek: undefined }), />Dit overblik<\/h1>/)
  assert.match(render({ programError: true }), /Programmet kunne ikke hentes/)
})

test('real React: read-only Home and undated/unknown week have no misleading badges or start button', () => {
  assert.doesNotMatch(render({ sessionReadOnly: true }), /Start dagens pas|Start næste pas|Passet kunne ikke åbnes/)
  const html = renderToStaticMarkup(h(WeekPlan, { enabled: true, athleteId: athlete.id, week, now }))
  assert.match(html, /Syntetisk pas/)
  assert.doesNotMatch(html, /Dag ukendt|Status ukendt|Klaret|Planlagt|<time/)
})
