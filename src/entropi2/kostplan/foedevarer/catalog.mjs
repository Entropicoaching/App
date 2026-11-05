import { LOCAL_FOODS } from '../../../athlete/lokaleFoedevarer.js'

// Units belong to the keys: all amounts are per 100 g of the named food state.
export const NUTRIENTS = Object.freeze(Object.fromEntries([
  ['energyKcal', 'Energi', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbohydrateG', 'Kulhydrat', 'g'],
  ['fatG', 'Fedt', 'g'],
  ['fibreG', 'Fibre', 'g'],
  ['ironMg', 'Jern', 'mg'],
  ['calciumMg', 'Calcium', 'mg'],
  ['magnesiumMg', 'Magnesium', 'mg'],
  ['zincMg', 'Zink', 'mg'],
  ['potassiumMg', 'Kalium', 'mg'],
  ['sodiumMg', 'Natrium', 'mg'],
  ['vitaminDUg', 'D-vitamin', 'µg'],
  ['vitaminB12Ug', 'B12', 'µg'],
  ['folateUg', 'Folat', 'µg'],
  ['leucineG', 'Leucin', 'g'],
].map(([key, label, unit]) => [key, Object.freeze({ label, unit })])))

// Flat plan snapshots use these names; units share the catalog's authority.
// No values are supplied here: a named source must accompany each flat value.
export const MICRONUTRIENTS = Object.freeze(Object.fromEntries([
  ['iron', 'ironMg'], ['calcium', 'calciumMg'], ['magnesium', 'magnesiumMg'],
  ['zinc', 'zincMg'], ['potassium', 'potassiumMg'], ['sodium', 'sodiumMg'],
  ['vitaminD', 'vitaminDUg'], ['vitaminB12', 'vitaminB12Ug'], ['folate', 'folateUg'],
].map(([name, nutrient]) => [name, Object.freeze({
  nutrient, label: NUTRIENTS[nutrient].label,
  unit: NUTRIENTS[nutrient].unit === 'µg' ? 'ug' : NUTRIENTS[nutrient].unit,
})])))

const text = value => typeof value === 'string' && value.trim().length > 0
export const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0

// Missing values are null, never inferred from macros or a food category.
// Callers supply provenance for new product/food data; this does not verify it.
export function createFood({ id, name, preparation = 'unspecified', nutrientsPer100g, source,
  prioritet, prioritetBegrundelse } = {}) {
  if (![id, name, preparation, source?.citation, source?.verification].every(text)) {
    throw new TypeError('Fødevare kræver id, navn, tilstand og kilde med verifikationsstatus')
  }
  if (!nutrientsPer100g || typeof nutrientsPer100g !== 'object' || Array.isArray(nutrientsPer100g)) {
    throw new TypeError('Næringsindhold pr. 100 g kræves')
  }
  if (Object.keys(nutrientsPer100g).some(key => !Object.hasOwn(NUTRIENTS, key))) {
    throw new TypeError('Ukendt næringsstof eller enhed')
  }
  // Optional editorial metadata travels as a pair; never infer it from macros.
  if ((prioritet !== undefined || prioritetBegrundelse !== undefined) &&
      (!['basis', 'god', 'særlig'].includes(prioritet) || !text(prioritetBegrundelse))) {
    throw new TypeError('Prioritet kræver basis, god eller særlig samt en begrundelse')
  }
  const nutrients = {}
  for (const key of Object.keys(NUTRIENTS)) {
    const value = nutrientsPer100g[key] ?? null
    if (value !== null && !isAmount(value)) throw new TypeError('Ugyldigt næringsindhold: ' + key)
    nutrients[key] = value
  }
  return Object.freeze({
    id, name, preparation, basisGrams: 100,
    nutrientsPer100g: Object.freeze(nutrients),
    source: Object.freeze({ citation: source.citation, verification: source.verification }),
    ...(prioritet === undefined ? {} : { prioritet, prioritetBegrundelse: prioritetBegrundelse.trim() }),
  })
}

// Curated examples, not a ranking, prescription or verified nutrient coverage.
// Evidence, limitations and source-verification status: docs/kost/prioriterede-foedevarer.md.
const foodPriorities = new Map([
  ['Skyr naturel', { prioritet: 'basis',
    prioritetBegrundelse: 'Praktisk mælkeprotein med essentielle aminosyrer; leucinmængden er ikke registreret her.' }],
  ['Kyllingebryst', { prioritet: 'god',
    prioritetBegrundelse: 'En proteinmulighed med essentielle aminosyrer; ikke nødvendig, hvis andre kilder dækker behovet.' }],
  ['Tofu fast', { prioritet: 'god',
    prioritetBegrundelse: 'Sojaprotein kan indgå som plantebaseret alternativ; tilpas portion og samlet protein over dagen.' }],
  ['Havregryn', { prioritet: 'basis',
    prioritetBegrundelse: 'Fuldkorn som kulhydrat- og fiberkilde; mæthed og mavekomfort varierer, og fibermængden er ukendt her.' }],
  ['Linser kogte', { prioritet: 'basis',
    prioritetBegrundelse: 'Bælgfrugt med planteprotein og fibre; kombiner varieret, og brug ikke mærket som dokumentation for jerndækning.' }],
  ['Ris kogt', { prioritet: 'god',
    prioritetBegrundelse: 'Praktisk kulhydratkilde omkring krævende træning; behov og timing afhænger af belastning og øvrige måltider.' }],
  ['Broccoli', { prioritet: 'basis',
    prioritetBegrundelse: 'Grøntsag til variation og volumen i måltidet; ikke dokumentation for ekstra styrke eller mikronæringsdækning.' }],
  ['Laks fersk', { prioritet: 'særlig',
    prioritetBegrundelse: 'Fed fisk kan bidrage med D-vitamin og protein; D-vitaminmængde og individuel dækning er ukendt her.' }],
  ['Hakket oksekød 8%', { prioritet: 'særlig',
    prioritetBegrundelse: 'Kan bidrage med hæmjern og kreatin; mængder og behov er ukendte her. Følg almindelige kostråd om rødt kød.' }],
])

// No second macro database: read the app's existing public list without mutation.
// The legacy list does not consistently specify raw/cooked state or provenance.
export const FOODS = Object.freeze(LOCAL_FOODS.map(food => createFood({
  id: 'local:' + encodeURIComponent(food.name),
  name: food.name,
  preparation: 'as-named; otherwise unspecified',
  ...foodPriorities.get(food.name),
  nutrientsPer100g: {
    energyKcal: food.kcal100, proteinG: food.protein100,
    carbohydrateG: food.carb100, fatG: food.fat100,
  },
  source: {
    citation: 'src/athlete/lokaleFoedevarer.js @ b54e820420e6ceec5be7ef1a3586d994f13ea6d3',
    verification: 'kilde skal verificeres',
  },
})))
