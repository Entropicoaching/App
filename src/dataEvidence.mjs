import { dayNumber, explicitRpe, hasEnoughData } from './dataEnough.mjs'
import { bestHeavySetPerDay, erTungtSaet, estimatedOneRepMax } from './exerciseProgress.js'
import { exerciseSetView } from './exerciseSetView.js'

export const repZone = reps => !Number.isInteger(Number(reps)) || Number(reps) <= 0 ? null : reps <= 3 ? '1-3' : reps <= 6 ? '4-6' : reps <= 8 ? '7-8' : reps <= 12 ? '9-12' : '13+'
export function prescribedRepZone(value) {
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(String(value || '').trim())
  return match && repZone(Number(match[1])) === repZone(Number(match[2] || match[1])) ? repZone(Number(match[1])) : null
}
export function heavyPointEvidence(p, lift) {
  const valid = p.deload === false && p.navn && erTungtSaet(p.navn, p.reps) && p.weight > 0 &&
    dayNumber(p.dag) !== null && Math.round(estimatedOneRepMax(p.weight, p.reps)) === p.e1rm &&
    exerciseSetView(p.navn).name === lift
  return { ...p, qualified: !!valid, lift, repZone: repZone(p.reps) }
}
export function liftEvidence(logs, lift) {
  return { rows: bestHeavySetPerDay(logs.filter(r => exerciseSetView(r.exercises?.name).name === lift))
    .map(p => heavyPointEvidence(p, lift)) }
}
export function normalizedRatings(logs) {
  return logs.map(r => ({ ...r, session_id: r.session_id ?? r.exercises?.session_id,
    lift: exerciseSetView(r.exercises?.name ?? r.name).name, repZone: repZone(r.reps_completed),
    targetRpe: r.rpe_planned, comparable: r.rpe_planned != null && repZone(r.reps_completed) !== null,
  }))
}
export function rpeSignalEvidence(logs, checkins, today, lift, conflict = false) {
  return { rows: normalizedRatings(logs), checkins, today, lift, conflict }
}
export function rpeSignalDescription(e) {
  const t = dayNumber(e.today)
  const own = e.rows.filter(r => !r.skipped && explicitRpe(r) && Number.isFinite(r.rpe_planned) &&
    dayNumber(r.logged_at) !== null && t - dayNumber(r.logged_at) >= 0 && t - dayNumber(r.logged_at) <= 21)
  const drift = own.reduce((n, r) => n + r.rpe_actual - r.rpe_planned, 0) / own.length
  return `Observeret RPE-afvigelse ${drift.toFixed(2)} fra planen i ${own.length} egne svar på ${new Set(own.map(r => r.session_id)).size} pas. Coachen vurderer sammenhængen.`
}
export function rpeTrendEvidence(logs) {
  const groups = new Map()
  for (const r of normalizedRatings(logs).filter(r => !r.skipped && r.comparable && explicitRpe(r))) {
    const key = [r.lift, r.repZone, r.targetRpe].join('|')
    groups.set(key, [...(groups.get(key) || []), { ...r, planKey: key }])
  }
  const entries = [...groups].map(([planKey, rows]) => ({ planKey, rows }))
  return entries.find(e => hasEnoughData('D13', e)) || entries[0] || { rows: [] }
}
export function suggestionEvidence(hist, lift, targetRpe, plannedReps) {
  if (!prescribedRepZone(plannedReps)) return { rows: [], lift, targetRpe, repZone: null }
  const rows = hist.flatMap(h => h.sets.map(s => ({ ...s, logged_at: h.date,
    session_id: s.session_id, rpe_actual: s.rpe, lift, comparable: s.targetRpe === targetRpe,
    repZone: repZone(s.reps), targetRpe: s.targetRpe })))
  return { rows, lift, targetRpe, repZone: prescribedRepZone(plannedReps) }
}
export function matchedDays(logs, checkins, sleep = false) {
  const groups = new Map(), counts = new Map(), byDay = new Map()
  for (const c of checkins) counts.set(c.logged_date, (counts.get(c.logged_date) || 0) + 1)
  for (const row of normalizedRatings(logs)) {
    if (row.skipped) continue
    const date = dayNumber(row.logged_at)
    if (!byDay.has(date)) byDay.set(date, [])
    byDay.get(date).push(row)
  }
  for (const c of checkins) {
    const date = c.logged_date
    if (dayNumber(date) === null || counts.get(date) !== 1) continue
    const dayLogs = byDay.get(dayNumber(date)) || []
    if (sleep) {
      const sessions = new Map(dayLogs.filter(r => Number.isFinite(r.exercises?.sessions?.athlete_rating))
        .map(r => [r.session_id, r.exercises.sessions.athlete_rating]))
      if (!Number.isFinite(c.sleep_hours) || c.sleep_hours <= 0 || !sessions.size) continue
      groups.set(date, { date, matched: true, sleep: c.sleep_hours,
        value: [...sessions.values()].reduce((a, b) => a + b, 0) / sessions.size,
        band: c.sleep_hours < 6 ? '<6t' : c.sleep_hours < 7 ? '6-7t' : c.sleep_hours < 8 ? '7-8t' : '8t+' })
    } else {
      if (!Number.isFinite(c.readiness_score)) continue
      for (const r of dayLogs.filter(r => explicitRpe(r) && r.comparable)) {
        const key = [r.lift, r.repZone, r.targetRpe].join('|')
        if (!groups.has(key)) groups.set(key, new Map())
        const days = groups.get(key), prev = days.get(date) || []
        days.set(date, [...prev, { ...r, readiness: c.readiness_score }])
      }
    }
  }
  if (sleep) return { rows: [...groups.values()] }
  const series = [...groups.values()].map(days => [...days].map(([date, rs]) => ({
    date, matched: true, comparable: true, independentRpe: true, readiness: rs[0].readiness,
    value: rs.reduce((n, r) => n + r.rpe_actual - r.targetRpe, 0) / rs.length,
    band: rs[0].readiness < 60 ? 'low' : 'high',
  })))
  return { rows: series.find(rows => hasEnoughData('D08', { rows })) || series[0] || [] }
}

