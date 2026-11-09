import { FOODS } from './foedevarer/index.mjs'

// Realismeprøve for måltider (U1). Et måltid, som atleten skal se, skal bestå
// af almindelige danske dagligvarer fra fødevaretabellen, i normale portioner,
// og eventuelle oplyste makroer skal passe med tabellens tal.
//
// Portionsgrænserne er appens praktiske produktregler for ÉN portion i ét
// måltid, i gram af den spiselige del i katalogets tilstand (kogt ris, pasta,
// kartofler og linser vejes kogte). De er ikke kostanbefalinger. Afdelingen
// bruges til at gruppere den printbare indkøbsliste.
const VARER = [
  ['Skyr naturel', 'Mejeri', 100, 500],
  ['Græsk yoghurt 2%', 'Mejeri', 100, 400],
  ['Græsk yoghurt 0%', 'Mejeri', 100, 400],
  ['Hytteost', 'Mejeri', 100, 400],
  ['Mælk minimælk', 'Mejeri', 100, 500],
  ['Kakaomælk', 'Mejeri', 200, 500],
  ['Feta', 'Mejeri', 20, 80],
  ['Ost 30+', 'Mejeri', 20, 80],
  ['Æg helt', 'Mejeri', 50, 250],
  ['Kyllingebryst', 'Kød og fisk', 75, 300],
  ['Hakket oksekød 8%', 'Kød og fisk', 75, 300],
  ['Laks fersk', 'Kød og fisk', 75, 300],
  ['Tun i vand', 'Kolonial', 60, 200],
  ['Tofu fast', 'Køl', 100, 350],
  ['Hummus', 'Køl', 30, 120],
  ['Pesto', 'Kolonial', 10, 40],
  ['Rugbrød', 'Brød', 50, 200],
  ['Grovbrød', 'Brød', 50, 200],
  ['Franskbrød', 'Brød', 40, 160],
  ['Tortilla wrap', 'Brød', 40, 160],
  ['Knækbrød', 'Brød', 20, 80],
  ['Havregryn', 'Kolonial', 30, 120],
  ['Müsli uden sukker', 'Kolonial', 30, 120],
  ['Cornflakes', 'Kolonial', 30, 100],
  ['Riskager naturel', 'Kolonial', 15, 60],
  ['Ris kogt', 'Kolonial', 100, 450],
  ['Pasta kogt', 'Kolonial', 100, 450],
  ['Quinoa kogt', 'Kolonial', 100, 400],
  ['Linser kogte', 'Kolonial', 80, 350],
  ['Kartofler kogte', 'Frugt og grønt', 100, 500],
  ['Syltetøj', 'Kolonial', 10, 50],
  ['Honning', 'Kolonial', 5, 40],
  ['Soja sauce', 'Kolonial', 5, 30],
  ['Dressing let', 'Kolonial', 10, 50],
  ['Olivenolie', 'Kolonial', 3, 30],
  ['Rapsolie', 'Kolonial', 3, 30],
  ['Mandler', 'Kolonial', 10, 50],
  ['Valnødder', 'Kolonial', 10, 50],
  ['Banan', 'Frugt og grønt', 80, 250],
  ['Æble', 'Frugt og grønt', 80, 250],
  ['Pære', 'Frugt og grønt', 80, 250],
  ['Blåbær', 'Frugt og grønt', 50, 250],
  ['Jordbær', 'Frugt og grønt', 50, 250],
  ['Tomat', 'Frugt og grønt', 50, 300],
  ['Agurk', 'Frugt og grønt', 50, 250],
  ['Peberfrugt rød', 'Frugt og grønt', 50, 250],
  ['Salat iceberg', 'Frugt og grønt', 20, 150],
  ['Broccoli', 'Frugt og grønt', 50, 300],
  ['Grønne bønner', 'Frugt og grønt', 50, 300],
  ['Løg', 'Frugt og grønt', 20, 150],
  ['Ærter frosne', 'Frost', 50, 250],
]

// Tilbehør tæller ikke som selve retten: olie, sovs og sødt pålæg alene er ikke et måltid.
const TILBEHOER = new Set(['Olivenolie', 'Rapsolie', 'Soja sauce', 'Dressing let', 'Syltetøj', 'Honning', 'Pesto'])

export const AFDELINGER = Object.freeze(['Frugt og grønt', 'Brød', 'Mejeri', 'Kød og fisk', 'Køl', 'Frost', 'Kolonial', 'Øvrige'])
export const DANSKE_DAGLIGVARER = Object.freeze(Object.fromEntries(VARER.map(([name, afdeling, min, max]) =>
  [name, Object.freeze({ afdeling, minGram: min, maxGram: max })])))
