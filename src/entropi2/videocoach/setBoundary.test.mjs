import test from 'node:test'
import assert from 'node:assert/strict'
import { findSetBoundary, REST_SECONDS, START_BUFFER_SECONDS } from './setBoundary.mjs'
import { motionSeries, pausedSet } from './setBoundaryFixture.mjs'

const detect = (motion, duration = 40) => findSetBoundary({ ...motion, duration })

for (const lift of ['bench', 'squat', 'deadlift']) {
  test(`${lift}: both reps survive chest/bottom and short top/floor stops`, () => {
    const motion = pausedSet(lift), before = structuredClone(motion)
    const result = detect(motion)
    assert.equal(result.status, 'ready')
    assert.equal(result.repCount, 2)
    assert.ok(result.window.start <= 1.5 - START_BUFFER_SECONDS)
    assert.ok(result.window.end > 7.5, 'last rep must be retained')
    assert.ok(result.window.end - result.restSince > REST_SECONDS)
    assert.deepEqual(motion, before, 'caller-owned samples stay unchanged')
    // No prefix through the second rep may terminate the set.
    for (let n = 1; n < motion.samples.length; n++) {
      const prefix = { ...motion, samples: motion.samples.slice(0, n) }
      const partial = detect(prefix)
      if (partial.status === 'ready') assert.equal(partial.repCount, 2)
    }
  })
}
test('bench regression: 4-second chest pause cannot terminate a set', () => {
  const result = detect(pausedSet('bench', { chestPause: 4 }))
  assert.equal(result.status, 'ready'); assert.equal(result.repCount, 2)
})
test('bench regression: 4-second unracked lockout is not final rest after rep one', () => {
  const result = detect(pausedSet('bench', { lockoutPause: 4 }))
  assert.equal(result.status, 'ready'); assert.equal(result.repCount, 2)
  assert.ok(result.window.end > 12)
})
test('squat: unracked top pause longer than the dwell threshold is preserved', () => {
  const result = detect(pausedSet('squat', { lockoutPause: 4 }))
  assert.equal(result.status, 'ready'); assert.equal(result.repCount, 2)
})
test('strict threshold: exactly 2.5 seconds of rack rest is insufficient', () => {
  const motion = motionSeries('bench', [[1, 0, true], [0.5, 1], [0.5, 0], [2.6, 0, true]])
  // Rack evidence starts at 2.1, so 4.6 is exactly 2.5 seconds later.
  assert.equal(detect(motion).status, 'incomplete')
  motion.samples.push({ time: 4.7, position: 0, atRest: true })
  assert.equal(detect(motion).status, 'ready')
})
test('rest timer resets on renewed motion and does not accumulate between reps', () => {
  const motion = motionSeries('deadlift', [[1, 1, true], [0.5, 0], [0.5, 1], [2, 1, true],
    [0.5, 0], [0.5, 1], [2, 1, true]])
  assert.equal(detect(motion).status, 'incomplete')
})
test('exact threshold at a non-zero timestamp does not end early through floating-point rounding', () => {
  const motion = motionSeries('bench', [[2.6, 0, true], [0.5, 1], [0.5, 0], [2.6, 0, true]])
  assert.equal(detect(motion).status, 'incomplete')
})
test('rest evidence resets on a single unconfirmed sample', () => {
  const motion = pausedSet('bench')
  const rest = motion.samples.filter(s => s.atRest && s.time > 6)
  rest[Math.floor(rest.length / 2)].atRest = false
  assert.equal(detect(motion).status, 'incomplete')
})
test('missing frames cannot supply the required continuous rest', () => {
  const motion = pausedSet('bench')
  motion.samples = motion.samples.filter(s => s.time < 8 || s.time > 9.3)
  assert.equal(detect(motion).status, 'incomplete')
})
test('jitter in rack is empty; standing in rack never counts as a completed rep', () => {
  const motion = motionSeries('bench', [[8, 0, true]])
  motion.samples.forEach((s, i) => { s.position = i % 2 ? 0.01 : 0 })
  assert.deepEqual(detect(motion), { status: 'empty', repCount: 0 })
})
test('empty input and partial excursions are honest empty/incomplete results', () => {
  assert.deepEqual(detect({ lift: 'bench', samples: [] }), { status: 'empty', repCount: 0 })
  const partial = motionSeries('bench', [[1, 0, true], [1, 0.1], [1, 0], [4, 0, true]])
  assert.equal(detect(partial).reason, 'no-rep')
})
test('series starting mid-rep cannot claim a complete start', () => {
  const motion = pausedSet('bench'); motion.samples = motion.samples.slice(20)
  assert.equal(detect(motion).reason, 'missing-start')
})
test('truncated end stays incomplete, rather than cropping at the last observed rep', () => {
  const motion = pausedSet('bench', { finalRest: 0.5 })
  assert.equal(detect(motion).reason, 'no-rest')
})
test('buffer clamps at zero and retains the first movement', () => {
  const motion = motionSeries('bench', [[0.2, 0, true], [0.5, 1], [0.5, 0], [3, 0, true]])
  const result = detect(motion)
  assert.equal(result.status, 'ready'); assert.equal(result.window.start, 0)
})
test('a slow first departure is retained before motion crosses the confirmation threshold', () => {
  const motion = motionSeries('bench', [[1, 0, true], [4, 0.06], [0.6, 1], [0.6, 0], [3, 0, true]])
  const result = detect(motion)
  assert.equal(result.status, 'ready')
  assert.ok(result.window.start <= 1 - START_BUFFER_SECONDS)
})
test('ready result preserves the full set even beyond the separate upload limit', () => {
  const result = detect(pausedSet('bench', { chestPause: 10, lockoutPause: 6 }), 40)
  assert.equal(result.status, 'ready'); assert.equal(result.repCount, 2)
  assert.ok(result.window.end - result.window.start > 15)
})
test('actual timestamps, not sample count, control the threshold', () => {
  const motion = pausedSet('bench')
  const dense = { ...motion, samples: motion.samples.flatMap((s, i, all) => {
    const next = all[i + 1]
    return next ? [s, { time: (s.time + next.time) / 2, position: (s.position + next.position) / 2, atRest: s.atRest && next.atRest }] : [s]
  }) }
  const a = detect(motion), b = detect(dense)
  assert.equal(b.status, 'ready'); assert.equal(b.repCount, 2)
  assert.ok(Math.abs(a.window.start - b.window.start) <= 0.1)
  assert.ok(Math.abs(a.window.end - b.window.end) <= 0.2)
})
test('malformed or nonfinite signals fail before producing a window', () => {
  const badInputs = [undefined, {}, { lift: 'curl', samples: [], duration: 10 },
    { lift: 'bench', samples: [], duration: Infinity }, { lift: 'bench', samples: [], duration: 0 },
    ...[NaN, Infinity, -1, 2, '0'].map(position => ({ lift: 'bench', duration: 10,
      samples: [{ time: 0, position, atRest: true }] })),
    ...[undefined, 1, 'true'].map(atRest => ({ lift: 'bench', duration: 10,
      samples: [{ time: 0, position: 0, atRest }] })),
    ...[-1, 11, NaN].map(time => ({ lift: 'bench', duration: 10,
      samples: [{ time, position: 0, atRest: true }] })),
    { lift: 'bench', duration: 10, samples: [{ time: 1, position: 0, atRest: true }, { time: 1, position: 0, atRest: true }] },
    { lift: 'bench', duration: 10, samples: [{ time: 2, position: 0, atRest: true }, { time: 1, position: 0, atRest: true }] },
    { lift: 'bench', duration: 10, samples: Array(100001).fill(null) }]
  for (const value of badInputs) assert.throws(() => findSetBoundary(value))
})
