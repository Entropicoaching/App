import { createElement as h } from 'react'
import { MICRONUTRIENTS, NUTRIENTS } from '../foedevarer/index.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'

const nutrients = Object.values(MICRONUTRIENTS).map(({ nutrient }) => nutrient)
const macros = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG']
const control = { minHeight: 44, paddingBlock: 12, cursor: 'pointer', font: 'inherit', boxSizing: 'border-box' }
const number = value => value.toLocaleString('da-DK', { maximumSignificantDigits: 3 })

function evidence(food) {
  try {
    const nutrition = supportedFoodSnapshot(food.nutrition)
    // The attached source must describe this exact catalogue identity.
    return nutrition.id === food.id && nutrition.name.trim() === food.name.trim() ? nutrition : null
  } catch { return null }
}

export default function SelectedFoodEvidence({ foods, foodId, ingredientNumber, mealNumber }) {
  if (typeof foodId !== 'string' || !foodId) return null
  const matches = Array.isArray(foods) ? foods.filter(food => food?.id === foodId) : []
  const food = matches.length === 1 ? matches[0] : null
  const nutrition = food ? evidence(food) : null
  const known = nutrition ? nutrients.filter(key => nutrition.nutrientsPer100g[key] !== null).length : 0
  const preparation = nutrition?.preparation
  return h('details', { style: { flexBasis: '100%', minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } },
    h('summary', { style: control }, `Næringsgrundlag for valgt fødevare ${ingredientNumber} i måltid ${mealNumber}`),
    food && typeof food.name === 'string' && h('h3', null, food.name),
    nutrition ? h('p', null, ['unspecified', 'as-named; otherwise unspecified'].includes(preparation)
      ? 'Tilberedning/tilstand: ikke oplyst.' : `Tilberedning/tilstand: ${preparation}`)
      : h('p', null, 'Næringsgrundlag ikke dokumenteret for denne fødevare. Tilberedning/tilstand er ikke dokumenteret.'),
    h('p', null, 'Referenceværdier pr. 100 g i den angivne tilstand. Kilden er et referencegrundlag, ikke spist indtag, en eksakt mærkevare eller en vurdering af individuelle eller medicinske behov. De indtastede gram i kladden er en separat mængde og ændres ikke af denne visning.'),
    h('p', null, `${known} af ${nutrients.length} stoffer har kendte værdier; ${nutrients.length - known} er ukendte. Ukendt er ikke nul.`),
    h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' } },
      ...nutrients.flatMap(key => {
        const value = nutrition?.nutrientsPer100g[key]
        return [h('dt', { key: `${key}-label` }, NUTRIENTS[key].label),
          h('dd', { key, style: { margin: 0 } }, value === null || value === undefined
            ? 'Ukendt – mangler data' : `${number(value)} ${NUTRIENTS[key].unit}`)]
      })),
    h('section', { style: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } },
      h('h4', null, 'Energi og makroer pr. 100 g'),
      h('ul', { style: { paddingInlineStart: '1.25rem' } }, ...macros.map(key => {
        const value = nutrition?.nutrientsPer100g[key]
        return h('li', { key }, `${NUTRIENTS[key].label}: ${value === null || value === undefined
          ? 'Ukendt – mangler data' : `${number(value)} ${NUTRIENTS[key].unit}`}`)
      }))),
    nutrition && h('dl', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
      h('dt', null, 'Kildehenvisning'), h('dd', { style: { margin: 0 } }, nutrition.source.citation),
      h('dt', null, 'Fødevare-id i grundlaget'), h('dd', { style: { margin: 0 } }, nutrition.id),
      h('dt', null, 'Verifikationsstatus i grundlaget'), h('dd', { style: { margin: 0 } }, nutrition.source.verification)))
}
