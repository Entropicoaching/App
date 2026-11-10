import { createElement as h, useEffect, useState } from 'react'
import { calendarDay } from '../../calendarDate.js'
import { readBlocks } from '../analysis/blokforblok/readBlocks.mjs'
import { weekByWeek } from './weekByWeek.mjs'

const cell = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }
const head = { ...cell, position: 'sticky', left: 0, background: '#1c1c18', textAlign: 'left', fontWeight: 400 }

export function WeekByWeekTable({ model }) {
  if (!model) return null
  return h('div', { 'data-u3-week-by-week': true },
    h('div', { style: { overflowX: 'auto', maxWidth: '100%' } },
      h('table', { style: { borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '100%' } },
        h('thead', null, h('tr', null, h('th', { style: head, scope: 'col' }, ''),
          ...model.weeks.map(w => h('th', { key: w.start, scope: 'col', style: { ...cell, fontWeight: 600 } }, w.label)))),
        h('tbody', null, ...model.rows.map(([label, values]) => h('tr', { key: label },
          h('th', { scope: 'row', style: head }, label),
          ...values.map((v, i) => h('td', { key: i, style: cell }, v))))))),
    ...model.couplings.map((text, i) => h('p', { key: i, 'data-u3-coach-coupling': true, style: { lineHeight: 1.6 } }, text)),
    h('p', { style: { lineHeight: 1.6, opacity: 0.8 } }, model.note))
}

// Fold i coachens arbejdsrum. L3 med kost læses først, når folden åbnes.
export default function WeekByWeekView({ client, athlete, now, foldProps = {}, summaryStyle }) {
  const today = calendarDay(now ?? new Date())
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!open || !client || !athlete?.id || !today) return undefined
    let live = true
    setData(null)
    readBlocks(client, athlete.id, today, { withMeals: true }).then(r => { if (live) setData(r) }, () => { if (live) setData({ day: today, failed: true }) })
    return () => { live = false }
  }, [open, client, athlete?.id, today])
  const model = data && data.day === today && !data.failed ? weekByWeek({ data, athlete, today, now: now ?? new Date() }) : null
  return h('details', { ...foldProps, 'data-u3-week-by-week-fold': true,
    onToggle: event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open) } },
    h('summary', { style: summaryStyle ?? { minHeight: 48, cursor: 'pointer' } }, 'Uge for uge'),
    open && (data?.failed ? h('p', { role: 'status' }, 'Ugerne kunne ikke hentes.')
      : model ? h(WeekByWeekTable, { model }) : h('p', { role: 'status' }, 'Henter uger…')))
}
