import { FRIDA_FOODS } from '../kostplan/foedevarer/frida55.mjs'
import { createFood, NUTRIENTS } from '../kostplan/foedevarer/catalog.mjs'

// Loaded only by the athlete's explicit click. Reuse the bounded official
// references and the existing validated per-100-g units without recalculation.
export function fridaLogFoods() {
  if (FRIDA_FOODS.length !== 40) throw new TypeError('Forkert Frida-udvalg')
  const fields = { kcal100: 'energyKcal', protein100: 'proteinG', carb100: 'carbohydrateG', fat100: 'fatG' }
  const ids = new Set()
  return Object.freeze(FRIDA_FOODS.map(reference => {
    const food = createFood(reference)
    if (food.basisGrams !== reference.basisGrams || !/^frida55:[1-9][0-9]*$/.test(food.id) || ids.has(food.id))
      throw new TypeError('Tvetydig Frida-reference')
    ids.add(food.id)
    const values = Object.fromEntries(Object.entries(fields).map(([flat, nutrient]) => {
      if (NUTRIENTS[nutrient]?.unit !== (flat === 'kcal100' ? 'kcal' : 'g')) throw new TypeError('Ukendt enhed')
      return [flat, food.nutrientsPer100g[nutrient]]
    }))
    return Object.freeze({ id: food.id, name: food.name, preparation: food.preparation, source: food.source, ...values })
  }))
}

// A separate explicit second step; the original 40-food adapter stays unchanged.
export async function extendedFridaLogFoods() {
  const { loadExtendedCoachFoods } = await import('../kostplan/foedevarer/frida55ExtendedLoader.mjs')
  const catalog = await loadExtendedCoachFoods()
  const fields = { kcal100: 'energyKcal', protein100: 'proteinG', carb100: 'carbohydrateG', fat100: 'fatG' }
  return Object.freeze(catalog.slice(40).map(reference => {
    const food = createFood(reference)
    const values = Object.fromEntries(Object.entries(fields).map(([flat, nutrient]) => {
      const value = food.nutrientsPer100g[nutrient]
      if (NUTRIENTS[nutrient]?.unit !== (flat === 'kcal100' ? 'kcal' : 'g')
        || typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw TypeError('Ukendt makroværdi')
      return [flat, value]
    }))
    return Object.freeze({ id: reference.id, name: reference.name, preparation: reference.preparation,
      source: reference.source, ...values })
  }))
}
