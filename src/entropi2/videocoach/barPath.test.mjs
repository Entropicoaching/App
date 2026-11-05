import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSyntheticBarPath as analyze } from './barPath.mjs'
import { syntheticLift, rmse } from './barPathFixtures.mjs'

for (const lift of ['squat', 'bench', 'deadlift']) {
  test(`${lift}: rejects jumps, rejoins a short loss and reduces synthetic positional RMSE`, () => {
    const { samples, truth } = syntheticLift(lift)
    const result = analyze(samples, { plateDiameterCm: 45 })
    // Same timestamp mask before/after: missing raw samples cannot contribute a
    // baseline error. Evaluate the four recovered missing samples separately.
    const before = rmse(samples, truth), after = rmse(result.points, truth, (_, index) => samples[index].x !== null)
    const recovered = rmse(result.points, truth, (_, index) => samples[index].x === null)
    assert.equal(result.counts.rejected, 3)
    assert.equal(result.counts.estimated, 7)
    assert.equal(result.counts.lost, 0)
    assert.equal(result.segments, 1)
    assert.ok(after < before * 0.25, `${before} -> ${after}`)
    assert.ok(recovered < 5, `missing-point RMSE ${recovered}`)
    assert.equal(result.calibration.status, 'known')
    assert.ok(Math.abs(result.calibration.cmPerPixel - 0.45) < 0.01)
    for (const index of [25, 45, 46, 47, 48, 78, 100]) assert.equal(result.points[index].status, 'estimated')
    assert.equal(result.points[49].status, 'tracked')
    console.log(`SYNTHETIC ${lift}: same-mask raw RMSE=${before.toFixed(3)} px; processed RMSE=${after.toFixed(3)} px; missing-only RMSE=${recovered.toFixed(3)} px; jumps=${result.counts.rejected}; estimated=${result.counts.estimated}`)
  })
  test(`${lift}: jitter-only improvement and reversal remain close to the known path`, () => {
    const { samples, truth } = syntheticLift(lift, { corrupt: false }), result = analyze(samples)
    assert.ok(rmse(result.points, truth) < rmse(samples, truth) * 0.8)
    assert.equal(result.counts.rejected, 0)
    assert.equal(result.calibration.status, 'unknown')
    assert.ok(Math.abs(result.points[60].y - truth[60].y) < 5)
  })
}

test('long loss stops predicting and resumes a new, disconnected segment', () => {
  const samples = Array.from({ length: 22 }, (_, index) => ({ time: index / 30,
    x: index >= 2 && index < 19 ? null : index >= 19 ? 400 : 100,
    y: index >= 2 && index < 19 ? null : 100 }))
  const result = analyze(samples)
  assert.equal(result.segments, 2)
  assert.equal(result.points[8].status, 'estimated')
  assert.equal(result.points[9].status, 'lost')
  assert.equal(result.points[19].status, 'tracked')
  assert.equal(result.points[19].x, 400)
  assert.equal(result.points[19].segment, 1)
})
test('a long timestamp interval makes a new segment without inventing frames', () => {
  const result = analyze([{ time: 0, x: 10, y: 10 }, { time: 2, x: 400, y: 800 }])
  assert.equal(result.points.length, 2)
  assert.equal(result.segments, 2)
})
test('low confidence is visibly estimated; no initial observation means no prediction', () => {
  const result = analyze([{ time: 0, x: 10, y: 10, confidence: 0.1 }, { time: 0.03, x: 10, y: 10 },
    { time: 0.06, x: 11, y: 11, confidence: 0.49 }])
  assert.equal(result.points[0].status, 'lost')
  assert.equal(result.points[2].status, 'estimated')
  assert.equal(result.points[2].reason, 'low-confidence')
  assert.ok(result.points[2].uncertaintyPx > result.points[1].uncertaintyPx)
})
test('short missing interval interpolates only between gated observations', () => {
  const result = analyze([{ time: 0, x: 100, y: 100 }, { time: 0.03, x: 100, y: 103 },
    { time: 0.06, x: null, y: null }, { time: 0.09, x: 100, y: 109 }])
  assert.equal(result.points[2].y, 106)
  assert.equal(result.points[2].status, 'estimated')
  assert.equal(result.points[3].status, 'tracked')
  assert.equal(result.verticalRange.value, 9)
})
test('45 cm scale is explicit; unknown scale never produces centimetres', () => {
  const samples = [{ time: 0, x: 100, y: 100 }, { time: 0.2, x: 100, y: 200 }]
  assert.deepEqual(analyze(samples).verticalRange, { value: 100, unit: 'px' })
  assert.deepEqual(analyze(samples, { plateDiameterCm: 45, plateDiameterPx: 100 }).verticalRange, { value: 45, unit: 'cm' })
  assert.equal(analyze(samples, { plateDiameterCm: 45 }).calibration.status, 'insufficient')
})
test('unstable accepted diameters refuse a physical scale; rejected diameters do not poison calibration', () => {
  const samples = [100, 100, 130, 100].map((diameterPx, index) => ({ time: index / 30, x: 100, y: 100, diameterPx }))
  const result = analyze(samples, { plateDiameterCm: 45 })
  assert.equal(result.calibration.status, 'unstable')
  assert.equal(result.verticalRange.unit, 'px')
  assert.equal(analyze(syntheticLift().samples, { plateDiameterCm: 45 }).calibration.status, 'known')
})
test('empty, all missing and a single observation have honest distinct states', () => {
  assert.equal(analyze([]).status, 'empty')
  const unavailable = analyze([{ time: 0, x: null, y: null }])
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.verticalRange, null)
  assert.equal(analyze([{ time: 0, x: 0, y: 0 }]).verticalRange, null)
})
test('analysis never mutates inputs and outputs have finite or explicitly missing coordinates', () => {
  const { samples } = syntheticLift(), copy = structuredClone(samples)
  samples.forEach(Object.freeze); Object.freeze(samples)
  const result = analyze(samples)
  assert.deepEqual(samples, copy)
  assert.ok(result.points.every(p => p.x === null && p.y === null || Number.isFinite(p.x) && Number.isFinite(p.y)))
})
test('invalid coordinates, time, confidence, diameters, settings and oversized arrays fail closed', () => {
  for (const samples of [null, {}, [null], [{ time: 0, x: NaN, y: 1 }], [{ time: 0, x: 1, y: null }],
    [{ time: 0, x: -1, y: 1 }], [{ time: Infinity, x: 1, y: 1 }], [{ time: 0, x: '1', y: 1 }],
    [{ time: 0, x: 1, y: 1, confidence: 2 }], [{ time: 0, x: 1, y: 1, diameterPx: 0 }],
    [{ time: 1, x: 1, y: 1 }, { time: 1, x: 1, y: 1 }], Array(10001).fill({})]) assert.throws(() => analyze(samples))
  for (const options of [null, [], { plateDiameterCm: 20 }, { plateDiameterPx: 100 }, { plateDiameterCm: 45, plateDiameterPx: 0 },
    { maxSpeedPxPerSecond: 0 }, { maxSpeedPxPerSecond: NaN }]) assert.throws(() => analyze([], options))
})
