import { copenhagenDay } from '../../../programOverblik.mjs'
import { inputInteger } from '../../../inputValues.js'
import { erDeloadBlok } from '../../../exerciseProgress.js'

export const DEFAULT_BLOCK_OVERVIEW = false
const dayNumber = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && copenhagenDay(value) === value ? value : null
const unknown = message => ({ state: 'unknown', message, weeks: [], next: null })

// Total prescribed exercise sets, not tonnage, completed sets or muscle weighting.
// Missing nested relations and malformed counts are unknown, never an invented zero.
export function plannedWeekSets(week) {
  if (week?.readEvidence?.complete === false || !Array.isArray(week?.sessions)) return null
  let total = 0
  for (const session of week.sessions) {
    if (!Array.isArray(session?.exercises)) return null
    for (const exercise of session.exercises) {
      const sets = inputInteger(exercise?.sets)
      if (sets === null || sets < 0 || !Number.isSafeInteger(total + sets)) return null
      total += sets
    }
  }
  return total
}

function markers(name) {
  return [/(?:^|\W)test(?:uge|week)?(?:$|\W)/i.test(name || '') && 'test',
    erDeloadBlok(name) && 'deload'].filter(Boolean)
}

/** Already scoped, complete weeks(*,sessions(*,exercises(*))) program state.
 * currentWeekId is the ACTIVE week, never the week opened for browsing.
 * Without it, only an explicit, unambiguous seven-day date span locates today.
 * Test/deload markers come only from block_name; no inferred training advice.
 */
export function buildBlockOverview({ enabled = DEFAULT_BLOCK_OVERVIEW, weeks = [],
  currentWeekId, today = new Date() } = {}) {
  if (enabled !== true) return null
  if (!Array.isArray(weeks)) return unknown('Programdata er ikke tilgængelige.')
  if (!weeks.length) return { state: 'empty', message: 'Din blok er ikke planlagt endnu.', weeks: [], next: null }
  const owners = new Set(weeks.filter(Boolean).map(w => w.athlete_id).filter(id => id != null))
  if (owners.size > 1) return unknown('Programmet indeholder uger fra flere atleter.')
  // Week zero and repeated week numbers exist in older plans. Identity is the id;
  // ambiguous ids are excluded rather than making every other week disappear.
  const counts = new Map()
  for (const week of weeks) if (week?.id != null) counts.set(week.id, (counts.get(week.id) || 0) + 1)
  const sorted = weeks.filter(week => week && week.id != null && counts.get(week.id) === 1
    && Number.isSafeInteger(week.week_number) && week.week_number >= 0
    && (week.block_name == null || typeof week.block_name === 'string')
    && week.readEvidence?.complete !== false).sort((a, b) => a.week_number - b.week_number)
  if (!sorted.length) return unknown('Ingen brugbare programuger er tilgængelige.')
  let active
  if (currentWeekId != null) {
    active = sorted.findIndex(w => w.id === currentWeekId)
  } else {
    const day = copenhagenDay(today)
    if (!day) return unknown('Den aktuelle dato er ukendt.')
    const candidates = sorted.filter(w => civilDay(w.start_date)
      && dayNumber(day) >= dayNumber(w.start_date) && dayNumber(day) < dayNumber(w.start_date) + 7)
    if (candidates.length !== 1) return unknown('Den aktuelle uge kan ikke bestemmes ud fra programmets datoer.')
    active = sorted.indexOf(candidates[0])
  }
  if (active < 0) return unknown('Den aktuelle uge findes ikke i programmet.')
  // Contiguous names, as in computePhases; repeated names are separate blocks.
  const name = sorted[active].block_name || null
  let start = active, end = active
  while (start > 0 && (sorted[start - 1].block_name || null) === name) start--
  while (end + 1 < sorted.length && (sorted[end + 1].block_name || null) === name) end++
  const block = sorted.slice(start, end + 1)
  const upcoming = block.slice(active - start + 1).find(w => markers(w.block_name).length)
  return { state: 'ready', partial: sorted.length !== weeks.length, name: name || 'Din aktuelle blok',
    currentWeek: active - start + 1, totalWeeks: block.length,
    weeks: block.map((w, i) => ({ id: w.id, weekNumber: w.week_number, blockWeek: i + 1,
      current: sorted[active] === w, start: civilDay(w.start_date), plannedSets: plannedWeekSets(w) })),
    next: upcoming ? { weekNumber: upcoming.week_number, start: civilDay(upcoming.start_date),
      kinds: markers(upcoming.block_name), name: upcoming.block_name } : null }
}
