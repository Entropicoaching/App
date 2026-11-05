import { buildAthleteOverview } from './overview.mjs'

// The host has already scoped identity/date via fremgangSnapshot. Validate the
// complete daily collection before projecting only today's production fields.
// No training/quality read, clock, client, inference or writes.
export function readinessSections(snapshot, { enabled = false } = {}) {
  if (enabled !== true) return null
  if (snapshot?.dailySource !== 'readiness_logs') return null
  const model = buildAthleteOverview(snapshot, { enabled: true })
  if (!['ready', 'empty'].includes(model.status)) return null
  const rows = snapshot.dailyRows.filter(row => !row._optimistic).map(row => ({
    athlete_id: row.athlete_id, logged_date: row.logged_date,
    sleep_hours: row.sleep_hours, energy: row.energy, stress: row.stress,
    soreness_level: row.soreness_level,
  }))
  // Count only confirmed rows; optimistic answers cannot create a section.
  const confirmed = buildAthleteOverview({ status: 'ready', complete: true,
    athleteId: snapshot.athleteId, endDate: snapshot.endDate, dailySource: 'readiness_logs',
    dailyRows: rows.map(row => ({ ...row, source: 'readiness_logs' })),
    exerciseLogs: [], mealRows: [], weightRows: [] }, { enabled: true })
  const sleep = confirmed.weeks.some(week => week.wellbeing[0].count > 0)
  const restitution = confirmed.weeks.at(-1).wellbeing.slice(1).some(field => field.count > 0)
  const basis = { status: 'ready', complete: true, athleteId: snapshot.athleteId,
    endDate: snapshot.endDate, dailySource: 'readiness_logs', readinessRows: rows, exerciseLogs: [] }
  return { sleep: sleep ? { ...basis, qualityRows: [] } : null,
    restitution: restitution ? basis : null }
}
