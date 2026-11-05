import test from 'node:test'
import assert from 'node:assert/strict'
import { createReviewController } from './reviewController.mjs'
import { renderReview } from './view.mjs'
import { syntheticH as h, syntheticDOM, nodes, syntheticLift } from './barPathFixtures.mjs'
import { verifyBarPathView, verifyOff } from './barPathViewCases.mjs'

test('synthetic DOM: actual review/controller render data, empty, missing, scale and error states', () => verifyBarPathView(h, syntheticDOM))
test('synthetic DOM: default OFF and explicit OFF ignore poisoned inputs', () => verifyOff(h))

test('synthetic DOM: long gaps produce disconnected paths and estimated portions stay dashed', () => {
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5 })
  const samples = Array.from({ length: 22 }, (_, i) => ({ time: i / 30, x: i > 1 && i < 19 ? null : i >= 19 ? 400 : 100, y: i > 1 && i < 19 ? null : 100 }))
  controller.syntheticBarPath(samples)
  const tree = renderReview(h, { state: controller.snapshot(), controller })
  const svg = nodes(tree, 'svg').find(node => node.props['aria-label'] === 'Syntetisk stangbane med stiplede estimater')
  const lines = nodes(svg, 'polyline')
  assert.equal(lines.length, 10, '8 before loss, 2 after; never bridge the lost points')
  assert.equal(lines.filter(node => node.props.strokeDasharray).length, 7)
  assert.equal(nodes(tree, 'details').find(node => Object.hasOwn(node.props, 'data-entropi2-synthetic-bar-path')).props.open, undefined)
  controller.dispose()
})
test('scope changes and disposal prevent further analysis, subscriptions do not leak results', () => {
  let scope = 'synthetic-a', calls = 0
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5, getScope: () => scope })
  const stop = controller.subscribe(() => calls++)
  controller.syntheticBarPath(syntheticLift().samples)
  assert.equal(calls, 2)
  const snapshot = controller.snapshot(); snapshot.barPath.points[0].x = -1
  assert.notEqual(controller.snapshot().barPath.points[0].x, -1)
  stop(); controller.syntheticBarPath([]); assert.equal(calls, 2)
  scope = 'synthetic-b'
  assert.equal(controller.syntheticBarPath(syntheticLift().samples), false)
  assert.deepEqual(controller.snapshot(), { enabled: false })
  controller.dispose()
  assert.equal(controller.syntheticBarPath([]), false)
})
test('analysis cannot invoke persistence, media, transport or conclusion callbacks', () => {
  let writes = 0
  const fail = () => { writes++; throw Error('Unexpected external operation') }
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5,
    callbacks: { saveConclusion: fail, saveMarkers: fail, seek: fail }, conversation: { snapshot: fail, send: fail } })
  assert.equal(controller.syntheticBarPath(syntheticLift().samples), true)
  assert.equal(writes, 0)
  assert.equal(controller.snapshot().dirty, false)
  controller.dispose()
})
test('busy review refuses analysis and error cannot retain a stale successful graph', async () => {
  let resolve
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5,
    callbacks: { saveConclusion: () => new Promise(done => { resolve = done }) } })
  controller.conclusion('focus', 'Syntetisk fokus')
  const pending = controller.saveConclusion()
  assert.equal(controller.syntheticBarPath(syntheticLift().samples), false)
  resolve(true); assert.equal(await pending, true)
  controller.syntheticBarPath(syntheticLift().samples)
  assert.notEqual(controller.snapshot().barPath, null)
  assert.equal(controller.syntheticBarPath(null), false)
  assert.equal(controller.snapshot().barPath, null)
  controller.dispose()
})
