import { addCalendarDays, calendarDay, calendarDaysBetween } from '../../calendarDate.js'
import { estimatedOneRepMax } from '../../exerciseProgress.js'
import { mainLiftName } from '../../exerciseSetView.js'
import { uniqueLogs } from './publicContract.mjs'

const lifts = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const format = n => number.format(n)
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

function validDay(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(value)) return null
  const day = calendarDay(value)
  return day && (!value.includes('T') || Date.parse(value) <= new Date(now).getTime()) ? day : null
}

function counts(contract, start, now) {
  const missing = { planned: null, done: null, confirmed: null, skipped: null }
  const sessions = contract.week?.sessions
  if (!contract.activeWeek || !Array.isArray(sessions)) return missing
  const ids = new Set()
  for (const session of sessions) {
    if (!Array.isArray(session?.exercises)) return missing
    for (const ex of session.exercises) {
      if (ex?.id == null || ids.has(ex.id) || !Number.isSafeInteger(ex.sets) || ex.sets <= 0) return missing
      ids.add(ex.id)
    }
  }
  const plannedSessions = sessions.filter(s => s.exercises.length)
  const planned = plannedSessions.length
  if (!contract.weekLogs) return { ...missing, planned }
  // A position can have multiple IDs after a retry. Conflicts must not fill a
  // planned position twice or choose an arbitrary confirmation over a skip.
  const logs = uniqueLogs(contract.weekLogs.map(r => ({ ...r, id: undefined }))).filter(r => {
    const day = validDay(r.logged_at, now)
    return !r._optimistic && day && day >= start && day <= contract.today
  })
  let done = 0, confirmed = 0, skipped = 0
  for (const session of plannedSessions) {
    let addressed = 0, total = 0
    for (const ex of session.exercises) {
      total += ex.sets
      const positions = logs.filter(r => r.exercise_id === ex.id &&
        Number.isSafeInteger(r.set_number) && r.set_number >= 1 && r.set_number <= ex.sets)
      addressed += positions.length
      skipped += positions.filter(r => r.skipped).length
      confirmed += positions.filter(r => !r.skipped).length
    }
    if (addressed === total) done++
  }
  return { planned, done, confirmed, skipped }
}

// A seven-day, descriptive snapshot. No D18 trend/readiness claim is inferred
// from a pair of weeks; existing answers retain their separate evidence gate.
export function weekOverview(contract, now) {
  const { today } = contract
  if (!today) return { period: 'Ugens dato mangler.', sessions: 'Pas: data mangler.', sets: 'Sæt: data mangler.', lifts: [] }
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const start = contract.activeWeek ? contract.start : monday
  const end = addCalendarDays(start, 6), previousStart = addCalendarDays(start, -7)
  const c = counts(contract, start, now)
  const sessions = c.planned === null ? 'Pas: en aktuel dateret programuge mangler.'
    : c.done === null ? `Pas: gennemført antal mangler. ${format(c.planned)} planlagt.`
      : `Pas gennemført: ${format(c.done)} af ${format(c.planned)} planlagt.`
  const sets = c.confirmed === null ? 'Sæt bekræftet: logdata for den aktuelle programuge mangler.'
    : `Sæt bekræftet: ${format(c.confirmed)}. Sprunget over: ${format(c.skipped)}.`
  const rows = contract.rows.filter(r => !r._optimistic && mainLiftName(r.lift))
  return {
    period: `${date(start)} til ${date(end)}. Sidste uge: ${date(previousStart)} til ${date(addCalendarDays(start, -1))}.`,
    sessions, sets,
    note: 'Et pas er gennemført, når alle planlagte sæt er logget eller sprunget over. Bekræftede sæt omfatter ikke oversprungne eller afventende sæt. Denne uge kan være ufuldstændig.',
    lifts: lifts.map(lift => {
      const missing = message => ({ lift, message })
      if (contract.loading) return missing('Henter løftehistorik. Sammenligningen er ikke klar.')
      if (!contract.historyReady) return missing('Løftehistorik mangler. Sammenligningen er ikke klar.')
      const current = rows.filter(r => r.lift === lift && r.logged_at >= start && r.logged_at <= end)
        .map(r => ({ ...r, value: estimatedOneRepMax(r.weight, r.reps_completed) }))
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value || b.weight - a.weight || a.repZone.localeCompare(b.repZone))
      const best = current[0]
      if (!best) return missing('Ingen sammenlignelige tunge sæt denne uge.')
      const previous = rows.filter(r => r.lift === lift && r.repZone === best.repZone &&
        r.logged_at >= previousStart && calendarDaysBetween(r.logged_at, start) > 0)
        .map(r => estimatedOneRepMax(r.weight, r.reps_completed)).filter(v => v > 0)
      const value = `${format(best.value)} kg e1RM`
      const source = `Bedste estimat denne uge fra ${format(best.weight)} kg × ${format(best.reps_completed)}. ${best.repZone} gentagelser.`
      if (!previous.length) return { lift, value, message: `${source} Sidste uge mangler sammenlignelige tunge sæt i samme rep-område.` }
      const previousBest = Math.max(...previous)
      const delta = Math.round((best.value - previousBest) * 10) / 10
      return { lift, value, message: `${source} Sidste uge: ${format(previousBest)} kg e1RM. Ændring: ${delta > 0 ? '+' : ''}${format(delta === 0 ? 0 : delta)} kg e1RM. Forskellen beskriver registreringerne, ikke årsagen eller parathed.` }
    }),
  }
}
