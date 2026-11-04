import test from 'node:test'
import assert from 'node:assert/strict'

// App runner discovers this directly. No custom loader or React stub.
let react, renderToStaticMarkup, MineTal
let unavailable = false
try {
  react = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  unavailable = true
}
if (!unavailable) ({ default: MineTal } = await import('./MineTal.mjs'))
const options = { skip: unavailable ? 'Real React/react-dom unavailable in pinned public copy; integration gate' : false }
const fixture = () => ({ status: 'ready', complete: true, athleteId: 'synthetic-athlete',
  endDate: '2026-11-04', dailyRows: [], exerciseLogs: [], mealRows: [], weightRows: [] })
const render = props => renderToStaticMarkup(react.createElement(MineTal, props))

test('real React: OFF never reads snapshot, literal true required', options, () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(render({ enabled, snapshot: poison }), '')
  }
})
test('real React: loading, fetch failure/retry and empty states distinct', options, () => {
  const loading = render({ enabled: true, snapshot: { status: 'loading' } })
  assert.match(loading, /aria-busy="true"/); assert.match(loading, /Henter dine registreringer/)
  const error = render({ enabled: true, snapshot: { status: 'error' }, onRetry() {} })
  assert.match(error, /role="alert"/); assert.match(error, /Prøv igen/)
  const empty = render({ enabled: true, snapshot: fixture() })
  assert.match(empty, /Mine tal/); assert.match(empty, /Ingen registreringer i perioden/)
  assert.match(empty, /2026-10-08–2026-11-04/)
  assert.ok(!/NaN|Infinity|undefined|Min private cyklus/.test(empty))
})
test('real React: seven domains, coverage, dated values and native disclosure', options, () => {
  const snapshot = fixture()
  snapshot.dailyRows = [29, 30, 31].map(day => ({ athlete_id: 'synthetic-athlete',
    source: 'athlete_manual', logged_date: `2026-10-${day}`, sleep_hours: 0,
    energy: 2, stress: 4, soreness: 0 }))
  Object.defineProperty(snapshot, 'cycle', { enumerable: true, get() { throw Error('private read') } })
  const html = render({ enabled: true, snapshot })
  for (const label of ['Søvn', 'Energi', 'Stress', 'Ømhed', 'Træning', 'Kost', 'Vægt',
    'For lidt data: 3 af mindst 4 dage', '0,0 timer', 'Ukendt', '<summary', '<time']) {
    assert.ok(html.includes(label), label)
  }
  assert.equal((html.match(/<details open=""/g) || []).length, 1)
  assert.match(html, /min-height:44px/)
  assert.ok(!/cyklus|cycle|sundhedsscore|100 %/.test(html))
})
