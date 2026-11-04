import test from 'node:test'
import assert from 'node:assert/strict'
import { readMonthlyExport, downloadMonthlyExport, createMonthlyExportRequest } from './monthlyDownload.mjs'

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', asOf: '2026-11-04' }
export function fixture(data = {}, errorTable, wait) {
  const calls = []
  return { calls, from(table) {
    const call = { table, orders: [] }; calls.push(call)
    const q = {
      select(value) { call.columns = value; return q },
      eq(key, value) { call.eq = [key, value]; return q },
      gte(key, value) { call.from = [key, value]; return q },
      lt(key, value) { call.until = [key, value]; return q },
      lte(key, value) { call.to = [key, value]; return q },
      order(key) { call.orders.push(key); return q },
      async range(from, to) {
        call.range = [from, to]
        if (wait) await wait
        return table === errorTable ? { error: { message: 'PRIVATE_SENTINEL' } }
          : { data: (data[table] || []).slice(from, to + 1) }
      },
    }; return q
  } }
}
const read = (client, format = 'json') => readMonthlyExport(client, scope, { enabled: true, format })
const row = extra => ({ id: 'synthetic-row', athlete_id: scope.athleteId, ...extra })

test('OFF does not inspect client or scope; invalid scope/format never reads', async () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(await readMonthlyExport(poison, poison), null)
  for (const enabled of [false, 1, 'true']) assert.equal(await readMonthlyExport(poison, poison, { enabled }), null)
  const client = fixture()
  for (const value of [{}, { ...scope, coachId: '' }, { ...scope, asOf: '2026-02-30' }])
    assert.equal((await readMonthlyExport(client, value, { enabled: true })).status, 'error')
  assert.equal((await read(client, 'xml')).status, 'error')
  assert.equal(client.calls.length, 0)
})