// Read metadata is attached by the successful read handlers. Unknown or capped
// reads cannot prove absence, and another athlete's retained state cannot count.
export function planEvidence(weeks, logs, athleteId, today, sessionId = null) {
  const confirmed = [weeks, logs].every(rs => rs.readEvidence?.athleteId === athleteId && rs.readEvidence?.complete === true)
  const closed = weeks.filter(w => dayNumber(w.start_date) !== null && dayNumber(w.start_date) + 7 <= dayNumber(today))
  const selected = sessionId ? weeks.flatMap(w => w.sessions || []).filter(s => s.id === sessionId) : closed.flatMap(w => w.sessions || [])
  const positions = selected.flatMap(s => {
    const w = weeks.find(w => (w.sessions || []).some(x => x.id === s.id))
    return (s.exercises || []).flatMap(ex => Array.from({ length: Math.max(0, Number(ex.sets) || 0) },
      (_, i) => ({ sid: s.id, ex: ex.id, n: i + 1, start: dayNumber(w?.start_date) })))
  })
  const isDone = (l, p) => l.exercise_id === p.ex && l.set_number === p.n && !l.skipped &&
    Number.isFinite(l.reps_completed) && l.reps_completed > 0 && p.start !== null &&
    dayNumber(l.logged_at) !== null && dayNumber(l.logged_at) >= p.start && dayNumber(l.logged_at) < p.start + 7
  const performed = positions.filter(p => logs.some(l => isDone(l, p)))
  return { today, weeks: closed.map(w => ({ ...w, complete: confirmed })), plannedSets: positions.length,
    samePeriod: confirmed, complete: confirmed, allExercises: confirmed,
    performedPositions: performed.length, performedSessions: selected.filter(s => {
      const ps = positions.filter(p => p.sid === s.id)
      return ps.length > 0 && ps.every(p => logs.some(l => isDone(l, p)))
    }).length,
    plannedSessions: selected.length }
}

