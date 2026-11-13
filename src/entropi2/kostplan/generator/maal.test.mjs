import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateGramPlan } from './index.mjs'
import { DANSKE_DAGLIGVARER, tjekMaaltid } from '../realisme.mjs'

// Ordre 1176: syntetisk dag hvor kulhydrat- og fedtmålet trækker protein under 5 % uden justeringen.
const sel = name => { const v = DANSKE_DAGLIGVARER[name]
  return { foodId: 'local:' + encodeURIComponent(name), minGrams: Math.max(5, Math.ceil(v.minGram / 5) * 5), maxGrams: Math.floor(v.maxGram / 5) * 5 } }
const meals = [
  ['Morgenmad', ['Æg helt', 'Rugbrød', 'Ost 30+', 'Æble']], ['Frokost', ['Kartofler kogte', 'Laks fersk', 'Broccoli', 'Rapsolie']],
  ['Aftensmad', ['Ris kogt', 'Kyllingebryst', 'Tomat', 'Olivenolie']], ['Mellemmåltid', ['Hytteost', 'Banan', 'Valnødder']],
].map(([name, items], i) => ({ id: 'm' + i, name, items: items.map(sel) }))
const targets = { kcal: 2083, protein: 160, carb: 251.1, fat: 44.6 }

test('generatoren rammer kcal og protein inden for 5 % uden at bryde portionsgrænser', () => {
  const plan = generateGramPlan({ targets, mealCount: meals.length, meals })
  assert.ok(Math.abs(plan.deviation.kcal.percent) <= 5, String(plan.deviation.kcal.percent))
  assert.ok(Math.abs(plan.deviation.protein.percent) <= 5, String(plan.deviation.protein.percent))
  for (const meal of plan.meals) for (const item of meal.items) {
    assert.ok(item.grams >= item.minGrams && item.grams <= item.maxGrams && item.grams % 5 === 0, `${item.foodId} ${item.grams}`)
  }
  assert.ok(plan.meals.every(m => tjekMaaltid({ items: m.items.map(i => ({ name: i.food.name, grams: i.grams })) }).ok))
  assert.deepEqual(plan.meals.map(m => m.items.map(i => i.foodId)), meals.map(m => m.items.map(i => i.foodId)))
})
