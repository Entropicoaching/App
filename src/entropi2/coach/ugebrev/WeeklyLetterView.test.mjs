import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WeeklyLetter from './WeeklyLetterView.mjs'
import { letterFixture, emptyFixture } from './letterFixture.mjs'
import { activePlan, meal, coach } from '../../kostplan/rapport/reportFixture.mjs'
const render = props => renderToStaticMarkup(createElement(WeeklyLetter, props))

test('real React: OFF renders nothing without reading data', () => {
  const data = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(render({ data }), '')
})

test('real React: draft visible in labelled editable field with folded basis, no send action', () => {
  const d = letterFixture(); d.daily[0].pain = 8; d.daily[0].painLocation = 'syntetisk knæ'
  const html = render({ enabled: true, data: d })
  for (const value of ['Udkast til ugebrev', '<textarea', 'Ros, ét fokuspunkt og ét spørgsmål',
    'Redigér altid', '1 af 2 planlagte pas', 'afklare den registrerede smerte',
    '<details>', '<summary', 'Grundlag for fokus', 'minimum 1', 'Beregnet værdi: 8',
    'Bekræftede planlagte pas: 1/2', '7/7', '2026-10-26', '2026-11-01', 'width:100%']) {
    assert.ok(html.includes(value), value)
  }
  const id = html.match(/<textarea id="([^"]+)"/)[1]
  assert.ok(html.includes(`for="${id}"`)); assert.ok(html.includes(`aria-describedby="${id}-help"`))
  assert.doesNotMatch(html, /<button|<form|readOnly|disabled|<details open|cyklus|syntetisk knæ/i)
  assert.equal((html.match(/<textarea/g) || []).length, 1)
})

test('real React: empty and error never show an editable stale draft', () => {
  const empty = render({ enabled: true, data: emptyFixture() })
  assert.match(empty, /endnu ikke et sikkert grundlag/); assert.doesNotMatch(empty, /textarea/)
  const error = render({ enabled: true, data: { ...letterFixture(), complete: false } })
  assert.match(error, /role="alert"/); assert.doesNotMatch(error, /textarea|endnu ikke/)
  assert.match(render({ enabled: true, data: { state: 'loading' } }), /aria-busy="true"/)
})

test('real React: unknown nutrition and training are honestly described', () => {
  const d = letterFixture(); d.compliance = null; d.nutritionDays = undefined
  const html = render({ enabled: true, data: d })
  assert.match(html, /Ugens pas: ukendt/); assert.match(html, /Ugens kost: ukendt/)
  assert.match(html, /Dele af datagrundlaget er utilstrækkelige/)
})

test('real React: sleep, native recovery and dated nutrition basis stay in the editable draft with sources folded', () => {
  const d = { ...letterFixture(), asOf: '2026-11-01', coachId: coach.id }
  d.recoveryDays = d.daily.map(row => ({ day: row.day, source: 'athlete_manual', energy: 2, stress: 4, sorenessLevel: 5 }))
  d.nutritionRead = { state: 'ready', complete: true, coachId: coach.id, athleteId: d.athleteId,
    date: d.asOf, plans: [activePlan({ on: '2026-10-26' })], weightLogs: [],
    mealLogs: [meal('2026-10-26', 'synthetic-meal')] }
  const html = render({ enabled: true, data: d })
  assert.match(html, /7 timer på 7\/7 dage/)
  assert.match(html, /energi: 2\/5/); assert.match(html, /ømhed: 5\/5/)
  assert.match(html, /1\.000 kcal mod 2\.000 kcal/)
  assert.match(html, /kostplan\/rapport: måltidslog og dateret planhistorik/)
  assert.match(html, /readiness_logs: atletens egne registreringer/)
  assert.doesNotMatch(html, /<details open|<button|<form|cyklus|synthetic-meal/)
  d.nutritionRead.date = '2026-10-31'
  const stale = render({ enabled: true, data: d })
  assert.match(stale, /role="alert"/); assert.doesNotMatch(stale, /textarea/)
})
