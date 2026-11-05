import test from 'node:test'
import assert from 'node:assert/strict'
import { createReviewController } from './reviewController.mjs'
import { renderReview, renderUpload } from './view.mjs'
import { createUploadController } from './uploadController.mjs'
import { syntheticH as h, syntheticDOM as render, nodes } from './barPathFixtures.mjs'

test('pinned review contract: conclusion and markers retain their exact persistence payloads', async () => {
  const calls = []
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5, uuid: () => 'synthetic-marker',
    callbacks: { saveConclusion(id, value) { calls.push([id, value]); return true }, saveMarkers(id, value) { calls.push([id, value]); return true } } })
  controller.conclusion('focus', 'Syntetisk fokus')
  assert.equal(await controller.saveConclusion(), true)
  assert.deepEqual(calls[0], ['synthetic-review', { works: '', focus: 'Syntetisk fokus', next_set: '' }])
  controller.marker('text', 'Syntetisk markering'); assert.equal(controller.addMarker(), true)
  assert.equal(await controller.saveMarkers(), true)
  assert.deepEqual(calls[1], ['synthetic-review', [{ id: 'synthetic-marker', start: 0, end: 1, text: 'Syntetisk markering', strokes: [] }]])
  assert.match(render(renderReview(h, { state: controller.snapshot(), controller })), /Gem konklusion som kladde/)
  controller.dispose()
})
test('pinned review contract: normalized drawings and seek events remain available', () => {
  const seeks = []
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5, callbacks: { seek: value => seeks.push(value) } })
  assert.equal(controller.drawStart(1, -1, 0.2), true)
  assert.equal(controller.drawMove(1, 2, 0.8), true)
  assert.equal(controller.drawEnd(1), true)
  assert.deepEqual(controller.snapshot().strokes[0].points, [[0, 0.2], [1, 0.8]])
  assert.equal(controller.time(2), true)
  const tree = renderReview(h, { state: controller.snapshot(), controller })
  nodes(tree, 'button').find(node => node.children[0] === 'Gå til tidspunkt').props.onClick()
  assert.deepEqual(seeks, [2])
  assert.equal(controller.seek(5), false)
  controller.dispose()
})
test('pinned review contract: failure is visible, never falsely saved', async () => {
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5,
    callbacks: { saveConclusion: () => false } })
  controller.conclusion('focus', 'Syntetisk fokus')
  assert.equal(await controller.saveConclusion(), false)
  assert.match(render(renderReview(h, { state: controller.snapshot(), controller })), /Handlingen er ikke bekræftet/)
  assert.equal(controller.snapshot().status, '')
  controller.dispose()
})
test('pinned contract: upload and review default OFF render nothing', () => {
  const upload = createUploadController(), review = createReviewController()
  assert.deepEqual(upload.snapshot(), { enabled: false, options: [], phase: 'off', error: '' })
  assert.deepEqual(review.snapshot(), { enabled: false })
  assert.equal(renderUpload(h, { state: upload.snapshot(), controller: upload }), null)
  assert.equal(renderReview(h, { state: review.snapshot(), controller: review }), null)
  upload.dispose(); review.dispose()
})
