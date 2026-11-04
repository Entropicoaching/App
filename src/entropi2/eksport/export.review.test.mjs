// Separate adversarial checks of the public API, without the producer fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { buildAthleteExport, createAthleteExportFiles } from './athleteExport.mjs'
import { downloadAthleteExport } from './downloadExport.mjs'

const current = 'synthetic-current'
const ready = rows => ({ athleteId: current, state: 'ready', complete: true, rows })
const empty = () => ({ athleteId: current, exerciseLogs: ready([]), mealLogs: ready([]), weightLogs: ready([]) })
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('review: importing actual copied modules is inert with all browser/service access trapped', () => {
  const urls = ['./athleteExport.mjs', './downloadExport.mjs'].map(path => new URL(path, import.meta.url).href)
  const script = `
    for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'location', 'fetch', 'WebSocket', 'XMLHttpRequest']) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('unexpected access: ' + key) } })
    }
    for (const url of ${JSON.stringify(urls)}) await import(url)
    console.log('inert import PASS')
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'inert import PASS')
})

test('review: current athletes.id is required even if row id matches user_id', () => {
  const data = empty()
  data.weightLogs.rows = [{ athlete_id: 'synthetic-user-id', weight: 999 },
    { athlete_id: current, weight: 74.2, logged_at: '2026-10-20' }]
  freeze(data)
  const exported = buildAthleteExport(data)
  assert.deepEqual(exported.datasets.weight, [{ log_id: null, logged_at: '2026-10-20', weight_kg: 74.2 }])
  exported.datasets.weight[0].weight_kg = 1
  assert.equal(data.weightLogs.rows[1].weight, 74.2)
})

test('review: planned reps never replace absent measured reps; note and RPE origin stay explicit', () => {
  const data = empty()
  data.exerciseLogs.rows = [{ athlete_id: current, exercises: { name: 'Squat', reps: 10 },
    rpe_planned: 8, note: '=SUM(A1)', coach_note: 'PRIVATE' }]
  const row = buildAthleteExport(data).datasets.training[0]
  assert.equal(row.reps_completed, null)
  assert.equal(row.rpe_actual, null)
  assert.equal(row.rpe_planned, 8)
  assert.equal(row.note, '=SUM(A1)')
  for (const file of createAthleteExportFiles(freeze(data), 'csv')) assert.ok(!file.content.includes('PRIVATE'))
})

test('review: all textual CSV columns neutralize a formula and quote delimiter/CRLF payloads', () => {
  const data = empty(), payload = ' \uFEFF@SUM(1,2)\r\n"injected",cell'
  data.weightLogs.rows = [{ athlete_id: current, id: payload, logged_at: payload, weight: payload }]
  const file = createAthleteExportFiles(data, 'csv')[2]
  const escaped = '"\'' + payload.replaceAll('"', '""') + '"'
  assert.equal(file.content, '\uFEFF"log_id","logged_at","weight_kg"\r\n' + [escaped, escaped, escaped].join(',') + '\r\n')
})

test('review: removal failure still schedules release of the allocated object URL', () => {
  const file = createAthleteExportFiles(empty(), 'json')[0]
  const timers = [], revoked = []
  const anchor = { click() {}, remove() { throw Error('remove failed') } }
  const runtime = { Blob, document: { body: { appendChild() {} }, createElement: () => anchor },
    URL: { createObjectURL: () => 'blob:review', revokeObjectURL: url => revoked.push(url) },
    setTimeout: fn => timers.push(fn) }
  assert.throws(() => downloadAthleteExport(file, runtime), /remove failed/)
  assert.equal(timers.length, 1)
  timers[0]()
  assert.deepEqual(revoked, ['blob:review'])
})
