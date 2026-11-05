import { antalOrd } from '../antalOrd.mjs'
import { adaptPublicContract } from './publicContract.mjs'
import { weekProgressSentence } from './weekProgressSentence.mjs'
import { weeklyLoad } from './weeklyLoad.mjs'
import { weeklyShareSummary } from './weeklyShareSummary.mjs'
import { calendarDay, calendarDaysBetween } from '../../calendarDate.js'

const format = n => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)

// Preserve raw light/deload sets: strength-filtered contract.rows cannot describe
// total load. Local edits/undo own current exercise IDs, even when empty.
export function analysisWeekExtras(props, now) {
  const contract = adaptPublicContract(props, now)
  const ids = new Set(contract.weekLogs === null ? [] : contract.exercises.map(ex => ex.id))
  const history = Array.isArray(props.fremgangLogs) && props.fremgangLoading !== true
    ? props.fremgangLogs.filter(row => row && typeof row === 'object' && !ids.has(row.exercise_id)) : null
  // Do not use weekLogs' deduplicated values: that strength adapter does not
  // distinguish pending metadata. Keep conflicts until the load module sees them.
  const local = contract.weekLogs === null ? [] : props.exerciseLogs.filter(row => {
    if (!row || !ids.has(row.exercise_id) || typeof row.logged_at !== 'string') return false
    const age = calendarDaysBetween(contract.start, calendarDay(row.logged_at))
    return age !== null && age >= 0 && age < 7
  })
  const rows = [...(history ?? []), ...local]
  const pending = new Set(rows.filter(row => row._optimistic && row.exercise_id != null && row.set_number != null)
    .map(row => JSON.stringify([row.exercise_id, row.set_number])))
  const authoritative = rows.filter(row => !pending.has(JSON.stringify([row.exercise_id, row.set_number])))
    .map(row => row.exercise_id != null && row.set_number != null ? { ...row, id: undefined } : row)
  const load = history && weeklyLoad(authoritative, now)
  const ratio = load?.acuteChronicRatio
  return {
    progress: weekProgressSentence(props, now),
    load: ratio == null ? null
      : `Registreret belastning: ${format(load.weeks[3].tonnage)} kg tonnage denne uge, ${format(ratio)} ${antalOrd(ratio, 'gang', 'gange')} gennemsnittet af de tre foregående uger. Denne uge kan være ufuldstændig.`,
    share: weeklyShareSummary(props, now),
  }
}

// Read clipboard capability only on an explicit click. Capture currentTarget
// before awaiting, and keep feedback within this button (no persistent writes).
export async function copyAnalysisWeek(event, text, clipboard = globalThis.navigator?.clipboard) {
  const button = event.currentTarget
  if (button.disabled) return false
  button.disabled = true
  try {
    if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable')
    await clipboard.writeText(text)
    button.textContent = 'Ugen er kopieret'
    return true
  } catch {
    button.textContent = 'Kunne ikke kopiere. Markér teksten ovenfor.'
    return false
  } finally {
    button.disabled = false
  }
}
