// APP-COACH3. Explicit opt-in; no storage, URL or network reads.
export const COACH_ACTIONS_ENABLED = false
export const coachActionsEnabled = value => value === true
const DAY = 86400000
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
export function actionDay(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const stamp = Date.parse(value + 'T00:00:00Z')
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? value : null
  }
  if (!(value instanceof Date) && typeof value !== 'string') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !actionDay(value.slice(0, 10))) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const p = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const dayNumber = value => { const d = actionDay(value); return d ? Date.parse(d + 'T00:00:00Z') / DAY : null }
const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
export function actionSessions(sessions = []) {
  return sessions.map(s => ({ id: s.id, plannedSets: (s.exercises || []).reduce((n, e) => n + positive(e.sets), 0) }))
}
// The selected data cannot establish whether a set or session note has a reply.
// Notes are deliberately never inspected here.
export function buildCoachActions({ enabled = false, athletes = [], calendarWeeks = {}, completion = {}, latestByTrack = {}, videos = [], today = new Date() } = {}) {
  if (!coachActionsEnabled(enabled)) return []
  const T = dayNumber(today)
  if (T === null) return []
  const rows = []
  for (const athlete of athletes) {
    const reasons = []
    const add = (rank, reason, tab, at, item) => {
      const d = dayNumber(at)
      if (d !== null && d <= T) reasons.push({ rank, reason, tab, at: d, item })
    }
    const weeks = (calendarWeeks[athlete.id] || []).filter(w => {
      const start = dayNumber(w.start_date)
      return start !== null && start <= T && start >= T - 14 && w.session_count > 0
    }).sort((a, b) => dayNumber(b.start_date) - dayNumber(a.start_date))
    const finished = weeks.find(w => dayNumber(w.start_date) + 7 <= T)
    for (const week of weeks.filter(w => w === finished || dayNumber(w.start_date) + 7 > T)) {
      const c = completion[athlete.id]?.[week.week_number] || {}
      // No weekday is inferred from session_order. Only a finished week is due.
      if (Object.hasOwn(completion, athlete.id) && week === finished && Array.isArray(week.actionSessions)) {
        const missed = week.actionSessions.filter(s => s.plannedSets > 0 && !c.sessionIds?.[s.id]).length
        if (missed) add(0, `${missed} pas uden log i uge ${week.week_number}`, 'log', week.start_date)
      }
      if (positive(c.sprungneSaet)) add(1, `${c.sprungneSaet} sprungne sæt i uge ${week.week_number}`, 'log', week.start_date)
      if (positive(c.saetUnderPlan)) add(1, `${c.saetUnderPlan} sæt med færre gentagelser end planen i uge ${week.week_number}`, 'log', week.start_date)
    }
    for (const track of ['besked', 'teknik']) {
      const last = latestByTrack[athlete.id]?.[track]
      if (last?.sender_role === 'athlete') {
        const item = { kind: 'message', key: `message-${athlete.id}-${track}`, athlete, track, createdAt: last.created_at, title: athlete.name, detail: last.content }
        add(2, track === 'teknik' ? 'Teknikbesked venter på svar' : 'Besked venter på svar', 'beskeder', last.created_at, item)
      }
    }
    for (const video of videos) {
      if (video.athlete_id !== athlete.id || video.status !== 'draft') continue
      const item = { kind: 'video', key: `video-${video.id}`, athlete, video, title: athlete.name, detail: 'Video venter på feedback', createdAt: video.created_at || video.analyzed_at }
      add(3, item.detail, 'analyse', item.createdAt, item)
    }
    reasons.sort((a, b) => a.rank - b.rank || a.at - b.at || a.reason.localeCompare(b.reason, 'da') || String(a.item?.key || '').localeCompare(String(b.item?.key || '')))
    if (reasons.length) rows.push({ athlete, ...reasons[0] })
  }
  return rows.sort((a, b) => a.rank - b.rank || a.at - b.at || String(a.athlete.name).localeCompare(String(b.athlete.name), 'da') || String(a.athlete.id).localeCompare(String(b.athlete.id)))
}
export function openCoachAction(row, { openProfile, openCoachPriorityItem }) {
  if (row.item) openCoachPriorityItem(row.item, 'list')
  else openProfile(row.athlete, row.tab, 'list')
}
