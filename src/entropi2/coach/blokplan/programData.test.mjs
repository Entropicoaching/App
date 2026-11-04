import test from 'node:test'
import assert from 'node:assert/strict'
import { readBlockBasis, readComparison, saveProgramDraft, programDraftKey, PROGRAM_READ_CAP } from './programData.mjs'
import { suggestBlock } from './blockPlan.mjs'
import { compareWeeks } from '../sammenlign/compareWeeks.mjs'
import { fixture as blockFixture, today } from '../planlaegning/syntheticFixture.mjs'
import { fixture as compareFixture, today as compareToday } from '../sammenlign/syntheticFixture.mjs'
import { rpeNote } from '../../../rpeEvidence.mjs'

export function fakeClient(tables, calls = []) {
  return { from(table) {
    const call = { table, filters: [] }; calls.push(call)
    const query = {
      select(columns) { call.columns = columns; return query },
      eq(...args) { call.filters.push(['eq', ...args]); return query },
      gte(...args) { call.filters.push(['gte', ...args]); return query },
      lte(...args) { call.filters.push(['lte', ...args]); return query },
      lt(...args) { call.filters.push(['lt', ...args]); return query },
      order(field) { call.order = field; return query },
      limit(cap) { call.cap = cap; return query },
      then(resolve, reject) { return Promise.resolve().then(() => {
        const value = tables[table]
        if (value instanceof Error) throw value
        return Array.isArray(value) ? { data: value, error: null } : value
      }).then(resolve, reject) },
    }
    return query
  } }
}
const blockTables = () => {
  const snapshot = blockFixture()
  return { weeks: snapshot.plan.rows.map((row, i) => ({ ...row, id: `w${i}`, week_number: i + 1 })), exercise_logs: snapshot.logs.rows }
}

test('OFF reads no client, dates, identity or periods', async () => {
  const options = { enabled: false }
  for (const key of ['client', 'athleteId', 'today', 'first', 'second']) Object.defineProperty(options, key, { get() { throw Error('OFF access') } })
  assert.equal(await readBlockBasis(options), null)
  assert.equal(await readComparison(options), null)
})

test('actual copied block model receives complete scoped plan and logs only after successful bounded reads', async () => {
  const calls = [], tables = blockTables(), before = JSON.stringify(tables)
  const snapshot = await readBlockBasis({ enabled: true, client: fakeClient(tables, calls), athleteId: 'synthetic-athlete', today })
  const model = suggestBlock(snapshot, today)
  assert.equal(model.state, 'ready'); assert.equal(model.weeks.length, 4)
  assert.equal(snapshot.weights, undefined)
  assert.ok(calls.every(c => c.cap === PROGRAM_READ_CAP && c.filters.some(f => f[0] === 'eq' && f[1] === 'athlete_id' && f[2] === 'synthetic-athlete')))
  assert.ok(calls.every(c => !c.columns.includes('rpe_source')))
  assert.equal(JSON.stringify(tables), before)
})

test('empty plan is honest unknown; error, truncation, foreign rows and date gaps cannot become complete', async () => {
  const options = { enabled: true, athleteId: 'synthetic-athlete', today }
  const empty = await readBlockBasis({ ...options, client: fakeClient({ weeks: [] }) })
  assert.equal(suggestBlock(empty, today).state, 'unknown')
  for (const weeks of [new Error('synthetic failure'), { error: { message: 'synthetic' }, data: [] },
    Array.from({ length: PROGRAM_READ_CAP }, () => ({})), [{ athlete_id: 'other' }]])
    await assert.rejects(readBlockBasis({ ...options, client: fakeClient({ weeks }) }))
  const tables = blockTables(); tables.weeks[1].start_date = '2026-10-10'
  await assert.rejects(readBlockBasis({ ...options, client: fakeClient(tables) }), /huller eller overlap/)
  const malformed = blockTables(); malformed.exercise_logs[0].logged_at = null
  await assert.rejects(readBlockBasis({ ...options, client: fakeClient(malformed) }), /ugyldig dato/)
})

test('two explicit periods reach the actual comparison model; timestamps filtered by Copenhagen day', async () => {
  const f = compareFixture(), calls = []
  const stored = row => {
    const { rpe_source, ...fields } = row
    return { ...fields, note: rpeNote(fields.note, fields, rpe_source === 'athlete') }
  }
  const tables = { exercise_logs: [...f.first.training.rows, ...f.second.training.rows].map(stored),
    meal_logs: [...f.first.nutrition.rows, ...f.second.nutrition.rows], weight_logs: [...f.first.weight.rows, ...f.second.weight.rows] }
  const snapshot = await readComparison({ enabled: true, client: fakeClient(tables, calls), athleteId: f.athleteId,
    today: compareToday, first: f.first.start, second: f.second.start })
  assert.deepEqual(compareWeeks(snapshot, compareToday), compareWeeks(f, compareToday))
  assert.equal(calls.length, 6)
  assert.ok(calls.every(c => !c.columns.includes('rpe_source')))
  assert.ok(calls.every(c => c.filters.some(f => f[0] === 'eq' && f[1] === 'athlete_id')))
  assert.ok(calls.filter(c => c.table !== 'meal_logs').every(c => c.filters.some(f => f[0] === 'lt')))
  await assert.rejects(readComparison({ enabled: true, client: fakeClient(tables), athleteId: f.athleteId,
    today: compareToday, first: f.second.start, second: f.first.start }), /datoorden/)
})

test('comparison errors never become zero totals', async () => {
  const f = compareFixture()
  await assert.rejects(readComparison({ enabled: true, athleteId: f.athleteId, today: compareToday,
    first: f.first.start, second: f.second.start,
    client: fakeClient({ exercise_logs: [], meal_logs: new Error('synthetic'), weight_logs: [] }) }))
})

test('save writes only one new namespace key and propagates storage failure', () => {
  const writes = [], storage = { setItem: (...args) => writes.push(args) }
  saveProgramDraft(storage, 'synthetic:athlete', 'block', { weeks: [] })
  assert.deepEqual(writes, [[programDraftKey('synthetic:athlete', 'block'), '{"weeks":[]}']])
  assert.match(writes[0][0], /^entropi2:coach-program:v1:synthetic%3Aathlete:block$/)
  assert.throws(() => saveProgramDraft(storage, 'synthetic', 'unknown', {}))
  assert.throws(() => saveProgramDraft(storage, 'synthetic', 'program', 'x'.repeat(400001)))
  assert.throws(() => saveProgramDraft({ setItem() { throw Error('quota') } }, 'synthetic', 'block', {}), /quota/)
})
