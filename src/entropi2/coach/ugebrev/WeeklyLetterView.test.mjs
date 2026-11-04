import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WeeklyLetter from './WeeklyLetterView.mjs'
import { letterFixture, emptyFixture } from './letterFixture.mjs'
const render = props => renderToStaticMarkup(createElement(WeeklyLetter, props))

test('real React: OFF renders nothing without reading data', () => {
  const data = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(render({ data }), '')
})

test('real React: draft visible in labelled editable field with folded basis, no send action', () => {
  const d = letterFixture(); d.daily[0].pain = 8; d.daily[0].painLocation = 'syntetisk knæ'
  const html = render({ enabled: true, data: d })
  for (const value of ['Udkast til ugebrev', '<textarea', 'Ros, ét fokuspunkt og ét spørgsmål',
    'Redigér altid', '1 af 2 planlagte pas', 'afklare den registrerede smerte',
    '<details>', '<summary', 'Grundlag for fokus', 'minimum 1', 'Beregnet værdi: 8',
    'Bekræftede planlagte pas: 1/2', '7/7', '2026-10-26', '2026-11-01', 'width:100%']) {
    assert.ok(html.includes(value), value)
  }
  const id = html.match(/<textarea id="([^"]+)"/)[1]
  assert.ok(html.includes(`for="${id}"`)); assert.ok(html.includes(`aria-describedby="${id}-help"`))
  assert.doesNotMatch(html, /<button|<form|readOnly|disabled|<details open|cyklus|syntetisk knæ/i)
  assert.equal((html.match(/<textarea/g) || []).length, 1)
})

test('real React: empty and error never show an editable stale draft', () => {
  const empty = render({ enabled: true, data: emptyFixture() })
  assert.match(empty, /endnu ikke et sikkert grundlag/); assert.doesNotMatch(empty, /textarea/)
  const error = render({ enabled: true, data: { ...letterFixture(), complete: false } })
  assert.match(error, /role="alert"/); assert.doesNotMatch(error, /textarea|endnu ikke/)
  assert.match(render({ enabled: true, data: { state: 'loading' } }), /aria-busy="true"/)
})

test('real React: unknown nutrition and training are honestly described', () => {
  const d = letterFixture(); d.compliance = null; d.nutritionDays = undefined
  const html = render({ enabled: true, data: d })
  assert.match(html, /Ugens pas: ukendt/); assert.match(html, /Ugens kost: ukendt/)
  assert.match(html, /Dele af datagrundlaget er utilstrækkelige/)
})
