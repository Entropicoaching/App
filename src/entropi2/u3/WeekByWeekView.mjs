import { createElement as h, useEffect, useState } from 'react'
import { calendarDay } from '../../calendarDate.js'
import { readBlocks } from '../analysis/blokforblok/readBlocks.mjs'
import { weekByWeek } from './weekByWeek.mjs'

import { Bars, FocusBox, Sparkline } from './charts.mjs'
import { formatNumber } from './format.mjs'

const cell = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }
const head = { ...cell, position: 'sticky', left: 0, background: '#1c1c18', textAlign: 'left', fontWeight: 400 }
const metric = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', alignItems: 'center', gap: 12,
  paddingBlock: 8, borderTop: '1px solid #2f2f29' }
const small = { fontSize: 13, color: '#c1beb5' }

const latest = row => {
  const v = row.values.at(-1)
  if (typeof v !== 'number') return '·'
  return row.key === 'kostdage' ? `${v}/7` : formatNumber(row.digits ? v : Math.round(v), row.digits ?? 0)
}
const goodFor = row => row.key === 'protein' && row.target ? v => v >= 0.9 * row.target
  : row.key === 'kostdage' ? v => v >= 4 : () => true

// U3b: én række pr. tal med fire søjler (ældste til venstre) i stedet for en
// bred tabel. Tallene står stadig i en lukket tabel under graferne.
export function WeekByWeekTable({ model }) {
  if (!model) return null
  return h('div', { 'data-u3-week-by-week': true, style: { padding: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18', textAlign: 'left', minWidth: 0 } },
    h(FocusBox, { focus: model.focus }),
    h('p', { style: { ...small, margin: '0 0 4px', textAlign: 'right' } }, `${model.weeks[0].label} til ${model.weeks.at(-1).label}`),
    ...model.series.map(row => h('div', { key: row.key, 'data-u3-week-metric': row.key, style: metric },
      h('div', { style: { minWidth: 0 } },
        h('span', { style: { ...small, display: 'block' } }, row.label),
        h('strong', { style: { fontSize: 18 } }, latest(row))),
      // Mængder som søjler fra 0, niveauer (e1RM, vægt, readiness) som kurve.
      h(row.relative ? Sparkline : Bars, { values: row.values, target: row.target, good: goodFor(row),
        label: `${row.label} for ${model.weeks.map(w => w.label).join(', ')}` }) ?? h('span', { style: small }, row.relative ? 'for få uger' : 'ingen data'))),
    ...model.couplings.map((text, i) => h('p', { key: i, 'data-u3-coach-coupling': true, style: { ...small, fontSize: 14, lineHeight: 1.5 } }, text)),
    h('p', { style: { ...small, lineHeight: 1.5 } }, model.note),
    h('details', { 'data-u3-week-numbers': true },
      h('summary', { style: { minHeight: 44, cursor: 'pointer', display: 'flex', alignItems: 'center' } }, 'Se tallene'),
      h('div', { style: { overflowX: 'auto', maxWidth: '100%' } },
        h('table', { style: { borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '100%' } },
          h('thead', null, h('tr', null, h('th', { style: head, scope: 'col' }, ''),
            ...model.weeks.map(w => h('th', { key: w.start, scope: 'col', style: { ...cell, fontWeight: 600 } }, w.label.replace('uge ', 'u'))))),
          h('tbody', null, ...model.rows.map(([label, values]) => h('tr', { key: label },
            h('th', { scope: 'row', style: head }, label),
            ...values.map((v, i) => h('td', { key: i, style: cell }, v)))))))))
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
    h('p', { style: { ...small, lineHeight: 1.5, textAlign: 'left' } }, 'De seneste 4 afsluttede uger.'),
    open && (data?.failed ? h('p', { role: 'status' }, 'Ugerne kunne ikke hentes.')
      : model ? h(WeekByWeekTable, { model }) : h('p', { role: 'status' }, 'Henter uger…')))
}