test('actual models: four complete scoped sources, 28 completed Danish days, unknown soreness and no cycle', async () => {
  const client = fixture({
    exercise_logs: [row({ logged_at: '2026-11-03T22:30:00Z', weight: 100, reps_completed: 5,
      exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Normal' } } } })],
    meal_logs: [row({ date: '2026-11-03', meal: 'Syntetisk', kcal: 700, protein: 30, carb: 40, fat: 15 })],
    weight_logs: [row({ logged_at: '2026-11-03', weight: 80 })],
    readiness_logs: [row({ logged_date: '2026-11-03', sleep_hours: 7, energy: 4, stress: 2,
      soreness_level: 5, soreness: 10, cycle: 'PRIVATE_SENTINEL', notes: 'PRIVATE_SENTINEL' })],
  })
  const file = await read(client), report = JSON.parse(file.content)
  assert.equal(file.status, 'ready')
  assert.equal(report.from, '2026-10-07'); assert.equal(report.to, '2026-11-03')
  const value = metric => report.records.find(r => r.record_type === 'daily' && r.period_from === report.to && r.metric === metric).value
  assert.equal(value('training_sets'), 1); assert.equal(value('training_volume'), 500)
  assert.equal(value('nutrition_energy'), 700); assert.equal(value('body_weight'), 80)
  assert.equal(value('sleep'), 7); assert.equal(value('energy'), 4); assert.equal(value('stress'), 2)
  assert.equal(value('soreness'), null)
  assert.doesNotMatch(file.content, /PRIVATE_SENTINEL|cycle|soreness_level|notes/)
  assert.equal(client.calls.length, 4)
  for (const call of client.calls) {
    assert.deepEqual(call.eq, ['athlete_id', scope.athleteId])
    assert.deepEqual(call.orders, [call.table === 'exercise_logs' || call.table === 'weight_logs' ? 'logged_at' : call.table === 'meal_logs' ? 'date' : 'logged_date', 'id'])
    assert.doesNotMatch(call.columns, /\*|cycle|consent|notes|soreness/)
  }
})

test('calendar UTC overfetch covers both DST boundaries; current Danish day is excluded by actual models', async () => {
  for (const [asOf, from] of [['2026-03-30', '2026-03-01'], ['2026-10-26', '2026-09-27']]) {
    const client = fixture({ exercise_logs: [row({ logged_at: `${asOf}T00:30:00Z`, weight: 100, reps_completed: 5 })] })
    const file = await readMonthlyExport(client, { ...scope, asOf }, { enabled: true, format: 'json' })
    assert.equal(file.status, 'empty')
    assert.equal(client.calls[0].from[1], `${from}T00:00:00Z`)
    assert.equal(client.calls[0].until[1], `${asOf}T00:00:00Z`)
  }
})

test('empty CSV and JSON remain downloadable with explicit missing data', async () => {
  for (const format of ['csv', 'json']) {
    const file = await read(fixture(), format)
    assert.equal(file.status, 'empty'); assert.ok(file.filename.endsWith('.' + format))
    assert.ok(file.content.length > 1000)
  }
})

test('pagination proves completeness, including an exact full page', async () => {
  for (const size of [500, 501]) {
    const client = fixture({ exercise_logs: Array.from({ length: size }, (_, i) => row({ id: `set-${i}`, logged_at: '2026-11-03', weight: 10, reps_completed: 1 })) })
    assert.equal((await read(client)).status, 'ready')
    assert.deepEqual(client.calls.filter(c => c.table === 'exercise_logs').map(c => c.range), [[0, 499], [500, 999]])
  }
})

test('source errors, duplicate IDs, foreign identities, oversized sources and query rejection fail closed', async () => {
  const bad = [fixture({}, 'meal_logs'),
    fixture({ weight_logs: [row({}), row({})] }),
    fixture({ readiness_logs: [row({ athlete_id: 'synthetic-other' })] }),
    fixture({ meal_logs: Array.from({ length: 10001 }, (_, i) => row({ id: i })) }),
    { from() { throw Error('PRIVATE_SENTINEL') } }]
  for (const client of bad) {
    const file = await read(client)
    assert.equal(file.status, 'error'); assert.equal(file.content, undefined)
    assert.doesNotMatch(file.message, /PRIVATE_SENTINEL/)
  }
})

test('request blocks duplicate clicks, reports loading, and cancels pending downloads after scope changes/OFF', async () => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  const client = fixture({}, null, wait), request = createMonthlyExportRequest(client, scope)
  const states = [], downloads = []
  let current = true
  const options = { isCurrent: () => current, update: value => states.push(value), download: value => downloads.push(value) }
  const pending = request.run('csv', options)
  await request.run('json', options)
  assert.deepEqual(states.map(s => s.status), ['loading']); assert.equal(client.calls.length, 4)
  current = false; request.cancel(); release(); await pending
  assert.equal(downloads.length, 0); assert.equal(states.length, 1)
})

test('request empty/success/failure states and retries use actual serializers', async () => {
  const client = fixture({}, 'meal_logs'), request = createMonthlyExportRequest(client, scope)
  const states = [], downloads = []
  const options = { isCurrent: () => true, update: s => states.push(s), download: f => downloads.push(f) }
  await request.run('csv', options)
  assert.equal(states.at(-1).status, 'error'); assert.equal(downloads.length, 0)
  const okay = createMonthlyExportRequest(fixture(), scope)
  await okay.run('json', options)
  assert.equal(states.at(-1).status, 'empty'); assert.match(states.at(-1).message, /Ingen registreringer/)
  assert.ok(downloads[0].filename.endsWith('.json'))
  await okay.run('csv', { ...options, download() { throw Error('blocked download') } })
  assert.equal(states.at(-1).status, 'error')
})

test('browser adapter creates a local Blob and cleans link/URL on success and click failure', () => {
  for (const throws of [false, true]) {
    const events = [], tasks = []
    const link = { click() { events.push('click'); if (throws) throw Error('blocked') }, remove() { events.push('remove') } }
    const browser = { Blob, document: { body: { appendChild(node) { assert.equal(node, link); events.push('append') } },
      createElement(tag) { assert.equal(tag, 'a'); return link } },
      URL: { createObjectURL(blob) { assert.equal(blob.type, 'text/csv;charset=utf-8'); events.push('blob'); return 'blob:synthetic' },
        revokeObjectURL(url) { assert.equal(url, 'blob:synthetic'); events.push('revoke') } },
      setTimeout(task, delay) { assert.equal(delay, 0); tasks.push(task) } }
    const run = () => downloadMonthlyExport({ status: 'empty', content: 'synthetic', mimeType: 'text/csv;charset=utf-8', filename: 'synthetic.csv' }, browser)
    if (throws) assert.throws(run, /blocked/); else run()
    assert.deepEqual(events, ['blob', 'append', 'click', 'remove'])
    assert.equal(link.href, 'blob:synthetic'); assert.equal(link.download, 'synthetic.csv')
    tasks.forEach(task => task())
    assert.equal(events.at(-1), 'revoke')
  }
  assert.throws(() => downloadMonthlyExport({ status: 'error' }), /No export/)
})
