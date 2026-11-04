import { buildAthleteOverview } from '../atlet/overview.mjs'
import { buildStrengthTrend } from '../strengthTrend.mjs'
import { weeklyDataBasis } from '../kvalitet/weeklyDataBasis.mjs'
import { weeklyIntensity } from '../../analysis/intensitet/intensityModel.mjs'
import { uniqueSets } from '../../analysis/weeklyLoad.mjs'
import { calendarDay, addCalendarDays } from '../../../calendarDate.js'

const finite = n => typeof n === 'number' && Number.isFinite(n)
const token = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 120
const day = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && calendarDay(s) === s
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const error = () => ({ status: 'error', automaticChanges: false })
const total = values => {
  const n = values.reduce((a, b) => a + b, 0)
  return Number.isFinite(n) ? n : null
}

/** Explicit opt-in; complete, authorized, one-athlete snapshot. See README.md. */
export function buildMonthReport(snapshot, { enabled = false } = {}) {
  if (enabled !== true) return null
  if (snapshot?.status === 'loading') return { status: 'loading', automaticChanges: false }
  if (!snapshot || snapshot.status !== 'ready' || snapshot.complete !== true
    || !token(snapshot.athleteId) || !day(snapshot.endDate)
    || !addCalendarDays(snapshot.endDate, -110)) return error()
  const { athleteId, endDate, dailyRows, exerciseLogs, mealRows, weightRows, sessions } = snapshot
  if ([dailyRows, exerciseLogs, mealRows, weightRows, sessions].some(rows => !Array.isArray(rows)
    || rows.length > 10000 || Array.from(rows).some(r => !r || typeof r !== 'object'
      || Array.isArray(r) || r.athlete_id !== athleteId))) return error()
  if ([dailyRows, mealRows, weightRows, sessions].some(rows => rows.some(r => r._optimistic))
    || exerciseLogs.some(r => typeof r.logged_at !== 'string' || !timestamp.test(r.logged_at)
    || !calendarDay(r.logged_at) || (!token(r.id) && !(token(r.exercise_id) && Number.isSafeInteger(r.set_number))) || (r.unit != null && r.unit !== 'kg'))
    || mealRows.some(r => !day(r.date))) return error()
  if (sessions.some(r => !token(r.id) || !day(r.day) || typeof r.planned !== 'boolean'
    || typeof r.completed !== 'boolean') || new Set(sessions.map(r => r.id)).size !== sessions.length) return error()
  // Upstream de-duplication does not compare lift names/references. Fail closed
  // for contradictory persisted IDs or positions before using any model.
  const seen = new Map()
  for (const r of exerciseLogs) {
    const signature = JSON.stringify([r.id, r.exercise_id, r.set_number, r.logged_at, r.weight, r.reps_completed, r.skipped ?? false,
      r._optimistic ?? false, r.exercises?.name ?? r.name, r.reference_e1rm,
      r.exercises?.sessions?.weeks?.block_name])
    const keys = [r.id != null ? JSON.stringify(['id', r.id]) : null,
      r.exercise_id != null && r.set_number != null ? JSON.stringify(['position', r.exercise_id, r.set_number]) : null].filter(Boolean)
    for (const key of keys) {
      if (seen.has(key) && seen.get(key) !== signature) return error()
      seen.set(key, signature)
    }
  }
  const logs = uniqueSets(exerciseLogs).filter(r => !r._optimistic)
  const overview = buildAthleteOverview({ status: 'ready', complete: true, athleteId, endDate, dailyRows,
    exerciseLogs: logs, mealRows, weightRows }, { enabled: true })
  if (!['ready', 'empty'].includes(overview.status)) return error()
  const from = overview.from
  const weeks = overview.weeks.map(w => {
    const inside = d => d >= w.from && d <= w.to
    const sets = logs.filter(r => inside(calendarDay(r.logged_at)))
    const intensity = weeklyIntensity(sets, w.to)
    const zones = intensity.weeks[0].zones.map(z => ({ key: z.key, label: z.label,
      count: total(intensity.weeks.map(i => i.zones.find(a => a.key === z.key).count)) }))
    const classified = total(zones.map(z => z.count))
    const unknown = total(intensity.weeks.map(i => i.unknown))
    const strength = buildStrengthTrend(sets, { today: w.to }).lifts.map(lift => {
      const values = lift.weeks.map(a => a.e1rm).filter(finite)
      return { key: lift.key, name: lift.name, e1rm: values.length ? Math.max(...values) : null }
    })
    const selected = sessions.filter(r => inside(r.day))
    const sources = Object.fromEntries(Object.entries({ training: logs, nutrition: mealRows,
      weight: weightRows, readiness: dailyRows }).map(([key, rows]) => [key,
      { athleteId, state: 'ready', complete: true, rows }]))
    const quality = weeklyDataBasis({ enabled: true, athleteId, asOf: w.to, sources })
    const basis = Object.fromEntries(['training', 'nutrition', 'weight', 'readiness'].map(domain => {
      const buckets = quality.weeks.filter(a => a.weekStart <= w.to && a.through >= w.from)
      const missing = buckets.flatMap(a => a.domains[domain].missingDays).filter(inside)
      const invalid = buckets.flatMap(a => a.domains[domain].invalidDays).filter(inside)
      return [domain, { validDays: 7 - missing.length - invalid.length, missingDays: missing.length,
        invalidDays: invalid.length }]
    }))
    return { ...w, strength, intensity: { classified, unknown, zones }, basis,
      sessions: { completed: selected.filter(r => r.completed).length,
        planned: selected.filter(r => r.planned).length,
        completedPlanned: selected.filter(r => r.planned && r.completed).length,
        extra: selected.filter(r => !r.planned && r.completed).length } }
  })
  const keys = new Map(weeks.flatMap(w => w.strength.map(s => [s.key, s.name])))
  const strength = [...keys].map(([key, name]) => ({ key, name,
    values: weeks.map(w => w.strength.find(s => s.key === key)?.e1rm ?? null) }))
  const flags = []
  const flag = (id, title, rule, observations) => flags.push({ id, title,
    dataBasis: { from, to: endDate, rule, observations } })
  for (const lift of strength) {
    if (lift.values.every(finite) && lift.values[3] < Math.max(...lift.values) * 0.95) {
      flag(`strength:${lift.key}`, `Styrkefald: ${lift.name}`,
        'Sidste periodes bedste e1RM er mere end 5 % under højeste af fire perioder; alle fire skal have målinger.',
        weeks.map((w, i) => ({ from: w.from, to: w.to, value: lift.values[i], unit: 'kg e1RM' })))
    }
  }
  const energy = weeks.map(w => w.wellbeing.find(f => f.key === 'energy'))
  if (energy.every(e => finite(e.average) && e.average <= 2 + Number.EPSILON * 128)) flag('energy', 'Vedvarende lav energi',
    'Gennemsnit højst 2/5 i alle fire perioder; mindst fire kendte dage i hver periode.',
    weeks.map((w, i) => ({ from: w.from, to: w.to, value: energy[i].average, count: energy[i].count, unit: '/5' })))
  for (const w of weeks) if (w.sessions.planned && w.sessions.completedPlanned / w.sessions.planned < 0.75) {
    flag(`sessions:${w.from}`, 'Færre gennemførte planlagte pas',
      'Under 75 % bekræftede planlagte pas i en 7-dages periode; ekstra pas tæller særskilt.',
      [{ from: w.from, to: w.to, value: w.sessions.completedPlanned, count: w.sessions.planned, unit: 'planlagte pas' }])
  }
  const hasSessions = weeks.some(w => w.sessions.planned || w.sessions.completed)
  return { status: overview.status === 'empty' && !hasSessions ? 'empty' : 'ready',
    from, to: endDate, weeks, strength, flags, automaticChanges: false }
}
