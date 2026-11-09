import test from 'node:test'
import assert from 'node:assert/strict'
import { RECIPES, sumRecipe, scaleRecipe, recipePortions } from './opskrifter/index.mjs'
import { FOODS } from './foedevarer/index.mjs'
import { calculateNutrition } from './beregning.mjs'
import { tjekMaaltid, realistiskKcalInterval, DANSKE_DAGLIGVARER, afdelingFor, AFDELINGER } from './realisme.mjs'
import { recipeItems, recipeProblems } from './coach/connections.mjs'
import { catalogFoods } from './coach/model.mjs'
import { ANBEFALINGER, vaeskeForslag, proteinForslag } from './anbefalinger.mjs'

const id = name => FOODS.find(food => food.name === name).id
const kcal = recipe => sumRecipe(recipe).nutrients.energyKcal.value

test('alle 24 opskrifter er realistiske måltider i grundmængden', () => {
  assert.equal(RECIPES.length, 24)
  for (const recipe of RECIPES) {
    const result = tjekMaaltid({ items: recipe.ingredients })
    assert.deepEqual(result.problemer, [], recipe.id)
    assert.equal(result.ok, true)
  }
})

test('alle ingredienser i opskrifterne er danske dagligvarer i fødevaretabellen med en butiksafdeling', () => {
  for (const recipe of RECIPES) for (const { food } of recipePortions(recipe)) {
    assert.ok(DANSKE_DAGLIGVARER[food.name], food.name)
    assert.ok(AFDELINGER.includes(DANSKE_DAGLIGVARER[food.name].afdeling))
  }
  for (const name of Object.keys(DANSKE_DAGLIGVARER)) assert.ok(FOODS.some(food => food.name === name), name)
})

test('makroerne summeret fra fødevaretabellen svarer til opskriftens egen sum', () => {
  for (const recipe of RECIPES) {
    const totals = sumRecipe(recipe).nutrients
    const { beregnet } = tjekMaaltid({ items: recipe.ingredients })
    assert.ok(Math.abs(beregnet.kcal - totals.energyKcal.value) < 1e-6, recipe.id)
    assert.ok(Math.abs(beregnet.protein - totals.proteinG.value) < 1e-6, recipe.id)
    const ok = tjekMaaltid({ items: recipe.ingredients, declared: { kcal: totals.energyKcal.value * 1.04, protein: totals.proteinG.value } })
    assert.equal(ok.ok, true, recipe.id)
  }
})

test('konstruerede urealistiske måltider afvises med en forståelig grund', () => {
  const cases = [
    [{ items: [{ foodId: id('Skyr naturel'), grams: 900 }] }, /Skyr naturel 900 g er uden for en normal portion/],
    [{ items: [{ foodId: id('Ris kogt'), grams: 250 }, { foodId: id('Olivenolie'), grams: 60 }] }, /Olivenolie 60 g/],
    [{ items: [{ foodId: id('Kyllingebryst'), grams: 20 }] }, /Kyllingebryst 20 g/],
    [{ items: [{ name: 'Drageæg-pulver', grams: 30 }] }, /findes ikke i fødevaretabellen/],
    [{ items: [{ foodId: id('Olivenolie'), grams: 10 }, { foodId: id('Honning'), grams: 20 }] }, /kun af tilbehør/],
    [{ items: [{ foodId: id('Ris kogt'), grams: 200 }, { foodId: id('Ris kogt'), grams: 100 }] }, /to gange/],
    [{ items: [{ foodId: id('Kyllingebryst'), grams: 150 }, { foodId: id('Ris kogt'), grams: 250 }], declared: { kcal: 900, protein: 45 } }, /afviger mere end 5 %/],
    [{ items: [] }, /ingen ingredienser/],
  ]
  for (const [meal, reason] of cases) {
    const result = tjekMaaltid(meal)
    assert.equal(result.ok, false)
    assert.match(result.problemer.join(' '), reason)
  }
  // En vare uden for den faste liste afvises, selv om den står i tabellen.
  const outside = FOODS.find(food => !DANSKE_DAGLIGVARER[food.name])
  if (outside) assert.match(tjekMaaltid({ items: [{ foodId: outside.id, grams: 100 }] }).problemer.join(' '), /ikke på listen/)
})

