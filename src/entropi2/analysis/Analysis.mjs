import { createElement as h } from 'react'
import { analysisModel } from './analysisModel.mjs'

// Explicit opt-in only. Assembly must supply entropi2 === true and the existing
// AthleteView props. Importing this module changes no existing entry or flag.
export default function Analysis(props = {}) {
  if (props.entropi2 !== true) return null
  const { answers, weekOverview: week, setTab } = analysisModel(props, props.now ?? new Date())
  return h('section', { 'aria-label': 'Din analyse', 'data-entropi2-analysis': true,
    style: { color: '#edeae2', background: '#141410', padding: 20, maxWidth: 480,
      width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif" } },
  h('h1', { style: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, lineHeight: '40px' } }, 'Din analyse'),
  h('section', { 'aria-label': 'Ugeoversigt', 'data-analysis-week': true,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
    h('h2', { style: { fontSize: '1.15rem' } }, 'Ugeoversigt'),
    h('p', null, week.period),
    h('p', null, week.sessions),
    h('p', null, week.sets),
    h('p', { style: { lineHeight: 1.6 } }, week.note),
    ...week.lifts.map(row => h('section', { key: row.lift, 'aria-label': row.lift },
      h('h3', { style: { fontSize: '1rem' } }, row.lift),
      row.value && h('p', { 'data-week-lift-value': row.lift }, row.value),
      h('p', { style: { lineHeight: 1.6 } }, row.message))),
    h('p', { style: { lineHeight: 1.6 } }, 'e1RM er et beregnet enrepetitionsmaksimum. Kun tunge sæt i kendte programblokke indgår; deload, taper og aflastning er udeladt.')),
  ...answers.map(a => h('section', { key: a.key, 'aria-label': a.title,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
  h('h2', { style: { fontSize: '1.15rem' } }, a.title),
  a.value && h('p', { 'data-analysis-value': a.key, style: { fontSize: '1.5rem' } }, a.value),
  h('p', { style: { lineHeight: 1.6 } }, a.message),
  typeof setTab === 'function' && h('button', { type: 'button',
    style: { minHeight: 44, padding: '0.5rem 1rem', color: '#171815', background: '#d8b16b', border: 0, borderRadius: 4 },
    onClick: () => setTab(a.destination) }, a.action))))
}