export const MAKRO_TOLERANCE = Object.freeze({ procent: 5, kcal: 10, gram: 2 })

const byId = new Map(FOODS.map(food => [food.id, food]))
const byName = new Map(FOODS.map(food => [food.name, food]))
const KEYS = [['kcal', 'energyKcal'], ['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]
const gram = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const fmt = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)

export function afdelingFor(name) {
  if (typeof name !== 'string') return 'Øvrige'
  const exact = DANSKE_DAGLIGVARER[name.trim()]
  if (exact) return exact.afdeling
  // Egne varer i ugeplanen har fritekstnavne. Kun et entydigt ord vælger afdeling.
  const lower = name.toLowerCase()
  const hits = new Set(VARER.filter(([vare]) => lower.includes(vare.toLowerCase().split(' ')[0])).map(([, afdeling]) => afdeling))
  return hits.size === 1 ? [...hits][0] : 'Øvrige'
}

// items: [{ foodId } eller { name }, grams]. declared (valgfri): { kcal, protein, carb, fat }.
// Returnerer { ok, problemer, beregnet }. Et måltid med blot ét problem afvises.
export function tjekMaaltid({ items, declared } = {}) {
  const problemer = []
  if (!Array.isArray(items) || items.length === 0) return { ok: false, problemer: ['Måltidet har ingen ingredienser.'], beregnet: null }
  if (items.length > 8) problemer.push('Måltidet har mere end 8 ingredienser.')
  const sum = { kcal: 0, protein: 0, carb: 0, fat: 0 }
  const seen = new Set()
  let ret = false, kendt = true
  for (const item of items) {
    const food = item?.foodId ? byId.get(item.foodId) : byName.get(item?.name)
    const name = food?.name ?? (typeof item?.name === 'string' ? item.name : String(item?.foodId ?? 'ukendt'))
    if (!food) { problemer.push(`${name} findes ikke i fødevaretabellen.`); kendt = false; continue }
    const vare = DANSKE_DAGLIGVARER[food.name]
    if (!vare) problemer.push(`${food.name} er ikke på listen over almindelige danske dagligvarer.`)
    if (seen.has(food.id)) problemer.push(`${food.name} står to gange i måltidet.`)
    seen.add(food.id)
    if (!gram(item.grams)) { problemer.push(`${food.name} mangler en gyldig mængde i gram.`); kendt = false; continue }
    if (vare && (item.grams < vare.minGram - 0.5 || item.grams > vare.maxGram + 0.5))
      problemer.push(`${food.name} ${fmt(item.grams)} g er uden for en normal portion (${vare.minGram} til ${vare.maxGram} g).`)
    if (!TILBEHOER.has(food.name)) ret = true
    for (const [key, nutrient] of KEYS) {
      const per100 = food.nutrientsPer100g[nutrient]
      if (typeof per100 !== 'number') { kendt = false; continue }
      sum[key] += per100 * item.grams / 100
    }
  }
  if (!ret) problemer.push('Måltidet består kun af tilbehør og er ikke en ret.')
  const beregnet = kendt ? sum : null
  if (declared && typeof declared === 'object') {
    if (!beregnet) problemer.push('Makroerne kan ikke kontrolleres, fordi en ingrediens mangler i tabellen.')
    else for (const [key] of KEYS) {
      if (declared[key] == null) continue
      const value = Number(declared[key])
      const floor = key === 'kcal' ? MAKRO_TOLERANCE.kcal : MAKRO_TOLERANCE.gram
      const limit = Math.max(beregnet[key] * MAKRO_TOLERANCE.procent / 100, floor)
      if (!Number.isFinite(value) || Math.abs(value - beregnet[key]) > limit)
        problemer.push(`Oplyst ${key === 'kcal' ? 'energi' : key} (${Number.isFinite(value) ? fmt(value) : 'ugyldig'}) afviger mere end ${MAKRO_TOLERANCE.procent} % fra fødevaretabellens ${fmt(beregnet[key])}.`)
    }
  }
  return { ok: problemer.length === 0, problemer, beregnet }
}

// Det kcal-interval, hvor en opskrift kan skaleres, uden at nogen portion bliver unormal.
export function realistiskKcalInterval(recipe, kcalBase) {
  let lav = 0, hoej = Infinity
  for (const ingredient of recipe.ingredients) {
    const vare = DANSKE_DAGLIGVARER[byId.get(ingredient.foodId)?.name]
    if (!vare) return null
    lav = Math.max(lav, vare.minGram / ingredient.grams)
    hoej = Math.min(hoej, vare.maxGram / ingredient.grams)
  }
  return lav <= hoej ? { min: kcalBase * lav, max: kcalBase * hoej } : null
}
