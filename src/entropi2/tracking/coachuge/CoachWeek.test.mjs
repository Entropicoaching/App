import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachWeek from './CoachWeek.mjs'

const render = props => renderToStaticMarkup(createElement(CoachWeek, props))
const empty = { state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-01',
  daily: [], loadDays: [], nutritionDays: [], weightDays: [] }

test('real React: OFF produces no markup and does not inspect data', () => {
  const data = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(render({ enabled, data }), '')
})
test('real React: loading, fetch failure, empty and insufficient remain distinct', () => {
  assert.match(render({ enabled: true, data: { state: 'loading' } }), /aria-busy="true"/)
  const error = render({ enabled: true, data: { ...empty, complete: false } })
  assert.match(error, /Kunne ikke hente hele perioden/); assert.doesNotMatch(error, /Ingen registreringer/)
  assert.match(render({ enabled: true, data: empty }), /Ingen registreringer i perioden/)
  assert.match(render({ enabled: true, data: { ...empty,
    daily: [{ day: '2026-11-01', source: 'athlete_manual', pain: 0 }] } }), /For lidt data til et samlet overblik/)
})
test('real React: pain priority has date, place, raw values and accessible folded evidence', () => {
  const html = render({ enabled: true, data: { ...empty,
    daily: [{ day: '2026-11-01', source: 'athlete_manual', pain: 8, painLocation: 'testknæ <script>' }] } })
  for (const value of ['Prioritet: Smerte', '8/10', '2026-11-01', '1/7 dage', 'Vis grundlag',
    'For lidt data i dele', 'Ingen automatiske programændringer', 'minmax(0, 1fr)', '<details>', '<summary']) assert.ok(html.includes(value), value)
  assert.ok(html.includes('testknæ &lt;script&gt;')); assert.doesNotMatch(html, /<script>/)
  assert.equal((html.match(/<h3>Prioritet: Smerte<\/h3>/g) || []).length, 1)
  assert.doesNotMatch(html, /<button|<input|cyklus/i)
})
