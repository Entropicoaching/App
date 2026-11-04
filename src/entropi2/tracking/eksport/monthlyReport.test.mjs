import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachMonthlyReport, exportCoachMonthlyReport } from './monthlyReport.mjs'
import { addCalendarDays } from '../../../calendarDate.js'

const id = 'synthetic-athlete'
const date = i => addCalendarDays('2026-10-08', i)
const fixture = () => ({ status: 'ready', complete: true, athleteId: id, endDate: date(27),
  exerciseLogs: [], mealRows: [], weightRows: [], dailyRows: [] })
const set = (i, extra = {}) => ({ athlete_id: id, id: `set-${i}`, logged_at: date(i),
  exercise_id: 'synthetic-squat', set_number: 1, weight: 100, reps_completed: 5,
  exercises: { name: 'Squat' }, ...extra })
const meal = (i, extra = {}) => ({ athlete_id: id, date: date(i), meal: 'Syntetisk måltid',
  kcal: 1000, protein: 50, carb: 100, fat: 20, ...extra })
const build = input => buildCoachMonthlyReport(input, { enabled: true })
const output = (input, format = 'csv') => exportCoachMonthlyReport(input, { enabled: true, format })
const daily = (report, metric, day = date(0)) => report.records.find(row =>
  row.record_type === 'daily' && row.metric === metric && row.period_from === day)

// Independent RFC4180 reader, including escaped quotes and embedded newlines.
function readCsv(content) {
  const rows = [], row = []
  let field = '', quoted = false
  const text = content.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (c === ',' || c === '\r')) {
      row.push(field); field = ''
      if (c === '\r') { assert.equal(text[++i], '\n'); rows.push([...row]); row.length = 0 }
    } else field += c
  }
  assert.equal(quoted, false)
  assert.equal(field, '')
  return rows
}

test('default/OFF reads neither snapshot nor format and requires literal true', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 'true', 1]) {
    assert.equal(buildCoachMonthlyReport(poison, { enabled }), null)
    assert.equal(exportCoachMonthlyReport(poison, { enabled, get format() { throw Error('format read') } }), null)
  }
  assert.equal(exportCoachMonthlyReport(poison, null), null)
})

test('loading, fetch errors and incomplete reads cannot create files', () => {
  for (const status of ['loading', 'error', 'ready']) {
    const input = { status, complete: false, get dailyRows() { throw Error('payload read') } }
    const result = output(input)
    assert.equal(result.status, status === 'loading' ? 'loading' : 'error')
    assert.ok(!('content' in result))
  }
  assert.equal(output(null).status, 'error')
  assert.equal(output(fixture(), 'xml').status, 'error')
})

test('empty is downloadable but never claims zero training or zero bodyweight', () => {
  const report = build(fixture())
  assert.equal(report.status, 'empty')
  assert.equal(report.from, date(0)); assert.equal(report.to, date(27))
  assert.equal(report.records.length, 28 * 9 + 4 * 9)
  assert.ok(report.records.filter(r => r.record_type === 'daily').every(r => r.value === null))
  assert.ok(report.records.filter(r => r.record_type === 'data_basis').every(r => r.observed_days === 0 && r.expected_days === 7))
  assert.equal(output(fixture()).status, 'empty')
  assert.equal(JSON.parse(output(fixture(), 'json').content).status, 'empty')
})

test('actual copied models expose training, volume, e1RM, nutrition, weight, daily scores and basis', () => {
  const input = fixture()
  input.exerciseLogs = [set(0)]
  input.mealRows = [meal(0), meal(0)]
  input.weightRows = [{ athlete_id: id, logged_at: date(0), weight: 80 }]
  input.dailyRows = [{ athlete_id: id, source: 'athlete_manual', logged_date: date(0),
    sleep_hours: 0, energy: 3, stress: 4, soreness: 0 }]
  const report = build(input)
  assert.equal(report.status, 'ready')
  for (const [metric, value, unit] of [['training_sets', 1, 'sets'], ['training_volume', 500, 'kg_reps'],
    ['nutrition_energy', 2000, 'kcal'], ['nutrition_protein', 100, 'g'], ['body_weight', 80, 'kg'],
    ['sleep', 0, 'hours'], ['energy', 3, 'score_1_to_5'], ['stress', 4, 'score_1_to_5'], ['soreness', 0, 'score_0_to_10']]) {
    assert.equal(daily(report, metric).value, value)
    assert.equal(daily(report, metric).unit, unit)
    assert.equal(daily(report, metric).observed_days, 1)
    assert.equal(daily(report, metric, date(1)).value, null)
    const basis = report.records.find(r => r.record_type === 'data_basis' && r.metric === metric)
    assert.equal(basis.observed_days, 1); assert.equal(basis.expected_days, 7)
  }
  const strength = report.records.find(r => r.record_type === 'strength')
  assert.equal(strength.exercise, 'Squat')
  assert.equal(strength.value, 100 * (1 + 5 / 30))
  assert.equal(strength.period_from, date(0))
  assert.equal(strength.period_to, '2026-10-11')
  assert.match(strength.rule, /Epley/)
})

