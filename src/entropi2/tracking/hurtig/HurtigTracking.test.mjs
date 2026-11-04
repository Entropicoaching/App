import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuickController } from './controller.mjs'
import { athleteId, date, data, meal, manualClock } from './testFixtures.mjs'

// These tests use actual React + ReactDOM SSR. Never substitute a fake renderer.
let React, renderToStaticMarkup, HurtigTracking, missing = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: HurtigTracking } = await import('./HurtigTracking.mjs'))
const options = { skip: missing ? 'Real React/react-dom absent in pinned public copy. Required Dhurva integration gate; no installation allowed.' : false }
const render = props => renderToStaticMarkup(React.createElement(HurtigTracking, props))
// Inspect button elements, not CSS text: the selected-state style contains
// aria-pressed="true" too. SSR also includes children of closed details.
const mealButtons = html => [...html.matchAll(/<button\b[^>]*\baria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)]
const topMeals = html => html.match(/<div\b[^>]*\baria-label="Mest brugte måltider"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
const moreMeals = html => html.match(/<details\b([^>]*)><summary\b[^>]*>Flere måltider<\/summary>([\s\S]*?)<\/details>/)
function fixture(t, extra = {}) {
  const time = manualClock()
  const controller = createQuickController({ enabled: true, athleteId, date, data: data(), clock: time.clock,
    save: { readiness: async () => true, weight: async () => true, meal: async () => true }, ...extra })
  t.after(() => { controller.dispose(); assert.equal(time.handles(), 0) })
  return { controller, ...time }
}

test('SSR inspection: CSS attribute selectors are not meal buttons', () => {
  // Synthetic HTML tests the inspector only; this is not a React renderer.
  const html = '<style>.e2-track-hurtig button[aria-pressed="true"]{border:2px solid}</style>'
    + '<div role="group" aria-label="Mest brugte måltider">'
    + ['A', 'B', 'C'].map(name => `<button aria-pressed="false">${name}</button>`).join('') + '</div>'
    + '<details><summary>Flere måltider</summary><div><button aria-pressed="true">D</button></div></details>'
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 5)
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2)
  assert.equal(mealButtons(html).length, 4)
  assert.equal(mealButtons(html).filter(button => button[1] === 'true').length, 1)
  assert.equal(mealButtons(topMeals(html)).length, 3)
  const more = moreMeals(html)
  assert.ok(more)
  assert.equal(more[1], '')
  assert.equal(mealButtons(more[2]).length, 1)
  assert.equal(mealButtons('&lt;button aria-pressed="true"&gt;hostile text&lt;/button&gt;').length, 0)
})

test('real React: strict OFF never reads controller', options, () => {
  const controller = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(render({ enabled, controller }), '')
})

test('real React: prefill, optional sleep disclosure, labels, 48px targets, no mandatory unrelated fields', options, t => {
  const { controller } = fixture(t), html = render({ enabled: true, controller })
  for (const text of ['Hurtig log', 'Samme som i går', 'Dagsform', 'Energi', 'Motivation', 'Stress', 'Ømhed',
    'Gem dagsform', 'Gem vægt', 'Gem måltid', 'Søvn (valgfrit)', 'Forslag fra i går', 'value="80.2"', 'min-height:48px', '<details>']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /<details open|\brequired=|NaN|Infinity|cyklus|cycle|readiness_score/)
  assert.equal((html.match(/<form/g) ?? []).length, 3)
  assert.equal((html.match(/<label/g) ?? []).length, 6)
  assert.match(html, /aria-describedby=/)
})

