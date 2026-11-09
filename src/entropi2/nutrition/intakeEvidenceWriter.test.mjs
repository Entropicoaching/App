import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood, FOODS } from '../kostplan/foedevarer/catalog.mjs'
import { foodPortion } from './controller.mjs'
import { createIntakeEvidenceRequest, readIntakeEvidence } from './intakeEvidence.mjs'
import { createIntakeEvidenceWriter } from './intakeEvidenceWriter.mjs'

const id = n => `91ac0000-1111-4222-8333-${String(n).padStart(12, '0')}`
const athleteId = id(1), ownerId = id(2), requestId = id(3), date = '2026-11-09'
const food = createFood({ id: 'synthetic:writer:v1', name: 'Synthetic transport reference', preparation: 'raw',
  nutrientsPer100g: { energyKcal: 123.4, proteinG: 10, carbohydrateG: 12, fatG: 0, ironMg: 2, calciumMg: 0 },
  source: { citation: 'Synthetic test only', verification: 'user-reported, unverified' } })
const input = (patch = {}) => ({ athleteId, date, requestId, grams: 125.25, meal: 'Synthetic decimal portion', food, ...patch })
function pair(raw = input()) {
  const r = createIntakeEvidenceRequest(raw), n = r.food.nutrientsPer100g
  // Use the existing product portion calculation, never a mock nutrient algorithm.
  const portion = foodPortion({ name: r.food.name, kcal100: n.energyKcal, protein100: n.proteinG,
    carb100: n.carbohydrateG, fat100: n.fatG }, r.grams)
  const values = Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(k => [k, portion[k]]))
  const mealLog = { id: r.requestId, athlete_id: r.athleteId, date: r.date, meal: r.meal, ...values }
  const evidence = { meal_log_id: r.requestId, request_id: r.requestId, athlete_id: r.athleteId,
    date: r.date, version: r.version, food: r.food, grams: r.grams, meal: r.meal, ...values, created_at: '2026-11-09T12:00:00Z' }
  assert.ok(readIntakeEvidence(mealLog, evidence, { athleteId: r.athleteId, date: r.date }))
  return { data: { mealLog, evidence }, error: null }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(transport = async () => pair()) {
  const calls = []
  const client = { rpc(name, args) { calls.push({ name, args, bytes: JSON.stringify(args.p_request) }); return transport(name, args) } }
  let ctx = { enabled: true, writable: true, ownerId, athleteId, date, generation: 1, client }
  const writer = createIntakeEvidenceWriter({ enabled: true, client, getCurrentContext: () => ctx })
  return { writer, client, calls, change(patch) { ctx = { ...ctx, ...patch } } }
}

test('OFF never reads client, callback, input or food getters', async () => {
  const options = { enabled: false, get client() { assert.fail('OFF client getter') },
    get getCurrentContext() { assert.fail('OFF callback getter') } }
  const raw = { get food() { assert.fail('OFF food getter') } }
  const w = createIntakeEvidenceWriter(options)
  for (const v of [w.prepare(raw), await w.submit(raw), await w.retry(), w.snapshot(), w.dispose()]) assert.deepEqual(v, { status: 'off' })
})

test('initial model and athlete/day validation: zero RPC, including actual frozen catalogue food', async () => {
  const f = fixture()
  for (const raw of [input({ grams: 0 }), input({ requestId: 'x' }), input({ date: '2026-02-30' }),
    input({ date: '2026-11-08' }), input({ athleteId: id(88) }), input({ grams: '1' }),
    input({ food: { ...food, extra: true } }), input({ meal: '[appData2-day-v1]receipt' })]) {
    assert.equal((await f.writer.submit(raw)).status, 'invalid')
  }
  assert.equal(f.calls.length, 0)
  const actual = Object.freeze(input({ food: FOODS[0] }))
  assert.equal(f.writer.prepare(actual).status, 'prepared')
  assert.ok(Object.isFrozen(FOODS[0].nutrientsPer100g))
  assert.equal(f.calls.length, 0)
})

