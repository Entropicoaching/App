import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PainHistory from './PainHistory.mjs'
import CoachPainHistory, { PainOverview } from './CoachPainHistory.mjs'

// Deliberately requires real app dependencies; no skip or replacement renderer.
const data = daily => ({ state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily })
const html = props => renderToStaticMarkup(h(PainHistory, props))

test('real React: visible area, dated flag evidence, escaped text and folded history', () => {
  const rendered = html({ enabled: true, weeks: 4, data: data([
    { day: '2026-11-04', source: 'athlete_manual', pain: 7, painLocation: 'Testknæ <script>' },
  ]) })
  assert.match(rendered, /Flag: smerte 7\+/)
  assert.match(rendered, /Datagrundlag: 1 af 1/)
  assert.match(rendered, /2026-11-04: 7\/10/)
  assert.match(rendered, /Testknæ &lt;script&gt;/)
  assert.match(rendered, /Forslag til samtale/)
  assert.match(rendered, /<details><summary/)
  assert.doesNotMatch(rendered, /<details open|<script>|NaN|undefined/)
})

test('real React: empty, loading, error and OFF', () => {
  assert.match(html({ enabled: true, data: data([]) }), /Ingen indtastet smerte med kropsområde/)
  assert.match(html({ enabled: true, data: { state: 'loading' } }), /aria-busy="true"/)
  const failed = html({ enabled: true, data: { state: 'error' }, onRetry() {} })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Prøv igen/)
  assert.doesNotMatch(failed, /Flag:|Senest/)
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(html({ enabled, data: new Proxy({}, { get() { throw Error('OFF read') } }) }), '')
  }
})

test('real React: coach fold is visible only with entered area pain; unavailable data is absent and names are escaped', () => {
  const props = { enabled: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', weeks: 6 }
  const render = snapshot => renderToStaticMarkup(h(PainOverview, { ...props, data: snapshot, onRetry() {} }))
  const visible = render(data([{ day: '2026-11-04', source: 'athlete_manual', pain: 8, painLocation: 'Testknæ <script>' }]))
  assert.match(visible, /^<details/)
  assert.match(visible, /Smerte pr. område \(4-8 uger\)/)
  assert.match(visible, /Testknæ &lt;script&gt;/)
  assert.match(visible, /Datagrundlag: 1 af 1.*2026-11-04: 8\/10/)
  assert.doesNotMatch(visible, /<details open|<script>/)
  assert.equal(render(data([])), '')
  assert.equal(render(data([{ day: '2026-11-04', source: 'athlete_manual', pain: 0 }])), '')
  const failed = render({ state: 'error', daily: [{ pain: 8, painLocation: 'STALE' }] })
  assert.equal(failed, '')
  assert.equal(render({ state: 'loading' }), '')
})

test('real React: actual readiness-to-coach pipeline hides existing soreness and unavailable tables, renders only explicit pain', () => {
  const props = { enabled: true, athleteId: 'synthetic-athlete', coachId: 'synthetic-coach', asOf: '2026-11-04' }
  const render = readiness => renderToStaticMarkup(h(CoachPainHistory, { ...props, readiness }))
  const legacy = { athlete_id: props.athleteId, logged_date: props.asOf, soreness_level: 5, sore_zones: ['Testryg'] }
  assert.equal(render([legacy]), '')
  assert.equal(render([]), '')
  assert.equal(render(undefined), '')
  for (const error of [{ code: '42P01', message: 'relation does not exist' }, { code: 'PGRST205', status: 404 }])
    assert.equal(render({ data: null, error }), '')
  const visible = render([{ ...legacy, pain: 8, pain_location: 'Testknæ <script>' }])
  assert.match(visible, /^<details/)
  assert.match(visible, /Testknæ &lt;script&gt;/)
  assert.match(visible, /Datagrundlag: 1 af 1.*2026-11-04: 8\/10/)
  assert.doesNotMatch(visible, /<details open|<script>|Testryg/)
  assert.equal(render([{ ...legacy, athlete_id: 'other', pain: 8, pain_location: 'FOREIGN' }]), '')
  for (const enabled of [false, undefined, 'true', 1]) assert.equal(renderToStaticMarkup(h(CoachPainHistory,
    { enabled, readiness: new Proxy({}, { get() { throw Error('OFF read') } }) })), '')
})

test('real React: scoped malformed observations have an alert and retry, without pain evidence or foreign content', () => {
  const props = { enabled: true, athleteId: 'synthetic-athlete', coachId: 'synthetic-coach', asOf: '2026-11-04', onRetry() {} }
  const row = { athlete_id: props.athleteId, logged_date: props.asOf, pain: 8, pain_location: null }
  const html = renderToStaticMarkup(h(CoachPainHistory, { ...props, readiness: [row] }))
  assert.match(html, /role="alert"/)
  assert.match(html, /Smertehistorikken kunne ikke vises. Nogle registreringer mangler oplysninger./)
  assert.match(html, /Prøv igen/); assert.doesNotMatch(html, /Flag:|Datagrundlag:|<details/)
  assert.equal(renderToStaticMarkup(h(CoachPainHistory, { ...props, readiness: [{ ...row, athlete_id: 'other' }] })), '')
})
