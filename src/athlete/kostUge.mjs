const METRICS = ['kcal', 'protein']
const DAY = 86400000

function dateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Dato skal være YYYY-MM-DD')
  const time = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new TypeError('Ugyldig dato')
  return time
}
const iso = time => new Date(time).toISOString().slice(0, 10)
const valueOrNull = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const mean = values => {
  if (!values.length) return null
  const result = values.reduce((sum, value) => sum + value, 0) / values.length
  if (!Number.isFinite(result)) throw new RangeError('Gennemsnit uden for talområdet')
  return result
}

// Pure input contract: logs belong to one athlete; coveredDates certifies complete
// reads, not complete food intake. targetHistory entries are full snapshots,
// including explicit null for an unknown/removed goal. No current-goal fallback.
export function summarizeKostWeek({ selectedDate, asOfDate, coveredDates, logs, targetHistory }) {
  const selected = dateTime(selectedDate)
  dateTime(asOfDate)
  if (![coveredDates, logs, targetHistory].every(Array.isArray)) throw new TypeError('Lister kræves')
  const monday = selected - ((new Date(selected).getUTCDay() + 6) % 7) * DAY
  const covered = new Set(coveredDates.map(date => { dateTime(date); return date }))
  const history = targetHistory.map(entry => {
    dateTime(entry.effectiveFrom)
    return { effectiveFrom: entry.effectiveFrom, kcal: valueOrNull(entry.kcal), protein: valueOrNull(entry.protein) }
  }).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  if (history.some((entry, index) => index > 0 && entry.effectiveFrom === history[index - 1].effectiveFrom)) {
    throw new TypeError('Kun ét målsnapshot pr. dato')
  }
  const byDate = new Map()
  for (const log of logs) {
    // APP-PERF2: samme datostreng valideres kun en gang i dette kald.
    if (!byDate.has(log.date)) {
      dateTime(log.date)
      byDate.set(log.date, [])
    }
    byDate.get(log.date).push(log)
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = iso(monday + index * DAY)
    dateTime(date)
    const rows = byDate.get(date) || []
    const status = date > asOfDate ? 'future' : !covered.has(date) ? 'unavailable' : rows.length ? 'logged' : 'missing'
    const snapshot = history.filter(entry => entry.effectiveFrom <= date).at(-1)
    const totals = Object.fromEntries(METRICS.map(metric => {
      const values = rows.map(row => valueOrNull(row[metric]))
      const total = status === 'logged' && values.every(value => value !== null)
        ? values.reduce((sum, value) => sum + value, 0) : null
      if (total !== null && !Number.isFinite(total)) throw new RangeError('Total uden for talområdet')
      return [metric, total]
    }))
    return { date, status, entryCount: status === 'logged' ? rows.length : null, totals,
      targets: Object.fromEntries(METRICS.map(metric => [metric, snapshot?.[metric] ?? null])) }
  })
  const metrics = Object.fromEntries(METRICS.map(metric => {
    const known = days.filter(day => day.status === 'logged' && day.totals[metric] !== null)
    const paired = known.filter(day => day.targets[metric] !== null)
    const intakeAverage = mean(paired.map(day => day.totals[metric]))
    const targetAverage = mean(paired.map(day => day.targets[metric]))
    return [metric, { average: mean(known.map(day => day.totals[metric])), knownDays: known.length,
      comparison: { days: paired.length, intakeAverage, targetAverage,
        difference: paired.length ? intakeAverage - targetAverage : null } }]
  }))
  return { startDate: days[0].date, endDate: days[6].date, days, metrics,
    counts: Object.fromEntries(['logged', 'missing', 'unavailable', 'future'].map(status => [status, days.filter(day => day.status === status).length])) }
}


