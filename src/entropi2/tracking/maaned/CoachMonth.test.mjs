import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, populated } from './fixtures.mjs'
let React, renderToStaticMarkup, CoachMonth
let missing = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: CoachMonth } = await import('./CoachMonth.mjs'))
const options = { skip: missing ? 'Real React unavailable in pinned copy; Dhurva must run this integration gate' : false }
const render = props => renderToStaticMarkup(React.createElement(CoachMonth, props))

test('real React: OFF, loading, error and empty', options, () => {
  assert.equal(render({ snapshot: new Proxy({}, { get() { throw Error('OFF read') } }) }), '')
  assert.match(render({ enabled: true, snapshot: { status: 'loading' } }), /aria-busy="true"/)
  const error = render({ enabled: true, snapshot: { status: 'error' }, onRetry() {} })
  assert.match(error, /role="alert"/); assert.match(error, /Prøv igen/); assert.doesNotMatch(error, /Ingen registreringer/)
  const empty = render({ enabled: true, snapshot: fixture() })
  assert.match(empty, /Ingen registreringer i perioden/); assert.doesNotMatch(empty, /NaN|Infinity|undefined/)
})
test('real React: populated domains, folded evidence, escaping and mobile styles', options, () => {
  const snapshot = populated()
  snapshot.exerciseLogs[0].exercises.name = 'Squat <script>'
  const html = render({ enabled: true, snapshot })
  for (const label of ['Månedsrapport', 'Styrke pr. hovedløft', 'Gennemførte pas', 'Volumen og intensitet',
    'Kost- og vægttrend', 'Dagsform', 'Tracking og datakvalitet', 'Vis flagets datagrundlag',
    '2026-10-08', '2026-11-04', 'min-height:44px', 'overflow-wrap:anywhere', '<details>', '<summary']) assert.ok(html.includes(label), label)
  assert.ok(html.includes('&lt;script&gt;')); assert.doesNotMatch(html, /<script>|<input|cyklus|cycle/)
  assert.doesNotMatch(html, /<details open/)
})
