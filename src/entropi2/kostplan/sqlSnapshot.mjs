import { createPlanFoodSnapshot, createPlanSnapshot } from './planSnapshot.mjs'
import { portionGuidance } from './coach/model.mjs'
import { NUTRIENTS } from './foedevarer/catalog.mjs'

const fields = ['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source']
const editorial = ['prioritet', 'prioritetBegrundelse']
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key))
const text = value => typeof value === 'string' && value.trim().length > 0
const invalid = () => { throw new TypeError('Fødevaren stemmer ikke med kostplanens snapshotkontrakt') }

// The SQL contract predates catalogue priority metadata. Validate the original
// food BEFORE any normalizer can discard unsupported keys or invalid values.
// Only this known editorial pair is excluded; UI/catalogue objects stay intact.
export function supportedFoodSnapshot(input) {
  if (!only(input, [...fields, ...editorial]) || fields.some(key => !Object.hasOwn(input, key))
    || !['id', 'name', 'preparation'].every(key => text(input[key]))
    || input.basisGrams !== 100 || !only(input.source, ['citation', 'verification'])
    || !only(input.nutrientsPer100g, Object.keys(NUTRIENTS))) invalid()
  if (Object.values(input.nutrientsPer100g).some(value => value !== null
    && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12))) invalid()
  // Retain existing provenance, nutrient and paired-priority validation.
  const food = createPlanFoodSnapshot(input)
  return Object.freeze(Object.fromEntries(fields.map(key => [key, food[key]])))
}

// Use exactly the same canonical shape for writes and approved-content checks.
// Version-level SQL fields are intentionally handled by createPlanSnapshot.
export function supportedPlanSnapshot(input) {
  const advice = portionGuidance(input.portion_guidance)
  const snapshot = createPlanSnapshot({ ...input, meals: input.meals.map(meal => {
    if (!only(meal, ['name', 'portions'])) invalid()
    return { ...meal, portions: meal.portions.map(portion => {
      if (!only(portion, ['grams', 'food'])) invalid()
      return { grams: portion.grams, food: supportedFoodSnapshot(portion.food) }
    }) }
  }) })
  return Object.freeze({ ...snapshot, ...(advice === undefined ? {} : { portion_guidance: advice }) })
}
