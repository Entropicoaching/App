import { exerciseViewGroups } from './exerciseSetView.js'
import { rel1030Enabled } from './rel1030.mjs'

export const DEFAULT_OPVARM_STIGE = false
export const BAR_KG = 20
export const PLATES_KG = Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25])
export function opvarmStigeEnabled(prop = false, search = '') {
  const values = new URLSearchParams(search).getAll('opvarmStige')
  return prop === true || rel1030Enabled(search) || (values.length === 1 && values[0] === '1')
}
// Only an explicit positive kilogram value; never parse ranges, RPE or percentages.
function kilograms(value) {
  if (typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null
  if (!['number', 'string'].includes(typeof value)) return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? number : null
}
export function plateLoad(value) {
  const kg = kilograms(value)
  if (kg === null || kg < BAR_KG) return null
  // Paired 1.25 kg plates give a 2.5 kg load grid. Exact ties round down.
  const units = (kg - BAR_KG) / 2.5
  const rounded = Math.ceil(units - 0.5)
  if (!Number.isSafeInteger(rounded)) return null
  let side = rounded * 1.25
  const plates = []
  for (const plate of PLATES_KG) {
    const count = Math.floor(side / plate)
    if (count) plates.push({ kg: plate, count })
    side -= count * plate
  }
  return { weight: BAR_KG + rounded * 2.5, plates }
}
export function warmupLadder(lift, topWeight) {
  if (!['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].includes(lift)) return null
  const top = plateLoad(topWeight)
  if (!top) return null
  const plannedWeight = kilograms(topWeight)
  const steps = []
  for (const [target, reps] of [[20, 8], [plannedWeight * 0.4, 5], [plannedWeight * 0.6, 3], [plannedWeight * 0.8, 2], [plannedWeight * 0.9, 1]]) {
    const load = plateLoad(Math.max(BAR_KG, target))
    if (load.weight > top.weight || (load.weight === top.weight && top.weight > BAR_KG)) continue
    if (!steps.some(step => step.weight === load.weight)) steps.push({ ...load, reps })
  }
  return { lift, plannedWeight, topWeight: top.weight, steps }
}
export function sessionLadder(exercises = []) {
  const group = exerciseViewGroups(Array.isArray(exercises) ? exercises.filter(Boolean) : [])
    .find(item => ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].includes(item.name))
  if (!group) return null
  // An explicitly labelled topset wins. A plain working row already has its
  // planned load; backoffs, history, overrides and intensity never supply it.
  const row = group.rows.find(item => item.type === 'top') || group.rows.find(item => item.type === 'straight')
  return row ? warmupLadder(group.name, row.ex.recommended_weight) : null
}
