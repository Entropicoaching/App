import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySnapshot, populatedSnapshot } from './fixtures.mjs'

// App npm test discovers this without a loader. A missing package is an explicit
// integration gate, never replaced with the synthetic host-tree fixture.
let h, renderToStaticMarkup, AthleteWeek, unavailable = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  unavailable = true
}
if (!unavailable) ({ default: AthleteWeek } = await import('./AthleteWeek.mjs'))
const options = { skip: unavailable ? 'Pinned copy lacks React/react-dom; real React required at Dhurva merge gate.' : false }
const render = props => renderToStaticMarkup(h(AthleteWeek, props))

test('real React: populated card, visible basis, dated range and closed disclosure', options, () => {
  const html = render({ enabled: true, snapshot: populatedSnapshot() })
  for (const label of ['Ugen i korte træk', '2 pas', '110 kg × 3', '7 timer', '3 af 5',
    '1.800 kcal/dag', '90 %', '2026-11-01', 'synthetic-v1']) assert.ok(html.includes(label), label)
  assert.equal((html.match(/Datagrundlag:/g) || []).length, 5)
  assert.match(html, /<details>/); assert.doesNotMatch(html, /<details open/)
  assert.match(html, /min-height:44px/); assert.match(html, /<time dateTime="2026-11-07"/)
})

test('real React: empty and sparse values retain honest unknown data', options, () => {
  const html = render({ enabled: true, snapshot: emptySnapshot() })
  assert.match(html, /role="status"/); assert.match(html, /Ingen registreringer i perioden/)
  assert.match(html, /For lidt data/); assert.match(html, /Kan ikke sammenlignes med mål/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined|cyklus|100 %/)
})

test('real React: loading/error/retry and strict OFF with unreadable snapshot', options, () => {
  for (const enabled of [undefined, false, null, 'true', 1]) {
    const props = { enabled, snapshot: new Proxy({}, { get() { throw Error('OFF read') } }) }
    assert.equal(render(props), '')
  }
  const loading = render({ enabled: true, snapshot: { status: 'loading' } })
  assert.match(loading, /aria-busy="true"/); assert.match(loading, /role="status"/)
  const error = render({ enabled: true, snapshot: { status: 'error' }, onRetry() {} })
  assert.match(error, /role="alert"/); assert.match(error, /<button type="button"/)
  assert.match(error, /Prøv igen/); assert.doesNotMatch(error, /0 pas/)
})

test('real React: source labels are escaped and cycle properties are never read', options, () => {
  const data = populatedSnapshot(); data.strength.label = '<script>synthetic</script>'
  Object.defineProperty(data, 'cycle', { get() { throw Error('private read') } })
  const html = render({ enabled: true, snapshot: data })
  assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>|cycle|cyklus/)
})
