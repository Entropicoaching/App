import { evaluateCoachWeek } from '../coachuge/evaluate.mjs'
import { BASIS_DOMAINS, weeklyDataBasis } from '../kvalitet/weeklyDataBasis.mjs'

const token = value => typeof value === 'string' && value.length > 0
  && value.length <= 120 && value === value.trim()
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const weekStates = new Set(['flags', 'noFlags', 'insufficient', 'empty'])

function athleteOverview(athleteId, asOf, snapshot) {
  let week = { state: 'error' }
  // Explicit identity and cutoff match BEFORE evaluating an athlete's snapshot.
  try {
    const data = snapshot?.coachWeek
    if (data?.athleteId === athleteId && data.asOf === asOf) {
      week = evaluateCoachWeek({ enabled: true, data })
    }
  } catch { /* An unreadable snapshot is unknown, never zero flags. */ }
  let basis
  try {
    basis = weeklyDataBasis({ enabled: true, athleteId, asOf, sources: snapshot?.sources })
  } catch { /* Preserve the athlete, but do not invent coverage. */ }
  // Even missing snapshots retain all four weeks with explicit unknown sources.
  if (basis?.state !== 'ready') basis = weeklyDataBasis({ enabled: true, athleteId, asOf })
  const flagCount = weekStates.has(week.state) ? week.flags.length : null
  const unknownDomains = BASIS_DOMAINS.filter(domain => basis.weeks.at(-1).domains[domain].state !== 'ready').length
  const missingValueDays = basis.weeks.reduce((total, w) => total + BASIS_DOMAINS.reduce((sum, domain) => {
    const d = w.domains[domain]
    return sum + (d.state === 'ready' ? w.elapsedDays - d.valueDays : 0)
  }, 0), 0)
  return { athleteId, weekState: week.state, flagCount, weeks: basis.weeks,
    unknownDomains, missingValueDays }
}

/** Pure, unwired coach model. Caller supplies the complete authorized roster.
 * No database IDs are inferred from user_id; snapshots are not the roster.
 * Unknown flag counts sort after positive counts and before confirmed zero.
 * Ties: unknown coverage domains, missing/invalid value-days, then athlete ID.
 * Coverage ranks attention only; it does not validate a signal or imply illness.
 */
export function buildCoachTeamOverview(options = {}) {
  if (options?.enabled !== true) return { state: 'off', athletes: [] }
  const roster = options.roster
  if (roster?.state === 'loading') return { state: 'loading', athletes: [] }
  const asOf = options.asOf
  const scope = weeklyDataBasis({ enabled: true, athleteId: 'scope-check', asOf })
  if (scope.state !== 'ready' || roster?.state !== 'ready' || roster.complete !== true
    || !Array.isArray(roster.athleteIds) || roster.athleteIds.length > 10000
    || !Array.from(roster.athleteIds).every(token)
    || new Set(roster.athleteIds).size !== roster.athleteIds.length) return { state: 'error', athletes: [] }
  if (!roster.athleteIds.length) return { state: 'empty', asOf, athletes: [] }
  const allowed = new Set(roster.athleteIds)
  const snapshots = new Map()
  const supplied = options.athletes
  if (supplied != null && (!Array.isArray(supplied) || supplied.length > 10000)) return { state: 'error', athletes: [] }
  for (const snapshot of supplied ?? []) {
    const id = snapshot?.athleteId
    if (!allowed.has(id)) continue
    // Duplicate identities are ambiguous, independent of input order.
    snapshots.set(id, snapshots.has(id) ? null : snapshot)
  }
  const athletes = roster.athleteIds.map(id => athleteOverview(id, asOf, snapshots.get(id)))
  const group = a => a.flagCount > 0 ? 0 : a.flagCount === null ? 1 : 2
  athletes.sort((a, b) => group(a) - group(b) || (b.flagCount ?? 0) - (a.flagCount ?? 0)
    || b.unknownDomains - a.unknownDomains || b.missingValueDays - a.missingValueDays
    || compare(a.athleteId, b.athleteId))
  return { state: 'ready', asOf, athletes }
}