test('all 28 days retained at midweek end; per-metric basis counts distinct known dates', () => {
  const input = fixture()
  input.mealRows = Array.from({ length: 28 }, (_, i) => meal(i))
  const report = build(input)
  const days = report.records.filter(r => r.record_type === 'daily' && r.metric === 'nutrition_energy')
  assert.deepEqual(days.map(r => r.period_from), Array.from({ length: 28 }, (_, i) => date(i)))
  assert.ok(days.every(r => r.value === 1000))
  assert.deepEqual(report.records.filter(r => r.record_type === 'data_basis' && r.metric === 'nutrition_energy')
    .map(r => r.observed_days), [7, 7, 7, 7])
})

test('bounds, Danish DST date, partial weeks and separated strength variants', () => {
  const input = fixture()
  input.exerciseLogs = [set(-1, { weight: 1000 }), set(28, { weight: 2000 }), set(0),
    set(17, { logged_at: '2026-10-24T23:30:00Z', exercises: { name: 'Bænkpres' } }),
    set(27, { exercises: { name: 'Sumo dødløft' } })]
  input.mealRows = [-1, 28].map(i => meal(i))
  const report = build(input)
  assert.equal(daily(report, 'training_sets', '2026-10-25').value, 1)
  assert.equal(daily(report, 'training_sets', '2026-10-24').value, null)
  assert.ok(report.records.every(r => r.period_from >= date(0) && r.period_to <= date(27)))
  const strength = report.records.filter(r => r.record_type === 'strength')
  assert.deepEqual(strength.map(r => r.exercise).sort(), ['Bænkpres', 'Squat', 'Sumo dødløft'])
  assert.ok(strength.every(r => r.value < 200))
  assert.equal(strength.find(r => r.exercise === 'Sumo dødløft').period_to, date(27))
  assert.ok(report.records.filter(r => r.metric === 'nutrition_energy').every(r => r.value === null))
})

test('invalid/missing measurements stay null while real nutrition zero survives', () => {
  const input = fixture()
  input.exerciseLogs = [set(0, { weight: null })]
  input.mealRows = [meal(0, { kcal: 0, protein: 0 }), meal(1, { kcal: null })]
  input.weightRows = [{ athlete_id: id, logged_at: date(0), weight: -1 }]
  input.dailyRows = [{ athlete_id: id, source: 'athlete_manual', logged_date: date(0),
    energy: 1.5, sleep_hours: Infinity, soreness_level: 5 }]
  const report = build(input)
  assert.equal(daily(report, 'training_sets').value, 1)
  for (const metric of ['training_volume', 'body_weight', 'energy', 'sleep', 'soreness']) assert.equal(daily(report, metric).value, null)
  assert.equal(daily(report, 'nutrition_energy').value, 0)
  assert.equal(daily(report, 'nutrition_energy', date(1)).value, null)
  assert.ok(!output(input, 'json').content.includes('Infinity'))
})

test('deduplicated, conflicting, skipped, optimistic and deload sets keep existing rules', () => {
  const input = fixture(), row = set(0)
  input.exerciseLogs = [row, { ...row }, set(1, { skipped: true }), set(2, { _optimistic: true }),
    set(3, { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } })]
  let report = build(input)
  assert.equal(daily(report, 'training_sets').value, 1)
  assert.equal(daily(report, 'training_sets', date(1)).value, null)
  assert.equal(daily(report, 'training_sets', date(2)).value, null)
  assert.equal(daily(report, 'training_sets', date(3)).value, 1)
  assert.equal(report.records.filter(r => r.record_type === 'strength').length, 1)
  input.exerciseLogs.push({ ...row, weight: 120 })
  report = build(input)
  assert.equal(daily(report, 'training_sets').value, null)
  assert.equal(report.records.filter(r => r.record_type === 'strength').length, 0)
})

