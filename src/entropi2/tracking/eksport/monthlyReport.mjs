import { buildAthleteOverview } from '../atlet/overview.mjs'
import { addCalendarDays } from '../../../calendarDate.js'

const COLUMNS = Object.freeze(['record_type', 'athlete_id', 'period_from', 'period_to',
  'metric', 'exercise', 'value', 'unit', 'observed_days', 'expected_days', 'rule'])
const METRICS = Object.freeze([
  ['training_sets', 'sets', 'Registrerede gennemførte sæt; manglende log er ikke hvile'],
  ['training_volume', 'kg_reps', 'Sum kg × udførte reps; ukendt måling giver null'],
  ['nutrition_energy', 'kcal', 'Registreret kost; ingen antagelse om komplet kostdag'],
  ['nutrition_protein', 'g', 'Registreret kost; ingen sammenligning med aktuelle mål'],
  ['body_weight', 'kg', 'Registreret kropsvægt; huller udfyldes ikke'],
  ['sleep', 'hours', 'Atletens manuelle søvnregistrering; huller udfyldes ikke'],
  ['energy', 'score_1_to_5', 'Atletens manuelle energi; 5 er højest'],
  ['stress', 'score_1_to_5', 'Atletens manuelle stress; 5 er højest'],
  ['soreness', 'score_0_to_10', 'Atletens manuelle ømhed; 0 er ingen'],
])
const error = () => ({ status: 'error', message: 'Eksport kræver ét komplet, gyldigt atlet-snapshot.' })
const object = row => row !== null && typeof row === 'object' && !Array.isArray(row)

// Never stringify input records. Existing models own numeric/date semantics;
// this boundary additionally rejects sparse/mixed/oversized collections.
function validCollections(input) {
  return ['dailyRows', 'exerciseLogs', 'mealRows', 'weightRows'].every(key => {
    const rows = input[key]
    return Array.isArray(rows) && rows.length <= 10000
      && Array.from(rows).every(row => object(row) && row.athlete_id === input.athleteId)
  })
}

/** Pure, unwired, explicitly enabled local export. See README.md for adapter contract.
 * No clock, DOM, download click, storage, auth, network or automatic changes.
 */
export function buildCoachMonthlyReport(input, options = {}) {
  if (options?.enabled !== true) return null
  if (!object(input)) return error()
  if (input.status === 'loading') return { status: 'loading' }
  if (input.status !== 'ready' || input.complete !== true) return error()
  try {
    if (typeof input.athleteId !== 'string' || !input.athleteId.trim()
      || input.athleteId.length > 120 || !validCollections(input)) return error()
    const model = buildAthleteOverview(input, { enabled: true })
    if (!model || !['ready', 'empty'].includes(model.status)) return error()
    const records = []
    const append = (type, from, to, metric, value, observed, expected, exercise = '', rule = metric[2]) => {
      records.push({ record_type: type, athlete_id: input.athleteId,
        period_from: from, period_to: to, metric: metric[0], exercise,
        value, unit: metric[1], observed_days: observed, expected_days: expected, rule })
    }
    for (const week of model.weeks) {
      const series = METRICS.map(() => [])
      for (let i = 0; i < 7; i++) {
        const date = addCalendarDays(week.from, i)
        const training = week.training.days[i]
        const nutrition = week.nutrition.days.find(day => day.date === date)
        const values = [training.sets > 0 ? training.sets : null, training.tonnage,
          nutrition?.kcal ?? null, nutrition?.protein ?? null, week.weight.days[i].value,
          ...week.wellbeing.map(field => field.days[i].value)]
        values.forEach((value, index) => {
          series[index].push(value)
          append('daily', date, date, METRICS[index], value, value === null ? 0 : 1, 1)
        })
      }
      series.forEach((values, index) => {
        const count = values.filter(value => value !== null).length
        append('data_basis', week.from, week.to, METRICS[index], null, count, 7, '',
          `Dage med kendt værdi, ikke fuldstændighed eller signalgrundlag. ${METRICS[index][2]}`)
      })
    }
    // Strength keeps existing calendar-week and variant separation. Clip the
    // displayed period to this export's 28 days; upstream receives filtered sets.
    for (const lift of model.strength) {
      const from = lift.weekStart < model.from ? model.from : lift.weekStart
      const end = addCalendarDays(lift.weekStart, 6)
      const to = end > model.to ? model.to : end
      append('strength', from, to, ['estimated_1rm', 'kg'], lift.e1rm, null, null, lift.name,
        'Højeste e1RM i kalenderugen inden for eksportperioden; Epley kg × (1 + reps/30); appens hovedløft-, tungt sæt- og deloadregler; ingen interpolation')
    }
    return { status: model.status, schema: 'entropi-coach-monthly-export/v1',
      athleteId: input.athleteId, from: model.from, to: model.to,
      timeZone: 'Europe/Copenhagen', records }
  } catch {
    // Malformed supplied records must not yield a partial downloadable report.
    return error()
  }
}

function csvCell(value) {
  if (value === null) return '""'
  let text = String(value)
  // Quoting alone does not prevent spreadsheet formulas. Only strings need
  // neutralizing; numeric values retain their machine-readable representation.
  if (typeof value === 'string' && (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)
    || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function exportCoachMonthlyReport(input, options = {}) {
  if (options?.enabled !== true) return null
  const format = options.format ?? 'csv'
  if (format !== 'csv' && format !== 'json') return { status: 'error', message: 'Vælg CSV eller JSON.' }
  const report = buildCoachMonthlyReport(input, options)
  if (!report || !['ready', 'empty'].includes(report.status)) return report
  const content = format === 'json' ? JSON.stringify(report, null, 2) + '\n'
    : '\uFEFF' + [COLUMNS.map(csvCell).join(','), ...report.records.map(row =>
      COLUMNS.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n'
  return { status: report.status, filename: `coach-4-weeks-${report.from}-${report.to}.${format}`,
    mimeType: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8', content }
}
