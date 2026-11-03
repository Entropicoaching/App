import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'

// Marc 3. nov.: videocoachen skal kunne naas direkte fra atletens startside.
const now = new Date('2026-11-03T10:00:00Z')
const props = extra => ({ enabled: true, athlete: { id: 'a', name: 'Testatlet' }, messages: [], setTab() {}, now, ...extra })

test('home shows an enabled "Film et sæt" shortcut only when the opener is wired', () => {
  const on = renderToStaticMarkup(createElement(AthleteHome, props({ onFilmSet() {} })))
  assert.match(on, /<button[^>]*data-film-set=""[^>]*>Film et sæt til videocoach<\/button>/)
  assert.doesNotMatch(on, /data-film-set=""[^>]*disabled/)
  const off = renderToStaticMarkup(createElement(AthleteHome, props()))
  assert.match(off, /<button[^>]*disabled=""[^>]*data-film-set=""|<button[^>]*data-film-set=""[^>]*disabled=""/)
})

test('AthleteView wires the shortcut to the existing instant videocoach flow', () => {
  const view = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(view, /onFilmSet=\{\(\) => \{ if \(!athlete\?\.id\) return; setAthleteVideoCoachInstant\(true\); setAthleteVideoCoachOpen\(true\) \}\}/)
})

test('home shows the date once: only the week in the eyebrow and "I dag" in the pass card', () => {
  const week = { id: 'w1', athlete_id: 'a', week_number: 1, start_date: '2026-11-03',
    sessions: [{ id: 's1', title: 'Dag 1', weekday: 1, exercises: [{ id: 'e1', name: 'Squat', sets: 4 }] }] }
  const html = renderToStaticMarkup(createElement(AthleteHome, props({ allWeeks: [week], currentWeek: week, exerciseLogs: [], onStartSession() {} })))
  assert.ok(html.includes('>Uge 1<'))
  assert.doesNotMatch(html, /2026-11-03/)
})
