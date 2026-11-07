import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeekPlan } from '../ugeplan/model.mjs'
import { ingredientKey } from './ingredients.mjs'
import { formatShoppingSnapshot } from './export.mjs'

function plan(ingredients) {
  const data = new Map()
  const model = createWeekPlan({ enabled: true, athleteId: 'PRIVATE-OWNER', date: '2026-11-04',
    storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) },
    templates: [{ id: 'PRIVATE-TEMPLATE', name: 'PRIVATE-MEAL', meal: { meal: 'PRIVATE-MEAL' }, ingredients }] })
  model.add(0, 'PRIVATE-TEMPLATE'); model.add(0, 'PRIVATE-TEMPLATE')
  return model
}

test('export uses actual repeated-occurrence projection, explicit preparation/units, unknown vs zero, no metadata IDs', () => {
  const model = plan([
    { name: 'Ris', quantity: 0.1, unit: 'kg', preparation: 'rå', foodId: 'PRIVATE-FOOD', source: 'PRIVATE-SOURCE' },
    { name: 'Ris', quantity: 50, unit: 'g', preparation: 'kogt' },
    { name: 'Ris', quantity: 20, unit: 'ml' },
  ])
  const items = model.snapshot().shopping.items
  model.confirmStock(ingredientKey(items[0]), 0)
  model.confirmStock(ingredientKey(items[1]), 200)
  const snapshot = model.snapshot(), before = structuredClone(snapshot)
  assert.equal(formatShoppingSnapshot(snapshot), [
    'Ugens indkøbsliste · ugen fra 2026-11-02',
    'Ris: 200 g (samlet behov). Tilberedning: rå. Bekræftet beholdning: 0 g. Nettokøb: 200 g.',
    'Ris: 100 g (samlet behov). Tilberedning: kogt. Bekræftet beholdning: 200 g. Nettokøb: 0 g.',
    'Ris: 40 ml (samlet behov). Tilberedning: ukendt. Bekræftet beholdning: ikke angivet. Nettokøb: 40 ml.',
  ].join('\n'))
  assert.doesNotMatch(formatShoppingSnapshot(snapshot), /PRIVATE|kcal|protein|foodId|athleteId/)
  assert.deepEqual(snapshot, before)
})

test('missing ingredients and actual calculation errors remain explicit, never an apparently complete list', () => {
  assert.match(formatShoppingSnapshot(plan(undefined).snapshot()),
    /Listen er ufuldstændig: 2 måltider mangler ingredienser eller skabelon\./)
  const failed = plan([{ name: 'Fejl', quantity: -1, unit: 'g' }]).snapshot()
  const text = formatShoppingSnapshot(failed)
  assert.ok(text.includes(failed.shopping.error)); assert.match(text, /Listen er ufuldstændig/)
  assert.doesNotMatch(text, /samlet behov|Nettokøb/)
  const readError = 'Ugekladden kunne ikke læses.'
  assert.match(formatShoppingSnapshot({ ...failed, error: readError, readFailed: true }), /Ugekladden kunne ikke læses/)
})
