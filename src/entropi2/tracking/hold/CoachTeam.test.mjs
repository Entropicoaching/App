import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachTeam from './CoachTeam.mjs'
import { athlete, options } from './fixtures.mjs'

const render = props => renderToStaticMarkup(createElement(CoachTeam, props))

test('real React: OFF renders nothing without reading any data', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(render({ enabled,
    roster: new Proxy({}, { get() { throw Error('read roster') } }),
    athletes: new Proxy([], { get() { throw Error('read snapshots') } }) }), '')
})

test('real React: loading, empty roster and error are honest distinct states', () => {
  assert.match(render({ enabled: true, roster: { state: 'loading' } }), /aria-busy="true"/)
  const empty = render(options())
  assert.match(empty, /Ingen atleter på coachens hold/); assert.match(empty, /role="status"/)
  const error = render({ ...options(), roster: { state: 'ready', complete: false, athleteIds: [] } })
  assert.match(error, /role="alert"/); assert.match(error, /Hele atletlisten/)
  assert.doesNotMatch(error, /Ingen atleter/)
})

test('real React: sorted athletes, flag counts and current coverage are immediately visible', () => {
  const a = athlete('synthetic-a'), b = athlete('synthetic-b')
  b.coachWeek.daily.forEach(d => { d.stress = 4 })
  const html = render(options([a, b]))
  assert.ok(html.indexOf('<h3>Atlet synthetic-b</h3>') < html.indexOf('<h3>Atlet synthetic-a</h3>'))
  assert.equal((html.match(/<h3>Atlet /g) || []).length, 2)
  assert.match(html, /<p>1 flag<\/p>/); assert.match(html, /<p>0 flag<\/p>/)
  const first = html.slice(html.indexOf('<article'), html.indexOf('</article>'))
  const visible = first.slice(0, first.indexOf('<details>'))
  for (const text of ['2026-11-02', '2026-11-04', '3 af 7 dage', 'Træningslog', 'Kost', 'Vægt', 'Dagsform',
    '3/3 dage registreret; 3 med værdigrundlag']) assert.ok(visible.includes(text), text)
  assert.ok(first.indexOf('2026-10-12') > first.indexOf('<details>'))
  assert.equal((html.match(/<details>/g) || []).length, 2)
  assert.doesNotMatch(html, /<details open/)
})

test('real React: unknown athlete data stays visible rather than becoming zero', () => {
  const a = athlete('synthetic-unknown')
  a.coachWeek.state = 'error'
  a.sources.training.state = 'error'; a.sources.nutrition.state = 'partial'
  a.sources.weight.state = 'loading'; delete a.sources.readiness
  const html = render(options([a]))
  for (const text of ['Flagantal ukendt', 'Ugegrundlaget kunne ikke kontrolleres', 'Kunne ikke indlæses',
    'Ufuldstændig indlæsning', 'Indlæses', 'Kilde mangler', 'Dækning ukendt']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /0 flag|0\/3 dage/)
  assert.match(html, /role="alert"/)
})

test('real React: empty observations are shown without implying sufficient evidence', () => {
  const a = athlete('synthetic-empty')
  a.coachWeek.daily = []; a.coachWeek.loadDays = []; a.coachWeek.strength = null
  a.coachWeek.nutritionDays = []; a.coachWeek.weightDays = []; a.coachWeek.compliance = null
  Object.values(a.sources).forEach(s => { s.rows = [] })
  const html = render(options([a]))
  assert.match(html, /Ingen registreringer i ugegrundlaget/)
  assert.match(html, /0\/3 dage registreret; 0 med værdigrundlag/)
  assert.match(html, /ikke bevis for komplette pas eller kostdage/)
  assert.match(html, /Manglende træningslog kan være hvile/)
})

test('real React: mobile host layout, keyboard details and escaped identifiers', () => {
  const html = render(options([athlete('synthetic-<script>')]))
  assert.match(html, /synthetic-&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>|<button|<input|cyklus|cycle|PRIVATE-SENTINEL/i)
  for (const text of ['aria-label="Holdoverblik"', '<ol', '<article', '<summary', 'min-height:44px',
    'minmax(0, 1fr)', 'overflow-wrap:anywhere', 'Ingen automatiske programændringer']) assert.ok(html.includes(text), text)
})
