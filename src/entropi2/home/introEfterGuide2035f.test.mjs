// Ordre 2035f (Dhurva 2068): en ny klient ser guiden med tre trin (2065) og derefter Hjem. Introen "Trin 1 af 4"
// vises kun, når guiden ikke er gennemført (onboarding_completed_at er null), så der er én intro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'

const base = { enabled: true, athlete: { id: 'synthetic-athlete', name: 'Testfornavn' }, today: '2026-11-24',
  now: new Date('2026-11-24T12:00:00Z'), allWeeks: [], currentWeek: undefined, exerciseLogs: [], storage: { getItem: () => null },
  setTab() {}, onStartSession() {} }
const render = athlete => renderToStaticMarkup(h(AthleteHome, { ...base, athlete: { ...base.athlete, ...athlete } }))

test('2035f: med gennemført guide viser Hjem ingen intro "Trin 1 af 4"', () => {
  const html = render({ onboarding_completed_at: '2026-11-24T10:00:00Z' })
  assert.doesNotMatch(html, /data-home-onboarding|Trin 1 af 4/)
  assert.match(html, /data-u9-pas/)
})

test('2035f: uden gennemført guide vises introen som før', () => {
  for (const athlete of [{}, { onboarding_completed_at: null }]) {
    const html = render(athlete)
    assert.match(html, /data-home-onboarding/)
    assert.match(html, /Trin 1 af 4/)
  }
})

test('2035f: skrivebeskyttet forhåndsvisning viser aldrig introen', () => {
  const html = renderToStaticMarkup(h(AthleteHome, { ...base, sessionReadOnly: true, onStartSession: undefined }))
  assert.doesNotMatch(html, /data-home-onboarding/)
})
