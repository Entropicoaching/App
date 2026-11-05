import { MICRONUTRIENTS, NUTRIENTS, sumDay } from '../foedevarer/index.mjs'
import { catalogFoods, number, totals } from './model.mjs'

// Use the same validation and retained food snapshots as the macro calculation.
// Never display the known subtotal of an incomplete nutrient as a daily total.
export function dayMicronutrients(meals) {
  const day = totals(meals) ? sumDay(meals.map(meal => meal.items.map(item => ({
    food: catalogFoods([item.food])[0].nutrition, grams: number(item.grams),
  })))) : null
  return Object.values(MICRONUTRIENTS).map(({ nutrient }) => {
    const result = day?.nutrients[nutrient]
    return { nutrient, ...NUTRIENTS[nutrient],
      value: result?.complete === true ? result.value : null }
  })
}

export function micronutrientsView(h, meals) {
  const complete = dayMicronutrients(meals).filter(({ value }) => value !== null)
  if (!complete.length) return null
  return h('details', null,
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Mineraler og vitaminer'),
    h('p', null, 'Dagens sum af fødevarerne i planen. En værdi vises kun, når alle fødevarer har data for den.'),
    h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' } },
      ...complete.flatMap(({ nutrient, label, unit, value }) => [
        h('dt', { key: `${nutrient}-label` }, label),
        h('dd', { key: nutrient, style: { margin: 0 } },
          `${value.toLocaleString('da-DK', { maximumSignificantDigits: 3 })} ${unit}`),
      ])))
}
