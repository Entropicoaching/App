import { FOODS } from '../foedevarer/index.mjs'
import { tjekMaaltid, DANSKE_DAGLIGVARER } from '../realisme.mjs'
import { HUSSTAND_OPSKRIFTER } from './opskrifter.mjs'

// Planmotor for en husstand: samme ret til alle, hver sin portion i gram.
// Hver portion skaleres, så måltidet rammer personens protein- og energiandel:
// alle ikke-flex-ingredienser skaleres med én faktor (protein), og flexvaren
// (ris, pasta, kartofler, brød, havre, frugt) fylder resten af energien.
// Mængderne holdes inden for realismeprøvens portionsgrænser og rundes til
// 5 g (under 20 g til hele gram). Personens data kommer fra kalderen; modulet
// indeholder ingen personoplysninger.

export const SLOTS = Object.freeze(['morgenmad', 'frokost', 'foer-traening', 'aftensmad', 'aftensnack'])
export const SLOT_NAVN = Object.freeze({
  morgenmad: 'Morgenmad', frokost: 'Frokost', 'foer-traening': 'Mellemmåltid før træning',
  aftensmad: 'Aftensmad (efter træning)', aftensnack: 'Aftensnack før sengetid',
})
export const DAG_TOLERANCE = Object.freeze({ kcalProcent: 5, proteinProcentUnder: 5, proteinProcentOver: 10 })

const byId = new Map(FOODS.map(food => [food.id, food]))
export const opskriftFor = id => {
  const recipe = HUSSTAND_OPSKRIFTER.find(item => item.id === id)
  if (!recipe) throw new TypeError('Ukendt opskrift: ' + id)
  return recipe
}
const per = (food, key) => (food.nutrientsPer100g[key] ?? 0) / 100
const rund = grams => grams < 20 ? Math.max(1, Math.round(grams)) : Math.round(grams / 5) * 5
const graenser = food => DANSKE_DAGLIGVARER[food.name] ?? { minGram: 1, maxGram: Infinity }
const clamp = (value, { minGram, maxGram }) => Math.min(maxGram, Math.max(minGram, value))

