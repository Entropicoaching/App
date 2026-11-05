import { createElement as h } from 'react'

export default function RpeHistoryView({ history }) {
  const series = history.series.map(row => ({ ...row, points: row.points.filter(point => point.count > 0) }))
    .filter(row => row.points.length > 0)
  if (!series.length) return null
  return h('section', { 'aria-label': 'RPE de seneste 6 uger', 'data-analysis-rpe': true,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
    h('h2', { style: { fontSize: '1.15rem' } }, 'RPE de seneste 6 uger'),
    h('p', { style: { lineHeight: 1.6 } }, history.message),
    ...series.map(row => h('details', { key: row.lift, open: row.lift === 'Alle hovedløft' },
      h('summary', { style: { padding: '12px 0', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' } }, row.lift),
      h('ol', { 'aria-label': `${row.lift}: RPE pr. uge`, style: { paddingLeft: 20 } },
        ...row.points.map(point => h('li', { key: point.start, style: { marginBottom: 12 } },
          h('span', { style: { display: 'block' } }, `${point.label}: ${point.text}`),
          h('span', { style: { display: 'block', fontSize: '0.85rem' } }, point.coverage)))))))
}
