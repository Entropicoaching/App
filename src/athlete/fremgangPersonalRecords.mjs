import { exerciseSetView } from '../exerciseSetView.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadLog, erDeloadBlok } from '../exerciseProgress.js'
import { parseInputNumber } from '../inputValues.js'
import { calendarDay } from '../calendarDate.js'

// APP-FREM3. Read-only view of already loaded sets. Two distinct training
// days per exact lift are required. Variants never inherit a main lift's PR.
export const DEFAULT_PERSONAL_RECORDS = false

export function personalRecordRows({ logs, exerciseLogs = [], currentWeek, allWeeks = [] }) {
  if (!Array.isArray(logs)) return []
  const currentIds = new Set((currentWeek?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id)))
  const names = new Map([...(allWeeks || []), currentWeek].filter(Boolean)
    .flatMap(w => (w.sessions || []).flatMap(s => (s.exercises || []).map(e => [e.id, e.name]))))
  // The current week's local snapshot owns edits, undo and pending sets.
  // Exclude its server rows before adding it so deleted sets cannot reappear.
  const sets = [
    ...logs.filter(l => l && !currentIds.has(l.exercise_id)).map(l => ({
      ...l, name: l.exercises?.name, deload: erDeloadLog(l),
    })),
    ...(exerciseLogs || []).filter(l => l && currentIds.has(l.exercise_id)).map(l => ({
      ...l, name: names.get(l.exercise_id), deload: erDeloadBlok(currentWeek?.block_name),
    })),
  ]
  const groups = new Map()
  for (const set of sets) {
    const weight = parseInputNumber(set.weight), reps = parseInputNumber(set.reps_completed)
    const day = typeof set.logged_at === 'string' ? calendarDay(set.logged_at) : null
    const view = exerciseSetView(set.name)
    if (!view.key || !day || set.skipped || set.deload || !(weight > 0) ||
      !Number.isSafeInteger(reps) || !erTungtSaet(set.name, reps)) continue
    const score = estimatedOneRepMax(weight, reps)
    if (!(score > 0) || !Number.isFinite(score)) continue
    const row = { key: view.key, name: view.name, weight, reps, day, score,
      time: Date.parse(set.logged_at), order: String(set.id ?? '') + '|' + String(set.set_number ?? '') }
    let group = groups.get(view.key)
    if (!group) { group = { days: new Set(), best: row }; groups.set(view.key, group) }
    group.days.add(day)
    const best = group.best
    if (score > best.score || (score === best.score &&
      (row.time < best.time || (row.time === best.time && row.order < best.order)))) group.best = row
  }
  return [...groups.values()].filter(g => g.days.size >= 2).map(g => g.best)
    .sort((a, b) => a.name.localeCompare(b.name, 'da'))
}

const kg = value => String(value).replace('.', ',')
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

export function renderPersonalRecords(h, props) {
  if (props.enabled !== true || props.loading || !Array.isArray(props.logs)) return null
  const rows = personalRecordRows(props)
  if (!rows.length) return null
  return h('section', { 'aria-label': 'Personlige rekorder', 'data-personal-records': rows.length,
    style: { marginBottom: '1rem', padding: '1rem', border: '1px solid #59564c', borderRadius: 8 } },
  h('h2', { style: { fontSize: '1.1rem', margin: '0 0 0.5rem' } }, 'Dine bedste sæt pr. løft'),
  h('p', { style: { fontSize: '0.8rem' } },
    'Bedste loggede tunge sæt efter beregnet maksimalløft (e1RM, et skøn). Kun løft med sæt fra mindst to træningsdage. Lige gode sæt viser den første dato.'),
  h('ul', { style: { paddingLeft: '1.2rem' } }, ...rows.map(row =>
    h('li', { key: row.key, 'data-personal-record': row.key, style: { marginTop: '0.75rem', overflowWrap: 'anywhere' } },
      h('strong', null, row.name), `: ${kg(row.weight)} kg × ${row.reps}. `,
      h('time', { dateTime: row.day }, date(row.day)),
      ` (beregnet maksimalløft ${kg(Math.round(row.score))} kg).`))))
}