// Én portion af en opskrift til et mål { kcal, protein }. maettet fortæller,
// om portionen ikke kan blive større ('op') eller mindre ('ned') i energi, og
// proteinLaast det samme for protein. Retten skal ligne sig selv: kød, grønt
// og sovs må højst ligge 40 % under eller 20 % over en ren skalering af hele
// opskriften til måltidets energi, så den store portion aldrig får mindre kød.
export function portion(recipe, maal) {
  const flexFood = byId.get(recipe.flex)
  const fedtFood = recipe.fedtflex ? byId.get(recipe.fedtflex) : null
  const fedtFaktor = maal.fedtFaktor ?? 1
  const base = recipe.ingredients.map(item => item.foodId === recipe.fedtflex ? { ...item, grams: item.grams * fedtFaktor } : item)
  const fast = base.filter(item => item.foodId !== recipe.flex)
  const flexBase = recipe.ingredients.find(item => item.foodId === recipe.flex)
  const fedtBase = fedtFood ? base.find(item => item.foodId === recipe.fedtflex) : null
  // Fedtvaren må højst blive fire gange grundmængden (fx 20 g olie, ikke 30 g).
  const fedtGraense = fedtFood ? { minGram: graenser(fedtFood).minGram,
    maxGram: Math.min(graenser(fedtFood).maxGram, 4 * recipe.ingredients.find(item => item.foodId === recipe.fedtflex).grams) } : null
  const sum = (items, key) => items.reduce((total, item) => total + per(byId.get(item.foodId), key) * item.grams, 0)
  const Pn = sum(fast, 'proteinG'), En = sum(fast, 'energyKcal')
  const pf = per(flexFood, 'proteinG'), ef = per(flexFood, 'energyKcal')
  const aProp = maal.kcal / sum(base, 'energyKcal')
  const aGraense = { minGram: 0.6 * aProp, maxGram: 1.2 * aProp }
  // Løs a * Pn + x * pf = protein og a * En + x * ef = kcal.
  let a = (maal.protein * ef - maal.kcal * pf) / (Pn * ef - En * pf)
  let proteinLaast = null
  if (!(a >= aGraense.minGram)) { a = aGraense.minGram; proteinLaast = 'ned' }
  else if (a > aGraense.maxGram) { a = aGraense.maxGram; proteinLaast = 'op' }
  let x = (maal.kcal - a * En) / ef
  const g = graenser(flexFood)
  let fedt = null, maettet = null
  if (x < g.minGram || x > g.maxGram) {
    const retning = x > g.maxGram ? 'op' : 'ned'
    x = clamp(x, g)
    const aProtein = (maal.protein - x * pf) / Pn
    a = clamp(aProtein, aGraense)
    proteinLaast = a === aProtein ? null : aProtein < a ? 'ned' : 'op'
    maettet = retning
    if (fedtFood) {
      // Fedtvaren tager resten af energien, inden for sin egen portionsgrænse.
      const ff = per(fedtFood, 'energyKcal')
      const uden = a * (En - fedtBase.grams * ff) + x * ef
      const raw = (maal.kcal - uden) / ff
      fedt = clamp(raw, fedtGraense)
      if (fedt === raw) maettet = null
    }
  }
  const items = base.map(item => {
    const food = byId.get(item.foodId)
    const raw = item.foodId === recipe.flex ? x : item.foodId === recipe.fedtflex && fedt !== null ? fedt : item.grams * a
    const limit = item.foodId === recipe.fedtflex ? fedtGraense : graenser(food)
    return { foodId: item.foodId, name: food.name, grams: rund(clamp(raw, limit)), ...(item.vare ? { vare: item.vare } : {}) }
  })
  const check = tjekMaaltid({ items: items.map(({ foodId, grams }) => ({ foodId, grams })) })
  return { recipeId: recipe.id, navn: recipe.name, items, totals: check.beregnet, problemer: check.problemer, maettet, proteinLaast }
}

// Fordeling: { slot: [andel af energi, andel af protein] }; begge skal summe til 1.
export function tjekFordeling(fordeling) {
  for (const index of [0, 1]) {
    const total = SLOTS.reduce((sum, slot) => sum + (fordeling[slot]?.[index] ?? 0), 0)
    if (Math.abs(total - 1) > 1e-9) throw new RangeError('Fordelingen skal summe til 1')
  }
}

const tom = () => ({ kcal: 0, protein: 0, carb: 0, fat: 0 })
const laeg = (total, add) => { for (const key of Object.keys(total)) total[key] += add[key] }

// dag: { menu: { slot: opskrift-id }, rester?: { frokost: opskrift-id } }
// person: { id, kcal: { traening, hvile }, protein, fedtMinG, fordeling(dag) -> fordeling, dagtype(dag) -> 'traening' | 'hvile' }
export function bygDag(dag, person) {
  const type = person.dagtype(dag)
  const maal = { kcal: person.kcal[type], protein: person.protein }
  const fordeling = person.fordeling(dag)
  tjekFordeling(fordeling)
  // Første runde bruger fordelingen. Rammer et måltid en portionsgrænse,
  // flyttes restenergien til de måltider, der stadig kan justeres.
  // Ligger fedtet under personens minimum, øges fedtvaren og kulhydratvaren
  // mindskes i samme energi (fedtFaktor), indtil gulvet er nået.
  const fedtMin = person.fedtMinG ?? 0
  let maaltider, total
  for (const fedtFaktor of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
    const kcalMaal = Object.fromEntries(SLOTS.map(slot => [slot, maal.kcal * fordeling[slot][0]]))
    const proteinMaal = Object.fromEntries(SLOTS.map(slot => [slot, maal.protein * fordeling[slot][1]]))
    // Flyt rest-energi og rest-protein til de måltider, der stadig kan justeres.
    const flyt = (targets, gap, laast) => {
      const retning = gap > 0 ? 'op' : 'ned'
      const frie = SLOTS.filter(slot => laast(slot) !== retning)
      const vaegt = frie.reduce((sum, slot) => sum + targets[slot], 0)
      if (!frie.length || !(vaegt > 0)) return false
      for (const slot of frie) targets[slot] = Math.max(5, targets[slot] + gap * targets[slot] / vaegt)
      return true
    }
    for (let runde = 0; runde < 12; runde++) {
      maaltider = {}
      total = tom()
      for (const slot of SLOTS) {
        const del = portion(opskriftFor(dag.menu[slot]), { kcal: kcalMaal[slot], protein: proteinMaal[slot], fedtFaktor })
        maaltider[slot] = del
        laeg(total, del.totals)
      }
      const gap = maal.kcal - total.kcal, pgap = maal.protein - total.protein
      const kcalOk = Math.abs(gap) < maal.kcal * 0.01, proteinOk = pgap <= maal.protein * 0.01 && pgap >= -maal.protein * 0.04
      if (kcalOk && proteinOk) break
      const a = kcalOk || flyt(kcalMaal, gap, slot => maaltider[slot].maettet)
      const b = proteinOk || flyt(proteinMaal, pgap, slot => maaltider[slot].proteinLaast)
      if (!a && !b) break
    }
    if (total.fat >= fedtMin) break
  }
  return vurderDag({ type, maal, maaltider, fedtMin })
}

