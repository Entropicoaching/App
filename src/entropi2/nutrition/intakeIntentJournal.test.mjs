import test from 'node:test'
import assert from 'node:assert/strict'
import { FRIDA_FOODS } from '../kostplan/foedevarer/frida55.mjs'
import { createIntakeEvidenceRequest, readIntakeEvidence } from './intakeEvidence.mjs'
import { foodPortion } from './controller.mjs'
import { createIntakeIntentJournal, INTAKE_INTENT_JOURNAL_BYTES } from './intakeIntentJournal.mjs'

export const id = n => `91ac0000-1111-4222-8333-${String(n).padStart(12, '0')}`
export const input = (patch = {}) => ({ athleteId: id(1), date: '2026-11-09', requestId: id(3),
  grams: 125.25, meal: 'Synthetic journal portion', food: FRIDA_FOODS[0], ...patch })
export const six = r => ({ athleteId: r.athleteId, date: r.date, requestId: r.requestId,
  grams: r.grams, meal: r.meal, food: r.food })
export function pair(raw) {
  const r = createIntakeEvidenceRequest(six(raw)), n = r.food.nutrientsPer100g
  // Same faithful pair fixture as the accepted writer tests, using real product
  // portion calculation. This simulates DataAPI JSON, never a database commit.
  const p = foodPortion({ name: r.food.name, kcal100: n.energyKcal, protein100: n.proteinG,
    carb100: n.carbohydrateG, fat100: n.fatG }, r.grams)
  const values = Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(k => [k, p[k]]))
  const mealLog = { id: r.requestId, athlete_id: r.athleteId, date: r.date, meal: r.meal, ...values }
  const evidence = { meal_log_id: r.requestId, request_id: r.requestId, athlete_id: r.athleteId,
    date: r.date, version: r.version, food: r.food, grams: r.grams, meal: r.meal, ...values,
    created_at: '2026-11-09T12:00:00Z' }
  assert.ok(readIntakeEvidence(mealLog, evidence, { athleteId: r.athleteId, date: r.date }))
  return { data: { mealLog, evidence }, error: null }
}
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export function storageFixture() {
  const data = new Map(), events = []
  const hooks = {}
  const storage = {
    getItem(key) { events.push(['get', key]); return hooks.get ? hooks.get(key, data) : data.get(key) ?? null },
    setItem(key, value) { events.push(['set', key, value]); if (hooks.set) hooks.set(key, value, data); else data.set(key, value) },
    removeItem() { assert.fail('journal must retain same-ID recovery tombstone') },
    get length() { throw Error('no enumeration') }, key() { assert.fail('no enumeration') },
  }
  const tails = new Map()
  const withExclusiveLock = (key, run) => {
    const next = (tails.get(key) ?? Promise.resolve()).then(async () => {
      events.push(['lock-enter', key])
      try { if (hooks.lock) await hooks.lock(); return await run() } finally { events.push(['lock-exit', key]) }
    })
    tails.set(key, next.catch(() => {}))
    return next
  }
  return { storage, withExclusiveLock, data, events, hooks }
}
export function fixture(transport = async (_name, { p_request }) => pair(p_request), shared = storageFixture(), generation = 1) {
  const calls = []
  const client = { rpc(name, args) {
    shared.events.push(['rpc', name]); calls.push({ name, args, bytes: JSON.stringify(args.p_request) })
    return transport(name, args)
  } }
  let ctx = { enabled: true, writable: true, future: false, ownerId: id(2), athleteId: id(1),
    date: '2026-11-09', generation, client }
  const options = { enabled: true, client, getCurrentContext: () => ctx,
    storage: shared.storage, withExclusiveLock: shared.withExclusiveLock }
  const journal = createIntakeIntentJournal(options)
  return { journal, client, calls, shared, options, change(patch) { ctx = { ...ctx, ...patch } } }
}

