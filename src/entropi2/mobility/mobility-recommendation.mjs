import { WARMUP_BASE } from '../../athlete/mobilityCatalog.mjs'
import { focusPlan } from '../../athlete/mobilityFocus.mjs'
import { foldNavn } from '../../exerciseNames.js'
import { isMainLift } from '../../warmup.js'

const standard = {
  lift: 'Squat', need: 'Mere dybde',
  reason: 'Intet kendt hovedløft i dagens pas. Standardrutinen giver fokus på ankler og hofter.',
}

function choice(name) {
  if (typeof name !== 'string' || !isMainLift(name)) return null
  const folded = foldNavn(name)
  if (folded.includes('squat')) return {
    lift: 'Squat', need: 'Mere dybde',
    reason: 'Dagens squat får fokus på ankler og hofter til squatdybden.',
  }
  if (/baenk|bench/.test(folded)) return {
    lift: 'Bænkpres', need: 'Skulderposition',
    reason: 'Dagens bænkpres får fokus på skulderposition og skulderbladskontrol.',
  }
  if (/doedl|deadlift/.test(folded)) return folded.includes('sumo') ? {
    lift: 'Dødløft', need: 'Plads i sumostilling',
    reason: 'Dagens sumodødløft får fokus på hofter og plads i den brede stilling.',
  } : {
    lift: 'Dødløft', need: 'Hofteposition',
    reason: 'Dagens dødløft får fokus på hofteposition og hoftebøjning.',
  }
  return null
}

/**
 * Pure recommendation for today's session: { exercises: [{ name, sets? }] }.
 * Supplied exercise order breaks ties; no sorting, calendar or progress lookup.
 * Missing sets are allowed; supplied sets must be a positive finite number or
 * numeric string. Unknown/missing sessions use the existing squat depth plan.
 * Returns { lift, need, reason, isDefault, routine }; all steps retain catalog
 * doses/descriptions. Fresh objects prevent callers from changing the catalog.
 */
export function recommendMobilityRoutine(session) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : []
  let selected = null
  for (const exercise of exercises) {
    if (!exercise || typeof exercise !== 'object') continue
    const sets = exercise.sets
    if (sets !== undefined &&
        (!(typeof sets === 'number' || typeof sets === 'string') ||
         !Number.isFinite(Number(sets)) || Number(sets) <= 0)) continue
    selected = choice(exercise.name)
    if (selected) break
  }
  const { lift, need, reason } = selected || standard
  return { lift, need, reason, isDefault: selected === null,
    routine: focusPlan(lift, need, WARMUP_BASE).exercises }
}
