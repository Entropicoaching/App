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
test('real React: sections short of data for the same reason share one reason line (1675)', () => {
  const html = render({ enabled: true, data: { ...empty, daily: [{ day: '2026-11-01', source: 'athlete_manual', sleepHours: 8, energy: 4 }] } })
  const text = html.replace(/<[^>]+>/g, '\n').split('\n').map(t => t.trim()).filter(Boolean)
  const count = t => text.filter(x => x === t).length
  assert.equal(count('Ingen validerede registreringer at vise.'), 0)
  assert.equal(count('For lidt data: 1 af mindst 4 dage'), 1)
  assert.equal(count('For lidt data: 0 af mindst 4 dage'), 1)
  assert.equal(text.filter(x => x.startsWith('Beregning: Aritmetisk')).length, 1)
  for (const v of ['Søvn, Energi', 'Søvn: ', '2026-10-26 – 2026-11-01', 'Regel: Middel &lt;6 t', '2026-11-01: 8 t']) assert.ok(text.some(x => x.includes(v)), v)
})
