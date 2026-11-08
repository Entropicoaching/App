import { MICRONUTRIENTS, NUTRIENTS, sumDay } from '../foedevarer/index.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'

const nutrients = Object.values(MICRONUTRIENTS).map(({ nutrient }) => nutrient)

// Inspect the original stored food before normalization can discard fields.
// Legacy/unsupported metadata keeps its historical macro-only projection shape.
export function retainedNutrition(input) {
  try {
    const nutrition = supportedFoodSnapshot(input)
    return nutrients.some(key => nutrition.nutrientsPer100g[key] !== null) ? { nutrition } : {}
  } catch { return {} }
}

// Called only with the validated approved portions, before any edits or receipts.
// A food without retained evidence makes every micronutrient unknown for the day.
export function plannedMicronutrients(meals) {
  if (!meals.length || meals.some(meal => meal.foods.some(food => !food.nutrition))) return []
  const day = sumDay(meals.map(meal => meal.foods.map(food => ({ food: food.nutrition, grams: food.grams }))))
  return nutrients.filter(key => day.nutrients[key].complete).map(nutrient => ({
    nutrient, ...NUTRIENTS[nutrient], value: day.nutrients[nutrient].value,
  }))
}

export function plannedMicronutrientsView(h, values = []) {
  const known = new Map(values.map(value => [value.nutrient, value]))
  const knownCount = nutrients.filter(nutrient => known.has(nutrient)).length
  return h('details', null,
    h('summary', { style: { minHeight: 44, paddingBlock: 12, cursor: 'pointer', font: 'inherit' } }, 'Mineraler og vitaminer'),
    h('p', null, 'Planlagte fødevarer i den godkendte planversion. Tallene viser ikke spist indtag eller dokumenteret dækning af dit behov. Rettede gram og spist-markeringer ændrer ikke disse plantal.'),
    h('div', null,
      knownCount ? h('p', null, `Kendte summer for ${knownCount} af ${nutrients.length} stoffer. En sum vises kun, når alle planlagte fødevarer har data for stoffet. Øvrige stoffer har manglende data; ukendt er ikke nul.`)
        : h('p', null, 'Der mangler næringsdata i denne planversion. Ingen mineral- eller vitaminsummer kan vises for hele den planlagte dag. Ukendt er ikke nul.'),
      h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' } },
        ...nutrients.flatMap(nutrient => {
          const evidence = known.get(nutrient)
          return [
            h('dt', { key: `${nutrient}-label` }, NUTRIENTS[nutrient].label),
            h('dd', { key: nutrient, style: { margin: 0 } }, evidence
              ? `${evidence.value.toLocaleString('da-DK', { maximumSignificantDigits: 3 })} ${evidence.unit}`
              : 'Ukendt – mangler data'),
          ]
        }))))
}
