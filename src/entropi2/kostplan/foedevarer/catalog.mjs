import { LOCAL_FOODS } from '../../../athlete/lokaleFoedevarer.js'

// Units belong to the keys: all amounts are per 100 g of the named food state.
export const NUTRIENTS = Object.freeze(Object.fromEntries([
  ['energyKcal', 'Energi', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbohydrateG', 'Kulhydrat', 'g'],
  ['fatG', 'Fedt', 'g'],
  ['fibreG', 'Fibre', 'g'],
  ['ironMg', 'Jern', 'mg'],
  ['calciumMg', 'Calcium', 'mg'],
  ['magnesiumMg', 'Magnesium', 'mg'],
  ['zincMg', 'Zink', 'mg'],
  ['potassiumMg', 'Kalium', 'mg'],
  ['sodiumMg', 'Natrium', 'mg'],
  ['vitaminDUg', 'D-vitamin', 'µg'],
  ['vitaminB12Ug', 'B12', 'µg'],
  ['folateUg', 'Folat', 'µg'],
  ['leucineG', 'Leucin', 'g'],
].map(([key, label, unit]) => [key, Object.freeze({ label, unit })])))

const text = value => typeof value === 'string' && value.trim().length > 0
export const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0

// Missing values are null, never inferred from macros or a food category.
// Callers supply provenance for new product/food data; this does not verify it.
export function createFood({ id, name, preparation = 'unspecified', nutrientsPer100g, source } = {}) {
  if (![id, name, preparation, source?.citation, source?.verification].every(text)) {
    throw new TypeError('Fødevare kræver id, navn, tilstand og kilde med verifikationsstatus')
  }
  if (!nutrientsPer100g || typeof nutrientsPer100g !== 'object' || Array.isArray(nutrientsPer100g)) {
    throw new TypeError('Næringsindhold pr. 100 g kræves')
  }
  if (Object.keys(nutrientsPer100g).some(key => !Object.hasOwn(NUTRIENTS, key))) {
    throw new TypeError('Ukendt næringsstof eller enhed')
  }
  const nutrients = {}
  for (const key of Object.keys(NUTRIENTS)) {
    const value = nutrientsPer100g[key] ?? null
    if (value !== null && !isAmount(value)) throw new TypeError('Ugyldigt næringsindhold: ' + key)
    nutrients[key] = value
  }
  return Object.freeze({
    id, name, preparation, basisGrams: 100,
    nutrientsPer100g: Object.freeze(nutrients),
    source: Object.freeze({ citation: source.citation, verification: source.verification }),
  })
}

// No second macro database: read the app's existing public list without mutation.
// The legacy list does not consistently specify raw/cooked state or provenance.
export const FOODS = Object.freeze(LOCAL_FOODS.map(food => createFood({
  id: 'local:' + encodeURIComponent(food.name),
  name: food.name,
  preparation: 'as-named; otherwise unspecified',
  nutrientsPer100g: {
    energyKcal: food.kcal100, proteinG: food.protein100,
    carbohydrateG: food.carb100, fatG: food.fat100,
  },
  source: {
    citation: 'src/athlete/lokaleFoedevarer.js @ b54e820420e6ceec5be7ef1a3586d994f13ea6d3',
    verification: 'kilde skal verificeres',
  },
})))
