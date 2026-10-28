import { isSessionDone, sessionLoggedCount } from '../nextSet.js'

const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const labels = { logget: 'Logget', delvist: 'Delvist logget', mangler: 'Ikke logget', hvile: 'Hviledag' }
const marks = { logget: '✓', delvist: '◐', mangler: '○', hvile: 'Hvile' }

// Presentation of the existing program completion rule, including skipped sets.
// No dates are inferred for undated or flexible sessions.
export function renderUgeLogget(h, options) {
  if (options.enabled !== true) return null
  const { week, weekStart, exerciseLogs, onOpenSession } = options
  if (!week) return null
  const sessions = week.sessions || []
  return h('section', { 'aria-label': 'Ugens loggede sæt', 'data-uge-logget': week.id,
    style: { marginBottom: '1rem' } },
  h('div', { style: { marginBottom: '0.5rem', fontSize: '0.8rem' } }, 'Denne uges loggede sæt'),
  h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 } },
    ...days.map((name, weekday) => {
      const matches = sessions.filter(s => s.weekday === weekday)
      const state = !matches.length ? 'hvile'
        : matches.every(s => isSessionDone(s, exerciseLogs)) ? 'logget'
        : matches.some(s => sessionLoggedCount(s, exerciseLogs) > 0) ? 'delvist' : 'mangler'
      const date = weekStart instanceof Date && Number.isFinite(weekStart.getTime()) ? new Date(weekStart) : null
      if (date) date.setDate(date.getDate() + weekday)
      const dateLabel = date ? date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) : ''
      const target = matches.find(s => !isSessionDone(s, exerciseLogs)) || matches[0]
      return h('button', { key: weekday, type: 'button', 'data-uge-dag': state,
        'aria-label': [name, dateLabel, labels[state], ...matches.map(s => s.title)].filter(Boolean).join(' · '),
        disabled: !target || typeof onOpenSession !== 'function',
        onClick: () => { if (target && typeof onOpenSession === 'function') onOpenSession(target.id) },
        style: { minWidth: 0, minHeight: 64, padding: '4px 0', borderRadius: 4,
          border: state === 'hvile' ? '1px dashed #7a7770' : '1px solid #a9a69e',
          background: state === 'logget' ? '#263b26' : '#1c1c18', color: '#edeae2',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: '0.65rem' } },
        h('span', null, name), h('span', null, date ? String(date.getDate()) : ''),
        h('span', { 'aria-hidden': true }, marks[state]))
    })),
  h('p', { style: { fontSize: '0.72rem', lineHeight: 1.5, margin: '0.5rem 0' } },
    '✓ Logget · ◐ Delvist logget · ○ Ikke logget · Hvile. Oversprungne sæt tæller som logget.'),
  sessions.some(s => !Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6)
    ? h('p', { style: { fontSize: '0.72rem' } }, 'Pas uden fast dag vises i Mit program.') : null)
}