export function weekEvidence(weeks, logs, athleteId, today, number) {
  const matches = weeks.filter(w => String(w.week_number) === String(number))
  const selected = Object.assign(matches, { readEvidence: matches.length === 1 ? weeks.readEvidence : null })
  return planEvidence(selected, logs, athleteId, today)
}
export function datedRegression(rows) {
  const points = rows.filter(r => dayNumber(r.dag) !== null && Number.isFinite(r.e1rm))
  if (points.length < 4) return null
  const start = dayNumber(points[0].dag), xs = points.map(r => dayNumber(r.dag) - start)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = points.reduce((a, r) => a + r.e1rm, 0) / points.length
  const variance = xs.reduce((n, x) => n + (x - mx) ** 2, 0)
  if (!variance) return null
  const slope = xs.reduce((n, x, i) => n + (x - mx) * (points[i].e1rm - my), 0) / variance
  return { slope, data: points.map((p, i) => ({ y: my + slope * (xs[i] - mx), label: p.dag })) }
}

// Calendar weeks with actual performed sessions. The caller supplies read coverage,
// never inferred from the number of rows or a successful partial page.
export function volumeWeeks(logs, today, complete) {
  const groups = new Map(), t = dayNumber(today)
  for (const r of logs) {
    const d = dayNumber(r.logged_at), sid = r.session_id ?? r.exercises?.session_id
    if (d === null || r.skipped || !sid || !Number.isFinite(r.weight) || r.weight <= 0 ||
        !Number.isFinite(r.reps_completed) || r.reps_completed <= 0) continue
    const start = d - ((d + 3) % 7)
    if (t === null || start + 7 > t) continue
    const key = new Date(start * 86400000).toISOString().slice(0, 10)
    const g = groups.get(key) || { total: 0, sessions: new Set() }
    g.total += r.weight * r.reps_completed; g.sessions.add(sid); groups.set(key, g)
  }
  return [...groups].sort(([a],[b]) => a.localeCompare(b)).map(([key,g]) => ({
    weekStart: key, start_date: key, total: Math.round(g.total), complete: complete === true,
    performedSessions: g.sessions.size,
  }))
}

export function volumeRows(logs) {
  return Object.assign((logs || []).map(r => ({ oevelseNavn: r.exercises?.name, loggetDato: r.logged_at,
    skipped: r.skipped || !(r.reps_completed > 0), session_id: r.exercises?.session_id,
  })), { readEvidence: logs?.readEvidence })
}
export function positiveStatusEvidence(current, completion, athleteId, today, openCount, sourcesConfirmed) {
  const plan = current?.planSessions || [], rows = completion?.evidenceRows || []
  const covered = current?.readEvidence?.complete === true && current.readEvidence.athleteId === athleteId &&
    completion?.readEvidence?.complete === true && completion.readEvidence.athleteId === athleteId
  const start = dayNumber(current?.start_date), t = dayNumber(today)
  const positions = plan.flatMap(s => (s.exercises || []).flatMap(ex =>
    Array.from({ length: Math.max(0, Number(ex.sets) || 0) }, (_, i) => ({ sid: s.id, ex: ex.id, n: i + 1 }))))
  const validRows = rows.filter(r => !r.skipped && r.reps_completed > 0 && dayNumber(r.logged_at) !== null &&
    start !== null && dayNumber(r.logged_at) >= start && dayNumber(r.logged_at) < start + 7 && dayNumber(r.logged_at) <= t)
  const done = p => validRows.some(r => r.exercise_id === p.ex && r.set_number === p.n)
  return { fullPlanWeek: covered && start !== null && t !== null && start <= t && t < start + 7 &&
      positions.length > 0 && positions.every(done),
    performedSessions: plan.filter(s => positions.some(p => p.sid === s.id) && positions.filter(p => p.sid === s.id).every(done)).length,
    voiceCount: plan.filter(s => Number.isInteger(s.athlete_rating) && s.athlete_rating >= 1 && s.athlete_rating <= 5 &&
      positions.some(p => p.sid === s.id && done(p))).length,
    openCount, allSourcesConfirmed: covered && sourcesConfirmed === true }
}
