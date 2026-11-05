// Arithmetic fixtures only; these numbers are not food composition data.
import { createFood } from '../foedevarer/index.mjs'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

export const syntheticMicros = { ironMg: 2, calciumMg: 100, magnesiumMg: 30, zincMg: 1,
  potassiumMg: 200, sodiumMg: 50, vitaminDUg: 0, vitaminB12Ug: 0.5, folateUg: 20 }
export function microFood(id, values = {}) {
  return createFood({ id, name: `Syntetisk ${id}`, preparation: 'synthetic',
    source: { citation: 'Synthetic arithmetic fixture only', verification: 'synthetic' },
    nutrientsPer100g: { energyKcal: 100, proteinG: 10, carbohydrateG: 10, fatG: 2,
      ...syntheticMicros, ...values } })
}
export function microPlan(values = {}) {
  const f = syntheticInput({ catalog: [microFood('a'), microFood('b', values)], template: [
    { id: 'first', name: 'Syntetisk første måltid', items: [{ foodId: 'a', grams: 100 }] },
    { id: 'second', name: 'Syntetisk andet måltid', items: [{ foodId: 'b', grams: 100 }] },
  ] })
  const controller = createCoachPlan(f.options)
  controller.generate(); controller.editGrams(0, 0, '150'); controller.editGrams(1, 0, '50')
  return { ...f, controller }
}