test('mixed identities, sparse collections, wrong provenance and duplicate daily records fail closed', () => {
  for (const key of ['exerciseLogs', 'mealRows', 'weightRows', 'dailyRows']) {
    for (const rows of [undefined, {}, [null], [[]], new Array(2), [{ athlete_id: 'other' }], [{ user_id: id }]]) {
      assert.equal(output({ ...fixture(), [key]: rows }).status, 'error')
    }
  }
  const row = { athlete_id: id, source: 'device', logged_date: date(0), energy: 3 }
  assert.equal(output({ ...fixture(), dailyRows: [row] }).status, 'error')
  row.source = 'athlete_manual'
  assert.equal(output({ ...fixture(), dailyRows: [row, row] }).status, 'error')
  const weight = { athlete_id: id, logged_at: date(0), weight: 80 }
  assert.equal(output({ ...fixture(), weightRows: [weight, weight] }).status, 'error')
})

test('bad cutoff and unrepresentable dates cannot fall back to clock', () => {
  for (const endDate of [undefined, '', '2026-02-30', '2026-11-04T12:00:00Z', '0000-01-01']) {
    assert.equal(output({ ...fixture(), endDate }).status, 'error')
  }
})

test('CSV round trip matches JSON rows, with explicit headers, empty null, UTF-8 and safe filename', () => {
  const input = fixture(); input.exerciseLogs = [set(0, { exercises: { name: 'Bænkpres' } })]
  const json = output(input, 'json'), csv = output(input)
  assert.equal(json.mimeType, 'application/json;charset=utf-8')
  assert.equal(csv.mimeType, 'text/csv;charset=utf-8')
  assert.equal(csv.filename, `coach-4-weeks-${date(0)}-${date(27)}.csv`)
  assert.ok(csv.content.startsWith('\uFEFF'))
  const [headers, ...rows] = readCsv(csv.content)
  assert.deepEqual(headers, ['record_type', 'athlete_id', 'period_from', 'period_to', 'metric', 'exercise',
    'value', 'unit', 'observed_days', 'expected_days', 'rule'])
  const report = JSON.parse(json.content)
  assert.equal(report.timeZone, 'Europe/Copenhagen')
  assert.equal(rows.length, report.records.length)
  rows.forEach((row, i) => assert.deepEqual(row, headers.map(key => report.records[i][key] === null
    ? '' : String(report.records[i][key]))))
})

test('CSV quotes embedded delimiters/newlines and neutralizes formula strings; JSON preserves exact identity', () => {
  for (const athleteId of ['=1+1', ' +1', '-1', '@SUM(A1)', '\tformula', 'synthetic,"id\r\ncontinued']) {
    const input = { ...fixture(), athleteId }
    const [headers, first] = readCsv(output(input).content)
    const expected = /^[\s]*[=+\-@]|^[\t\r\n]/.test(athleteId) ? `'${athleteId}` : athleteId
    assert.equal(first[headers.indexOf('athlete_id')], expected)
    assert.equal(JSON.parse(output(input, 'json').content).athleteId, athleteId)
    assert.equal(output(input).filename, `coach-4-weeks-${date(0)}-${date(27)}.csv`)
  }
})

test('cycle, notes, names, auth and metadata never escape; frozen inputs and outputs are independent', () => {
  const input = fixture()
  input.exerciseLogs = [set(0, { note: 'PRIVATE_SENTINEL', cycle: 'PRIVATE_SENTINEL' })]
  input.mealRows = [meal(0, { note: 'PRIVATE_SENTINEL' })]
  input.dailyRows = [{ athlete_id: id, source: 'athlete_manual', logged_date: date(0), energy: 3 }]
  for (const target of [input, input.dailyRows[0], input.exerciseLogs[0], input.mealRows[0]]) {
    for (const key of ['cycleData', 'menstruation', 'athleteName', 'auth']) {
      Object.defineProperty(target, key, { enumerable: true, get() { throw Error('private read') } })
    }
    Object.freeze(target)
  }
  for (const rows of [input.exerciseLogs, input.mealRows, input.dailyRows, input.weightRows]) Object.freeze(rows)
  const csv = output(input), json = output(input, 'json')
  assert.equal(csv.status, 'ready'); assert.equal(json.status, 'ready')
  assert.doesNotMatch(csv.content + json.content, /PRIVATE_SENTINEL|cycle|menstruation|athleteName|auth/)
  const report = build(input); report.records[0].value = 999
  assert.equal(daily(build(input), 'training_sets').value, 1)
})
