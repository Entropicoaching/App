// Synthetic data only. Real product adapter/snapshot/React and original SQL run.
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { historyFixture, uuid } from '../dailyReference.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'

export const today = '2026-11-07', dates = ['2026-11-08', '2026-11-09', '2026-11-10']
export const athleteId = 'synthetic-shopping-athlete'
export const mealNames = ['Morgenmad', 'Formiddag', 'Frokost', 'Før træning', 'Aftensmad', 'Aftenmåltid']
export const food = (id, name, preparation, citation = 'Syntetisk katalog A') => ({
  id, name, preparation, basisGrams: 100,
  nutrientsPer100g: { energyKcal: 0, proteinG: null, carbohydrateG: 0, fatG: null },
  source: { citation, verification: 'Syntetisk test, ikke verificeret' },
})
export function snapshot(factor = 1) {
  const lentils = food('synthetic:lentils', 'Linser', 'kogte'), rice = food('synthetic:rice', 'Ris', 'tørre')
  return createPlanSnapshot({ goal: 'vedligehold', intensity: 0,
    meals: mealNames.map((name, i) => ({ name, portions: [
      { grams: factor * (10 + i), food: lentils }, { grams: factor * (20 + 2 * i), food: rice },
      ...(i ? [] : [{ grams: factor * 7, food: { ...lentils, preparation: 'rå' } },
        { grams: factor * 11, food: { ...rice, id: 'synthetic:rice-other' } },
        { grams: factor * 13, food: { ...lentils, source: { ...lentils.source, citation: 'Syntetisk katalog B' } } }]),
    ] })) })
}
export function shoppingFixture(options = {}) {
  const f = historyFixture(options), parent = f.plan(70000, today, 'godkendt', athleteId)
  for (let i = 0; i < 3; i++) {
    f.data[tableNames[1]].push({ id: uuid(70010 + i), plan_id: parent.id, version_no: i + 1,
      effective_from: dates[i], portion_guidance: null, ...structuredClone(snapshot(i + 1)) })
    f.approve(70010 + i, parent.id, today + 'T10:00:00Z', athleteId)
  }
  return f
}
export const gate = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
export { uuid, tableNames }
