import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { developmentModel as model, developmentSnapshot } from './developmentModel.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import { renderTree } from './testDom.mjs'
import { weeklyLoad } from './weeklyLoad.mjs'
import { weeklyIntensity } from './intensitet/intensityModel.mjs'

const now = '2026-11-04T12:00:00Z'
const row = (i, extra = {}) => ({ exercise_id: `synthetic-${i}`, athlete_id: 'synthetic-a',
  logged_at: `${addCalendarDays('2026-05-13', i * 7)}T10:00:00Z`,
  weight: 100 + i, reps_completed: 3, reference_e1rm: 150,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: i < 13 ? 'Volumen' : 'Styrke' } } }, ...extra })
const props = extra => ({ entropi2: true, now, athlete: { id: 'synthetic-a', competition_date: '2026-11-18' },
  fremgangLogs: Array.from({ length: 26 }, (_, i) => row(i)), ...extra })
const view = p => renderTree(DevelopmentView(p))

test('26 calendar weeks retain oldest data, holes, observed blocks and exact Epley delta', () => {
  const m = model(props(), now)
  assert.equal(m.state, 'ready'); assert.equal(m.weeks.length, 26)
  assert.equal(m.start, '2026-05-11'); assert.equal(m.weeks.at(-1).start, '2026-11-02')
  assert.equal(m.lifts[0].observed, 26); assert.equal(m.lifts[0].delta, 27.5)
  assert.match(m.lifts[0].message, /steget 27,5 kg/)
  assert.deepEqual(m.weeks[0].blocks, ['Volumen']); assert.deepEqual(m.weeks.at(-1).blocks, ['Styrke'])
  assert.equal(m.weeks[0].tonnage, 300)
  assert.equal(m.weeks.at(-1).highShare, 100)
  const gap = model(props({ fremgangLogs: [row(0), row(25)] }), now)
  assert.equal(gap.lifts[0].points[1].value, null)
  assert.equal(gap.lifts[0].delta, null)
  assert.equal(gap.weeks[1].sets, 0); assert.equal(gap.weeks[1].highShare, null)
})

test('four main lifts remain separate; variants and deload do not supply strength', () => {
  const names = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
  const logs = names.flatMap((name, n) => Array.from({ length: 26 }, (_, i) => row(i, {
    exercise_id: `synthetic-${n}-${i}`, weight: 100 + n * 30 + i,
    exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } },
  })))
  const m = model(props({ fremgangLogs: logs }), now)
  assert.deepEqual(m.lifts.map(l => l.observed), [26, 26, 26, 26])
  assert.equal(new Set(m.lifts.map(l => l.points[0].value)).size, 4)
  for (const ex of [{ name: 'Pause squat', block: 'Styrke' }, { name: 'Squat', block: 'Deload' }]) {
    const p = props({ fremgangLogs: [row(25, { exercises: { name: ex.name, sessions: { weeks: { block_name: ex.block } } } })] })
    const r = model(p, now)
    assert.deepEqual(r.lifts.map(l => l.observed), ex.name === 'Squat' ? [0] : [])
    assert.equal(r.weeks.at(-1).sets, 1)
  }
})

test('rep zones are never pooled, and same-day zone selection is input-order independent', () => {
  const three = Array.from({ length: 10 }, (_, i) => row(i + 15))
  const five = row(25, { reps_completed: 5, weight: 200, exercise_id: 'synthetic-five' })
  const p = props({ fremgangLogs: [...three, row(25), five] })
  const a = model(p, now), b = model({ ...p, fremgangLogs: [...p.fremgangLogs].reverse() }, now)
  assert.deepEqual(a, b)
  assert.equal(a.lifts[0].zone, '4-6'); assert.equal(a.lifts[0].observed, 1)
  assert.equal(a.lifts[0].delta, null)
})

test('pending, conflicting identities, foreign, skipped, invalid and future observations are rejected', () => {
  const saved = row(25, { id: 'synthetic-id', set_number: 1 })
  for (const variant of [
    { ...saved, weight: 999 }, { ...saved, pending: true }, { ...saved, _optimistic: true },
    { ...saved, logged_at: row(24).logged_at },
    { ...saved, exercise_id: 'different-position', pending: true },
  ]) {
    for (const logs of [[saved, variant], [variant, saved]]) {
      assert.equal(developmentSnapshot(props({ fremgangLogs: logs }), now).length, 0)
    }
  }
  const bad = [row(25, { athlete_id: 'synthetic-foreign' }), row(25, { skipped: true }),
    row(25, { logged_at: '2026-02-30' }), row(25, { logged_at: '2026-11-04T13:00:00Z' }),
    row(26), row(25, { exercise_id: undefined })]
  assert.equal(developmentSnapshot(props({ fremgangLogs: bad }), now).length, 0)
  const same = model(props({ fremgangLogs: [saved, { ...saved }] }), now)
  assert.equal(same.weeks.at(-1).sets, 1)
})

test('current-week edits and empty undo own the history, including pending retries', () => {
  const currentWeek = { start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ exercises: [{ id: 'synthetic-25', name: 'Squat', sets: 1 }] }] }
  const p = props({ currentWeek, exerciseLogs: [] })
  assert.equal(model(p, now).lifts[0].observed, 25)
  const local = { exercise_id: 'synthetic-25', set_number: 1, logged_at: '2026-11-04T10:00:00Z', weight: 130, reps_completed: 3 }
  assert.equal(model({ ...p, exerciseLogs: [local] }, now).lifts[0].points.at(-1).value, 143)
  assert.equal(model({ ...p, exerciseLogs: [local, { ...local, pending: true }] }, now).lifts[0].points.at(-1).value, null)
})

