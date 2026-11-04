import { calendarDay } from '../../calendarDate.js'
import { parseInputNumber, optionalInput } from '../../inputValues.js'

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
