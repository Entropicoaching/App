import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { parseInputNumber, optionalInput } from '../../inputValues.js'

// A Home suggestion is deliberately narrower than the full tracking draft.
// Energy is today's answer; yesterday's sleep and private fields are not copied.
export function homeReadinessSuggestion(props = {}) {
  if (props.enabled !== true || props.sessionReadOnly) return null
  const { athlete, today, trackingData: data } = props
  if (typeof athlete?.id !== 'string' || !athlete.id.trim() || typeof today !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(today) || calendarDay(today) !== today || data?.status !== 'ready' || data.complete !== true ||
      data.athleteId !== athlete.id || data.today !== today || !Array.isArray(data.readinessRows)) return null
  const own = row => row?.athlete_id === athlete.id && !row._optimistic
  if (own(props.readinessLog) && props.readinessLog.logged_date === today ||
      data.readinessRows.some(row => own(row) && row.logged_date === today)) return null
  // Never silently replace an athlete's existing draft with a suggestion.
  if (['sleep', 'energy', 'motivation', 'stress', 'soreness'].some(key => !optionalInput(props.readinessInput?.[key]))) return null
  const rows = data.readinessRows.filter(row => own(row) && row.logged_date === addCalendarDays(today, -1))
  if (rows.length !== 1) return null
  const scores = Object.fromEntries(['energy', 'motivation', 'stress', 'soreness_level']
    .map(key => [key, parseInputNumber(rows[0][key])]))
  if (Object.values(scores).some(value => !Number.isInteger(value) || value < 1 || value > 5)) return null
  return { sleep_hours: '', energy: '', motivation: String(scores.motivation),
    stress: String(scores.stress), soreness_level: String(scores.soreness_level) }
}

export function quickLogStatus(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, today } = props
  if (!athlete?.id || !calendarDay(today)) return null
  const { readinessLog, weightLogs } = props
  const own = row => row?.athlete_id === athlete.id && !row._optimistic
  return {
    readiness: own(readinessLog) && readinessLog.logged_date === today,
    weight: Array.isArray(weightLogs) && weightLogs.some(row => own(row) &&
      row.logged_at === today && parseInputNumber(row.weight) > 0),
  }
}

export function confirmedReadinessEnergy(props = {}) {
  if (props.enabled !== true || props.sessionReadOnly || props.readinessError) return null
  const { athlete, today, readinessLog: row, trackingData: data } = props
  if (data && (data.status !== 'ready' || data.complete !== true ||
      data.athleteId !== athlete?.id || data.today !== today)) return null
  if (!athlete?.id || !calendarDay(today) || row?.athlete_id !== athlete.id ||
      row.logged_date !== today || row._optimistic) return null
  const energy = parseInputNumber(row.energy)
  return Number.isInteger(energy) && energy >= 1 && energy <= 5 ? energy : null
}

export function quickLogError(kind, props) {
  if (kind === 'weight') return parseInputNumber(props.weightInput) > 0 ? null : 'Skriv din vægt i kg, fx 82,5.'
  const input = props.readinessInput ?? {}
  if (['energy', 'motivation', 'stress', 'soreness'].some(key => {
    const value = parseInputNumber(input[key])
    return !Number.isInteger(value) || value < 1 || value > 5
  })) return 'Vælg et svar fra 1 til 5 i alle fire felter.'
  const sleep = parseInputNumber(input.sleep)
  return !optionalInput(input.sleep) && (sleep === null || sleep > 24)
    ? 'Skriv søvn fra 0 til 24 timer, eller lad feltet stå tomt.' : null
}
