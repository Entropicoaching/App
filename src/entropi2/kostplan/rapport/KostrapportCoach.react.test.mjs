// Real React gate, discovered by npm test. Missing React is a failure, not a
// skip; no fixture loader or dependency replacement is registered here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import View from './KostrapportCoach.mjs'
import { buildNutritionReport } from './nutritionReport.mjs'
import { input, meal } from './reportFixture.mjs'

const render = (data = input()) => renderToStaticMarkup(h(View, { enabled: true, report: buildNutritionReport(data) }))

test('real React: strict OFF gate renders nothing without touching data', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 1, 'true', null]) {
    assert.equal(renderToStaticMarkup(h(View, { enabled, report: poison })), '')
  }
})

test('real React: correct four nutrients, denominator, daily detail, weight and mobile layout', () => {
  const html = render()
  for (const expected of ['3.500 kcal', '4.000 kcal plan for loggede dage', '87,5 % af mål', '125 % af mål',
    '2 af 7 dage med kostlog', '5 uden log', 'Protein', 'Kulhydrat', 'Fedt', 'Gennemsnit: 81 kg', '+2 kg', 'min-height:44px']) {
    assert.ok(html.includes(expected), expected)
  }
  assert.match(html, /<details><summary/); assert.doesNotMatch(html, /<details open/)
  assert.equal((html.match(/<time /g) || []).length, 7)
  assert.match(html, /auto-fit/); assert.match(html, /min\(100%, 17rem\)/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined/)
})

test('real React: unknown/missing evidence and empty log never imply zero intake', () => {
  const empty = render(input({ mealLogs: [], plans: [], weightLogs: [] }))
  assert.match(empty, /ingen kostlog i perioden/); assert.match(empty, /Ingen aktiveret plan/)
  assert.match(empty, /Ikke nok vejninger/)
  assert.doesNotMatch(empty, /0 kcal registreret|0 % af mål/)
  const unknown = render(input({ mealLogs: [meal('2026-11-02', 'x', { protein: null })] }))
  assert.match(unknown, /role="alert"/); assert.match(unknown, /Ukendt registreret/)
  assert.match(unknown, /1.000 kcal registreret/)
})

test('real React: loading/error do not expose stale report, and retry remains a native button', () => {
  const loading = renderToStaticMarkup(h(View, { enabled: true, state: 'loading', report: buildNutritionReport(input()) }))
  assert.match(loading, /role="status"/); assert.match(loading, /aria-busy="true"/)
  assert.doesNotMatch(loading, /3.500|Plan og registreret kost/)
  const error = renderToStaticMarkup(h(View, { enabled: true, state: 'error', onRetry() {}, report: buildNutritionReport(input()) }))
  assert.match(error, /role="alert"/); assert.match(error, /<button type="button"/)
  assert.doesNotMatch(error, /3.500|Plan og registreret kost/)
})
