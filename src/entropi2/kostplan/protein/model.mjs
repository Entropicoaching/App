import { FOODS, PRIORITIES } from '../foedevarer/index.mjs'

// Evidence context: Jäger et al. (2017), ISSN position stand: protein and
// exercise, DOI 10.1186/s12970-017-0177-8 (already in the pinned catalogue).
// Editorial strength: moderate for distributing sufficient daily protein;
// limited for additional long-term benefit from a specific before-sleep slot.
// This is not a formal GRADE rating. No source was fetched in this offline task.
// 0.3–0.4 g/kg and 3–5 meals are the ORDER's planning heuristic, not a proven
// individual minimum, absorption ceiling or a reason to change the daily goal.
export const PROTEIN_POLICY = Object.freeze({
  minMeals: 3, maxMeals: 5, thresholdPerKg: 0.3, referenceUpperPerKg: 0.4,
  maxAdditionProteinG: 15, maxAdditionGrams: 150, portionStepGrams: 5,
  sourceId: 'issn-protein-2017', verification: 'kilde skal verificeres',
})

const finite = (value, min, max) => typeof value === 'number'
  && Number.isFinite(value) && value >= min && value <= max
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const defaults = PRIORITIES.find(priority => priority.id === 'protein').foodIds

function foodChoices(ids) {
  if (!Array.isArray(ids)) throw new TypeError('Tilladte fødevarer skal være en liste af katalog-id’er')
  const seen = new Set()
  return Array.from(ids, id => {
    const food = FOODS.find(entry => entry.id === id)
    if (!food || seen.has(id)) throw new TypeError('Ukendt eller gentaget fødevare-id')
    seen.add(id)
    return food
  })
}

function alternatives(foods, budget) {
  return foods.flatMap(food => {
    const per100g = food.nutrientsPer100g.proteinG
    if (!finite(per100g, Number.MIN_VALUE, 100)) return []
    // Round DOWN so even a single 5 g increment cannot overshoot the budget.
    const grams = Math.floor(Math.min(PROTEIN_POLICY.maxAdditionGrams,
      budget * 100 / per100g) / PROTEIN_POLICY.portionStepGrams) * PROTEIN_POLICY.portionStepGrams
    if (grams <= 0) return []
    const proteinG = per100g * grams / 100
    if (proteinG > budget) return []
    return [{ foodId: food.id, name: food.name, preparation: food.preparation,
      grams, proteinG, energyKcal: food.nutrientsPer100g.energyKcal === null
        ? null : food.nutrientsPer100g.energyKcal * grams / 100,
      source: { ...food.source } }]
  })
}

/**
 * Pure, unwired adult planning proposal. All meals must belong to ONE selected
 * athlete/day. Caller supplies the existing daily goal, weight and 3–5 planned
 * slots, optionally one timing: 'before-sleep'. No timing is inferred from names.
 * proteinG is a complete meal total or null/omitted; never a partial subtotal.
 * The model neither creates log entries nor derives a new daily protein goal.
 * Allowed food IDs express caller choices, NOT automatic allergy screening.
 */
export function planProteinDistribution(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Planlægningsinput kræves')
  const { weightKg, dailyProteinG, meals, allowedFoodIds = defaults } = input
  const missing = ['weightKg', 'dailyProteinG', 'meals'].filter(key => input[key] == null)
  if (missing.length) return { status: 'unavailable', missing, meals: [], totalProteinG: null }
  // Bounds are engineering input limits, not clinical eligibility or safety.
  if (!finite(weightKg, 25, 350) || !finite(dailyProteinG, 0.1, 1000)) {
    throw new TypeError('Vægt skal være 25–350 kg og eksisterende proteinmål 0,1–1000 g')
  }
  if (!Array.isArray(meals)) throw new TypeError('Måltider skal være en liste')
  if (meals.length === 0) return { status: 'empty', missing: [], meals: [], totalProteinG: null }
  if (meals.length < 3 || meals.length > 5) throw new TypeError('Planen kræver 3–5 måltidspladser')
  const foods = foodChoices(allowedFoodIds), ids = new Set()
  let beforeSleepCount = 0
  const entries = Array.from(meals, meal => {
    if (!text(meal?.id) || ids.has(meal.id) || !text(meal.name)
      || (meal.timing !== 'daytime' && meal.timing !== 'before-sleep')
      || (meal.proteinG != null && !finite(meal.proteinG, 0, 1000))) {
      throw new TypeError('Måltid kræver unikt id, navn, timing og kendt protein eller null')
    }
    ids.add(meal.id)
    if (meal.timing === 'before-sleep') beforeSleepCount++
    return { id: meal.id, name: meal.name.trim(), timing: meal.timing, proteinG: meal.proteinG ?? null }
  })
  if (beforeSleepCount > 1) throw new TypeError('Højst én før-søvn-plads')
  // Distribute in tenths; the final slot carries the sub-tenth remainder so
  // arbitrary valid daily goals are preserved rather than silently rounded.
  const base = Math.floor(dailyProteinG * 10 / entries.length) / 10
  const thresholdG = weightKg * PROTEIN_POLICY.thresholdPerKg
  const referenceUpperG = weightKg * PROTEIN_POLICY.referenceUpperPerKg
  const complete = entries.every(meal => meal.proteinG !== null)
  const knownProteinG = entries.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0)
  let budget = complete ? Math.max(0, dailyProteinG - knownProteinG) : 0
  const result = entries.map((meal, index) => {
    const targetProteinG = index === entries.length - 1 ? dailyProteinG - base * index : base
    const belowThreshold = meal.proteinG === null ? null : meal.proteinG < thresholdG
    const gap = meal.proteinG === null ? 0 : Math.max(0, Math.min(thresholdG, targetProteinG) - meal.proteinG)
    const suggestions = belowThreshold === true
      ? alternatives(foods, Math.min(gap, budget, PROTEIN_POLICY.maxAdditionProteinG)) : []
    // Pick at most ONE alternative per meal. Reserve the largest alternative:
    // any combination across meals then stays within the known daily remainder.
    budget = Math.max(0, budget - Math.max(0, ...suggestions.map(choice => choice.proteinG)))
    return { ...meal, targetProteinG, belowThreshold,
      targetBelowThreshold: targetProteinG < thresholdG,
      targetAboveReference: targetProteinG > referenceUpperG, suggestions }
  })
  return { status: 'planned', dailyProteinG, weightKg, thresholdG, referenceUpperG,
    beforeSleepIncluded: beforeSleepCount === 1, knownProteinG,
    totalProteinG: complete ? knownProteinG : null,
    suggestionsStatus: complete ? 'available' : 'incomplete-day', meals: result }
}