test('OFF is completely inert, including every options/input/storage/context getter', async () => {
  const options = { enabled: false }
  for (const name of ['client', 'getCurrentContext', 'storage', 'withExclusiveLock'])
    Object.defineProperty(options, name, { get() { throw Error('OFF getter: ' + name) } })
  const poison = new Proxy({}, { get() { throw Error('input getter') }, ownKeys() { assert.fail('input keys') } })
  const j = createIntakeIntentJournal(options)
  for (const result of [j.prepare(poison), j.recover(), j.submit(poison), j.retry(poison),
    j.acknowledge(poison), j.snapshot(), j.dispose()]) assert.deepEqual(await result, { status: 'off' })
})

test('actual model rejects invalid inputs before storage/lock access; 0 RPC', async () => {
  const f = fixture()
  for (const name of ['storage', 'withExclusiveLock']) Object.defineProperty(f.options, name, { get() { throw Error('invalid accesses ' + name) } })
  const bad = [input({ grams: 0 }), input({ grams: '12' }), input({ requestId: 'x' }), input({ version: 1 }),
    input({ athleteId: id(9) }), input({ date: '2026-02-30' }), input({ date: '2026-11-08' }),
    input({ food: { ...FRIDA_FOODS[0], extra: true } }), input({ meal: '[appData2-day-v1]synthetic' })]
  for (const value of bad) assert.equal((await f.journal.prepare(value)).status, 'invalid')
  assert.equal(f.calls.length, 0); assert.equal(f.shared.events.length, 0)
})

test('missing or non-entering exclusive lock fails closed without storage/RPC', async () => {
  for (const lock of [undefined, async () => {}]) {
    const f = fixture(); f.options.withExclusiveLock = lock
    assert.equal((await f.journal.prepare(input())).status, 'lock-required')
    await f.journal.submit(); await f.journal.retry()
    assert.equal(f.shared.events.length, 0); assert.equal(f.calls.length, 0)
  }
})

test('prepare persists canonical Frida request, version and distinct owner; snapshots hide all payload', async () => {
  const f = fixture(), raw = structuredClone(input())
  const pending = f.journal.prepare(raw)
  raw.requestId = id(9); raw.grams = 99; raw.food.source.citation = 'edited'
  const s = await pending
  assert.deepEqual(Object.keys(s).sort(), ['status', 'mayHaveCommitted', 'uncertain', 'requestId'].sort())
  assert.equal(s.status, 'prepared'); assert.equal(s.requestId, id(3))
  const [[key, text]] = [...f.shared.data]
  assert.ok(key.length < 80); assert.ok(!key.includes(id(1)) && !key.includes(id(2)) && !key.includes('2026-11-09'))
  const record = JSON.parse(text)
  assert.equal(record.version, 1); assert.equal(record.ownerId, id(2)); assert.equal(record.athleteId, id(1))
  assert.notEqual(record.ownerId, record.athleteId)
  assert.deepEqual(record.request, createIntakeEvidenceRequest(input()))
  assert.equal(record.attempted, false); assert.equal(f.calls.length, 0)
  assert.ok(new TextEncoder().encode(text).length <= INTAKE_INTENT_JOURNAL_BYTES)
  assert.ok(Object.isFrozen(s)); assert.equal(JSON.stringify(s).includes('food'), false)
})

test('quota, thrown read, silent discard and mismatched readback block all RPC', async () => {
  for (const mode of ['quota', 'read', 'discard', 'mismatch']) {
    const f = fixture()
    if (mode === 'quota') f.shared.hooks.set = () => { throw Error('synthetic quota') }
    if (mode === 'read') f.shared.hooks.get = () => { throw Error('synthetic denied') }
    if (mode === 'discard') f.shared.hooks.set = () => {}
    if (mode === 'mismatch') f.shared.hooks.set = (key, _text, data) => data.set(key, 'foreign')
    assert.equal((await f.journal.prepare(input())).status, 'storage-error', mode)
    await f.journal.submit(); await f.journal.retry()
    assert.equal(f.calls.length, 0, mode)
  }
})

test('same initial request can explicitly repersist after initial storage failure; different UUID blocked', async () => {
  const f = fixture(); f.shared.hooks.set = () => {}
  await f.journal.prepare(input())
  assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
  delete f.shared.hooks.set
  assert.equal((await f.journal.prepare(input())).status, 'prepared')
  assert.equal((await f.journal.submit()).status, 'confirmed')
})

