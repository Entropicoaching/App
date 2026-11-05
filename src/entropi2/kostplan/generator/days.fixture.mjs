import { calculateNutrition } from '../beregning.mjs'

// Entirely synthetic adult strength-athlete days; food data comes from the catalog.
export const foodId = name => 'local:' + encodeURIComponent(name)
export const selection = (name, minGrams, maxGrams) => ({ foodId: foodId(name), minGrams, maxGrams })
const mealChoices = () => [
  { id: 'm1', name: 'Morgenmad', items: [selection('Havregryn', 40, 150), selection('Skyr naturel', 100, 400),
    selection('Banan', 80, 200), selection('Mandler', 10, 40)] },
  { id: 'm2', name: 'Frokost', items: [selection('Ris kogt', 100, 500), selection('Kyllingebryst', 75, 250),
    selection('Broccoli', 50, 200), selection('Olivenolie', 5, 30)] },
  { id: 'm3', name: 'Aftensmad', items: [selection('Pasta kogt', 100, 450), selection('Hakket oksekød 8%', 75, 250),
    selection('Tomat', 100, 200), selection('Olivenolie', 5, 25)] },
  { id: 'm4', name: 'Mellemmåltid', items: [selection('Skyr naturel', 100, 350), selection('Rugbrød', 50, 200),
    selection('Mandler', 10, 40)] },
  { id: 'm5', name: 'Aften', items: [selection('Mælk minimælk', 200, 400), selection('Rugbrød', 50, 160),
    selection('Ost 30+', 20, 60)] },
]

export function strengthDays() {
  return [[65, 'cut', 3], [75, 'cut', 4], [80, 'maintain', 3], [90, 'maintain', 4],
    [95, 'bulk', 4], [110, 'bulk', 5]].map(([weightKg, goal, mealCount]) => ({
    label: `${weightKg} kg / ${goal} / ${mealCount} måltider`,
    input: { targets: calculateNutrition({ date: '2026-11-05', adult: true, weightKg, goal,
      maintenanceKcal: weightKg * 33 }).targets, mealCount, meals: mealChoices().slice(0, mealCount) },
  }))
}