function vurderDag({ type, maal, maaltider, fedtMin }) {
  const total = tom()
  for (const slot of SLOTS) laeg(total, maaltider[slot].totals)
  const afvigelse = {
    kcalProcent: (total.kcal - maal.kcal) / maal.kcal * 100,
    proteinProcent: (total.protein - maal.protein) / maal.protein * 100,
  }
  const ok = Math.abs(afvigelse.kcalProcent) <= DAG_TOLERANCE.kcalProcent &&
    afvigelse.proteinProcent >= -DAG_TOLERANCE.proteinProcentUnder && afvigelse.proteinProcent <= DAG_TOLERANCE.proteinProcentOver &&
    total.fat >= fedtMin * 0.95 && Object.values(maaltider).every(m => m.problemer.length === 0)
  return { type, maal, maaltider, total, afvigelse, ok, fedtMin }
}

// Samme ret til flere: den person med det største energimål får aldrig
// mindre af kød, fisk, mejeri eller grønt end en person med et mindre mål.
function udlignHusstand(personer, dagene) {
  const orden = [...personer].sort((a, b) => dagene[a.id].maal.kcal - dagene[b.id].maal.kcal)
  for (let i = 1; i < orden.length; i++) {
    const stor = dagene[orden[i].id], lille = dagene[orden[i - 1].id]
    let rettet = false
    for (const slot of SLOTS) {
      const s = stor.maaltider[slot], l = lille.maaltider[slot]
      const recipe = opskriftFor(s.recipeId)
      if (s.recipeId !== l.recipeId) continue
      const items = s.items.map((item, n) => item.foodId === recipe.flex || item.foodId === recipe.fedtflex || item.grams >= l.items[n].grams
        ? item : { ...item, grams: l.items[n].grams })
      if (items.every((item, n) => item === s.items[n])) continue
      const check = tjekMaaltid({ items: items.map(({ foodId, grams }) => ({ foodId, grams })) })
      stor.maaltider[slot] = { ...s, items, totals: check.beregnet, problemer: check.problemer }
      rettet = true
    }
    if (rettet) dagene[orden[i].id] = vurderDag(stor)
  }
  return dagene
}

export function bygPlan(dage, personer) {
  return dage.map(dag => ({ ...dag, personer: udlignHusstand(personer,
    Object.fromEntries(personer.map(person => [person.id, bygDag(dag, person)]))) }))
}

// Aftensmad må ikke gentages inden for planen.
export function gentagneAftensmaaltider(dage) {
  const set = new Map()
  for (const dag of dage) set.set(dag.menu.aftensmad, (set.get(dag.menu.aftensmad) ?? 0) + 1)
  return [...set].filter(([, count]) => count > 1).map(([id]) => id)
}
