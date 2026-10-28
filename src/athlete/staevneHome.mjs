import { calendarDay, calendarDaysBetween } from '../calendarDate.js'

// Presentation only. Explicit prop, with no storage or URL activation.
export const DEFAULT_STAEVNE_HOME = false
export function staevneHome({ enabled = DEFAULT_STAEVNE_HOME, athlete, currentWeek, now = new Date() } = {}) {
  if (enabled !== true) return null
  const date = athlete?.competition_date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const today = calendarDay(now)
  const days = today ? calendarDaysBetween(today, date) : null
  if (days === null || days < 0) return null
  const block = typeof currentWeek?.block_name === 'string' ? currentWeek.block_name.trim() : ''
  return { days, countdown: days === 0 ? 'Stævne i dag' : `${days} ${days === 1 ? 'dag' : 'dage'} til stævne`,
    focus: block ? `Ugens fokus: ${block}` : null }
}

export function renderStaevneHome(h, options = {}) {
  const model = staevneHome(options)
  if (!model) return null
  return h('button', { type: 'button', 'data-staevne-home': '', onClick: () => options.setTab('stævnedag'),
    style: { display: 'grid', gap: '0.35rem', width: '100%', minWidth: 0, minHeight: 44,
      padding: '0.85rem 1rem', marginBottom: '1rem', border: '1px solid #c8923a', borderRadius: 4,
      background: '#1c1c18', color: '#edeae2', font: 'inherit', textAlign: 'left',
      overflowWrap: 'anywhere', cursor: 'pointer' } },
  h('span', { style: { fontWeight: 600 } }, model.countdown),
  model.focus ? h('span', null, model.focus) : null,
  h('span', { style: { color: '#e0ae5c' } }, 'Se Stævne'))
}
