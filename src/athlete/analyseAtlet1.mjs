import { rel1101Enabled } from '../rel1101.mjs'
import { parseInputNumber } from '../inputValues.js'
import { calendarDay, calendarDaysBetween, addCalendarDays } from '../calendarDate.js'
import { erTungtSaet, erDeloadLog, erDeloadBlok } from '../exerciseProgress.js'

// Only the existing strict release opt-in. No storage or new data source.
export function analyseAtlet1Enabled(props = {}) {
  return rel1101Enabled(props.rel1101, globalThis.window?.location?.search ?? globalThis.location?.search ?? '')
}
const list = value => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : []
const kg = value => String(value).replace('.', ',')
const date = value => value.split('-').reverse().join('.')
const identity = row => row.exercise_id != null && row.set_number != null
  ? JSON.stringify([row.exercise_id, row.set_number]) : row.id != null ? `id:${row.id}` : null
// Conflicting duplicates have no defensible winner. Exact duplicates count once.
function unique(rows) {
  const byKey = new Map(), anonymous = []
  for (const row of rows) {
    const key = identity(row)
    if (key === null) { anonymous.push(row); continue }
    const group = byKey.get(key) || []
    group.push(row); byKey.set(key, group)
  }
  const signature = r => JSON.stringify([r.weight, r.reps_completed, r.logged_at, !!r.skipped, r.exercises])
  return [...anonymous, ...[...byKey.values()].filter(g => new Set(g.map(signature)).size === 1).map(g => g[0])]
}
function clean(row, today) {
  const name = row.exercises?.name
  const weight = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
  // Missing timestamps must never become today; invalid dates must not normalize.
  const day = row.logged_at == null ? null : calendarDay(row.logged_at)
  if (typeof name !== 'string' || !name.trim() || !day || !today || day > today
    || row.skipped || !(weight > 0) || !Number.isSafeInteger(reps) || reps < 1) return null
  return { name: name.trim(), weight, reps, day, row }
}
export function analyseAtlet1Model(props = {}, now = new Date()) {
  const today = calendarDay(now)
  const week = props.currentWeek
  const start = typeof week?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.start_date)
    ? calendarDay(week.start_date) : null
  const active = !!(today && start && today >= start && today < addCalendarDays(start, 7))
  const exercises = list(week?.sessions).flatMap(s => list(s.exercises))
  const byId = new Map(exercises.filter(e => e.id != null).map(e => [e.id, e]))
  // A supplied local snapshot owns edits and undo for the selected program week.
  // The history is still required before making a historical comparison.
  const local = Array.isArray(props.exerciseLogs) ? unique(list(props.exerciseLogs).filter(r => byId.has(r.exercise_id))
    .map(r => ({ ...r, exercises: { ...r.exercises, name: byId.get(r.exercise_id).name,
      sessions: { weeks: { block_name: week?.block_name } } } }))) : []
  const history = unique(list(props.fremgangLogs).filter(r => !Array.isArray(props.exerciseLogs) || !byId.has(r.exercise_id)))
  const rows = [...history, ...local].map(r => clean(r, today)).filter(Boolean)
  const heavy = rows.filter(r => erTungtSaet(r.name, r.reps) && !r.row.deload && !erDeloadLog(r.row))
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.row.logged_at).localeCompare(String(b.row.logged_at)) || a.name.localeCompare(b.name) || a.weight - b.weight)
  const latest = heavy.at(-1)
  const recent = latest && calendarDaysBetween(latest.day, today) <= 14 ? latest : null
  const answers = [
    { key: 'status', title: 'Hvor står jeg?', message: 'Log vægt og gentagelser på et tungt sæt med dato i dit program. Så kan du se din seneste registrering her.' },
    { key: 'good', title: 'Hvad går godt?', message: 'Log tunge sæt i samme øvelse med samme antal gentagelser på mindst fire forskellige dage over mindst tre uger inden for de seneste tolv uger. Den nyeste registrering skal være højst to uger gammel, før vi sammenligner vægtene.' },
    { key: 'focus', title: 'Hvad arbejder vi med nu?', message: 'Den aktuelle programuge er ikke klar. Åbn dit program; når ugens øvelser er klar, skal du logge vægt og gentagelser på dine sæt.' },
  ]
  if (recent) answers[0] = { ...answers[0], value: `${kg(recent.weight)} kg`,
    message: `${recent.name}: senest registrerede tunge sæt med ${recent.reps} gentagelser, den ${date(recent.day)}. Det er en logget vægt, ikke en vurdering af din samlede form.` }
  else if (latest) answers[0].message = `Din seneste gyldige registrering er fra ${date(latest.day)}. Log et nyt tungt sæt med vægt og gentagelser for en aktuel status.`
  if (recent && Array.isArray(props.fremgangLogs)) {
    // Exact raw exercise and repetition count: never pool variants or rep ranges.
    const comparable = heavy.filter(r => r.name.toLocaleLowerCase('da') === recent.name.toLocaleLowerCase('da')
      && r.reps === recent.reps && calendarDaysBetween(r.day, today) <= 84)
    const days = new Map()
    for (const r of comparable) if (!days.has(r.day) || days.get(r.day).weight < r.weight) days.set(r.day, r)
    const points = [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
    if (points.length >= 4 && calendarDaysBetween(points[0].day, points.at(-1).day) >= 21) {
      const first = points[0], last = points.at(-1), delta = last.weight - first.weight
      if (delta > 0 && Number.isFinite(delta)) answers[1] = { ...answers[1], value: `+${kg(Number(delta.toPrecision(12)))} kg`,
        message: `${recent.name}, ${recent.reps} gentagelser: forskellen mellem dagens højeste loggede vægt den ${date(first.day)} og den ${date(last.day)}. Det viser en forskel i registreringerne; årsagen kan ikke udledes.` }
      else answers[1].message = `${recent.name}: de sammenlignelige registreringer viser endnu ingen stigning fra første til seneste dagsbedste. Fortsæt med at logge vægt og gentagelser i samme øvelse. Det er ikke en vurdering af din indsats.`
    }
  }
  if (active && exercises.length && byId.size === exercises.length) {
    const block = typeof week.block_name === 'string' && week.block_name.trim() ? `I programmet står blokken «${week.block_name.trim()}». ` : ''
    const count = local.map(r => clean(r, today)).filter(r => r && r.day >= start && identity(r.row) !== null
      && Number.isSafeInteger(parseInputNumber(r.row.set_number)) && parseInputNumber(r.row.set_number) >= 1).length
    answers[2].message = `${block}Følg øvelserne i den aktuelle programuge og log vægt og gentagelser efter hvert sæt. Registreringer siger ikke, om hele planen er gennemført.`
    if (count > 0) answers[2].value = `${count} ${count === 1 ? 'registreret sæt' : 'registrerede sæt'}`
    if (erDeloadBlok(week.block_name)) answers[2].message = `${block}Følg den lettere uge i programmet og log dine sæt. De bruges ikke til at vurdere styrkefremgang.`
  }
  if (props.fremgangLoading === true || !Array.isArray(props.fremgangLogs)) {
    for (const a of answers.slice(0, 2)) { delete a.value; a.message = props.fremgangLoading === true
      ? 'Henter løftehistorik. Vent på indlæsningen, før du vurderer dine registreringer.'
      : 'Løftehistorikken er ikke klar. Åbn Fremgang igen for at hente den; når den er klar, skal du logge vægt og gentagelser på dine sæt.' }
  }
  return answers
}
export function renderAnalyseAtlet1(h, props = {}) {
  return h('section', { 'aria-label': 'Din analyse', 'data-analyse-atlet1': true, style: { color: '#edeae2' } },
    h('h1', null, 'Din analyse'),
    ...analyseAtlet1Model(props).map(a => h('section', { key: a.key, 'aria-labelledby': `analyse-atlet1-${a.key}`,
      style: { padding: '1rem', marginBottom: '1rem', border: '1px solid #59564c', borderRadius: 8 } },
      h('h2', { id: `analyse-atlet1-${a.key}`, style: { fontSize: '1.1rem' } }, a.title),
      a.value && h('p', { 'data-analyse-metric': a.key, style: { fontSize: '1.6rem', margin: '0.5rem 0' } }, a.value),
      h('p', { style: { lineHeight: 1.6 } }, a.message))))
}
