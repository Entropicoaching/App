// Deliberately a hard gate: real React, no fixture loader or conditional skip.
// Discovered by the app's existing npm test runner after merge.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StaevneCoach from './StaevneCoach.mjs'
import { input } from './fixture.mjs'

const render = (overrides = {}, props = {}) => renderToStaticMarkup(h(StaevneCoach,
  { enabled: true, role: 'coach', input: input(overrides), ...props }))

test('real React: strict OFF and coach-only visibility', () => {
  for (const enabled of [false, undefined, 'true', 1]) assert.equal(render({}, { enabled }), '')
  for (const role of ['athlete', undefined, 'admin']) assert.equal(render({}, { role }), '')
})

test('real React: coach summary, four checkpoints, native folded detail and sources', () => {
  const html = render()
  assert.match(html, /Stævnekost til coachen/); assert.match(html, /Tal med din coach/)
  assert.match(html, /Coachkladde/); assert.match(html, /80 kg nu/)
  assert.match(html, /78 kg som pejlemærke/); assert.match(html, /ikke aktiveret/)
  assert.equal((html.match(/<details>/g) ?? []).length, 2)
  assert.equal((html.match(/<summary /g) ?? []).length, 2)
  assert.doesNotMatch(html, /<details[^>]*\bopen|<button|<form|<input/)
  assert.equal((html.match(/href="https:\/\/doi.org\//g) ?? []).length, 3)
})

test('real React: empty, invalid and blocked safety states do not show computed targets', () => {
  const empty = render({}, { input: null })
  assert.match(empty, /role="status"/); assert.match(empty, /ingen plan endnu/)
  for (const overrides of [{ weightKg: Infinity }, { adult: false }, { asOf: '2026-11-29' }]) {
    const html = render(overrides)
    assert.match(html, /role="alert"/); assert.match(html, /Tal med din coach/)
    assert.doesNotMatch(html, /Uge 1|Efter vejning|80 kg nu/)
  }
})

test('real React: shortfall at 2h never suggests acute water loss', () => {
  const html = render({ weighInHours: 2, competitionDate: '2026-11-08', weightClassKg: 79 })
  assert.match(html, /role="alert"/); assert.match(html, /Ingen akut vandreduktion ved 2 timers/)
  assert.doesNotMatch(html, /Vurderingsloft ved 24 timer/)
})

test('real React: 24h assessment is not permission and recovery has an acute-care warning', () => {
  const html = render({ competitionDate: '2026-11-09', weightClassKg: 78.8 })
  assert.match(html, /role="alert"/); assert.match(html, /ikke et vandtabsmål eller en tilladelse/)
  assert.match(html, /søg akut lægehjælp/); assert.match(html, /ikke en dokumenteret sikker dosis/)
})
