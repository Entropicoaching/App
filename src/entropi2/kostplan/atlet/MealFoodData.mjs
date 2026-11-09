import { createElement as h } from 'react'
import { MICRONUTRIENTS, NUTRIENTS } from '../foedevarer/index.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'

const nutrients = Object.values(MICRONUTRIENTS).map(({ nutrient }) => nutrient)
const macros = [['energyKcal', 'kcal100'], ['proteinG', 'protein100'], ['carbohydrateG', 'carb100'], ['fatG', 'fat100']]
const control = { minHeight: 44, paddingBlock: 12, cursor: 'pointer', font: 'inherit', boxSizing: 'border-box' }
const number = value => value.toLocaleString('da-DK', { maximumSignificantDigits: 3 })

// Inspect only the evidence attached to this shown line. Never look up a name,
// calculate from display grams, or borrow evidence from another plan/receipt.
function evidence(food) {
  try {
    const nutrition = supportedFoodSnapshot(food.nutrition)
    return nutrition.name.trim() === food.name.trim() ? nutrition : null
  } catch { return null }
}

export default function MealFoodData({ meal }) {
  return h('details', { style: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } },
    h('summary', { style: control, 'aria-label': `${meal.name}: Fødevaredata for dette måltid` }, 'Fødevaredata for dette måltid'),
    h('p', null, 'Grundlaget for de viste fødevarer. Referenceværdier pr. 100 g er ikke en måling af din portion eller en eksakt mærkevare. Her vises hverken spist indtag eller dækning af dit behov.'),
    h('ul', { style: { paddingInlineStart: '1.25rem' } }, ...meal.foods.map((food, index) => {
      const nutrition = evidence(food)
      // Normal legacy projection omits this field. A present invalid reference
      // (including null/undefined) must not be laundered into plan evidence.
      const planValues = !('nutrition' in food)
      const macroTitle = planValues ? 'Planens makrogrundlag pr. 100 g' : 'Energi og makroer pr. 100 g'
      const known = nutrition ? nutrients.filter(key => nutrition.nutrientsPer100g[key] !== null).length : 0
      const preparation = nutrition?.preparation
      return h('li', { key: food.id, style: { marginBlock: 16, minWidth: 0 } },
        h('h3', null, food.name),
        nutrition ? h('div', null,
          h('p', null, ['unspecified', 'as-named; otherwise unspecified'].includes(preparation)
            ? 'Tilberedning/tilstand: ikke oplyst.' : `Tilberedning/tilstand: ${preparation}`),
          h('p', null, 'Referenceværdier pr. 100 g af fødevaren i den angivne tilstand.'))
          : h('p', null, 'Næringsgrundlag ikke dokumenteret for denne fødevare'),
        h('p', null, `${known} af ${nutrients.length} stoffer har kendte værdier; ${nutrients.length - known} er ukendte. Ukendt er ikke nul.`),
        h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' } },
          ...nutrients.flatMap(key => {
            const value = nutrition?.nutrientsPer100g[key]
            return [h('dt', { key: `${key}-label` }, NUTRIENTS[key].label),
              h('dd', { key, style: { margin: 0 } }, value === null || value === undefined
                ? 'Ukendt – mangler data' : `${number(value)} ${NUTRIENTS[key].unit}`)]
          })),
        h('section', { 'aria-label': macroTitle, style: { minWidth: 0, maxWidth: '100%' } },
          h('h4', null, macroTitle),
          planValues && h('p', null, 'Fødevarekilden er ikke dokumenteret i denne visning. Tallene er planens næringsværdier, ikke verificerede fødevarereferencer.'),
          h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' } },
            ...macros.flatMap(([key, field]) => {
              const candidate = planValues ? food[field] : nutrition?.nutrientsPer100g[key]
              const value = typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
              return [h('dt', { key: `${key}-label` }, NUTRIENTS[key].label),
                h('dd', { key, style: { margin: 0 } }, value === null || value === undefined
                  ? 'Ukendt – mangler data' : `${number(value)} ${NUTRIENTS[key].unit}`)]
            }))),
        nutrition && h('details', null,
          h('summary', { style: control, 'aria-label': `${meal.name}: ${food.name} (${index + 1}): Kilde` }, 'Kilde'),
          h('dl', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
            h('dt', null, 'Kildehenvisning'), h('dd', { style: { margin: 0 } }, nutrition.source.citation),
            h('dt', null, 'Fødevare-id i grundlaget'), h('dd', { style: { margin: 0 } }, nutrition.id),
            h('dt', null, 'Verifikationsstatus i grundlaget'), h('dd', { style: { margin: 0 } }, nutrition.source.verification))))
    })))
}
