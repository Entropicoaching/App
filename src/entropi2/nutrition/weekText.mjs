import { calendarTime, parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { weekSummary } from './weekSummary.mjs'

const display = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
const amount = (value, unit) => value === null ? 'ukendt' : `${display(value)} ${unit}`
const goal = value => {
  const number = parseInputNumber(value)
  return number > 0 ? number : null
}

// Pure text projection of an already athlete-scoped meal history and snapshot goals
// (kcal/protein). The explicit end date includes its six preceding calendar days.
// No identity, meal label, advice, storage, clock or sending is part of this API.
export function weekText(historyRows, targets, date, { compact = false } = {}) {
  if (calendarTime(date) === null) return 'Kostuge: perioden er ukendt.'
  const { loggedDays, averages } = weekSummary(historyRows, targets, date)
  // Compact athlete view; the default projection retains dates and agreed goals.
  if (compact) {
    const detail = loggedDays < 2 ? 'for få dage til et gennemsnit'
      : averages.kcal === null || averages.protein === null ? 'gennemsnittet kan ikke beregnes, fordi næringsdata mangler eller skal kontrolleres'
      : `snit ${amount(averages.kcal, 'kcal')} · ${amount(averages.protein, 'g protein')} pr. logget dag`
    return `Seneste 7 dage: ${loggedDays} af 7 dage logget · ${detail}.`
  }
  const end = calendarTime(date)
  const start = new Date(end - 6 * 86400000).toISOString().slice(0, 10)
  const danishDate = iso => iso.split('-').reverse().join('.')
  const parts = [
    `Kost ${danishDate(start)}–${danishDate(date)}: ${loggedDays} af 7 dage logget.`,
  ]
  if (loggedDays) {
    parts.push(`Gennemsnit pr. logget dag: energi ${amount(averages.kcal, 'kcal')}; protein ${amount(averages.protein, 'g')}.`)
  } else {
    parts.push('Gennemsnit pr. logget dag: ingen loggede dage.')
  }
  const kcal = goal(targets?.kcal), protein = goal(targets?.protein)
  parts.push(`Daglige mål: energi ${kcal === null ? 'ikke angivet' : amount(kcal, 'kcal')}; protein ${protein === null ? 'ikke angivet' : amount(protein, 'g')}.`)
  return parts.join(' ')
}
