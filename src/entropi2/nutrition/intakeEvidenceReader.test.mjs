import test from 'node:test'
import assert from 'node:assert/strict'
import { createIntakeEvidenceReader } from './intakeEvidenceReader.mjs'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'
import { createIntakeEvidenceRequest, INTAKE_LIMITS } from './intakeEvidence.mjs'
import { foodPortion } from './controller.mjs'

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const athleteId = id(1), ownerId = id(2), date = '2026-11-09'
const food = createFood({ id: 'synthetic:reader', name: 'Synthetic reference', preparation: 'raw',
  nutrientsPer100g: { energyKcal: 123.4, proteinG: 10, carbohydrateG: 12, fatG: 0, ironMg: 2, calciumMg: 0 },
  source: { citation: 'Synthetic fixture only', verification: 'unverified user reference' } })
function pair(n = 10) {
  const r = createIntakeEvidenceRequest({ athleteId, date, requestId: id(n), grams: 125.25, meal: 'Synthetic portion', food })
  const p = foodPortion({ name: r.food.name, kcal100: 123.4, protein100: 10, carb100: 12, fat100: 0 }, r.grams)
  const values = Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(k => [k, p[k]]))
  return { parent: { id: r.requestId, athlete_id: athleteId, date, meal: r.meal, ...values },
    evidence: { meal_log_id: r.requestId, request_id: r.requestId, athlete_id: athleteId, date, version: 1,
      food: r.food, grams: r.grams, meal: r.meal, ...values, created_at: '2026-11-09T12:00:00+00:00' } }
}
const clone = value => JSON.parse(JSON.stringify(value))
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

// A thin Data API executor: the reader's exact select/filters/order/range are
// executed against synthetic JSON rows. No fake summary or food interpretation.
function fixture({ pairs = [pair()], legacy = [], intercept = null } = {}) {
  const tables = { meal_logs: [...pairs.map(p => clone(p.parent)), ...clone(legacy)],
    meal_intake_evidence_v1: pairs.map(p => clone(p.evidence)) }
  const calls = []
  const client = { from(table) {
    assert.ok(Object.hasOwn(tables, table))
    const query = { table, filters: [], orders: [] }
    const api = {
      select(columns, options) { query.columns = columns; query.options = options; return api },
      eq(key, value) { query.filters.push([key, value]); return api },
      order(key, options) { query.orders.push([key, options]); return api },
      async range(start, end) {
        Object.assign(query, { start, end }); calls.push(query)
        assert.deepEqual(query.filters, [['athlete_id', athleteId], ['date', date]])
        assert.deepEqual(query.options, { count: 'exact' })
        assert.deepEqual(query.orders, [[table === 'meal_logs' ? 'id' : 'meal_log_id', { ascending: true }]])
        assert.ok(end - start < 500 && start >= 0 && end <= INTAKE_LIMITS.rows)
        assert.ok(!query.columns.includes('*'))
        let selected = tables[table].filter(row => query.filters.every(([key, value]) => row[key] === value))
        const key = query.orders[0][0]
        selected = [...selected].sort((a, b) => a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0)
        const result = { data: selected.slice(start, end + 1).map(row => Object.fromEntries(query.columns.split(',').map(k => [k, clone(row[k])]))),
          error: null, count: selected.length }
        return intercept ? await intercept(query, result, tables, calls) : result
      },
    }
    return api
  } }
  let current = { enabled: true, ownerId, athleteId, date, generation: 1, client }
  const reader = createIntakeEvidenceReader({ ...current, getCurrentScope: () => current })
  return { reader, client, tables, calls, setScope: patch => { current = { ...current, ...patch } } }
}
const unknown = result => {
  assert.equal(result.summary, null)
  assert.deepEqual([result.mealLogs, result.evidenceRows, result.entries], [[], [], []])
}

