import { dayNumber, meetToday } from './coachMeetSource.mjs'
export { readMeetSource, meetToday } from './coachMeetSource.mjs'
import { createElement as h, useEffect, useState } from 'react'

export const COACH_MEET_SOON_ENABLED = false
export function coachMeetSoonFlag(search = '') {
  const values = new URLSearchParams(search).getAll('coachStaevne')
  return values.length === 1 && values[0] === '1'
}
function sessionStatus(athleteId, data, day) {
  const today = dayNumber(day)
  if (!['plan', 'logs'].every(key => data?.[key]?.state === 'ready' && data[key].day === day && data[key].ids?.includes(athleteId))) return 'Ugens pas: ukendt'
  const weeks = data.plan.rows.filter(w => w.athlete_id === athleteId && dayNumber(w.start_date) != null && dayNumber(w.start_date) <= today && today < dayNumber(w.start_date) + 7)
  if (weeks.length !== 1 || !Array.isArray(weeks[0].sessions)) return 'Ugens pas: ingen entydig ugeplan'
  const week = weeks[0], sessions = week.sessions
  const ids = new Set(sessions.map(s => s?.id).filter(Boolean))
  if (ids.size !== sessions.length) return 'Ugens pas: ukendt'
  if (!ids.size) return 'Ugens pas: ingen planlagte pas'
  const logged = new Set()
  for (const log of data.logs.rows) {
    if (log.athlete_id !== athleteId || log.skipped) continue
    const sid = log.exercises?.sessions?.id
    if (!ids.has(sid)) continue
    const validStamp = typeof log.logged_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(log.logged_at) && dayNumber(log.logged_at.slice(0, 10)) != null
    const stamp = validStamp ? new Date(log.logged_at) : null
    const loggedDay = stamp && dayNumber(meetToday(stamp))
    if (loggedDay == null) return 'Ugens pas: ukendt'
    if (dayNumber(week.start_date) <= loggedDay && loggedDay <= today) logged.add(sid)
  }
  return `Ugens pas: ${logged.size} af ${ids.size} logget${logged.size === ids.size ? ' (alle)' : ''}`
}
export function meetSoonRows({ athletes = [], data = {}, now = new Date() } = {}) {
  const day = meetToday(now), today = dayNumber(day)
  if (today == null) return []
  const unique = new Map(athletes.filter(a => a?.id && !a.hidden).map(a => [a.id, a]))
  return [...unique.values()].flatMap(athlete => {
    const date = dayNumber(athlete.competition_date)
    const days = date == null ? -1 : date - today
    return days >= 0 && days <= 14 ? [{ athlete, days, date: athlete.competition_date, status: sessionStatus(athlete.id, data, day) }] : []
  }).sort((a, b) => a.days - b.days || String(a.athlete.name || '').localeCompare(String(b.athlete.name || ''), 'da') || String(a.athlete.id).localeCompare(String(b.athlete.id)))
}
export function CoachMeetSoon({ enabled = COACH_MEET_SOON_ENABLED, athletes, data, loading, loadError, openProfile }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (enabled !== true) return
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [enabled])
  if (enabled !== true) return null
  const rows = meetSoonRows({ athletes, data, now })
  const message = loading ? 'Indlæser stævner…' : loadError ? 'Stævner kunne ikke indlæses.' : !rows.length ? 'Ingen atleter med stævne inden for 14 dage.' : null
  return h('section', { 'aria-label': 'Stævne inden for 14 dage', style: { marginBottom: '1rem', color: '#edeae2' } },
    h('h2', { style: { fontSize: '1.1rem', margin: '0 0 8px' } }, 'Stævne inden for 14 dage'),
    message ? h('p', { role: 'status' }, message) : h('ul', { style: { listStyle: 'none', margin: 0, padding: 0 } },
      ...rows.map(row => h('li', { key: row.athlete.id }, h('button', {
        type: 'button', onClick: () => openProfile(row.athlete, 'program', 'list'),
        style: { display: 'block', width: '100%', minHeight: 44, padding: '0.6rem', textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', color: '#edeae2', background: '#1c1c18', border: '1px solid #59564c', font: 'inherit', cursor: 'pointer' },
      }, h('span', { style: { display: 'block' } }, `${row.athlete.name} · ${row.days === 0 ? 'Stævne i dag' : `${row.days} ${row.days === 1 ? 'dag' : 'dage'} til stævne`} (${row.date})`),
      h('span', { style: { display: 'block', fontSize: '0.85rem' } }, row.status))))))
}
