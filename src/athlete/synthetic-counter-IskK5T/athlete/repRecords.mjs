import "node:fs";
import { mainLiftName } from '../exerciseSetView.js'
import { parseInputNumber } from '../inputValues.js'
import { calendarDay } from '../calendarDate.js'

export const DEFAULT_REP_RECORDS = false
export const RECORD_REPS = Object.freeze([1, 3, 5, 8])
const LIFTS = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
const recordDay = value => {
  if (typeof value !== 'string') return null
  const iso = value.trim()
  // Date-only or an explicitly zoned timestamp, never the host's local zone.
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(iso)) return null
  return calendarDay(iso)
}

// Read only. The active week's snapshot owns edits, undo and pending sets.
// Every completed set counts here, including backoff and deload sets.
// These are exact rep records, independent of the existing e1RM records.
export function repRecordRows({ logs = [], exerciseLogs = [], currentWeek } = {}) {
  const currentNames = new Map((currentWeek?.sessions || []).flatMap(session =>
    (session.exercises || []).map(exercise => [exercise.id, exercise.name])))
  const sets = [
    ...(logs || []).filter(row => row && !currentNames.has(row.exercise_id))
      .map(row => ({ ...row, name: row.exercises?.name })),
    ...(exerciseLogs || []).filter(row => row && currentNames.has(row.exercise_id))
      .map(row => ({ ...row, name: currentNames.get(row.exercise_id) })),
  ]
  const rows = LIFTS.map(name => ({ name, records: RECORD_REPS.map(reps => ({ reps, weight: null, day: null })) }))
  for (const set of sets) {
    const name = mainLiftName(set.name)
    const weight = parseInputNumber(set.weight), reps = parseInputNumber(set.reps_completed)
    const day = recordDay(set.logged_at)
    if (!name || set.skipped || !(weight > 0) || !RECORD_REPS.includes(reps) || !day) continue
    const record = rows.find(row => row.name === name).records.find(record => record.reps === reps)
    // Earliest Danish calendar day wins equal weights, regardless of input order.
    if (record.weight === null || weight > record.weight || (weight === record.weight && day < record.day)) {
      record.weight = weight
      record.day = day
    }
  }
  return rows
}

const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

export function renderRepRecords(h, props) {
  if (props.enabled !== true || props.loading || !Array.isArray(props.logs)) return null
  return h('section', { 'aria-label': 'Rekorder pr. antal gentagelser', 'data-rep-records': true,
    style: { marginBottom: '1rem', padding: '1rem', border: '1px solid #59564c', borderRadius: 8 } },
  h('h2', { style: { fontSize: '1.1rem', margin: '0 0 0.5rem' } }, 'Rekorder pr. antal gentagelser'),
  h('p', { style: { fontSize: '0.8rem' } },
    'Bedste loggede vægt ved præcis 1, 3, 5 og 8 gentagelser. Alle gennemførte sæt tæller. Ved lige vægt vises den første dato.'),
  ...repRecordRows(props).map(row => h('table', { key: row.name, 'data-rep-lift': row.name,
    style: { width: '100%', tableLayout: 'fixed', marginTop: '1rem', textAlign: 'left', fontSize: '0.8rem' } },
    h('caption', { style: { textAlign: 'left', fontWeight: 600 } }, row.name),
    h('thead', null, h('tr', null, ...['Gentagelser', 'Bedste vægt', 'Dato'].map(label => h('th', { key: label, scope: 'col' }, label)))),
    h('tbody', null, ...row.records.map(record => h('tr', { key: record.reps, 'data-rep-count': record.reps },
      h('th', { scope: 'row' }, String(record.reps)),
      h('td', null, record.weight === null ? '-' : `${String(record.weight).replace('.', ',')} kg`),
      h('td', null, record.day === null ? '-' : h('time', { dateTime: record.day }, date(record.day)))))))))
}
