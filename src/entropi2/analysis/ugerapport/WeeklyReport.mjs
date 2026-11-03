import { createElement as h } from 'react'
import { weeklyReportModel, formatReportNumber as number } from './weeklyReportModel.mjs'

// Leaf component only. Assembly must explicitly opt in; no entry is changed.
export default function WeeklyReport(props = {}) {
  if (props.entropi2 !== true) return null
  const report = weeklyReportModel(props, props.now)
  const style = { color: '#edeae2', background: '#141410', padding: 16,
    width: '100%', maxWidth: 480, minWidth: 0, boxSizing: 'border-box',
    overflowWrap: 'anywhere', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }
  if (!report.ready) return h('section', { 'aria-label': 'Din ugerapport', style },
    h('h2', null, 'Din ugerapport'), h('p', null, report.message))
  const weight = report.weight
  return h('section', { 'aria-label': 'Din ugerapport', 'data-entropi2-ugerapport': true, style },
    h('h2', null, 'Din ugerapport'), h('p', null, report.period),
    h('p', null, report.sessions),
    h('h3', null, 'Ugens bedste e1RM'),
    h('ul', { style: { paddingLeft: 20 } }, ...report.lifts.map(row =>
      h('li', { key: row.lift }, `${row.lift}: ${row.value === null ? row.message : `${number(row.value)} kg e1RM`}`))),
    h('p', null, report.mealDays === null ? 'Kostdage: data er ikke klar.' : `Kostdage logget: ${report.mealDays} af 7.`),
    h('p', null, weight.delta === null ? weight.message
      : `Vægtændring: ${weight.delta > 0 ? '+' : ''}${number(weight.delta)} kg.`),
    h('details', null,
      h('summary', { style: { minHeight: 44, paddingTop: 8, boxSizing: 'border-box', cursor: 'pointer' } }, 'Sådan tælles ugen'),
      h('p', null, report.note), h('p', null, report.sessionNote),
      ...report.lifts.filter(row => row.value !== null).map(row => h('p', { key: row.lift }, `${row.lift}: ${row.message}`)),
      weight.delta !== null && h('p', null, weight.message)))
}
