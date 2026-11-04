import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteExport, createAthleteExportFiles } from './athleteExport.mjs'
import { downloadAthleteExport } from './downloadExport.mjs'
import { dayReceipt } from '../../mealEvidence.mjs'

const athleteId = 'synthetic-athlete'
const own = row => ({ athlete_id: athleteId, ...row })
const source = rows => ({ athleteId, state: 'ready', complete: true, rows })
const input = () => ({ athleteId,
  exerciseLogs: source([own({ id: 'set-1', logged_at: '2026-11-03T23:30:00Z',
    exercise_id: 'exercise-1', exercises: { name: 'Bænkpres', secret: 'PRIVATE' },
    set_number: 1, weight: 0, reps_completed: 8, rpe_actual: 0, skipped: false,
    note: 'Roligt, "godt"\nNæste sæt', secret: 'PRIVATE' })]),
  mealLogs: source([own({ id: 'meal-1', date: '2026-11-03', meal: 'Grød æøå',
    kcal: 0, protein: '12,5', carb: 40, fat: null, secret: 'PRIVATE' })]),
  weightLogs: source([own({ id: 'weight-1', logged_at: '2026-11-03', weight: '82.50' })]),
})

// Independent CSV reader: supports quoted newlines/commas/quotes and CRLF.
function readCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if (char === '\r' && text[i + 1] === '\n' && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = ''; i++
    } else cell += char
  }
  assert.equal(quoted, false)
  return rows
}

test('JSON contains actual own set/meal/weight values, units and no extra fields', () => {
  const data = input(), before = JSON.stringify(data)
  const [file] = createAthleteExportFiles(data, 'json')
  const result = JSON.parse(file.content)
  assert.equal(result.schema, 'entropi-athlete-export/v1')
  assert.deepEqual(result.datasets.training[0], {
    log_id: 'set-1', logged_at: '2026-11-03T23:30:00Z', exercise_id: 'exercise-1',
    exercise: 'Bænkpres', set_number: 1, weight_kg: 0, reps_completed: 8,
    rpe_planned: null, rpe_actual: 0, skipped: false, note: 'Roligt, "godt"\nNæste sæt',
  })
  assert.deepEqual(result.datasets.nutrition[0], { log_id: 'meal-1', date: '2026-11-03',
    meal: 'Grød æøå', kcal: 0, protein_g: '12,5', carbs_g: 40, fat_g: null })
  assert.equal(result.datasets.weight[0].weight_kg, '82.50')
  assert.ok(!file.content.includes('PRIVATE'))
  assert.ok(!file.content.includes(athleteId))
  assert.equal(JSON.stringify(data), before)
})

test('all three datasets filter foreign, missing owner and unpersisted rows', () => {
  const data = input()
  for (const key of ['exerciseLogs', 'mealLogs', 'weightLogs']) {
    const original = data[key].rows[0]
    data[key].rows.push(null, [], { ...original, athlete_id: 'synthetic-other' },
      { ...original, athlete_id: undefined }, { ...original, _optimistic: true },
      { ...original, pending: true })
  }
  for (const rows of Object.values(buildAthleteExport(data).datasets)) assert.equal(rows.length, 1)
})

test('missing identity, stale identity, incomplete, loading, failed or absent sources reject', () => {
  for (const bad of [undefined, null, '', ' ', 123]) {
    assert.throws(() => buildAthleteExport({ ...input(), athleteId: bad }), TypeError)
  }
  for (const key of ['exerciseLogs', 'mealLogs', 'weightLogs']) {
    for (const change of [null, {}, { state: 'loading' }, { state: 'error' },
      { complete: false }, { rows: null }, { athleteId: 'synthetic-stale' }]) {
      const data = input()
      data[key] = change === null ? null : { ...data[key], ...change }
      // {} is a valid no-op, all other variants must reject.
      if (change && Object.keys(change).length === 0) data[key] = {}
      assert.throws(() => buildAthleteExport(data), TypeError)
    }
  }
})

test('ready empty datasets have JSON arrays and CSV headers even without rows', () => {
  const data = { athleteId, exerciseLogs: source([]), mealLogs: source([]), weightLogs: source([]) }
  assert.deepEqual(buildAthleteExport(data).datasets, { training: [], nutrition: [], weight: [] })
  const files = createAthleteExportFiles(data, 'csv')
  assert.equal(files.length, 3)
  for (const file of files) { assert.equal(readCsv(file.content).length, 1); assert.ok(file.content.startsWith('\uFEFF')) }
})

test('CSV roundtrips Danish characters, quotes, multiline notes, zeros and column widths', () => {
  const files = createAthleteExportFiles(input(), 'csv')
  assert.deepEqual(files.map(f => f.filename), [
    'entropi-egne-traening.csv', 'entropi-egne-kost.csv', 'entropi-egne-vaegt.csv',
  ])
  const [headers, values] = readCsv(files[0].content)
  assert.equal(values[headers.indexOf('note')], 'Roligt, "godt"\nNæste sæt')
  assert.equal(values[headers.indexOf('exercise')], 'Bænkpres')
  assert.equal(values[headers.indexOf('weight_kg')], '0')
  assert.equal(values[headers.indexOf('skipped')], 'false')
  for (const file of files) {
    const [head, ...rows] = readCsv(file.content)
    for (const row of rows) assert.equal(row.length, head.length)
  }
})

