import assert from 'node:assert/strict'
import { createReviewController } from './reviewController.mjs'
import { renderReview, renderUpload } from './view.mjs'
import { syntheticLift } from './barPathFixtures.mjs'

// The same actual view/controller contracts can run with a synthetic DOM locally
// and with real React in the host's npm test. No replacement analysis code.
export function verifyBarPathView(h, render) {
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5 })
  const output = () => render(renderReview(h, { state: controller.snapshot(), controller }))
  let html = output()
  assert.match(html, /Syntetisk stangbane/)
  assert.match(html, /Ingen syntetisk stangbane endnu/)
  assert.match(html, /Ingen video analyseres her/)
  // The optional panel starts folded and cannot send anything to an athlete.
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/)
  assert.equal(controller.syntheticBarPath(syntheticLift().samples, { plateDiameterCm: 45 }), true)
  html = output()
  assert.match(html, /114 målte · 7 estimerede · 0 tabte/)
  assert.match(html, /3 spring afvist/)
  assert.match(html, /Skala fra kendt skive på 45 cm/)
  assert.match(html, /Observeret lodret spænd: [\d,.]+ cm/)
  assert.match(html, /stroke-dasharray|strokeDasharray/)
  assert.match(html, /usikkert estimat/)
  assert.match(html, /ikke et bevis for præcision/)
  controller.syntheticBarPath(syntheticLift().samples)
  assert.match(output(), /Skala ukendt/)
  assert.match(output(), /Observeret lodret spænd: [\d,.]+ px/)
  controller.syntheticBarPath([100, 100, 130].map((diameterPx, i) => ({ time: i / 30, x: 100, y: 100, diameterPx })), { plateDiameterCm: 45 })
  assert.match(output(), /Skivediameteren varierer for meget/)
  controller.syntheticBarPath([{ time: 0, x: null, y: null }])
  assert.match(output(), /Skiven blev ikke fundet/)
  assert.doesNotMatch(output(), /Observeret lodret spænd/)
  assert.equal(controller.syntheticBarPath([{ time: 0, x: '<unsafe>', y: 1 }]), false)
  html = output()
  assert.match(html, /role="alert"/)
  assert.match(html, /Den syntetiske stangbane er ugyldig/)
  assert.doesNotMatch(html, /unsafe|Observeret lodret spænd/)
  controller.syntheticBarPath([])
  assert.match(output(), /Ingen syntetisk stangbane endnu/)
  assert.doesNotMatch(output(), /role="alert"/)
  controller.dispose()
  assert.equal(renderReview(h, { state: controller.snapshot(), controller }), null)
}

export function verifyOff(h) {
  const poison = new Proxy({}, { get() { assert.fail('OFF evaluated a controller, samples or view data') } })
  for (const config of [{}, { enabled: false }, { enabled: 'true' }]) {
    const controller = createReviewController(config)
    assert.deepEqual(controller.snapshot(), { enabled: false })
    assert.equal(controller.syntheticBarPath(poison, poison), false)
    assert.equal(renderReview(h, { state: controller.snapshot(), controller: poison }), null)
    assert.equal(renderUpload(h, { state: controller.snapshot(), controller: poison }), null)
  }
}