test('foreign/malformed/oversize/unknown-version/noncanonical records survive rejected recovery unchanged', async () => {
  const seed = fixture(); await seed.journal.prepare(input())
  const [[key, original]] = [...seed.shared.data]
  const edit = patch => { const v = JSON.parse(original); patch(v); return JSON.stringify(v) }
  const cases = ['{', 'null', ' '.repeat(INTAKE_INTENT_JOURNAL_BYTES + 1), original + ' ',
    edit(v => { v.version = 2 }), edit(v => { v.ownerId = id(9) }), edit(v => { v.athleteId = id(9) }),
    edit(v => { v.date = '2026-11-08' }), edit(v => { v.request.version = 2 }),
    edit(v => { v.request.grams = '125.25' }), edit(v => { v.request.food.source.extra = true }),
    edit(v => { v.request.requestId = v.request.requestId.toUpperCase() }),
    edit(v => { v.extra = true }), edit(v => { v.acknowledged = true })]
  for (const raw of cases) {
    const shared = storageFixture(); shared.data.set(key, raw)
    const f = fixture(undefined, shared, 2)
    assert.equal((await f.journal.recover()).status, 'invalid-record')
    assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
    await f.journal.retry(); assert.equal(f.calls.length, 0)
    assert.equal(shared.data.get(key), raw)
    assert.equal(f.journal.snapshot().requestId, undefined)
    assert.equal(shared.events.some(e => e[0] === 'set'), false)
  }
})

test('observed valid payload edits block send/resolve; no overwrite or erasure', async () => {
  for (const afterSend of [false, true]) {
    const f = fixture(); await f.journal.prepare(input())
    if (afterSend) await f.journal.submit()
    const [[key, text]] = [...f.shared.data], v = JSON.parse(text)
    v.request.grams = 126; const changed = JSON.stringify(v); f.shared.data.set(key, changed)
    assert.equal((await (afterSend ? f.journal.acknowledge() : f.journal.submit())).status, 'storage-conflict')
    assert.equal(f.shared.data.get(key), changed); assert.equal(f.calls.length, afterSend ? 1 : 0)
    assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
  }
})

test('scoped key stable across generation/client recreation and different for owner/athlete/day', async () => {
  const a = fixture(); await a.journal.prepare(input()); const key = [...a.shared.data.keys()][0]
  a.journal.dispose()
  const b = fixture(undefined, a.shared, 99)
  assert.equal((await b.journal.recover()).requestId, id(3))
  assert.equal(b.shared.data.size, 1)
  for (const patch of [{ ownerId: id(8) }, { athleteId: id(8) }, { date: '2026-11-08' }]) {
    const g = fixture(undefined, a.shared, 2); g.change(patch)
    // Recreate after binding the new context, just as an owning lifecycle would.
    const j = createIntakeIntentJournal(g.options)
    assert.equal((await j.recover()).status, 'empty')
  }
  assert.equal(a.shared.data.get(key) !== undefined, true)
})

test('shared synthetic exclusive lock serializes competing preparations and holds across deferred RPC', async () => {
  const shared = storageFixture(), a = fixture(undefined, shared), b = fixture(undefined, shared)
  const first = a.journal.prepare(input()), second = b.journal.prepare(input({ requestId: id(8) }))
  assert.equal((await first).status, 'prepared'); assert.equal((await second).status, 'blocked')
  const gate = deferred(), sending = fixture(() => gate.promise, shared, 2)
  await sending.journal.recover()
  const p = sending.journal.submit()
  while (!sending.calls.length) await Promise.resolve()
  let finished = false
  const waiting = b.journal.prepare(input({ requestId: id(8) })).then(s => { finished = true; return s })
  await Promise.resolve(); await Promise.resolve(); assert.equal(finished, false)
  gate.resolve(pair(createIntakeEvidenceRequest(input()))); await p
  assert.equal((await waiting).status, 'blocked')
  let depth = 0
  for (const [event] of shared.events) {
    if (event === 'lock-enter') assert.equal(++depth, 1)
    if (event === 'lock-exit') assert.equal(--depth, 0)
    if (event === 'rpc') assert.equal(depth, 1)
  }
  assert.equal(depth, 0)
})
