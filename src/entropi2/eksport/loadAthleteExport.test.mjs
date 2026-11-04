import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAthleteExport } from './loadAthleteExport.mjs'
import { createAthleteExportFiles } from './athleteExport.mjs'
const scope = () => ({ enabled: true, athleteId: 'fixture-athlete', ownerId: 'fixture-user', athleteUserId: 'fixture-user' })
function fixture(reply) {
  const calls = []
  return { calls, client: { from(table) {
    const call = { table }; calls.push(call)
    const query = {
      select(value) { call.columns = value; return query },
      eq(key, value) { assert.equal(key, 'athlete_id'); assert.equal(value, 'fixture-athlete'); return query },
      order(key, value) { assert.equal(key, 'id'); assert.deepEqual(value, { ascending: true }); return query },
      range(start, end) { assert.equal(end - start, 499); call.start = start; return reply(call) },
    }
    return query
  } } }
}
test('actual loader reads all pages of all datasets and feeds existing JSON/CSV exporters', async () => {
  const f = fixture(({ table, start }) => ({ data: start === 0 ? Array.from({ length: 500 }, (_, i) =>
    ({ id: `${table}-${i}`, athlete_id: 'fixture-athlete', weight: i, secret: 'OMIT' })) : [] }))
  const input = await loadAthleteExport({ client: f.client, getScope: scope })
  assert.equal(input.ownerId, 'fixture-user')
  assert.equal(f.calls.length, 6)
  for (const key of ['exerciseLogs', 'mealLogs', 'weightLogs']) {
    assert.equal(input[key].rows.length, 500); assert.equal(input[key].complete, true)
  }
  assert.equal(JSON.parse(createAthleteExportFiles(input, 'json')[0].content).datasets.weight.length, 500)
  assert.equal(createAthleteExportFiles(input, 'csv').length, 3)
  assert.ok(!createAthleteExportFiles(input, 'json')[0].content.includes('OMIT'))
})
test('empty is a complete successful export, never confused with a read failure', async () => {
  const f = fixture(() => ({ data: [] }))
  const input = await loadAthleteExport({ client: f.client, getScope: scope })
  assert.deepEqual(JSON.parse(createAthleteExportFiles(input, 'json')[0].content).datasets,
    { training: [], nutrition: [], weight: [] })
  assert.equal(f.calls.length, 3)
})
test('OFF, preview/foreign owner and missing identity perform zero client reads', async () => {
  for (const change of [{ enabled: false }, { enabled: 'true' }, { athleteId: '' }, { ownerId: '' }, { athleteUserId: 'foreign' }]) {
    const f = fixture(() => assert.fail('forbidden read'))
    await assert.rejects(loadAthleteExport({ client: f.client, getScope: () => ({ ...scope(), ...change }) }))
    assert.equal(f.calls.length, 0)
  }
})
test('identity changes or closing during an awaited read rejects without further pages', async () => {
  for (const change of [{ enabled: false }, { athleteId: 'other' }, { ownerId: 'other' }, { athleteUserId: 'other' }]) {
    let current = scope()
    const f = fixture(async () => { current = { ...current, ...change }; return { data: [] } })
    await assert.rejects(loadAthleteExport({ client: f.client, getScope: () => current }))
    assert.equal(f.calls.length, 1)
  }
})
test('failure on any dataset rejects the entire export, including a missing or malformed response', async () => {
  for (const table of ['exercise_logs', 'meal_logs', 'weight_logs']) {
    for (const bad of [{ data: [], error: { message: 'fixture failure' } }, { data: null },
      { data: [{ id: 'x', athlete_id: 'foreign' }] }, { data: [{ athlete_id: 'fixture-athlete' }] }]) {
      const f = fixture(call => call.table === table ? bad : { data: [] })
      await assert.rejects(loadAthleteExport({ client: f.client, getScope: scope }))
    }
  }
})
test('repeated pages and thrown reads do not produce a falsely complete snapshot', async () => {
  const row = { id: 'same', athlete_id: 'fixture-athlete' }
  const f = fixture(() => ({ data: Array(500).fill(row) }))
  await assert.rejects(loadAthleteExport({ client: f.client, getScope: scope }))
  const thrown = fixture(() => { throw Error('fixture transport') })
  await assert.rejects(loadAthleteExport({ client: thrown.client, getScope: scope }), /fixture transport/)
})
