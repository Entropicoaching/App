import { calendarDay, addCalendarDays } from '../calendarDate.js'
import { calendarTime } from './kostNumbers.mjs'
import { isSessionDone } from '../nextSet.js'
import { exerciseViewGroups } from '../exerciseSetView.js'

export const DEFAULT_NEXT_TRAINING_HOME = false
const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const hasSets = session => (session.exercises || []).some(ex => Number(ex.sets) > 0)
const fixedDay = session => Number.isInteger(session.weekday) && session.weekday >= 0 && session.weekday <= 6

// Read-only calendar projection. Date arithmetic uses calendar days, including DST.
// Undated weeks follow the same anchor rule as weekStartDate. With no anchor,
// the active week is this calendar week, as in WeekCalendar.
export function nextTrainingHome({ enabled = DEFAULT_NEXT_TRAINING_HOME, allWeeks = [], currentWeek, exerciseLogs = [], now = new Date() } = {}) {
  if (enabled !== true) return null
  const today = calendarDay(now)
  if (!today) return null
  const weeks = allWeeks || []
  if (!weeks.length && !currentWeek) return { kind: 'no-program' }
  if (!currentWeek) return null
  const active = weeks.find(week => week.id === currentWeek.id) || currentWeek
  const ordered = [...weeks]
  if (!ordered.some(week => week.id === active.id)) ordered.push(active)
  const anchor = [...ordered].sort((a, b) => a.week_number - b.week_number)
    .find(week => calendarTime(week.start_date) !== null && Number.isInteger(week.week_number))
  const todayWd = (new Date(calendarTime(today)).getUTCDay() + 6) % 7
  const monday = addCalendarDays(today, -todayWd)
  const weekStart = week => {
    if (calendarTime(week.start_date) !== null) return week.start_date
    // An explicit but invalid date must not become an invented appointment.
    if (week.start_date) return null
    if (!Number.isInteger(week.week_number)) return week === active ? monday : null
    if (anchor) return addCalendarDays(anchor.start_date, (week.week_number - anchor.week_number) * 7)
    return Number.isInteger(active.week_number) ? addCalendarDays(monday, (week.week_number - active.week_number) * 7) : null
  }
  const candidates = []
  for (const week of ordered) {
    const start = weekStart(week)
    if (!start) continue
    const end = addCalendarDays(start, 6)
    for (const session of week.sessions || []) {
      if (!hasSets(session)) continue
      if (!fixedDay(session)) {
        if (session.weekday != null) continue
        // A flexible unfinished session can be trained today. Keep today's UI.
        if (start <= today && today <= end && !isSessionDone(session, exerciseLogs)) return null
        if (start > today && !isSessionDone(session, exerciseLogs)) candidates.push({ week, session, date: null, orderDate: start })
        continue
      }
      const date = addCalendarDays(start, session.weekday)
      // A scheduled training day keeps the existing UI, even after completion.
      if (date === today) return null
      if (date > today && !isSessionDone(session, exerciseLogs)) candidates.push({ week, session, date, orderDate: date })
    }
  }
  candidates.sort((a, b) => a.orderDate.localeCompare(b.orderDate) || (a.session.session_order ?? 0) - (b.session.session_order ?? 0))
  const next = candidates[0]
  if (!next) return { kind: 'no-next' }
  return { kind: 'next', date: next.date, weekNumber: next.week.week_number,
    title: next.session.title || 'Træning',
    day: next.date ? weekdays[next.session.weekday] : 'Dag ikke fastlagt',
    exercises: exerciseViewGroups((next.session.exercises || []).filter(ex => Number(ex.sets) > 0))
      .map(group => ({ name: group.name, sets: group.totalSets })) }
}

export function renderNextTrainingHome(h, model, goProgram) {
  if (!model) return null
  const next = model.kind === 'next'
  const dateLabel = model.date ? `${Number(model.date.slice(8))}.${Number(model.date.slice(5, 7))}.${model.date.slice(0, 4)}` : `Uge ${model.weekNumber}`
  return h('section', { 'aria-label': 'Næste træning', 'data-next-training-home': '',
    style: { marginBottom: '1.25rem', padding: '1rem', border: '1px solid #59564c', borderRadius: 4, color: '#edeae2', overflowWrap: 'anywhere' } },
  h('h1', { style: { fontSize: '1.4rem', margin: '0 0 0.75rem', fontWeight: 400 } }, next ? 'Næste træning' : model.kind === 'no-program' ? 'Intet program endnu' : 'Intet kommende pas planlagt'),
  next ? h('div', null,
    h('p', null, `${model.day} · ${dateLabel}`), h('h2', { style: { fontSize: '1.1rem' } }, model.title),
    h('ul', null, ...model.exercises.map((ex, index) => h('li', { key: index }, `${ex.name} · ${ex.sets} sæt`))))
    : h('p', null, model.kind === 'no-program' ? 'Din coach tilknytter dit program. Så vises din næste træning her.' : 'Se dit program for resten af planen.'),
  h('button', { type: 'button', onClick: goProgram,
    style: { minHeight: 44, padding: '0.65rem 1rem', background: '#1c1c18', border: '1px solid #c8923a', color: '#edeae2', cursor: 'pointer', font: 'inherit' } }, 'Se Program'))
}
