// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Tal til profilen, regnet i hvert render ud fra hentede data: aktuel
// kropsvægt og ugetrend, sidste sæt pr. øvelse og bedste log i samme
// rep-zone (bestLog til ProgramTab). Fabrik: Dashboard kalder den i hvert render.

export function lavProfilTal({
  athleteLogs, athleteWeightLogs,
}) {
  const currentWeight = (() => {
    if (!athleteWeightLogs.length) return null
    const recent = athleteWeightLogs.slice(0, 5).map(l => l.weight)
    if (recent.length >= 5) {
      const sorted = [...recent].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    return Math.round((recent.reduce((s, v) => s + v, 0) / recent.length) * 10) / 10
  })()

  const weightTrend = (() => {
    if (athleteWeightLogs.length < 2) return null
    const now = new Date()
    const d7 = new Date(now); d7.setDate(now.getDate() - 7)
    const d14 = new Date(now); d14.setDate(now.getDate() - 14)
    const thisWeek = athleteWeightLogs.filter(l => new Date(l.logged_at) >= d7).map(l => l.weight)
    const prevWeek = athleteWeightLogs.filter(l => { const d = new Date(l.logged_at); return d >= d14 && d < d7 }).map(l => l.weight)
    if (!thisWeek.length || !prevWeek.length) return null
    const thisAvg = thisWeek.reduce((s, v) => s + v, 0) / thisWeek.length
    const prevAvg = prevWeek.reduce((s, v) => s + v, 0) / prevWeek.length
    return Math.round((thisAvg - prevAvg) * 10) / 10
  })()

  const lastLogPerExercise = {}
  for (const log of athleteLogs) {
    const name = log.exercises?.name
    if (name && (log.weight > 0 || log.reps_completed > 0)) {
      if (!lastLogPerExercise[name]) lastLogPerExercise[name] = []
      lastLogPerExercise[name].push({ weight: log.weight, reps_completed: log.reps_completed, logged_at: log.logged_at })
    }
  }

  function repZone(r) {
    const n = parseInt(r) || 0
    if (n <= 3) return 0
    if (n <= 6) return 1
    if (n <= 10) return 2
    return 3
  }

  function bestLog(name, plannedReps) {
    const logs = lastLogPerExercise[name]
    if (!logs?.length) return null
    const planned = parseInt(plannedReps) || 0
    if (planned > 0) {
      const zone = repZone(planned)
      const sameZone = logs.filter(l => repZone(l.reps_completed) === zone)
      if (sameZone.length > 0) return sameZone[0]
    }
    return logs[0]
  }

  return {
    currentWeight, weightTrend, lastLogPerExercise, repZone, bestLog,
  }
}
