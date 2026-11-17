// Ordre 1568: RPE med ét tryk i dagens pas (− og + som vægtens trinfliser).
// Alle ændringer går gennem chooseRpeInput, så det der gemmes og vises som
// "valgt" er det samme som ved valg i vælgeren.
import { chooseRpeInput } from '../rpeEvidence.mjs'

export const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const RPE_STANDARD = 8

const tal = v => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Udgangspunkt: valgt RPE, ellers planlagt RPE, ellers 8. Resultatet lander
// på nærmeste halve tal inden for 5,5 til 10.
export function stepRpe(valgt, planlagt, delta) {
  const start = tal(valgt) ?? tal(planlagt) ?? RPE_STANDARD
  const naeste = Math.round((start + delta) * 2) / 2
  return Math.min(RPE_VALUES.at(-1), Math.max(RPE_VALUES[0], naeste))
}

export function stepRpeInInputs(state, key, input, planlagt, delta) {
  return chooseRpeInput(state, key, stepRpe(input.rpe, planlagt, delta), input)
}