test('CSV neutralizes formula strings including leading whitespace; JSON preserves originals', () => {
  const attacks = ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\r=1', '\n=1', '\uFEFF=1']
  for (const attack of attacks) {
    const data = input()
    data.exerciseLogs.rows[0].note = attack
    data.mealLogs.rows[0].meal = attack
    const files = createAthleteExportFiles(data, 'csv')
    for (const [index, column] of [[0, 'note'], [1, 'meal']]) {
      const [head, row] = readCsv(files[index].content)
      assert.equal(row[head.indexOf(column)], "'" + attack)
    }
    assert.equal(JSON.parse(createAthleteExportFiles(data, 'json')[0].content).datasets.training[0].note, attack)
  }
})

test('raw logs preserve repeats, skipped sets, missing measurements and numeric negatives', () => {
  const data = input()
  data.exerciseLogs.rows.push(own({ id: 'skip', skipped: true, weight: -1 }))
  data.weightLogs.rows.push({ ...data.weightLogs.rows[0] })
  const result = buildAthleteExport(data)
  assert.equal(result.datasets.training[1].skipped, true)
  assert.equal(result.datasets.training[1].reps_completed, null)
  assert.equal(result.datasets.weight.length, 2)
  const [head, , row] = readCsv(createAthleteExportFiles(data, 'csv')[0].content)
  assert.equal(row[head.indexOf('weight_kg')], '-1')
})

test('actual copied meal receipt producer is excluded from food export', () => {
  const data = input()
  const receipt = dayReceipt(data.mealLogs.rows, '2026-11-03', '2026-11-04')
  assert.ok(receipt)
  data.mealLogs.rows.push(own(receipt))
  assert.equal(buildAthleteExport(data).datasets.nutrition.length, 1)
})

test('unsupported formats and unsupported field values reject without partial file output', () => {
  for (const format of [undefined, 'xml', 'CSV']) assert.throws(() => createAthleteExportFiles(input(), format))
  for (const bad of [Infinity, NaN, {}, [], 1n]) {
    const data = input(); data.weightLogs.rows[0].weight = bad
    assert.throws(() => createAthleteExportFiles(data, 'json'), TypeError)
    assert.throws(() => createAthleteExportFiles(data, 'csv'), TypeError)
  }
})

function browserFixture(fail = '') {
  const events = [], timers = []
  const anchor = { click() { events.push('click'); if (fail === 'click') throw Error('click failed') },
    remove() { events.push('remove') } }
  const runtime = {
    Blob,
    URL: { createObjectURL(blob) { events.push(blob); return 'blob:synthetic' },
      revokeObjectURL(url) { events.push(['revoke', url]) } },
    document: { body: { appendChild(a) { assert.equal(a, anchor); events.push('append') } },
      createElement(tag) { assert.equal(tag, 'a'); if (fail === 'create') throw Error('create failed'); return anchor } },
    setTimeout(fn, delay) { if (fail === 'timer') throw Error('timer failed'); assert.equal(delay, 1000); timers.push(fn) },
  }
  return { runtime, events, timers, anchor }
}

test('download builds the exact local Blob, clicks once, removes anchor and revokes later', async () => {
  const fixture = browserFixture(), file = createAthleteExportFiles(input(), 'csv')[0]
  downloadAthleteExport(file, fixture.runtime)
  assert.deepEqual(new Uint8Array(await fixture.events[0].arrayBuffer()), new TextEncoder().encode(file.content))
  assert.equal(fixture.events[0].type, file.type)
  assert.equal(fixture.anchor.download, file.filename)
  assert.equal(fixture.anchor.href, 'blob:synthetic')
  assert.deepEqual(fixture.events.slice(1), ['append', 'click', 'remove'])
  assert.equal(fixture.timers.length, 1)
  fixture.timers[0]()
  assert.deepEqual(fixture.events.at(-1), ['revoke', 'blob:synthetic'])
})

test('download cleans up on DOM failure and scheduling failure without leaving real timers', () => {
  const file = createAthleteExportFiles(input(), 'json')[0]
  for (const fail of ['create', 'click', 'timer']) {
    const fixture = browserFixture(fail)
    if (fail === 'timer') downloadAthleteExport(file, fixture.runtime)
    else assert.throws(() => downloadAthleteExport(file, fixture.runtime), /failed/)
    assert.equal(fixture.timers.length, 0)
    assert.equal(fixture.events.filter(e => Array.isArray(e) && e[0] === 'revoke').length, 1)
  }
  assert.throws(() => downloadAthleteExport(file, {}), /browser/)
  assert.throws(() => downloadAthleteExport({ ...file, filename: '../bad.csv' }, {}), TypeError)
})