test('exact echo success, SQL JSON key ordering, repeated submit and same pending operation', async () => {
  const d = deferred(), f = fixture(() => d.promise), raw = input()
  const a = f.writer.submit(raw), b = f.writer.submit(input())
  assert.strictEqual(a, b)
  await Promise.resolve()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].name, 'record_meal_intake_evidence_v1')
  assert.deepEqual(Object.keys(f.calls[0].args), ['p_request'])
  const reply = pair(raw)
  reply.data.evidence.food = Object.fromEntries(Object.entries(reply.data.evidence.food).reverse())
  d.resolve(reply)
  const result = await a
  assert.equal(result.status, 'success')
  assert.deepEqual(result.value, readIntakeEvidence(reply.data.mealLog, reply.data.evidence, { athleteId, date }))
  assert.equal(result.value.nutrients.calciumMg, 0)
  assert.equal(result.value.nutrients.magnesiumMg, null)
  assert.equal((await f.writer.submit(input())).status, 'success')
  assert.equal((await f.writer.retry()).status, 'success')
  assert.equal(f.calls.length, 1)
  assert.ok(Object.isFrozen(result.value.food.source))
})

test('caller mutation during pending cannot change payload, expected echo or retained retry bytes', async () => {
  const d = deferred(), f = fixture(() => d.promise), raw = structuredClone(input()), original = structuredClone(raw)
  const pending = f.writer.submit(raw)
  raw.requestId = id(55); raw.grams = 88; raw.meal = 'mutated'; raw.food.source.citation = 'mutated'
  raw.food.nutrientsPer100g.calciumMg = null
  await Promise.resolve()
  const sent = f.calls[0].args.p_request
  assert.deepEqual(sent, createIntakeEvidenceRequest(original))
  assert.ok(Object.isFrozen(sent.food.nutrientsPer100g))
  assert.throws(() => { sent.food.source.citation = 'transport mutation' }, TypeError)
  d.resolve(pair(original))
  assert.equal((await pending).status, 'success')
})

test('foreign valid or malformed reply is uncertain; complete request and IDs must match', async () => {
  const variants = [
    () => pair(input({ requestId: id(9) })), () => pair(input({ athleteId: id(9) })),
    () => pair(input({ date: '2026-11-08' })), () => pair(input({ grams: 125.26 })),
    () => pair(input({ meal: 'Foreign meal' })),
    () => pair(input({ food: createFood({ ...food, source: { ...food.source, citation: 'Foreign source' } }) })),
    () => pair(input({ food: createFood({ ...food, preparation: 'cooked' }) })),
    () => pair(input({ food: createFood({ ...food, nutrientsPer100g: { ...food.nutrientsPer100g, calciumMg: null } }) })),
    () => ({ data: null }), () => { const p = pair(); p.data.evidence.request_id = id(7); return p },
    () => { const p = pair(); p.data.mealLog.date = new Date(date); return p },
  ]
  for (const make of variants) {
    const f = fixture(async () => make()), s = await f.writer.submit(input())
    assert.equal(s.status, 'uncertain'); assert.equal(s.value, undefined)
    assert.equal(s.mayHaveCommitted, true)
    assert.equal((await f.writer.submit(input({ requestId: id(10) }))).status, 'blocked')
    assert.equal(f.calls.length, 1)
  }
})

test('lost response retains exact immutable UUID/bytes; retry is explicit, never automatic', async () => {
  let attempts = 0
  const f = fixture(async () => { if (++attempts === 1) throw new Error('synthetic private transport error'); return pair() })
  assert.equal((await f.writer.submit(input())).status, 'uncertain')
  assert.equal((await f.writer.submit(input())).status, 'uncertain')
  for (const patch of [{ grams: 126 }, { food: createFood({ ...food, name: 'Changed' }) }, { date: '2026-11-08' }])
    assert.equal(f.writer.prepare(input(patch)).status, 'conflict')
  assert.equal(f.writer.prepare(input({ requestId: id(10) })).status, 'blocked')
  assert.equal(f.calls.length, 1)
  assert.equal((await f.writer.retry()).status, 'success')
  assert.strictEqual(f.calls[0].args.p_request, f.calls[1].args.p_request)
  assert.equal(f.calls[0].bytes, f.calls[1].bytes)
  assert.equal(f.calls[1].args.p_request.requestId, requestId)
})

