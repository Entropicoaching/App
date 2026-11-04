import test from 'node:test'
import assert from 'node:assert/strict'
import { EATING_OUT_DISHES, EATING_OUT_PORTIONS, estimateEatingOut } from './eatingOut.mjs'

test('catalog has unique stable IDs and immutable editorial assumptions', () => {
  assert.equal(new Set(EATING_OUT_DISHES.map(d => d.id)).size, 8)
  assert.deepEqual(EATING_OUT_PORTIONS.map(p => p.label), ['Lille', 'Mellem', 'Stor'])
  for (const dish of EATING_OUT_DISHES) {
    assert.ok(dish.label && dish.portion)
    assert.throws(() => { dish.kcal = 0 }, TypeError)
  }
  assert.throws(() => EATING_OUT_DISHES.pop(), TypeError)
})

test('known fixture yields a rounded, explicitly marked estimate and broad bands', () => {
  const result = estimateEatingOut('pizza', 'medium')
  assert.equal(result.kcal, 1000)
  assert.equal(result.protein, 40)
  assert.deepEqual(result.kcalRange, [700, 1300])
  assert.deepEqual(result.proteinRange, [30, 50])
  assert.equal(result.isEstimate, true)
  assert.equal(result.kind, 'eating-out-estimate')
  assert.match(result.notice, /ikke en måling/)
  assert.match(result.notice, /uden for intervallet/)
})

test('all dishes have positive increasing portions with rounded enclosing bands', () => {
  for (const dish of EATING_OUT_DISHES) {
    const results = EATING_OUT_PORTIONS.map(p => estimateEatingOut(dish.id, p.id))
    for (const metric of ['kcal', 'protein']) {
      assert.ok(results[0][metric] < results[1][metric])
      assert.ok(results[1][metric] < results[2][metric])
      for (const r of results) {
        assert.ok(Number.isFinite(r[metric]) && r[metric] > 0)
        assert.ok(r[metric + 'Range'][0] <= r[metric])
        assert.ok(r[metric + 'Range'][1] >= r[metric])
        assert.equal(r[metric] % (metric === 'kcal' ? 50 : 5), 0)
      }
    }
  }
})

test('unknown or malformed IDs fail closed without conversion; results are detached', () => {
  const bad = [undefined, null, '', 'toString', '__proto__', 'PIZZA', {}, [], 0,
    { toString() { throw new Error('must not coerce') } }]
  for (const id of bad) {
    assert.equal(estimateEatingOut(id, 'medium'), null)
    assert.equal(estimateEatingOut('pizza', id), null)
  }
  const result = estimateEatingOut('pizza', 'medium')
  result.kcalRange[0] = -1; result.kcal = 0
  assert.equal(estimateEatingOut('pizza', 'medium').kcalRange[0], 700)
  assert.equal(estimateEatingOut('pizza', 'medium').kcal, 1000)
})
