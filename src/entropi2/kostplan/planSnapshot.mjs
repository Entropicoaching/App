// Pure Entropi Coach snapshots. No flags, storage, auth, clock or API calls.
import { createFood } from './foedevarer/catalog.mjs'
import { sumDay } from './foedevarer/totals.mjs'

const text = value => typeof value === 'string' && value.trim().length > 0

// A manual food may start with a name; an id-only food displays its identifier.
// Provenance and per-100-g data must still be supplied, never fetched or invented.
export function createPlanFoodSnapshot(input = {}) {
  if ((!text(input?.id) && !text(input?.name)) ||
      (input.basisGrams !== undefined && input.basisGrams !== 100)) {
    throw new TypeError('Fødevare kræver id eller navn og basis 100 g')
  }
  const food = createFood({ ...input,
    id: text(input.id) ? input.id : 'manual:' + encodeURIComponent(input.name),
    name: text(input.name) ? input.name : input.id,
  })
  if (Object.values(food.nutrientsPer100g).some(value => value !== null && value > 1e12)) {
    throw new TypeError('Næringsindhold overstiger snapshotgrænsen')
  }
  return food
}

// Intensity is an explicit dimensionless 0..1 setting, not a calorie prescription.
// Goal and intensity belong to each immutable version so a coach can adjust them.
export function createPlanSnapshot({ goal, intensity, meals = [] } = {}) {
  if (!['bulk', 'vedligehold', 'cut'].includes(goal) ||
      typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity < 0 || intensity > 1) {
    throw new TypeError('Plan kræver bulk, vedligehold eller cut og intensitet fra 0 til 1')
  }
  if (!Array.isArray(meals) || meals.length > 30) throw new TypeError('Plan kræver højst 30 måltider')
  const snapshotMeals = Array.from(meals, meal => {
    if (!text(meal?.name) || meal.name.length > 200 || !Array.isArray(meal.portions) ||
        meal.portions.length < 1 || meal.portions.length > 100) {
      throw new TypeError('Måltid kræver navn og 1 til 100 fødevarelinjer')
    }
    return Object.freeze({ name: meal.name, portions: Object.freeze(Array.from(meal.portions, portion => {
      if (typeof portion?.grams !== 'number' || !Number.isFinite(portion.grams) ||
          portion.grams <= 0 || portion.grams > 100000) {
        throw new TypeError('Fødevarelinje kræver gram over 0 og højst 100000 samt basis 100 g')
      }
      return Object.freeze({ grams: portion.grams, food: createPlanFoodSnapshot(portion.food) })
    })) })
  })
  // Empty drafts are honest empty data. Approval requires a nonempty meal list.
  return Object.freeze({ goal, intensity, meals: Object.freeze(snapshotMeals) })
}

// Meals describe one plan day. Callers select a version/day before calling this.
// Always calculate from the stored food snapshot, never the current food catalog.
export function summarizePlanSnapshot(input) {
  const snapshot = createPlanSnapshot(input)
  return sumDay(snapshot.meals.map(meal => meal.portions))
}
