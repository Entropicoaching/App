import { parseInputNumber } from '../../inputValues.js'
import { fixedRepsEntry } from '../../fixedRepsEntry.js'
import { formatKg } from '../home/today/todayModel.mjs'

// U6 del 1: næste uges vægt i sættet. Rene beregninger, ingen læsninger og ingen skrivninger.
// Kilde: når coachen godkender udkastet fra draft-next-week og gemmer ugen, skriver
// create_program_week / fill_planned_program_week vægten i exercises.recommended_weight
// (supabase/functions/draft-next-week/index.ts). Atleten kan ikke læse
// training_progression_states (kun service_role), så en vægt over 0 i recommended_weight
// er coachens plan. 0 eller tomt betyder "vælg selv" (entropi-skillen, programregel 9);
// så gælder sidste pas' vægt som i U5.

const given = value => value != null && String(value).trim() !== ''
const key = name => typeof name === 'string' ? name.trim().toLowerCase() : ''
const round = value => Math.round(value * 10) / 10

export function plannedWeight(exercise) {
  const weight = parseInputNumber(exercise?.recommended_weight)
  return weight != null && weight > 0 ? round(weight) : null
}

// U7 del 2 (kontrollens bemærkning til U6): hedder topsæt og backoff det samme, må "(+2,5)"
// ikke regnes mod backoff. Med topSet regnes forskellen mod dagens tungeste sæt af navnet
// sidste gang (top fra readLastWeights), og kun den tungeste planlagte række af navnet i dag
// får en forskel; en backoff-række med samme navn står uden tal i parentes.
function topSetOnly(exercises) {
  const heaviest = new Map()
  for (const ex of exercises) {
    const plan = plannedWeight(ex)
    if (!ex?.id || !key(ex.name) || plan == null) continue
    const best = heaviest.get(key(ex.name))
    if (!best || plan > best.plan) heaviest.set(key(ex.name), { id: ex.id, plan })
  }
  return ex => heaviest.get(key(ex.name))?.id === ex.id
}

// Én linje pr. øvelse i dagens pas: coachens plan med forskellen mod sidst, ellers sidste pas.
export function planWeightLines(exercises, lastByName, { topSet = false } = {}) {
  if (!Array.isArray(exercises)) return []
  const lines = []
  const isTop = topSet ? topSetOnly(exercises) : () => true
  for (const ex of exercises) {
    if (!ex?.id || !key(ex.name)) continue
    const previous = lastByName?.[key(ex.name)]
    const lastWeight = parseInputNumber(topSet && previous?.top != null ? previous.top : previous?.weight)
    const last = lastWeight != null && lastWeight > 0 ? round(lastWeight) : null
    const plan = plannedWeight(ex)
    if (plan != null) lines.push({ id: ex.id, name: ex.name.trim(), weight: plan, source: 'plan',
      delta: last == null || !isTop(ex) ? null : round(plan - last) })
    else if (last != null) lines.push({ id: ex.id, name: ex.name.trim(), weight: last, source: 'last', delta: null })
  }
  return lines
}

// "Squat 142,5 kg (+2,5)", "Squat 140 kg (som sidst)" eller "Bænkpres 60 kg som sidst".
export function planWeightText(line) {
  if (!line || !(line.weight > 0)) return ''
  const base = `${line.name} ${formatKg(line.weight)} kg`
  if (line.source !== 'plan') return `${base} som sidst`
  if (line.delta == null) return base
  if (line.delta === 0) return `${base} (som sidst)`
  return `${base} (${line.delta > 0 ? '+' : '−'}${formatKg(Math.abs(line.delta))})`
}

// Første sæt får coachens planvægt i udkastet. Et felt, atleten allerede har udfyldt, bevares altid.
export function planFirstSetPrefill(exercises, logInputs = {}) {
  const out = {}
  if (!Array.isArray(exercises)) return out
  for (const ex of exercises) {
    const plan = plannedWeight(ex)
    const id = `${ex?.id}_1`
    if (!ex?.id || plan == null || given(logInputs?.[id]?.weight)) continue
    const reps = given(logInputs?.[id]?.reps) ? logInputs[id].reps : fixedRepsEntry(ex.reps) ?? ''
    out[id] = { ...(logInputs?.[id] || {}), weight: String(plan), reps }
  }
  return out
}
