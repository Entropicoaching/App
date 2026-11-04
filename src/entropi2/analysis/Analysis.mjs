import { createElement as h } from 'react'
import DevelopmentView from './DevelopmentView.mjs'
import { analysisModel } from './analysisModel.mjs'
import { formatHistoryKg } from './fourWeekHistory.mjs'
import RpeHistoryView from './RpeHistoryView.mjs'
import { muscleVolume, formatVolume } from './muscleVolume.mjs'
import { analysisWeekExtras, copyAnalysisWeek } from './analysisWeekExtras.mjs'
import WeeklyReport from './ugerapport/WeeklyReport.mjs'
import MineData from '../athlete/minedata/MineData.mjs'
import { analysisMineData } from './analysisMineData.mjs'
import IntensityView from './intensitet/IntensityView.mjs'
import { analysisIntensity } from './analysisSnapshots.mjs'

// Explicit opt-in only. Assembly must supply entropi2 === true and the existing
// AthleteView props. Importing this module changes no existing entry or flag.
export default function Analysis(props = {}) {
  if (props.entropi2 !== true) return null
  const now = props.now ?? new Date()
  const { answers, rpeHistory, personalRecords: records, setTab } = analysisModel(props, now)
  const volume = muscleVolume(props, now)
  const extras = analysisWeekExtras(props, now)
  return h('section', { 'aria-label': 'Din analyse', 'data-entropi2-analysis': true,
    style: { color: '#edeae2', background: '#141410', padding: 20, maxWidth: 480,
      width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif" } },
  h('h1', { style: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, lineHeight: '40px' } }, 'Din analyse'),
  h(DevelopmentView, { ...props, now }),
  h('details', { 'data-analysis-secondary': true },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Ugerapport og flere analyser'),
  h(WeeklyReport, { ...props, now }),
  h('details', { 'data-analysis-mine-data': true, style: { marginBottom: 16 } },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Mine data'),
    h(MineData, { ...analysisMineData(props, now), showRecords: false })),
  h('details', { 'data-analysis-intensity': true, style: { marginBottom: 16 } },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Intensitet pr. uge'),
    props.fremgangError || props.exerciseLogsError
      ? h('p', { role: 'status' }, 'Intensitetsdata kunne ikke hentes.')
      : props.fremgangLoading || props.exerciseLogsLoading
        ? h('p', { role: 'status' }, 'Henter intensitetsdata…')
        : h(IntensityView, { entropi2: true, exerciseLogs: analysisIntensity(props), asOf: now })),
  h('details', { 'data-analysis-more': true },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Flere analyser'),
  extras.progress && h('p', { 'data-analysis-progress': true, style: { lineHeight: 1.6 } }, extras.progress),
  extras.load && h('p', { 'data-analysis-load': true, style: { lineHeight: 1.6 } }, extras.load),
  h('details', { 'data-analysis-share': true, style: { marginTop: 12, marginBottom: 12 } },
    h('summary', { style: { cursor: 'pointer', minHeight: 44, display: 'list-item', paddingTop: 12, boxSizing: 'border-box' } }, 'Del ugen'),
    h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', lineHeight: 1.6 } }, extras.share),
    h('button', { type: 'button', 'data-analysis-copy': true, 'aria-live': 'polite',
      style: { minHeight: 44, padding: '0.5rem 1rem', color: '#171815', background: '#d8b16b', border: 0, borderRadius: 4 },
      onClick: event => copyAnalysisWeek(event, extras.share) }, 'Del ugen')),
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
  typeof setTab === 'function' && h('button', { type: 'button', 'data-analysis-destination': a.destination,
    style: { minHeight: 44, padding: '0.5rem 1rem', color: '#171815', background: '#d8b16b', border: 0, borderRadius: 4 },
    onClick: () => setTab(a.destination) }, a.action))))))
}