test('empty, unavailable, error and loading states never expose stale observations', () => {
  for (const extra of [{ fremgangError: true }, { exerciseLogsError: true }, { fremgangLoading: true },
    { exerciseLogsLoading: true }, { fremgangLogs: undefined }]) {
    const p = props(extra), m = model(p, now), dom = view(p)
    assert.equal(m.weeks.length, 0); assert.equal(m.forecast, null)
    assert.equal(dom.querySelectorAll('figure').length, 0)
    assert.match(dom.textContent, /kunne ikke hentes|Henter|ikke klar endnu/)
  }
  const empty = model(props({ fremgangLogs: [] }), now)
  assert.deepEqual(empty.insights, []); assert.ok(empty.lifts.every(l => l.delta === null))
  assert.match(view(props({ fremgangLogs: [] })).textContent, /Din udvikling kommer frem/)
  assert.equal(model(props(), '2026-02-30').state, 'error')
})

test('rich histories produce 2–3 descriptive insights with periods and measured evidence', () => {
  const m = model(props(), now)
  assert.equal(m.insights.length, 3)
  assert.ok(m.insights.every(i => i.evidence.includes('2026')))
  assert.match(m.insights[1].evidence, /kg × gentagelser/)
  const stale = model(props({ fremgangLogs: Array.from({ length: 10 }, (_, i) => row(i)) }), now)
  assert.ok(stale.lifts[0].stale)
  assert.equal(stale.insights.length, 1)
})

test('forecast uses the host competition date and existing model; no date or inadequate data stays honest', () => {
  assert.equal(model(props(), now).forecast.status, 'ready')
  assert.equal(model(props(), now).forecast.meetDate, '2026-11-18')
  assert.equal(model(props({ fremgangLogs: [] }), now).forecast.status, 'insufficient')
  for (const competition_date of [undefined, '', '2026-10-01', '2026-02-30']) {
    const m = model(props({ athlete: { id: 'synthetic-a', competition_date } }), now)
    assert.equal(m.forecast, null); assert.match(m.meetMessage, /Intet kommende|ugyldig/)
  }
})

test('a date-only asOf includes the full Danish day; exact instants exclude later sets', () => {
  const logs = [row(25, { logged_at: '2026-11-04T22:30:00Z' })]
  assert.equal(model(props({ fremgangLogs: logs }), '2026-11-04').weeks.at(-1).sets, 1)
  assert.equal(model(props({ fremgangLogs: logs }), now).weeks.at(-1).sets, 0)
  const boundary = model(props({ fremgangLogs: [row(25, { logged_at: '2026-11-01T23:30:00Z' })] }), now)
  assert.equal(boundary.weeks.at(-1).sets, 1)
})

test('distinct historical timestamps on one exercise/day keep all sets without IDs', () => {
  const first = row(25, { logged_at: '2026-11-04T10:00:00Z' })
  const second = { ...first, logged_at: '2026-11-04T10:05:00Z' }
  const third = { ...first, logged_at: '2026-11-04T10:10:00Z', weight: 130 }
  const m = model(props({ fremgangLogs: [first, second, third] }), now)
  assert.equal(m.weeks.at(-1).sets, 3)
  assert.equal(m.weeks.at(-1).tonnage, 1140)
  assert.equal(m.lifts[0].points.at(-1).value, 143)
})

test('longer windows preserve the four-week defaults, ratios and reject unsupported ranges', () => {
  const logs = props().fremgangLogs
  const four = weeklyLoad(logs, now), long = weeklyLoad(logs, now, { weeks: 26 })
  assert.deepEqual(long.weeks.slice(-4), four.weeks)
  assert.equal(long.acuteChronicRatio, four.acuteChronicRatio)
  assert.deepEqual(weeklyIntensity(logs, now, { weeks: 26 }).weeks.slice(-4), weeklyIntensity(logs, now).weeks)
  for (const weeks of [0, 27, 1.5, '26', null]) {
    assert.equal(weeklyLoad(logs, now, { weeks }), null)
    assert.equal(weeklyIntensity(logs, now, { weeks }).ready, false)
  }
  assert.equal(weeklyLoad(logs, now, { weeks: 1 }).chronicLoad, null)
})

test('rendered charts have text equivalents, closed details and no invented intensity references', () => {
  const p = props({ fremgangLogs: props().fremgangLogs.map(({ reference_e1rm, ...r }) => r) })
  const dom = view(p)
  assert.equal(dom.querySelectorAll('[data-history-value]').length, 26)
  assert.equal(dom.querySelectorAll('[data-history-bar]').length, 26)
  assert.ok(dom.querySelectorAll('details').every(d => d.getAttribute('open') === null))
  assert.doesNotMatch(dom.textContent, /ingen gyldige e1RM-referencer|Ingen reference|Sæt ≥80 %/)
  assert.match(dom.textContent, /Blok ukendt|Volumen/)
  assert.equal(dom.querySelectorAll('input').length, 0)
})

test('OFF reads no data and rendering frozen snapshots performs no mutation or callbacks', () => {
  for (const entropi2 of [undefined, false, 1, 'true']) assert.equal(DevelopmentView({ entropi2,
    get now() { throw Error('OFF clock') }, get athlete() { throw Error('OFF data') } }), null)
  const p = props(), before = JSON.stringify(p)
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  freeze(p); view(p); assert.equal(JSON.stringify(p), before)
})
