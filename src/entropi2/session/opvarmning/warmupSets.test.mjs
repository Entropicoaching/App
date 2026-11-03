import test from 'node:test'
import assert from 'node:assert/strict'
import { warmupSets } from './warmupSets.mjs'

test('three, four and five sets from the supplied first work weight', () => {
  assert.deepEqual(warmupSets({ weight: 50 }), [
    { weight: 20, reps: 5, targetPercent: 40, percent: 40 },
    { weight: 30, reps: 3, targetPercent: 60, percent: 60 },
    { weight: 40, reps: 1, targetPercent: 80, percent: 80 },
  ])
  assert.deepEqual(warmupSets({ weight: 100 }).map(s => [s.weight, s.reps]),
    [[40, 5], [55, 4], [70, 3], [85, 1]])
  assert.deepEqual(warmupSets({ weight: 200 }).map(s => [s.weight, s.reps]),
    [[70, 5], [100, 4], [130, 3], [160, 2], [180, 1]])
  for (const [weight, count] of [[79.99, 3], [80, 4], [159.99, 4], [160, 5]])
    assert.equal(warmupSets({ weight }).length, count)
})

test('2.5 kg rounding uses nearest step; displayed percent follows rounded kg', () => {
  const result = warmupSets({ weight: 52.5 })
  assert.deepEqual(result.map(s => s.weight), [20, 32.5, 42.5])
  assert.deepEqual(result.map(s => s.percent), [38, 62, 81])
  assert.equal(warmupSets({ weight: 18.75 })[1].weight, 12.5)
})

test('invalid, unnormalized and insufficient loads produce no suggestion', () => {
  for (const weight of [undefined, null, '', '100', '52,5', true, {}, [], NaN,
    Infinity, -Infinity, -10, 0, 2.5, 7.5, 9.99, Number.MAX_VALUE])
    assert.deepEqual(warmupSets({ weight }), [])
  for (const input of [undefined, null, {}, [], 100]) assert.deepEqual(warmupSets(input), [])
})

test('distinct increasing positive grid loads below work weight, tapering reps', () => {
  for (let eighths = 80; eighths <= 8000; eighths++) {
    const weight = eighths / 8, result = warmupSets({ weight })
    assert.ok(result.length >= 3 && result.length <= 5)
    let previous = 0, reps = Infinity
    for (const set of result) {
      assert.ok(set.weight > previous && set.weight < weight)
      assert.equal(set.weight % 2.5, 0)
      assert.ok(Number.isInteger(set.reps) && set.reps > 0 && set.reps <= reps)
      assert.equal(set.percent, Math.round(set.weight / weight * 100))
      previous = set.weight; reps = set.reps
    }
  }
})

test('frozen source is unchanged, irrelevant data ignored and calls return fresh sets', () => {
  const source = Object.freeze({ weight: 100,
    get reps() { throw Error('Unneeded reps read') },
    get savedData() { throw Error('Unneeded data read') } })
  const a = warmupSets(source), b = warmupSets(source)
  assert.deepEqual(a, b)
  a[0].weight = 999
  assert.equal(warmupSets(source)[0].weight, 40)
  assert.equal(source.weight, 100)
})
