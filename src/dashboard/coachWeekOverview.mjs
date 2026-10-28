import { calendarDay, addCalendarDays } from '../calendarDate.js'
// APP-COACHUGE1. Presentation and aggregation only; no storage or network.
export const DEFAULT_COACH_WEEK_OVERVIEW = false
export function coachWeekFlag(search = '') {
  return new URLSearchParams(search).get('coachUge') === '1'
}
export function addWeekRpe(completion, log) {
  if (log.skipped) return
  const valid = value => (typeof value === 'number' || typeof value === 'string') &&
    String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 10
  if (!valid(log.rpe_actual) || !valid(log.rpe_planned)) return
  completion.rpeCount = (completion.rpeCount || 0) + 1
  completion.rpeDeltaSum = (completion.rpeDeltaSum || 0) + Number(log.rpe_actual) - Number(log.rpe_planned)
}
// Only the preview gets explicit readiness/error state; the legacy reader stays intact.
export async function readWeekData(enabled, run, setStatus, key) {
  if (!enabled) return run()
  setStatus(previous => ({ ...previous, [key]: 'loading' }))
  try {
    const result = await run()
    setStatus(previous => ({ ...previous, [key]: result.error || !Array.isArray(result.data) ? 'error' : 'ready' }))
    return result
  } catch (error) {
    setStatus(previous => ({ ...previous, [key]: 'error' }))
    return { data: null, error }
  }
}
const count = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0
// Reused week numbers need an unambiguous plan as well as separate log totals.
export function selectOverviewWeek(weeks, current, today = new Date()) {
  const dated = weeks.filter(w => w.start_date != null && w.start_date !== '')
  const matches = dated.length ? dated : weeks.filter(w => w.week_number === current?.week_number)
  if (!dated.length && matches.length < 2) return current
  const day = calendarDay(today)
  if (!day) return undefined
  const active = matches.filter(w => {
    if (!w.start_date) return false
    const start = calendarDay(w.start_date)
    if (!start) return false
    const end = addCalendarDays(start, 7)
    return start <= day && day < end
  })
  return active.length === 1 ? active[0] : undefined
}
// Unknown plans stay unknown, including incomplete or malformed set prescriptions.
export function plannedSetCount(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}
export function isThisCoachWeek(value, today = new Date()) {
  const day = calendarDay(today), logged = calendarDay(value)
  if (!day || !logged) return false
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay()
  const monday = addCalendarDays(day, -((weekday + 6) % 7))
  return monday <= logged && logged < addCalendarDays(monday, 7)
}
export function weekRows(entries, completion) {
  return entries.map(({ athlete, current }) => {
    const c = (current && completion?.[athlete.id]?.[current.id != null ? `id:${current.id}` : current.week_number]) || {}
    const planned = current ? plannedSetCount('coachWeekPlannedSets' in current ? current.coachWeekPlannedSets : current.planned_sets) : null
    const logged = count(c.coachWeekSets)
    const missed = count(c.sprungneSaet)
    const rpe = c.rpeCount > 0 && Number.isFinite(c.rpeDeltaSum) ? c.rpeDeltaSum / c.rpeCount : null
    const deviation = planned == null ? null : Math.abs(planned - logged)
    return { athlete, deviation, week: current?.week_number ?? null, planned, logged, missed, rpe,
      rpeCount: count(c.rpeCount), under: count(c.saetUnderPlan),
      remaining: planned == null ? 0 : Math.max(0, planned - logged - missed) }
  }).sort((a, b) => (a.deviation == null) - (b.deviation == null) ||
    (b.deviation ?? 0) - (a.deviation ?? 0) ||
    String(a.athlete.name).localeCompare(String(b.athlete.name), 'da') ||
    String(a.athlete.id).localeCompare(String(b.athlete.id)))
}
const signed = value => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}`
export function renderWeekOverview(h, { enabled = DEFAULT_COACH_WEEK_OVERVIEW, entries = [], completion,
  status = {}, loading = false, loadError = false, openProfile, profileTab = 'program' }) {
  if (enabled !== true) return null
  const title = h('h2', { id: 'coach-week-title', style: { fontSize: '1.1rem', margin: '0 0 8px' } }, 'Coachens uge')
  const message = text => h('section', { 'aria-labelledby': 'coach-week-title', style: { marginBottom: 20 } },
    title, h('p', { role: 'status' }, text))
  if (loadError || status.plan === 'error' || status.logs === 'error') return message('Ugeoverblikket kunne ikke indlæses. Åbn listen igen for at prøve igen.')
  if (loading) return message('Indlæser ugeoverblik…')
  if (!entries.length) return message('Ingen synlige atleter.')
  if (status.plan !== 'ready' || status.logs !== 'ready' || completion == null) return message('Indlæser ugeplaner og logs…')
  const rows = weekRows(entries, completion)
  const cell = (label, value) => h('span', { style: { whiteSpace: 'nowrap' } }, `${label}: ${value}`)
  return h('section', { 'aria-labelledby': 'coach-week-title', 'data-coach-week': true,
    style: { marginBottom: 20, color: '#edeae2' } }, title,
  h('p', { style: { fontSize: '0.8rem', color: '#b3afa4' } },
    'Aktuel programuge. Missede sæt er markeret sprunget over. RPE er logget minus planlagt i snit, kun sæt med begge tal. Loggede sæt tælles fra mandag til søndag i dansk tid. Største absolutte forskel mellem planlagte og loggede sæt vises først. Ukendt plan vises sidst.'),
  h('div', { role: 'list', 'aria-label': 'Atleternes uger' }, ...rows.map(row =>
    h('div', { role: 'listitem', key: row.athlete.id }, h('button', {
      type: 'button', onClick: () => openProfile(row.athlete, profileTab === 'log' ? 'log' : 'program'),
      style: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', width: '100%', minHeight: 44,
        padding: '10px 4px', background: 'transparent', border: 0, borderBottom: '1px solid #59564c',
        textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' },
    }, h('span', { style: { flex: '1 1 160px', overflowWrap: 'anywhere' } }, row.athlete.name),
    cell('Uge', row.week ?? 'Ingen aktuel uge'), cell('Planlagt', row.planned == null ? 'Ingen plan' : `${row.planned} sæt`),
    cell('Afvigelse', row.deviation == null ? 'Ukendt' : `${row.deviation} sæt`),
    cell('Logget', `${row.logged} sæt`), cell('Missede', `${row.missed} sæt`),
    cell('RPE', row.rpe == null ? 'Mangler tal' : `${signed(row.rpe)} (${row.rpeCount} sæt)`),
    cell('Endnu ikke logget', row.planned == null ? 'Ukendt' : `${row.remaining} sæt`))))))
}
