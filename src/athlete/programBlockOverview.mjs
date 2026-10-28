import { calendarDay, addCalendarDays } from '../calendarDate.js'
import { weekFullyLogged } from './ugeHjaelp.js'

// A block is a contiguous phase, as in the existing program navigation.
// Its anchor stays the active week when the athlete opens another week.
export function blockWeeks(allWeeks = [], activeWeekIdx = 0) {
  if (!allWeeks[activeWeekIdx]) return []
  const name = allWeeks[activeWeekIdx].block_name || null
  let start = activeWeekIdx, end = activeWeekIdx
  while (start > 0 && (allWeeks[start - 1].block_name || null) === name) start--
  while (end + 1 < allWeeks.length && (allWeeks[end + 1].block_name || null) === name) end++
  return allWeeks.slice(start, end + 1).map((week, i) => ({ week, index: start + i }))
}

// Injected reader returns the existing guarded-read result. Failure remains unknown.
// Chunks avoid oversized filters; partial failures must never imply not logged.
export async function readProgramBlockLogs(weeks, read) {
  const ids = [...new Set(weeks.flatMap(w => (w.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))))]
  const logs = []
  for (let i = 0; i < ids.length; i += 100) {
    for (let offset = 0; ; offset += 500) {
      const result = await read(ids.slice(i, i + 100), offset, offset + 499)
      if (!result?.ok || !Array.isArray(result.data)) return null
      logs.push(...result.data)
      if (result.data.length < 500) break
    }
  }
  return logs
}

const days = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
function restLabel(sessions) {
  if (sessions.some(s => !Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6)) return 'Hviledage ikke fastlagt'
  const used = new Set(sessions.map(s => s.weekday))
  const rest = days.filter((_, i) => !used.has(i))
  return rest.length ? `Hviledage: ${rest.join(', ')}` : 'Ingen hviledage'
}
const formatDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' })
function startDay(allWeeks, week) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDay(value) : null
  if (valid(week.start_date)) return valid(week.start_date)
  const anchor = [...allWeeks].sort((a, b) => a.week_number - b.week_number).find(w => valid(w.start_date))
  return anchor ? addCalendarDays(anchor.start_date, (week.week_number - anchor.week_number) * 7) : null
}
export function programBlockRows({ allWeeks, activeWeekIdx, logs }) {
  return blockWeeks(allWeeks, activeWeekIdx).map(({ week, index }) => {
    const start = startDay(allWeeks, week)
    const end = start && addCalendarDays(start, 6)
    const sessions = week.sessions || []
    const hasSets = sessions.some(s => (s.exercises || []).some(e => e.sets > 0))
    const status = !hasSets ? 'Ingen planlagte sæt' : logs == null ? 'Logstatus ikke tilgængelig'
      : weekFullyLogged(week, logs) ? 'Ugen er logget' : 'Ugen er ikke fuldt logget'
    return { index, week, start, end, date: start && end ? `${formatDay(start)} til ${formatDay(end)}` : 'Dato ikke fastlagt',
      sessions: sessions.length, rest: restLabel(sessions), status, current: index === activeWeekIdx }
  })
}

export function renderProgramBlockOverview(h, options) {
  const rows = programBlockRows(options)
  if (!rows.length) return null
  return h('section', { 'aria-label': 'Hele din aktuelle blok', style: { marginBottom: '1.5rem' } },
    h('h2', { style: { color: '#edeae2', fontSize: '1.2rem' } }, rows[0].week.block_name || 'Din aktuelle blok'),
    h('p', { style: { color: '#b8b4a8' } }, 'Hele blokken. Tryk på en uge for at åbne den.'),
    h('ul', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 } },
      ...rows.map(row => h('li', { key: row.week.id }, h('button', {
        type: 'button', 'aria-current': row.current ? 'step' : undefined,
        'aria-pressed': row.index === options.viewingWeekIdx,
        onClick: () => options.goToWeek(row.index),
        style: { display: 'grid', gap: 5, minHeight: 44, width: '100%', minWidth: 0,
          textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '0.85rem',
          border: `1px solid ${row.current ? '#c8923a' : '#59564c'}`, background: '#1c1c18', color: '#edeae2', cursor: 'pointer', font: 'inherit' },
      }, h('strong', null, `Uge ${row.week.week_number}${row.current ? ' · Aktuel uge' : ''}`),
      h('span', null, row.date), h('span', null, `${row.sessions} pas`), h('span', null, row.rest), h('span', null, row.status)))))
  )
}