test('OFF never reads client or current-scope options, including dispose/load/snapshot', async () => {
  let reads = 0
  const options = { enabled: false }
  for (const key of ['client', 'ownerId', 'athleteId', 'date', 'generation', 'getCurrentScope'])
    Object.defineProperty(options, key, { get() { reads++; throw new Error('must not read') } })
  const reader = createIntakeEvidenceReader(options)
  assert.equal(reader.snapshot().status, 'off'); assert.equal((await reader.load()).status, 'off')
  reader.dispose(); assert.equal((await reader.load()).status, 'off'); assert.equal(reads, 0)
})

test('invalid initial and current scopes, retired and disposed instances make no I/O', async () => {
  for (const patch of [{ ownerId: null }, { athleteId: 'bad' }, { date: '2026-02-30' }, { generation: -1 }, { client: {} }]) {
    let calls = 0
    const reader = createIntakeEvidenceReader({ enabled: true, ownerId, athleteId, date, generation: 0,
      client: { from() { calls++; throw new Error() } }, getCurrentScope() { calls++; throw new Error() }, ...patch })
    assert.equal((await reader.load()).status, 'invalid-scope'); assert.equal(calls, 0)
  }
  const f = fixture(); f.setScope({ enabled: false })
  assert.equal((await f.reader.load()).status, 'retired'); assert.equal(f.calls.length, 0)
  f.setScope({ enabled: true }); assert.equal((await f.reader.load()).status, 'retired')
  const g = fixture(); g.reader.dispose(); assert.equal((await g.reader.load()).status, 'disposed'); assert.equal(g.calls.length, 0)
})

test('actual model: known reference, genuine zero, null, provenance and caller/transport mutation', async () => {
  const f = fixture(), result = await f.reader.load()
  assert.equal(result.status, 'ready'); assert.equal(f.calls.length, 3)
  assert.equal(result.summary.nutrients.ironMg.total, 2.505)
  assert.equal(result.summary.nutrients.calciumMg.total, 0)
  assert.equal(result.summary.nutrients.magnesiumMg.total, null)
  assert.equal(result.entries[0].referenceKind, 'user-reported-reference')
  assert.deepEqual(result.entries[0].food.source, food.source)
  assert.throws(() => { result.evidenceRows[0].food.source.citation = 'mutated' }, TypeError)
  assert.throws(() => { result.summary.nutrients.ironMg.total = 999 }, TypeError)
  assert.throws(() => { result.mealLogs.push(pair().parent) }, TypeError)
  f.tables.meal_logs[0].meal = 'transport mutation'
  f.tables.meal_intake_evidence_v1[0].food.source.citation = 'transport mutation'
  assert.equal(f.reader.snapshot().summary.nutrients.ironMg.total, 2.505)
  assert.equal(result.entries[0].food.source.citation, food.source.citation)
})

test('legacy macro-only food stays unknown; day receipts excluded by actual model; empty is not zero', async () => {
  const legacy = { ...pair(11).parent, meal: 'Legacy macro-only' }
  const receipt = { ...pair(12).parent, meal: '[appData2-day-v1]receipt' }
  const f = fixture({ legacy: [legacy, receipt] }), result = await f.reader.load()
  assert.equal(result.status, 'ready'); assert.equal(result.summary.recordedRows, 2)
  assert.equal(result.summary.nutrients.ironMg.total, null)
  assert.equal(result.summary.nutrients.ironMg.knownSubtotal, 2.505)
  assert.equal(result.summary.nutrients.ironMg.unknownRows, 1)
  const empty = await fixture({ pairs: [] }).reader.load()
  assert.equal(empty.status, 'ready'); assert.equal(empty.summary.nutrients.calciumMg.total, null)
  assert.equal(empty.summary.nutrients.ironMg.state, 'no-recorded-food')
})

for (const n of [499, 500, 1000, 1001]) test('bounded actual pagination, row count ' + n, async () => {
  const pairs = Array.from({ length: n }, (_, i) => pair(i + 10)).reverse()
  const f = fixture({ pairs }), result = await f.reader.load()
  assert.equal(result.status, n > 1000 ? 'incomplete' : 'ready')
  if (n <= 1000) {
    assert.equal(result.summary.recordedRows, n)
    assert.equal(result.summary.nutrients.calciumMg.total, 0)
    assert.equal(f.calls.length, 3 * (n === 499 ? 1 : n === 500 ? 2 : 3))
    assert.deepEqual(result.mealLogs.map(r => r.id), pairs.map(p => p.parent.id).sort())
  } else { unknown(result); assert.equal(result.reason, 'row-limit'); assert.equal(f.calls.length, 3) }
})

