import assert from 'node:assert/strict'
import { createUploadController } from './uploadController.mjs'
import { renderUpload, renderReview } from './view.mjs'
import { createReviewController } from './reviewController.mjs'
import { pausedSet, sourceFor } from './setBoundaryFixture.mjs'

export function verifyBoundaryViews(h, text) {
  const c = createUploadController({ enabled: true, options: [{ key: 'synthetic', exercise_name: 'Syntetisk løft', set_number: 1 }] })
  c.choose('synthetic'); c.next()
  const render = () => text(renderUpload(h, { state: c.snapshot(), controller: c }))
  assert.match(render(), /Vælg video/)
  c.select(sourceFor(pausedSet()))
  assert.match(render(), /Hele sættet er markeret med buffer/)
  assert.doesNotMatch(render(), /Vi starter med slutningen/)
  c.select(sourceFor({ lift: 'bench', samples: [] }))
  assert.match(render(), /Ingen tydelige gentagelser/)
  c.select(sourceFor(pausedSet('bench', { finalRest: 0.2 })))
  assert.match(render(), /afsluttende hvile kunne ikke bekræftes/)
  c.select(sourceFor(pausedSet('bench', { chestPause: 10, lockoutPause: 6 }), 40))
  assert.match(render(), /overskrider grænsen/)
  assert.match(render(), /ikke valgt automatisk/)
  c.move(0)
  assert.match(render(), /valgt intervallet manuelt/)
  c.select(sourceFor({ lift: 'bench', samples: [{ time: 0, position: NaN, atRest: true }] }))
  assert.match(render(), /Bevægelsesdata skal have stigende tid/)
  assert.equal(renderUpload(h, { state: { enabled: false }, controller: c }), null)
  const coach = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 10 })
  const output = text(renderReview(h, { state: coach.snapshot(), controller: coach }))
  assert.match(output, /Din konklusion/)
  assert.match(output, /Forbind den eksisterende afspiller/)
  assert.equal(renderReview(h, { state: { enabled: false }, controller: coach }), null)
  c.dispose(); coach.dispose()
}
