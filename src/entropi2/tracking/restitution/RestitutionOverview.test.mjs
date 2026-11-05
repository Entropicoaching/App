import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, readiness } from './restitutionFixtures.mjs'

// Discovered by the app's npm test. Only real React/ReactDOM; missing packages
// are an explicit integration gate, never replaced with a test double here.
let h, renderToStaticMarkup, RestitutionOverview, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: RestitutionOverview } = await import('./RestitutionOverview.mjs'))
const options = { skip: missing ? 'Real React/react-dom absent in pinned copy; Dhurva must run before merge' : false }
const render = props => renderToStaticMarkup(h(RestitutionOverview, props))

test('real React: OFF, loading, error/retry and insufficient states', options, () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(render({ enabled, snapshot: poison }), '')
  assert.match(render({ enabled: true, snapshot: { status: 'loading' } }), /aria-busy="true"/)
  const failure = render({ enabled: true, snapshot: { status: 'error', message: 'synthetic-hidden' }, onRetry() {} })
  assert.match(failure, /role="alert"/); assert.match(failure, /<button type="button"/)
  assert.doesNotMatch(failure, /synthetic-hidden|For lidt data/)
  const empty = render({ enabled: true, snapshot: { ...fixture(), readinessRows: [], exerciseLogs: [] } })
  assert.match(empty, /For lidt data/); assert.match(empty, /0\/7 dage/)
  assert.doesNotMatch(empty, /Forsigtig restitutionsstatus|NaN|Infinity|undefined/)
})

test('real React: all levels, visible summary, folded evidence and coverage', options, () => {
  for (const [changes, label] of [[{}, 'God'], [{ energy: 3 }, 'Ok'], [{ sleep_hours: 5 }, 'Lav']]) {
    const data = fixture(); data.readinessRows = [7, 8, 9, 13].map(i => readiness(i, changes))
    const html = render({ enabled: true, snapshot: data })
    for (const text of [`Forsigtig restitutionsstatus: ${label}`, '4/7 dage', '2/7 dage',
      '2026-11-04', 'Se datagrundlag og vurdering', 'ikke en måling af din restitution', 'Programmet ændres ikke.']) assert.ok(html.includes(text), text)
    assert.equal((html.match(/<details>/g) ?? []).length, 1)
    assert.doesNotMatch(html, /<details open|synthetic-|NaN|Infinity|undefined/)
    assert.match(html, /min-height:44px/)
  }
})

test('real React: missing and invalid data are disclosed without a level', options, () => {
  const data = fixture(); data.readinessRows[0].sleep_hours = '8'
  data.exerciseLogs[0].reps_completed = null
  const html = render({ enabled: true, snapshot: data })
  for (const text of ['For lidt data', '3/7 dage', 'dagsformmåling', 'sætrække', 'Ukendt belastning']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /Forsigtig restitutionsstatus/)
})