test('hver opskrift kan skaleres i et realistisk interval omkring grundmængden', () => {
  for (const recipe of RECIPES) {
    const base = kcal(recipe), range = realistiskKcalInterval(recipe, base)
    assert.ok(range && range.min <= base && base <= range.max, recipe.id)
    assert.ok(range.max / range.min >= 1.5, `${recipe.id} kan kun bruges i et meget smalt interval`)
  }
})

test('alle mål: hver skaleret opskrift er enten realistisk eller afvist, aldrig vist urealistisk', () => {
  const foods = catalogFoods(FOODS)
  const mealKcal = new Set()
  for (const weightKg of [55, 70, 85, 100, 120]) for (const [goal, intensity] of [['bulk', 'moderate'], ['maintain', 'moderate'], ['cut', 'light'], ['cut', 'moderate'], ['cut', 'aggressive']]) {
    let targets
    try { targets = calculateNutrition({ date: '2026-11-09', adult: true, weightKg, goal, intensity }).targets } catch { continue }
    for (const meals of [3, 4, 5]) mealKcal.add(Math.round(targets.kcal / meals))
  }
  assert.ok(mealKcal.size >= 20)
  let accepted = 0, rejected = 0
  for (const recipe of RECIPES) for (const value of mealKcal) {
    const items = recipeItems(recipe.id, foods, value)
    const scaled = recipePortions(scaleRecipe(recipe, { nutrient: 'energyKcal', value })).map(({ food, grams }) => ({ foodId: food.id, grams }))
    if (items) { accepted++; assert.equal(tjekMaaltid({ items }).ok, true) }
    else { rejected++; assert.equal(tjekMaaltid({ items: scaled }).ok, false); assert.ok(recipeProblems(recipe.id, foods, value).length > 0) }
  }
  assert.ok(accepted > 0 && rejected > 0)
  // Hovedmåltiderne dækker hele spændet af måltidsenergi med mindst én realistisk opskrift.
  for (const value of mealKcal) {
    if (value > 1000) continue
    assert.ok(RECIPES.some(recipe => ['morgenmad', 'frokost', 'aftensmad'].includes(recipe.category) && recipeItems(recipe.id, foods, value)), `${value} kcal`)
  }
})

test('afdeling til indkøbslisten: præcis vare, entydigt ord eller Øvrige', () => {
  assert.equal(afdelingFor('Skyr naturel'), 'Mejeri')
  assert.equal(afdelingFor('Kyllingebryst i strimler'), 'Kød og fisk')
  assert.equal(afdelingFor('Mormors frikadeller'), 'Øvrige')
  assert.equal(afdelingFor(null), 'Øvrige')
})

test('bilagets plads er tom: ingen opfundne tal, og forslag kræver både tal og kilde', () => {
  assert.equal(ANBEFALINGER.status, 'afventer-bilag')
  const values = JSON.stringify(ANBEFALINGER).match(/:\s*-?\d/g)
  assert.equal(values, null)
  assert.equal(vaeskeForslag(80), null)
  assert.equal(proteinForslag(80), null)
  const udfyldt = { vaeske: { mlPrKg: 10, mlPrTraeningstime: 100, kilde: 'Syntetisk kilde til prøven' },
    protein: { gPrKgMin: 1, gPrKgMax: 2, kilde: 'Syntetisk kilde til prøven' } }
  assert.deepEqual(vaeskeForslag(80, 1, udfyldt), { ml: 900, kilde: 'Syntetisk kilde til prøven' })
  assert.deepEqual(proteinForslag(80, udfyldt), { minG: 80, maxG: 160, kilde: 'Syntetisk kilde til prøven' })
  assert.equal(vaeskeForslag(80, 1, { vaeske: { mlPrKg: 10, kilde: '' } }), null)
})
