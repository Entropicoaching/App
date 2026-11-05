import { antalOrd } from '../antalOrd.mjs'
import { positive, displayNumber } from './model.mjs'

// Use the validated existing week receipt and latest weighing only.
// The logged intake is a neutral starting point, without a weight-based formula.
export function energySuggestion(model = {}, week = null, basis = null) {
  if (basis && basis.state !== 'ready') return { kcal: null, text: basis.text }
  if (basis?.days.size >= 4 && !week)
    return { kcal: null, text: 'Et gyldigt gennemsnitligt energiindtag er nødvendigt for at vise et forslag.' }
  const weight = positive(model.latest?.weight)
  if (weight === null) return { kcal: null, text: 'Log en gyldig vejning for at få hjælp til energimålet.' }
  if (!Number.isInteger(week?.days) || week.days < 4 || week.days > 7)
    return { kcal: null, text: 'Energimålet kræver mindst 4 loggede dage med gyldigt indtag i de seneste 7 dage.' }
  const intake = positive(week.kcal)
  const kcal = intake === null ? null : Math.round(intake)
  if (!Number.isSafeInteger(kcal) || kcal < 1 || kcal > 2147483647)
    return { kcal: null, text: 'Et gyldigt gennemsnitligt energiindtag er nødvendigt for at vise et forslag.' }
  return { kcal, text: `Typisk indtag: ${kcal.toLocaleString('da-DK')} kcal på ${week.days} ${antalOrd(week.days, 'logget dag', 'loggede dage')}. Seneste vejning: ${displayNumber(weight)} kg. Indtaget kan bruges som udgangspunkt for energimålet; tilpas det til atleten.` }
}