test('foreign athlete/day, malformed JSON/shape, numeric strings, duplicate/conflicting identities rejected', async () => {
  for (const change of [r => { r.data[0].athlete_id = id(99) }, r => { r.data[0].date = '2026-11-08' },
    r => { r.data[0].kcal = '1' }, r => { r.data[0].extra = true }, r => { r.data = null },
    r => { r.data[0].meal = new Date() }, r => { r.count = null },
    r => { r.data.push({ ...r.data[0], kcal: 99 }); r.count = 2 }]) {
    const f = fixture({ intercept(q, r) { if (q.table === 'meal_logs') change(r); return r } })
    const result = await f.reader.load(); assert.equal(result.status, 'incomplete'); unknown(result)
  }
  const f = fixture({ intercept(q, r) {
    if (q.table !== 'meal_logs') { r.data.push({ ...r.data[0], grams: 77 }); r.count++ }
    return r
  } })
  assert.equal((await f.reader.load()).status, 'incomplete')
})

test('malformed evidence is rejected before ready, semantic validation uses original reader', async () => {
  for (const change of [r => { r.food.nutrientsPer100g.ironMg = '2' }, r => { r.grams = '125.25' },
    r => { r.created_at = '2026-02-30T00:00:00Z' }, r => { r.request_id = id(999) }, r => { r.food = null }]) {
    const f = fixture({ intercept(q, r) { if (q.table !== 'meal_logs') change(r.data[0]); return r } })
    const result = await f.reader.load(); assert.equal(result.status, 'incomplete'); unknown(result)
  }
})

test('partial pages, silent backend cap, no progress and changing exact count cannot claim ready', async () => {
  for (const mode of ['partial', 'cap', 'repeat', 'count']) {
    const f = fixture({ pairs: Array.from({ length: 501 }, (_, i) => pair(10 + i)), intercept(q, r, tables) {
      if (q.table === 'meal_logs') {
        if (mode === 'partial' && q.start === 0) r.data.pop()
        if (mode === 'cap' && q.start === 0) r.data = r.data.slice(0, 100)
        if (mode === 'repeat' && q.start === 500) r.data = [clone(tables.meal_logs[0])]
        if (mode === 'count' && q.start === 500) r.count++
      }
      return r
    } })
    const result = await f.reader.load(); assert.equal(result.status, 'incomplete', mode); unknown(result)
    assert.ok(f.calls.length <= 2)
  }
})

test('missing table/function, backend errors, rejected network and unsuccessful refresh expose no old total', async () => {
  for (const code of ['42P01', '42883', 'PGRST202', 'PGRST205', '42501', '500', 'throw']) {
    let failing = false
    const f = fixture({ intercept(q, r) {
      if (failing && q.table !== 'meal_logs') {
        if (code === 'throw') throw new Error('synthetic raw/user information must not escape')
        return { data: null, error: { code, message: 'synthetic raw detail' }, count: null }
      }
      return r
    } })
    assert.equal((await f.reader.load()).status, 'ready'); failing = true
    const pending = f.reader.load(); assert.equal(f.reader.snapshot().status, 'loading'); unknown(f.reader.snapshot())
    const result = await pending
    assert.equal(result.status, ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code) ? 'unavailable' : 'error')
    unknown(result); assert.ok(!JSON.stringify(result).includes('synthetic raw'))
  }
})

