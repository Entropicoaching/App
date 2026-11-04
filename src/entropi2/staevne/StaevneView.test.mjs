import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StaevneView from './StaevneView.mjs'

const render = props => renderToStaticMarkup(h(StaevneView, props))
const fixture = { enabled: true, referenceDate: '2026-11-04', lifts: { squat: { e1RM: 200, openerTime: '10:00' }, bench: { e1RM: 100 }, deadlift: { e1RM: 250 } } }

test('strict OFF does not read data or create an enabled component', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) assert.equal(StaevneView({ enabled, get lifts() { throw Error('OFF data access') } }), null)
  assert.equal(render({}), '')
})
test('actual React component shows three lifts, nine actual inputs and folded warmup', () => {
  const html = render(fixture)
  assert.match(html, /Squat/); assert.match(html, /Bænkpres/); assert.match(html, /Dødløft/)
  assert.match(html, /åbner 180 kg · andet 192,5 kg · tredje 200 kg/)
  assert.equal((html.match(/<input/g) || []).length, 9)
  assert.equal((html.match(/<fieldset/g) || []).length, 9)
  assert.equal((html.match(/<details>/g) || []).length, 3)
  assert.doesNotMatch(html, /<details open/)
  assert.match(html, /09:25/); assert.match(html, /Åbnertid mangler/)
  assert.match(html, /value="conservative"/); assert.match(html, /value="aggressive"/)
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const [, id] of html.matchAll(/\sfor="([^"]+)"/g)) assert.ok(ids.includes(id))
})
test('empty data and loading failures are honest and do not invent zero results', () => {
  const empty = render({ enabled: true })
  assert.equal((empty.match(/Ingen e1RM/g) || []).length, 3)
  assert.doesNotMatch(empty, /åbner 0|NaN|undefined|Infinity/)
  const failed = render({ ...fixture, error: true })
  assert.match(failed, /role="alert"/); assert.match(failed, /kunne ikke indlæses/)
  assert.doesNotMatch(failed, /<input/)
  assert.match(render({ enabled: true, lifts: null }), /forkert format/)
  assert.match(render({ ...fixture, lifts: { squat: { e1RM: -1 } } }), /e1RM skal/)
  assert.match(render({ ...fixture, strategy: 'unknown' }), /Ukendt strategi/)
})
test('controlled actual results show miss and validation without changing proposals', () => {
  const html = render({ ...fixture, onResultChange() {}, results: { squat: [{ kg: '175', status: 'miss' }, { kg: '177', status: 'good' }] } })
  assert.match(html, /value="175"/)
  assert.match(html, /value="miss" selected=""/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /Faktisk vægt skal/)
  assert.match(html, /åbner 180 kg/)
  assert.doesNotMatch(html, /readOnly=""|readonly=""/)
})
