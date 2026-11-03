import { addCalendarDays } from '../../calendarDate.js'
import { MAIN_LIFTS, bestWeeklySet } from './weekOverview.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
export const formatHistoryKg = value => number.format(value)
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

// Descriptive weekly maxima only; no D18, readiness or cause is inferred.
// Calendar weeks include the current partial week, using the adapter's Danish day.
export function fourWeekHistory(contract) {
  if (!contract.today) return { message: 'Dato mangler. Udviklingen kan ikke vises.', lifts: [] }
  const monday = addCalendarDays(contract.today,
    -((new Date(`${contract.today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = addCalendarDays(monday, (i - 3) * 7)
    const end = addCalendarDays(start, 6)
    return { start, end, label: `${date(start)} til ${date(end)}` }
  })
  return {
    message: 'Bedste e1RM pr. kalenderuge fra tunge sæt i kendte programblokke. Deload, taper, aflastning og afventende sæt er udeladt. Denne uge kan være ufuldstændig; forskelle beskriver registreringerne, ikke årsagen eller parathed.',
    lifts: MAIN_LIFTS.map(lift => {
      const unavailable = contract.loading ? 'Henter løftehistorik. Udviklingen er ikke klar.'
        : !contract.historyReady ? 'Løftehistorik mangler. Udviklingen er ikke klar.' : null
      const points = weeks.map(week => {
        const best = unavailable ? null : bestWeeklySet(contract.rows, lift, week.start, week.end)
        return { ...week, value: best?.value ?? null }
      })
      const recorded = points.filter(point => point.value !== null)
      let summary = unavailable || (recorded.length === 0 ? 'Ingen sammenlignelige tunge sæt i de seneste 4 uger.'
        : 'Kun én uge med data; udviklingen kan ikke sammenlignes.')
      if (!unavailable && recorded.length >= 2) {
        const first = recorded[0], last = recorded.at(-1)
        const delta = Math.round((last.value - first.value) * 10) / 10
        const period = `fra ugen ${date(first.start)} til ugen ${date(last.start)}`
        summary = delta === 0 ? `Stabilt e1RM ${period}.`
          : `${delta > 0 ? 'Op' : 'Ned'} ca. ${formatHistoryKg(Math.abs(delta))} kg e1RM ${period}.`
      }
      return { lift, points, summary, unavailable: !!unavailable }
    }),
  }
}
