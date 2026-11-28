import test from 'node:test'
import assert from 'node:assert/strict'
import { dagTilRaekker } from './PortalPlan.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const del = (foodId, grams) => ({ name: 'x', grams, foodId })
test('2490: dagens maaltider bliver editorens raekker, manglende maaltider staar tomme', () => {
  const raekker = dagTilRaekker({ meals: [{ name: 'A', portions: [del(FOODS[0].id, 200), del(FOODS[1].id, 50)] }, { name: 'B', portions: [del(FOODS[2].id, 300)] }] })
  assert.equal(raekker.length, 3)
  assert.deepEqual(raekker[0].map(i => [i.foodId, i.grams]), [[FOODS[0].id, '200'], [FOODS[1].id, '50']])
  assert.deepEqual(raekker[2], [{ foodId: '', grams: '' }])
})
test('2490: ukendt foedevare, for mange maaltider eller ingen maaltider giver ingen forudfyldning', () => {
  assert.equal(dagTilRaekker({ meals: [{ name: 'A', portions: [del('syn:ukendt', 100)] }] }), null)
  assert.equal(dagTilRaekker({ meals: Array.from({ length: 4 }, () => ({ name: 'A', portions: [del(FOODS[0].id, 100)] })) }), null)
  assert.equal(dagTilRaekker({ meals: [] }), null)
  assert.equal(dagTilRaekker({ meals: [{ name: 'A', portions: [del(FOODS[0].id, 0)] }] }), null)
})
