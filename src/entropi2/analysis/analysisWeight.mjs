import { calendarDay } from '../../calendarDate.js'

// Startup and both tabs share one initial read per athlete. Explicit retries
// and reads after saving continue to use the host's original reader directly.
export function readInitialAnalysisWeight(enabled, athleteId, requested, read) {
  if (!enabled) return read(athleteId)
  if (!athleteId) return undefined
  if (requested.current?.athleteId === athleteId) return requested.current.promise
  const request = { athleteId, promise: undefined }
  requested.current = request
  request.promise = read(athleteId)
  return request.promise
}

// The E2 host owns reads. Its athlete-scoped status is authoritative over
// retained arrays and any secondary snapshot. Legacy callers keep their flags.
export function analysisWeightProps(props) {
  if (!Object.hasOwn(props, 'weightStatus')) return props
  const status = props.weightStatus
  const owned = props.athlete?.id != null && status?.athleteId === props.athlete.id
  const state = owned && ['loading', 'error', 'ready'].includes(status?.state)
    && (status.state !== 'ready' || Array.isArray(props.weightLogs)) ? status.state : 'unavailable'
  return { ...props,
    weightLogs: state === 'ready' ? props.weightLogs : undefined,
    weightLoading: state === 'loading', weightError: state === 'error',
    ...(props.mineData ? { mineData: { ...props.mineData,
      ...(state !== 'ready' ? { weights: { state, rows: [] } } : {}),
    } } : {}),
  }
}

// Only confirmed, unambiguous observations in the displayed four-week period.
// The bridge has already validated dates, timestamps and ownership of host rows.
export function latestAnalysisWeightDate(source, athleteId, today, start) {
  if (!athleteId || !today || !start || source?.state !== 'ready' || !Array.isArray(source.rows)) return null
  const days = new Map()
  for (const row of source.rows) {
    if (!row || row.athlete_id !== athleteId || row.pending || row._optimistic ||
      typeof row.kg !== 'number' || !Number.isFinite(row.kg) || row.kg <= 0 ||
      typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      calendarDay(row.date) !== row.date || row.date < start || row.date > today) continue
    const values = days.get(row.date) ?? new Set()
    values.add(row.kg); days.set(row.date, values)
  }
  return [...days].filter(([, values]) => values.size === 1).map(([date]) => date).sort().at(-1) ?? null
}
