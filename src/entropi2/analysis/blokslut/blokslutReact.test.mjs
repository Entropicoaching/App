import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BlokslutView from './BlokslutView.mjs'
import { snapshot } from './blokslutFixture.mjs'
const html = extra => renderToStaticMarkup(h(BlokslutView, snapshot(extra)))

test('real React: overview, folded volume and focus are rendered', () => {
  const result = html()
  assert.match(result, /Pas gennemført: 3 af 3/)
  assert.match(result, /110 → 121 kg e1RM/)
  assert.match(result, /Ét fokus til næste blok/)
  assert.match(result, /<details><summary/)
  assert.doesNotMatch(result, /<details open/)
  assert.match(result, /1\.380 kg løftet/)
  assert.equal(html({ entropi2: false }), '')
})

test('real React: empty, missing, loading and error carry no invented metrics', () => {
  const empty = html({ exerciseLogs: [] })
  assert.match(empty, /Ingen bekræftede træningssæt/)
  assert.doesNotMatch(empty, /→|0 kg e1RM/)
  assert.match(html({ exerciseLogs: undefined }), /logdata mangler/)
  assert.match(html({ loading: true }), /role="status"/)
  const error = html({ error: 'synthetic raw detail' })
  assert.match(error, /role="alert"/); assert.match(error, /kunne ikke hentes/)
  assert.doesNotMatch(error, /synthetic raw detail|Pas gennemført|→/)
})
