// Runs with the app's own real React dependencies under npm test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderProgramBlokslut, programBlokslutModel } from './programBlokslut.mjs'
import { snapshot } from './blokslutFixture.mjs'
const render = (model, open = true) => renderToStaticMarkup(renderProgramBlokslut(createElement, model, { open, onRetry() {} }))
const model = rows => programBlokslutModel({ athleteId: 'synthetic', ...snapshot(), readPage: () => ({ data: rows }) })
test('real React: compact report shows gains, completed sessions and one focus; later folded', async () => {
  const m = await model(snapshot().exerciseLogs), html = render(m)
  assert.match(html, /aria-label="Din blok".*open=""/)
  assert.match(html, /Gennemførte pas: 3 af 3.*Squat: \+11 kg.*Ét fokuspunkt:/)
  assert.doesNotMatch(render(m, false), /open=""/)
})
test('real React: empty has no invented strength gains', async () => {
  const html = render(await model([]))
  assert.match(html, /Ingen bekræftede træningssæt/)
  assert.doesNotMatch(html, /\+11|0 kg beregnet e1RM/)
})
test('real React: error and loading have semantic messages and no summary metrics', () => {
  assert.match(render({ status: 'loading', message: 'Henter blokkens data.' }), /role="status"/)
  const html = render({ status: 'error', message: 'Blokkens data kunne ikke hentes.' })
  assert.match(html, /role="alert"/); assert.match(html, /Prøv igen/)
  assert.doesNotMatch(html, /Gennemførte pas|Ét fokuspunkt:/)
})