test('real React: top three first, more folded, selection and hostile text escaped', options, t => {
  const { controller } = fixture(t, { data: data({ mealRows: [meal('<script>A</script>'), meal('<script>A</script>'), meal('B'), meal('C'), meal('D')] }) })
  controller.selectMeal(controller.snapshot().meals[3].key)
  const html = render({ enabled: true, controller })
  assert.match(html, /&lt;script&gt;A&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>/)
  const buttons = mealButtons(html)
  assert.equal(buttons.length, 4)
  assert.equal(buttons.filter(button => button[1] === 'true').length, 1)
  assert.match(buttons.find(button => button[1] === 'true')[2], /^D ·/)
  const top = mealButtons(topMeals(html))
  assert.equal(top.length, 3)
  assert.deepEqual(top.map(button => button[2].split(' ·')[0]), ['&lt;script&gt;A&lt;/script&gt;', 'B', 'C'])
  const more = moreMeals(html)
  assert.ok(more, 'remaining meals are in their own disclosure')
  assert.doesNotMatch(more[1], /\bopen(?:\s|=|$)/, 'more meals start folded')
  assert.deepEqual(mealButtons(more[2]).map(button => button[2].split(' ·')[0]), ['D'])
  assert.ok(html.indexOf(more[0]) > html.indexOf(topMeals(html)))
  assert.match(html, /Valgt: D/); assert.match(html, /320 kcal · 22 g protein/)
})

test('real React: zero to five meals keep at most three outside the closed disclosure', options, t => {
  for (const count of [0, 1, 2, 3, 4, 5]) {
    const { controller } = fixture(t, { data: data({ mealRows: ['A', 'B', 'C', 'D', 'E'].slice(0, count).map(name => meal(name)) }) })
    if (count) controller.selectMeal(controller.snapshot().meals[count - 1].key)
    const html = render({ enabled: true, controller })
    const buttons = mealButtons(html)
    assert.equal(buttons.length, count, `all ${count} distinct meals occur exactly once`)
    assert.equal(buttons.filter(button => button[1] === 'true').length, count ? 1 : 0)
    assert.equal(mealButtons(topMeals(html)).length, Math.min(count, 3))
    const more = moreMeals(html)
    if (count <= 3) assert.equal(more, null)
    else {
      assert.ok(more)
      assert.doesNotMatch(more[1], /\bopen(?:\s|=|$)/)
      assert.equal(mealButtons(more[2]).length, count - 3)
      assert.equal(mealButtons(more[2]).filter(button => button[1] === 'true').length, 1)
    }
  }
})

test('real React: loading, error/retry and genuinely empty history are distinct', options, t => {
  const loading = fixture(t, { data: { status: 'loading' } })
  assert.match(render({ enabled: true, controller: loading.controller }), /aria-busy="true"/)
  const failed = fixture(t, { data: { status: 'error' } })
  const error = render({ enabled: true, controller: failed.controller, onRetry() {} })
  assert.match(error, /role="alert"/); assert.match(error, /Prøv igen/); assert.doesNotMatch(error, /Ingen tidligere måltider/)
  const empty = fixture(t, { data: data({ readinessRows: [], weightRows: [], mealRows: [] }) })
  const html = render({ enabled: true, controller: empty.controller })
  assert.match(html, /Ingen registreringer fra i går/); assert.match(html, /Ingen tidligere måltider/)
  assert.doesNotMatch(html, /Samme som i går/)
})

test('real React: pending offers undo, saving disables controls, success only follows callback', options, async t => {
  let resolve
  const f = fixture(t, { save: { weight: () => new Promise(r => { resolve = r }) } })
  f.controller.save('weight')
  const pending = render({ enabled: true, controller: f.controller })
  assert.match(pending, />Fortryd</); assert.match(pending, /5 sekunder/); assert.doesNotMatch(pending, />Gemt\.</)
  await f.advance(5000)
  const saving = render({ enabled: true, controller: f.controller })
  assert.match(saving, /Gemmer…/); assert.match(saving, /disabled=""/); assert.doesNotMatch(saving, />Fortryd</)
  resolve(true); await f.advance(0)
  assert.match(render({ enabled: true, controller: f.controller }), />Gemt\.</)
})

test('real React: save errors preserve draft; unavailable adapters are visible', options, async t => {
  const f = fixture(t, { save: { weight: async () => false } })
  f.controller.save('weight'); await f.advance(5000)
  const html = render({ enabled: true, controller: f.controller })
  assert.match(html, /role="alert"/); assert.match(html, /Kunne ikke bekræfte/)
  assert.match(html, /value="80.2"/); assert.match(html, /gemmeveje er ikke tilsluttet/)
})
