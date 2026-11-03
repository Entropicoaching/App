import { createElement as h } from 'react'
import { analysisModel } from './analysisModel.mjs'
import { formatHistoryKg } from './fourWeekHistory.mjs'
import RpeHistoryView from './RpeHistoryView.mjs'
import { muscleVolume, formatVolume } from './muscleVolume.mjs'

// Explicit opt-in only. Assembly must supply entropi2 === true and the existing
// AthleteView props. Importing this module changes no existing entry or flag.
export default function Analysis(props = {}) {
  if (props.entropi2 !== true) return null
  const now = props.now ?? new Date()
  const { answers, weekOverview: week, fourWeekHistory: history, rpeHistory, personalRecords: records, setTab } = analysisModel(props, now)
  const volume = muscleVolume(props, now)
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
    ...week.lifts.map(row => h('section', { key: row.lift, 'aria-label': row.lift },
      h('h3', { style: { fontSize: '1rem' } }, row.lift),
      row.value && h('p', { 'data-week-lift-value': row.lift }, row.value),
      h('p', { style: { lineHeight: 1.6 } }, row.message))),
    // Marc 3. nov. (keep it simple): forklaringerne er foldet ind; tallene står øverst.
    h('details', { 'data-analysis-week-help': true, style: { marginTop: 8 } },
      h('summary', { style: { cursor: 'pointer', opacity: 0.8 } }, 'Sådan tælles det'),
      h('p', { style: { lineHeight: 1.6 } }, week.note),
      h('p', { style: { lineHeight: 1.6 } }, 'e1RM er et beregnet enrepetitionsmaksimum. Kun tunge sæt i kendte programblokke indgår; deload, taper og aflastning er udeladt.'))),
  h('section', { 'aria-label': 'De seneste 4 uger', 'data-analysis-history': true,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
    h('h2', { style: { fontSize: '1.15rem' } }, 'De seneste 4 uger'),
    // Marc 3. nov. (keep it simple): forklaringen foldes ind under graferne.
    h('details', { style: { marginTop: 8 } }, h('summary', { style: { cursor: 'pointer', opacity: 0.8 } }, 'Sådan tælles det'), h('p', { style: { lineHeight: 1.6 } }, history.message)),
    ...history.lifts.map(row => {
      const max = Math.max(...row.points.map(p => p.value ?? 0), 1)
      return h('figure', { key: row.lift, 'aria-label': `${row.lift}, ugentligt e1RM`, style: { margin: '20px 0' } },
        h('figcaption', { style: { fontWeight: 600 } }, row.lift),
        h('ol', { 'aria-label': `${row.lift}: værdier pr. uge`,
          style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, padding: 0, listStyle: 'none', fontSize: '0.85rem' } },
          ...row.points.map(point => h('li', { key: point.start },
            h('span', { 'aria-hidden': 'true', style: { display: 'flex', alignItems: 'flex-end', height: 64 } },
              point.value !== null && h('span', { 'data-history-bar': true,
                style: { display: 'block', width: '100%', height: `${point.value / max * 100}%`, background: '#d8b16b', borderRadius: 3 } })),
            h('span', { style: { display: 'block' } }, point.label),
            h('span', { 'data-history-value': true, style: { display: 'block' } },
              point.value === null ? (row.unavailable ? 'Data ikke klar' : 'Ingen data') : `${formatHistoryKg(point.value)} kg e1RM`)))),
        h('p', { 'data-history-summary': true, style: { lineHeight: 1.6 } }, row.summary))
    })),
  RpeHistoryView({ history: rpeHistory }),
  h('section', { 'aria-label': 'Dine rekorder', 'data-analysis-records': true,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
    h('h2', { style: { fontSize: '1.15rem' } }, 'Dine rekorder'),
    // Marc 3. nov.: forklaringen foldes ind; rekorderne staar oeverst.
    h('details', { style: { marginTop: 8 } }, h('summary', { style: { cursor: 'pointer', opacity: 0.8 } }, 'Sådan tælles det'), h('p', null, records.message), h('p', { style: { lineHeight: 1.6 } }, records.note)),
    records.lifts.length > 0 && h('ul', { style: { paddingLeft: 20, lineHeight: 1.6 } },
      ...records.lifts.map(row => {
        const heavy = row.heaviest, best = row.bestEstimate
        const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
        return h('li', { key: row.lift },
          h('strong', null, row.lift),
          h('p', null, `Tungeste sæt: ${formatHistoryKg(heavy.weight)} kg × ${heavy.reps} · ${date(heavy.date)}.`),
          h('p', null, `Bedste e1RM: ${formatHistoryKg(best.value)} kg e1RM fra ${formatHistoryKg(best.weight)} kg × ${best.reps} · ${date(best.date)}.`))
      })),
    ),
  h('section', { 'aria-label': 'Volumen pr. muskelgruppe', 'data-analysis-volume': true,
    style: { padding: 12, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18', minWidth: 0 } },
    h('h2', { style: { fontSize: '1.15rem' } }, 'Volumen pr. muskelgruppe'),
    h('details', { style: { marginTop: 8 } }, h('summary', { style: { cursor: 'pointer', opacity: 0.8 } }, 'Sådan tælles det'), h('p', { style: { lineHeight: 1.6 } }, volume.message)),
    ...volume.weeks.map(week => h('table', { key: week.start,
      style: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: 20, fontSize: '0.85rem' } },
      h('caption', { style: { textAlign: 'left', paddingBottom: 8 } }, week.label),
      h('thead', null, h('tr', null,
        ...['Muskelgruppe', 'Sæt', 'Tonnage (kg)'].map((label, i) => h('th', { key: label, scope: 'col',
          style: { width: i === 0 ? '40%' : i === 1 ? '15%' : '45%', textAlign: i === 0 ? 'left' : 'right', padding: '6px 2px', verticalAlign: 'top' } }, label)))),
      h('tbody', null, ...week.groups.map(row => h('tr', { key: row.group },
        h('th', { scope: 'row', style: { textAlign: 'left', padding: '6px 2px', fontWeight: 400 } }, row.group),
        h('td', { style: { textAlign: 'right', padding: '6px 2px' } }, formatVolume(row.sets)),
        h('td', { style: { textAlign: 'right', padding: '6px 2px' } }, formatVolume(row.tonnage)))))))),
  ...answers.map(a => h('section', { key: a.key, 'aria-label': a.title,
    style: { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' } },
  h('h2', { style: { fontSize: '1.15rem' } }, a.title),
  a.value && h('p', { 'data-analysis-value': a.key, style: { fontSize: '1.5rem' } }, a.value),
  h('p', { style: { lineHeight: 1.6 } }, a.message),
  typeof setTab === 'function' && h('button', { type: 'button',
    style: { minHeight: 44, padding: '0.5rem 1rem', color: '#171815', background: '#d8b16b', border: 0, borderRadius: 4 },
    onClick: () => setTab(a.destination) }, a.action))))
}
