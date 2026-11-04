import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisModel } from './analysisModel.mjs'
import { adaptPublicContract } from './publicContract.mjs'
import { weekOverview, bestWeeklySet } from './weekOverview.mjs'
import { fourWeekHistory } from './fourWeekHistory.mjs'
import Analysis from './testRender.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const dates = ['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-03']
const log = (day, weight = 100, name = 'Squat', reps_completed = 3, extra = {}) => ({
  exercise_id: `${name}-${day}`, logged_at: `${day}T10:00:00Z`, weight, reps_completed,
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
const props = fremgangLogs => ({ entropi2: true, now, fremgangLogs })
const model = logs => analysisModel(props(logs), now).fourWeekHistory
const squat = logs => model(logs).lifts[0]

test('history: zero, one, two and four recorded weeks retain four positions and null gaps', () => {
  for (const indexes of [[], [3], [0, 3], [0, 1, 2, 3]]) {
    const row = squat(indexes.map(i => log(dates[i], 100 + i * 5)))
    assert.equal(row.points.length, 4)
    assert.deepEqual(row.points.map(p => p.value), dates.map((_, i) => indexes.includes(i) ? (100 + i * 5) * 1.1 : null))
    assert.equal(row.points[0].start, '2026-10-12')
    assert.equal(row.points[3].end, '2026-11-08')
    if (indexes.length === 0) assert.match(row.summary, /^Ingen sammenlignelige/)
    if (indexes.length === 1) assert.match(row.summary, /^Kun én uge/)
    if (indexes.length >= 2) assert.equal(row.summary, 'Op ca. 16,5 kg e1RM fra ugen 12.10.2026 til ugen 02.11.2026.')
  }
})

test('history: neutral increase, decrease, stable, rounded stable and actual observed dates', () => {
  for (const [weight, expected] of [[110, 'Op ca. 11 kg'], [90, 'Ned ca. 11 kg'], [100, 'Stabilt e1RM'], [100.01, 'Stabilt e1RM']]) {
    const row = squat([log(dates[1], 100), log(dates[3], weight)])
    assert.ok(row.summary.startsWith(expected), row.summary)
    assert.match(row.summary, /fra ugen 19.10.2026 til ugen 02.11.2026/)
    assert.equal(row.points[0].value, null)
    assert.equal(row.points[2].value, null)
    assert.doesNotMatch(row.summary, /parat|årsag|form|over 4 uger/i)
  }
})

test('history: all four main lifts are separate, no-data lifts remain empty and variants excluded', () => {
  const logs = ['Back squat', 'Bench top set', 'Deadlift', 'Sumo deadlift'].map((name, i) => log(dates[i], 100, name))
  logs.push(log(dates[3], 999, 'Front squat'))
  const rows = model(logs).lifts
  assert.deepEqual(rows.map(r => r.lift), ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
  rows.forEach((row, i) => assert.deepEqual(row.points.map(p => p.value), dates.map((_, j) => j === i ? 110.00000000000001 : null)))
  assert.ok(model([log(dates[3])]).lifts[1].points.every(p => p.value === null))
})

test('history: decimals, mixed reps and multiple sets match each weekly overview exactly', () => {
  const logs = dates.flatMap(day => [log(day, '102,5'), log(day, 100, 'Squat', 6, { logged_at: `${day}T11:00:00Z` })])
  const row = squat(logs)
  row.points.forEach((point, i) => {
    const dayNow = new Date(`${dates[i]}T22:00:00Z`)
    const contract = adaptPublicContract(props(logs), dayNow)
    const overview = weekOverview(contract, dayNow).lifts[0]
    assert.equal(point.value, 120)
    assert.equal(overview.value, '120 kg e1RM')
    assert.equal(bestWeeklySet(contract.rows, 'Squat', point.start, point.end).value, point.value)
  })
  assert.equal(squat([log(dates[3], '102,5')]).points[3].value, 112.75000000000001)
  assert.deepEqual(model(logs), model([...logs].reverse()))
})

test('history: Danish Monday boundaries in winter, summer and year rollover', () => {
  for (const [instant, previous, current, monday] of [
    ['2026-11-01T23:30:00Z', '2026-11-01T22:59:59Z', '2026-11-01T23:00:00Z', '2026-11-02'],
    ['2026-07-05T22:30:00Z', '2026-07-05T21:59:59Z', '2026-07-05T22:00:00Z', '2026-07-06'],
    ['2026-01-04T23:30:00Z', '2026-01-04T22:59:59Z', '2026-01-04T23:00:00Z', '2026-01-05'],
  ]) {
    const logs = [previous, current].map((logged_at, i) => log('2026-01-01', 100 + i * 10, 'Squat', 3, { exercise_id: String(i), logged_at }))
    const row = analysisModel({ fremgangLogs: logs }, new Date(instant)).fourWeekHistory.lifts[0]
    assert.equal(row.points[3].start, monday)
    assert.equal(row.points[2].value, 110.00000000000001)
    assert.equal(row.points[3].value, 121.00000000000001)
  }
})

test('history: loading, absent history and invalid date never present invented values', () => {
  for (const extra of [{ fremgangLoading: true }, { fremgangLogs: undefined }]) {
    const row = analysisModel({ ...props([log(dates[3])]), ...extra }, now).fourWeekHistory.lifts[0]
    assert.ok(row.points.every(p => p.value === null))
    assert.match(row.summary, /ikke klar/)
  }
  assert.deepEqual(fourWeekHistory(adaptPublicContract({}, new Date('invalid'))).lifts, [])
})

test('history: optimistic, skipped, light, unknown-block, deload, future and outside-window sets stay out', () => {
  for (const bad of [log(dates[3], 999, 'Squat', 3, { _optimistic: true }),
    log(dates[3], 999, 'Squat', 3, { skipped: true }), log(dates[3], 999, 'Squat backoff'),
    log('2026-10-11', 999), log('2026-11-05', 999),
    ...['', 'Deload', 'Taper', 'Aflastning'].map(block_name => log(dates[3], 999, 'Squat', 3,
      { exercises: { name: 'Squat', sessions: { weeks: { block_name } } } }))]) {
    assert.ok(squat([bad]).points.every(p => p.value === null))
  }
})

test('history: local undo, frozen inputs and strict OFF preserve behavior', () => {
  const currentWeek = { start_date: '2026-11-02', block_name: 'Styrke', sessions: [{ exercises: [{ id: 'sq', name: 'Squat', sets: 1 }] }] }
  const p = { ...props([log(dates[3], 200, 'Squat', 3, { exercise_id: 'sq' })]), currentWeek, exerciseLogs: [] }
  assert.equal(analysisModel(p, now).fourWeekHistory.lifts[0].points[3].value, null)
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  const before = JSON.stringify(p); freeze(p); Analysis(p); assert.equal(JSON.stringify(p), before)
  assert.equal(Analysis({ entropi2: false, get now() { throw Error('OFF read') }, get fremgangLogs() { throw Error('OFF read') } }), null)
})

// The requested 26-week view replaces the old four-week graph. The pure
// fourWeekHistory contract above remains unchanged for existing consumers.
test('history DOM: long-term development replaces the four-week graph above folded reports', () => {
  const dom = Analysis(props([log(dates[0], 100), log(dates[3], '102,5')]))
  const history = dom.querySelectorAll('[data-analysis-history]')[0]
  assert.equal(dom.querySelectorAll('h2')[0].textContent, 'Din udvikling')
  assert.equal(history.querySelectorAll('[data-history-bar]').length, 2)
  assert.equal(history.querySelectorAll('[data-history-value]').length, 26)
  assert.equal(history.querySelectorAll('[data-history-value]').filter(n => n.textContent.includes('Ingen sammenlignelige data')).length, 24)
  assert.match(history.textContent, /112,8 kg e1RM/)
  assert.match(history.textContent, /for lidt data/)
  assert.doesNotMatch(dom.textContent, /De seneste 4 uger/)
  const secondary = dom.querySelectorAll('[data-analysis-secondary]')[0]
  assert.equal(secondary.getAttribute('open'), null)
  assert.equal(secondary.querySelectorAll('[data-entropi2-ugerapport]').length, 1)
})

test('history DOM: gaps, short histories, loading and missing snapshots are honest', () => {
  for (const count of [0, 1, 2, 4]) {
    const history = Analysis(props(dates.slice(0, count).map(day => log(day))))
      .querySelectorAll('[data-development]')[0]
    assert.equal(history.querySelectorAll('[data-history-bar]').length, count)
    assert.equal(history.querySelectorAll('[data-history-value]').length, count === 0 ? 0 : 26)
    assert.equal(history.querySelectorAll('[data-history-summary]').length, count === 0 ? 0 : 1)
  }
  for (const extra of [{ fremgangLoading: true }, { fremgangLogs: undefined }]) {
    const history = Analysis({ ...props([log(dates[3])]), ...extra }).querySelectorAll('[data-development]')[0]
    assert.equal(history.querySelectorAll('[data-history-bar]').length, 0)
    assert.equal(history.querySelectorAll('[data-history-value]').length, 0)
    assert.match(history.textContent, /Henter|løftehistorikken mangler/)
  }
})
