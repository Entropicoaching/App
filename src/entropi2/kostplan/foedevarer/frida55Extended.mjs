import { createFood } from './catalog.mjs'
import { COACH_FOODS } from './frida55.mjs'
import { ADDITIONAL_FRIDA_ROWS } from './frida55Extended.data.mjs'

// Additive data-stage entry point. The existing index, loader and default
// coach catalogue retain their exact identities, order and values.
// Exact named state, per 100 g edible part; no yield or brand substitutions.
// Original cells and source records: frida55Extended.provenance-01/02.json.
export const ADDITIONAL_FRIDA_FOODS = Object.freeze(ADDITIONAL_FRIDA_ROWS.map(row => createFood({
  id: `frida55:${row.foodId}`,
  name: row.name,
  preparation: `Som navngivet: ${row.name}`,
  nutrientsPer100g: row.values,
  source: {
    // Preserve the supported two-string SQL source shape and every original
    // [ParameterID, Source, SourceFood] tuple, including estimated/borrowed data.
    citation: `DTU Frida5.5; Marija Langwagen, Jette Jacobsen, Tue Christensen and Anders Poulsen: Den Danske Fødevaredatabase, Frida version 5.5, November 2025, DTU Fødevareinstituttet; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/; https://doi.org/10.11583/DTU.29500682.v8; FoodID=${row.foodId}; [ParameterID,Source,SourceFood]=${JSON.stringify(row.references)}`,
    verification: 'Officielle referencegennemsnit; omfatter anslåede/beregnede/lånte værdier; ikke individuelt målt eller eksakt mærkevare.',
  },
})))

export const EXTENDED_COACH_FOODS = Object.freeze([...COACH_FOODS, ...ADDITIONAL_FRIDA_FOODS])
