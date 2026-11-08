import { FOODS, createFood } from './catalog.mjs'
import { FRIDA_ROWS } from './frida55.data.mjs'

// Bounded, coach-only reference selection. The general index stays unchanged.
// Exact named state, edible portion, per 100 g; no yield/brand substitutions.
// Full attribution, original cells and bibliography: frida55.provenance.json.
export const FRIDA_FOODS = Object.freeze(FRIDA_ROWS.map(row => createFood({
  id: `frida55:${row.foodId}`,
  name: row.name,
  preparation: `Som navngivet: ${row.name}`,
  nutrientsPer100g: row.values,
  source: {
    // The supported immutable SQL shape has two source strings. Retain every
    // original [ParameterID, Source, SourceFood] tuple in the citation itself.
    citation: `DTU Frida5.5; https://doi.org/10.11583/DTU.29500682.v8; FoodID=${row.foodId}; [ParameterID,Source,SourceFood]=${JSON.stringify(row.references)}`,
    verification: 'Officielle referencegennemsnit; omfatter anslåede/beregnede/lånte værdier; ikke individuelt målt eller eksakt mærkevare.',
  },
})))

export const COACH_FOODS = Object.freeze([...FOODS, ...FRIDA_FOODS])
