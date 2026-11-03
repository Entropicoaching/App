import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePlates, PLATES_KG } from './plateCalculator.mjs'

const total = result => result.barWeightKg + 2 * result.platesPerSide.reduce((sum, p) => sum + p.weightKg * p.count, 0)

test('standard and optional bars, bare bars and all plate denominations', () => {
  assert.deepEqual(PLATES_KG, [25, 20, 15, 10, 5, 2.5, 1.25, 0.5])
  for (const bar of [20, 15]) {
    assert.deepEqual(calculatePlates(bar, bar).platesPerSide, [])
    for (const weight of PLATES_KG) {
      const result = calculatePlates(bar + 2 * weight, bar)
      assert.equal(result.status, 'exact')
      assert.equal(total(result), bar + 2 * weight)
      assert.deepEqual(result.platesPerSide, [{ weightKg: weight, count: 1 }])
    }
  }
  assert.deepEqual(calculatePlates(100).platesPerSide, [{ weightKg: 25, count: 1 }, { weightKg: 15, count: 1 }])
})

test('Danish decimals, impossible small loads, lower ties and under-bar requests', () => {
  assert.equal(calculatePlates(' 22,5 ').status, 'exact')
  assert.equal(calculatePlates('22.5').nearestWeightKg, 22.5)
  for (const [weight, expected] of [[20.5, 20], [21.5, 21], [21.75, 22], [22.25, 22], [0, 20], [19.5, 20]]) {
    const result = calculatePlates(weight)
    assert.equal(result.nearestWeightKg, expected)
    assert.equal(total(result), expected)
    assert.equal(result.status, weight < 20 ? 'below-bar' : 'nearest')
  }
  assert.deepEqual(calculatePlates(23).platesPerSide, [{ weightKg: 0.5, count: 3 }])
  assert.equal(calculatePlates(70.5).status, 'exact') // carry back one 25 kg plate
  assert.equal(total(calculatePlates(71.5)), 71.5)
})

test('invalid values do not coerce objects or suggest a load', () => {
  for (const value of ['', ' ', '1e2', '2,5.0', '-1', '<img>', null, undefined, true, [], {}, NaN, Infinity, -1, Number.MAX_VALUE]) {
    const result = calculatePlates(value)
    assert.equal(result.status, 'invalid', String(value))
    assert.equal(result.nearestWeightKg, null)
    assert.deepEqual(result.platesPerSide, [])
  }
  assert.equal(calculatePlates(30, '20').status, 'invalid')
  assert.equal(calculatePlates(30, 10).status, 'invalid')
  assert.doesNotThrow(() => calculatePlates({ toString() { throw Error('must not coerce') } }))
})

test('independent reachable-sum oracle for both bars and fractional requests', () => {
  const reachable = new Set([0])
  // Construct loads by adding actual pairs, without the production reachability rule.
  for (let halfKg = 0; halfKg <= 1200; halfKg++) {
    if (reachable.has(halfKg)) for (const plate of PLATES_KG) reachable.add(halfKg + plate * 4)
  }
  for (const bar of [15, 20]) for (let eighth = 0; eighth <= 4000; eighth++) {
    const wanted = eighth / 8
    const expected = [...reachable].sort((a, b) => a - b).map(n => bar + n / 2)
      .reduce((best, load) => Math.abs(load - wanted) < Math.abs(best - wanted) ? load : best, bar)
    const result = calculatePlates(wanted, bar)
    assert.equal(result.nearestWeightKg, expected, `${bar} kg bar, ${wanted} kg requested`)
    assert.equal(total(result), expected)
    assert.ok(result.platesPerSide.every(p => PLATES_KG.includes(p.weightKg) && Number.isSafeInteger(p.count) && p.count > 0))
  }
})

test('large inputs terminate with compact counts, deterministic fresh results', () => {
  const a = calculatePlates(1e9)
  assert.equal(total(a), 1e9)
  assert.ok(a.platesPerSide.length <= 8)
  a.platesPerSide[0].count = -1
  assert.equal(total(calculatePlates(1e9)), 1e9)
  assert.equal(calculatePlates(Number.MAX_SAFE_INTEGER / 8).status, 'nearest')
  assert.ok(Object.isFrozen(PLATES_KG))
})