test('known outcome allows new UUID, never changed reuse of any previous UUID', async () => {
  const f = fixture(async (_name, { p_request: r }) => pair(input({ requestId: r.requestId })))
  assert.equal((await f.writer.submit(input())).status, 'success')
  assert.equal(f.writer.prepare(input({ grams: 125.26 })).status, 'conflict')
  assert.equal((await f.writer.submit(input({ requestId: id(4) }))).status, 'success')
  assert.equal(f.writer.prepare(input({ grams: 125.26 })).status, 'conflict')
  assert.equal(f.calls.length, 2)
})

test('definitive SQL codes and synthetic missing-contract metadata are distinct and private', async () => {
  for (const [code, status] of [['23505', 'conflict'], ['42501', 'denied'], ['PGRST202', 'unavailable'],
    ['42P01', 'unavailable'], ['42883', 'unavailable'], ['XX000', 'uncertain']]) {
    const f = fixture(async () => ({ data: null, error: { code, message: 'private food/error must not escape' } }))
    const s = await f.writer.submit(input())
    assert.equal(s.status, status)
    assert.equal(JSON.stringify(s).includes('private'), false)
    assert.equal(s.mayHaveCommitted, status === 'uncertain')
    assert.equal(f.calls.length, 1)
  }
  let attempts = 0
  const f = fixture(async () => { if (++attempts === 1) throw Error('lost'); return { error: { code: '42501' } } })
  await f.writer.submit(input())
  assert.equal((await f.writer.retry()).status, 'denied')
  assert.equal(f.writer.snapshot().mayHaveCommitted, true, 'denial cannot erase earlier possible commit')
  assert.equal(f.writer.prepare(input({ requestId: id(4) })).status, 'blocked')
})

test('owner/athlete/day/generation/client/capability changes retire before RPC and after await', async () => {
  const changes = [{ ownerId: id(90) }, { athleteId: id(90) }, { date: '2026-11-08' }, { generation: 2 },
    { client: { rpc() { assert.fail('replacement client invoked') } } }, { writable: false }, { enabled: false }, { future: true }]
  for (const patch of changes) {
    const d = deferred(), f = fixture(() => d.promise)
    f.writer.prepare(input()); f.change(patch)
    assert.equal((await f.writer.submit()).status, 'retired'); assert.equal(f.calls.length, 0)
    const g = fixture(() => d.promise), callback = g.writer.retry, pending = g.writer.submit(input())
    await Promise.resolve(); assert.equal(g.calls.length, 1)
    g.change(patch); d.resolve(pair())
    const retired = await pending
    assert.deepEqual(retired, { status: 'retired', mayHaveCommitted: true })
    assert.deepEqual(g.writer.snapshot(), retired)
    assert.deepEqual(await callback(), retired)
    assert.equal(g.calls.length, 1)
  }
})

test('snapshot/retry detects stale context, captured callbacks and dispose reveal no payload', async () => {
  const f = fixture(async () => { throw Error('lost') })
  await f.writer.submit(input()); f.change({ generation: 2 })
  assert.deepEqual(f.writer.snapshot(), { status: 'retired', mayHaveCommitted: true })
  f.change({ generation: 1 })
  assert.equal((await f.writer.retry()).status, 'retired')
  assert.equal(f.calls.length, 1)
  const d = deferred(), g = fixture(() => d.promise), pending = g.writer.submit(input())
  await Promise.resolve(); g.writer.dispose(); d.resolve(pair())
  assert.deepEqual(await pending, { status: 'retired', mayHaveCommitted: true })
  assert.equal((await g.writer.submit(input())).status, 'retired')
  const h = fixture(); const p = h.writer.submit(input()); h.writer.dispose()
  assert.deepEqual(await p, { status: 'retired', mayHaveCommitted: false }); assert.equal(h.calls.length, 0)
})