test('final current parents govern edit/delete/new row, never old cached parents', async () => {
  for (const action of ['edit', 'delete', 'new']) {
    const f = fixture({ intercept(q, r, tables) {
      if (q.table !== 'meal_logs') {
        if (action === 'edit') tables.meal_logs[0].meal = 'Edited normal parent'
        if (action === 'delete') tables.meal_logs.length = 0
        if (action === 'new') tables.meal_logs.push({ ...pair(12).parent, meal: 'New legacy row' })
      }
      return r
    } })
    const result = await f.reader.load(); assert.equal(result.status, 'ready')
    assert.equal(result.summary.nutrients.ironMg.total, null)
    assert.equal(result.summary.recordedRows, action === 'delete' ? 0 : action === 'new' ? 2 : 1)
    if (action === 'edit') assert.equal(result.entries[0], null)
    if (action === 'delete') assert.equal(result.entries.length, 0)
  }
})

test('incomplete final parent reload returns no model, including new rows beyond cap', async () => {
  for (const mode of ['partial', 'oversize']) {
    const f = fixture({ intercept(q, r, tables, calls) {
      if (q.table !== 'meal_logs' && mode === 'oversize') tables.meal_logs = Array.from({ length: 1001 }, (_, i) => pair(10 + i).parent)
      if (q.table === 'meal_logs' && calls.some(c => c.table !== 'meal_logs') && mode === 'partial') r.count++
      return r
    } })
    const result = await f.reader.load(); assert.equal(result.status, 'incomplete'); unknown(result)
  }
})

test('one in-flight operation coalesces double click and copies pages before next await', async () => {
  const gate = defer(), entered = defer(); let response
  const f = fixture({ intercept: async (q, r) => {
    if (q.table !== 'meal_logs') { response = r; entered.resolve(); await gate.promise }
    return r
  } })
  const first = f.reader.load(), second = f.reader.load()
  assert.equal(first, second); await entered.promise
  assert.equal(f.calls.length, 2); assert.equal(f.reader.snapshot().status, 'loading')
  gate.resolve(); const result = await first
  response.data[0].food.source.citation = 'mutation after load'
  assert.equal(result.status, 'ready'); assert.equal(f.calls.length, 3)
  assert.equal(result.entries[0].food.source.citation, food.source.citation)
})

for (const field of ['ownerId', 'athleteId', 'date', 'client', 'generation', 'enabled', 'dispose'])
  for (const stage of ['parent-page', 'evidence', 'final-parent']) test('deferred stale ' + field + ' during ' + stage, async () => {
    const gate = defer(), entered = defer()
    const f = fixture({ pairs: Array.from({ length: 501 }, (_, i) => pair(10 + i)), intercept: async (q, r, tables, calls) => {
      const hit = stage === 'parent-page' ? q.table === 'meal_logs' && q.start === 500
        : stage === 'evidence' ? q.table !== 'meal_logs'
          : q.table === 'meal_logs' && calls.some(c => c.table !== 'meal_logs')
      if (hit) { entered.resolve(); await gate.promise }
      return r
    } })
    const pending = f.reader.load(); await entered.promise
    const count = f.calls.length
    if (field === 'dispose') f.reader.dispose()
    else f.setScope({ [field]: { ownerId: id(8), athleteId: id(9), date: '2026-11-10', client: { from() { throw new Error() } }, generation: 2, enabled: false }[field] })
    gate.resolve(); const result = await pending
    assert.equal(result.status, field === 'dispose' ? 'disposed' : 'retired'); unknown(result)
    assert.equal(f.calls.length, count); assert.equal((await f.reader.load()).status, result.status)
    assert.equal(f.calls.length, count)
  })

test('snapshot invalidates an old ready payload on scope change, future date remains read-only capability', async () => {
  const f = fixture(); assert.equal((await f.reader.load()).status, 'ready')
  f.setScope({ generation: 2 }); assert.equal(f.reader.snapshot().status, 'retired'); unknown(f.reader.snapshot())
  const current = { enabled: true, ownerId, athleteId, date: '2099-01-01', generation: 0, client: {
    from() { return { select() { return this }, eq() { return this }, order() { return this }, range() { return Promise.resolve({ data: [], error: null, count: 0 }) } } },
  } }
  const reader = createIntakeEvidenceReader({ ...current, getCurrentScope: () => current })
  assert.equal((await reader.load()).status, 'ready'); reader.dispose()
})
