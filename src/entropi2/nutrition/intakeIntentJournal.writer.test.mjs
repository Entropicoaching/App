import test from 'node:test'
import assert from 'node:assert/strict'
import { createIntakeEvidenceRequest } from './intakeEvidence.mjs'
import { createIntakeEvidenceWriter } from './intakeEvidenceWriter.mjs'
import { fixture, storageFixture, input, id, pair, deferred } from './intakeIntentJournal.test.mjs'

test('exact persist/readback and attempted/readback precede ONE actual writer send; deferred clicks coalesce', async () => {
  const gate = deferred(), f = fixture((_name, { p_request }) => {
    const [[, text]] = [...f.shared.data]
    assert.equal(JSON.parse(text).attempted, true)
    assert.equal(JSON.stringify(JSON.parse(text).request), JSON.stringify(p_request))
    return gate.promise
  })
  await f.journal.prepare(input())
  const a = f.journal.submit(), b = f.journal.submit(), c = f.journal.retry()
  assert.strictEqual(a, b); assert.strictEqual(a, c)
  while (!f.calls.length) await Promise.resolve()
  const events = f.shared.events.map(e => e[0]), rpc = events.indexOf('rpc')
  const writes = events.flatMap((e, n) => e === 'set' ? [n] : [])
  assert.equal(writes.length, 2)
  for (const n of writes) assert.equal(events[n + 1], 'get')
  assert.ok(writes[1] < rpc); assert.equal(events[rpc - 1], 'get')
  gate.resolve(pair(f.calls[0].args.p_request))
  assert.equal((await a).status, 'confirmed')
  assert.equal((await f.journal.submit()).status, 'confirmed')
  assert.equal((await f.journal.retry()).status, 'confirmed')
  assert.equal(f.calls.length, 1)
  assert.ok(Object.isFrozen(f.calls[0].args.p_request.food.source))
  assert.equal(JSON.stringify(await a).includes('food'), false)
  assert.equal((await f.journal.acknowledge()).status, 'resolved')
  assert.equal(JSON.parse([...f.shared.data.values()][0]).acknowledged, true)
  assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'prepared')
})

test('attempt-marker throws/discards/mismatches/read failures prevent actual transport', async () => {
  for (const mode of ['throw', 'discard', 'mismatch', 'readback']) {
    const f = fixture(); await f.journal.prepare(input())
    if (mode === 'throw') f.shared.hooks.set = () => { throw Error('quota') }
    if (mode === 'discard') f.shared.hooks.set = () => {}
    if (mode === 'mismatch') f.shared.hooks.set = (key, _text, data) => data.set(key, 'changed')
    if (mode === 'readback') f.shared.hooks.set = (key, text, data) => {
      data.set(key, text); f.shared.hooks.get = () => { throw Error('read denied') }
    }
    assert.equal((await f.journal.submit()).status, 'storage-error', mode)
    assert.equal(f.calls.length, 0, mode)
    assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status === 'prepared', false)
  }
})

test('simulated commit-lost-reply survives dispose/recreate/new generation with identical UUID and request bytes', async () => {
  const simulatedRows = new Map(), shared = storageFixture()
  let loseReply = true
  const transport = async (_name, { p_request }) => {
    const text = JSON.stringify(p_request)
    const existing = simulatedRows.get(p_request.requestId)
    if (existing) assert.equal(text, existing)
    else simulatedRows.set(p_request.requestId, text)
    if (loseReply) { loseReply = false; throw Error('synthetic commit reply lost') }
    return pair(p_request)
  }
  const f = fixture(transport, shared)
  const raw = structuredClone(input()), expected = JSON.stringify(createIntakeEvidenceRequest(raw))
  await f.journal.prepare(raw)
  raw.grams = 999; raw.food.source.citation = 'mutated after prepare'
  assert.equal((await f.journal.submit()).status, 'uncertain')
  const persisted = [...shared.data.values()][0]
  assert.equal(JSON.parse(persisted).attempted, true)
  assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
  await f.journal.submit(); assert.equal(f.calls.length, 1)
  const oldRetry = f.journal.retry, oldAck = f.journal.acknowledge
  f.journal.dispose()
  const count = shared.events.length
  await oldRetry(); await oldAck(); assert.equal(shared.events.length, count)
  const next = fixture(transport, shared, 2)
  assert.equal(next.journal.snapshot().requestId, undefined)
  assert.equal((await next.journal.recover()).status, 'recovered')
  assert.equal([...shared.data.values()][0], persisted)
  assert.equal((await next.journal.submit()).status, 'recovered'); assert.equal(next.calls.length, 0)
  assert.equal((await next.journal.retry()).status, 'confirmed')
  assert.equal(next.calls[0].bytes, expected); assert.equal(f.calls[0].bytes, expected)
  assert.equal(next.calls[0].args.p_request.requestId, id(3)); assert.equal(simulatedRows.size, 1)
  assert.equal((await next.journal.acknowledge()).status, 'resolved')
})

test('only private matching writer success authorizes resolution; arbitrary/foreign successes and all errors retain intent', async () => {
  for (const reply of [pair(createIntakeEvidenceRequest(input({ requestId: id(8) }))),
    { data: null, error: null }, { status: 'success', requestId: id(3) },
    ...['23505', '42501', 'PGRST202', '42P01', '42883', 'XX000'].map(code => ({ error: { code } }))]) {
    const f = fixture(async () => reply); await f.journal.prepare(input())
    assert.notEqual((await f.journal.submit()).status, 'confirmed')
    const text = [...f.shared.data.values()][0]
    assert.equal((await f.journal.acknowledge({ status: 'success', requestId: id(3) })).status, 'blocked')
    assert.equal([...f.shared.data.values()][0], text)
    assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
    assert.equal(f.journal.snapshot().mayHaveCommitted, true)
  }
  const f = fixture(); await f.journal.prepare(input())
  const foreign = createIntakeEvidenceWriter({ enabled: true, client: f.client, getCurrentContext: f.options.getCurrentContext })
  const success = await foreign.submit(input())
  assert.equal(success.status, 'success')
  assert.equal((await f.journal.acknowledge(success)).status, 'blocked')
})

test('scope/client/date/generation/capability changes retire before send and after deferred RPC; stale callbacks touch no storage', async () => {
  const changes = [{ ownerId: id(8) }, { athleteId: id(8) }, { date: '2026-11-08' }, { generation: 2 },
    { client: { rpc() { assert.fail('replacement client') } } }, { writable: false }, { future: true }, { enabled: false }]
  for (const patch of changes) {
    const before = fixture(); await before.journal.prepare(input()); before.change(patch)
    const count = before.shared.events.length
    assert.equal((await before.journal.submit()).status, 'retired')
    assert.equal(before.shared.events.length, count); assert.equal(before.calls.length, 0)
    const gate = deferred(), after = fixture(() => gate.promise)
    await after.journal.prepare(input()); const pending = after.journal.submit()
    while (!after.calls.length) await Promise.resolve()
    after.change(patch)
    const storageEvents = () => after.shared.events.filter(e => ['get', 'set', 'rpc'].includes(e[0])).length
    const cutoff = storageEvents()
    gate.resolve(pair(after.calls[0].args.p_request))
    assert.deepEqual(await pending, { status: 'retired', mayHaveCommitted: true })
    const poison = new Proxy({}, { ownKeys() { assert.fail('stale input') } })
    await after.journal.prepare(poison); await after.journal.recover(); await after.journal.retry(); await after.journal.acknowledge()
    assert.equal(storageEvents(), cutoff)
    after.change({ generation: 1 }); assert.equal(after.journal.snapshot().status, 'retired')
  }
})

test('queued lock callback, prepare and acknowledgement cannot act after scope retirement/dispose', async () => {
  for (const action of ['prepare', 'recover', 'submit', 'acknowledge']) {
    const f = fixture()
    if (['submit', 'acknowledge'].includes(action)) await f.journal.prepare(input())
    if (action === 'acknowledge') await f.journal.submit()
    const gate = deferred(); f.shared.hooks.lock = () => gate.promise
    const j = f.journal, pending = j[action](input())
    await Promise.resolve(); j.dispose()
    const cutoff = f.shared.events.filter(e => ['get', 'set', 'rpc'].includes(e[0])).length
    gate.resolve(); assert.equal((await pending).status, 'retired')
    assert.equal(f.shared.events.filter(e => ['get', 'set', 'rpc'].includes(e[0])).length, cutoff)
  }
})

test('changing an already bound storage or lock seam fails closed', async () => {
  for (const kind of ['storage', 'withExclusiveLock']) {
    const f = fixture(); await f.journal.prepare(input())
    f.options[kind] = storageFixture()[kind]
    assert.equal((await f.journal.submit()).status, 'storage-error')
    assert.equal(f.calls.length, 0)
  }
})

test('storage failure after possible commit never reports cleared, accepts replacement or loses same-ID record', async () => {
  for (const failure of ['post-read', 'ack-throw', 'ack-discard', 'ack-readback']) {
    const f = fixture(async (_name, { p_request }) => {
      if (failure === 'post-read') f.shared.hooks.get = () => { throw Error('after synthetic commit') }
      return pair(p_request)
    })
    await f.journal.prepare(input()); const result = await f.journal.submit()
    if (failure === 'post-read') assert.equal(result.status, 'storage-error')
    else assert.equal(result.status, 'confirmed')
    if (failure === 'ack-throw') f.shared.hooks.set = () => { throw Error('quota') }
    if (failure === 'ack-discard') f.shared.hooks.set = () => {}
    if (failure === 'ack-readback') f.shared.hooks.set = (key, text, data) => {
      data.set(key, text); f.shared.hooks.get = () => { throw Error('lost readback') }
    }
    assert.equal((await f.journal.acknowledge()).status, 'storage-error')
    assert.notEqual(f.journal.snapshot().status, 'resolved')
    assert.equal(f.journal.snapshot().mayHaveCommitted, true)
    assert.equal(f.journal.snapshot().requestId, id(3))
    const retained = JSON.parse([...f.shared.data.values()][0])
    assert.equal(retained.request.requestId, id(3)); assert.equal(retained.attempted, true)
    delete f.shared.hooks.get; delete f.shared.hooks.set
    assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
    assert.equal((await f.journal.acknowledge()).status, 'resolved')
  }
})

test('persisted acknowledgement alone after reload cannot authorize replacement or arbitrary clear', async () => {
  const f = fixture(); await f.journal.prepare(input()); await f.journal.submit(); await f.journal.acknowledge()
  f.journal.dispose()
  const next = fixture(undefined, f.shared, 2)
  assert.equal((await next.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
  assert.equal((await next.journal.recover()).status, 'recovered')
  assert.equal((await next.journal.acknowledge('success')).status, 'blocked')
  assert.equal((await next.journal.retry()).status, 'confirmed')
  assert.equal((await next.journal.acknowledge()).status, 'resolved')
})

test('observed deletion after matching success is a conflict, never permission to recreate/resolve', async () => {
  const f = fixture(); await f.journal.prepare(input()); await f.journal.submit()
  const key = [...f.shared.data.keys()][0]
  f.shared.data.delete(key)
  const writes = f.shared.events.filter(e => e[0] === 'set').length
  assert.equal((await f.journal.acknowledge()).status, 'storage-conflict')
  assert.equal(f.shared.data.has(key), false)
  assert.equal(f.shared.events.filter(e => e[0] === 'set').length, writes)
  assert.equal((await f.journal.prepare(input({ requestId: id(8) }))).status, 'blocked')
  assert.equal(f.journal.snapshot().mayHaveCommitted, true)
})

test('scope changes during storage callbacks retire before any following read or RPC', async () => {
  for (const kind of ['get', 'set']) {
    const f = fixture()
    f.shared.hooks[kind] = (key, value, data) => {
      f.change({ generation: 2 })
      if (kind === 'get') return value.get(key) ?? null
      data.set(key, value)
    }
    assert.equal((await f.journal.prepare(input())).status, 'retired')
    const cutoff = f.shared.events.length
    await f.journal.retry(); await f.journal.acknowledge()
    assert.equal(f.shared.events.length, cutoff); assert.equal(f.calls.length, 0)
  }
})

import { createIntakeIntentJournal } from './intakeIntentJournal.mjs'
import { FRIDA_FOODS } from '../kostplan/foedevarer/frida55.mjs'

test('source3 RPC accessors revoke before storage/send, preserve receiver and same-ID replay', async () => {
  // Synchronous Map storage with one journal in each exclusive-lock domain.
  const make = () => {
    const f = fixture()
    f.options.withExclusiveLock = (_key, run) => run()
    return f
  }
  for (const patch of [{ generation: 2 }, { ownerId: id(8) }, { athleteId: id(8) },
    { date: '2026-11-08' }, { client: {} }, { writable: false }, { future: true }, { enabled: false }]) {
    for (const phase of ['prepare', 'submit']) {
      const f = make(), method = f.client.rpc
      if (phase === 'submit') assert.equal((await f.journal.prepare(input())).status, 'prepared')
      const count = f.shared.events.length
      let gets = 0
      Object.defineProperty(f.client, 'rpc', { get() { gets++; f.change(patch); return method } })
      const result = phase === 'prepare' ? await f.journal.prepare(input()) : await f.journal.submit()
      assert.equal(result.status, 'retired')
      assert.equal(gets, 1)
      assert.equal(f.shared.events.length, count, 'revocation must precede storage')
      assert.equal(f.calls.length, 0)
      f.journal.dispose()
    }
  }
  for (const mode of ['missing', 'throwing']) {
    for (const phase of ['initial', 'prepare', 'submit']) {
      const f = make()
      if (phase === 'submit') await f.journal.prepare(input())
      const count = f.shared.events.length
      let gets = 0
      Object.defineProperty(f.client, 'rpc', { get() {
        gets++
        if (mode === 'throwing') throw Error('synthetic method lookup denied')
        return undefined
      } })
      const j = phase === 'initial' ? createIntakeIntentJournal(f.options) : f.journal
      const result = phase === 'submit' ? await j.submit() : await j.prepare(input())
      assert.equal(result.status, 'retired')
      assert.equal(gets, 1)
      assert.equal(f.shared.events.length, count)
      assert.equal(f.calls.length, 0)
      j.dispose(); f.journal.dispose()
    }
  }
  for (const accessor of [false, true]) {
    const f = make(), sent = []
    let loseReply = true, gets = 0
    function method(name, args) {
      assert.strictEqual(this, f.client)
      assert.equal(name, 'record_meal_intake_evidence_v1')
      const [[, text]] = [...f.shared.data]
      assert.equal(JSON.parse(text).attempted, true)
      assert.equal(JSON.stringify(JSON.parse(text).request), JSON.stringify(args.p_request))
      sent.push(JSON.stringify(args.p_request))
      if (loseReply) { loseReply = false; throw Error('synthetic lost reply') }
      return pair(args.p_request)
    }
    if (accessor) Object.defineProperty(f.client, 'rpc', { get() { gets++; return method } })
    else f.client.rpc = method
    assert.equal((await f.journal.prepare(input())).status, 'prepared')
    assert.equal((await f.journal.submit()).status, 'uncertain')
    f.journal.dispose()
    f.change({ generation: 2 })
    const next = createIntakeIntentJournal(f.options)
    assert.equal((await next.recover()).status, 'recovered')
    assert.equal((await next.submit()).status, 'recovered')
    assert.equal(sent.length, 1, 'recovery must require explicit same-ID retry')
    assert.equal((await next.retry()).status, 'confirmed')
    assert.equal(sent.length, 2)
    assert.equal(sent[0], sent[1])
    assert.equal(JSON.parse(sent[1]).requestId, id(3))
    assert.equal((await next.acknowledge()).status, 'resolved')
    assert.equal(accessor ? gets > 0 : gets === 0, true)
    next.dispose()
  }
})

test('K14 revoking generation during injected client method lookup must prevent transport entry', async () => {
  const violations = []
  // Sweep lookup boundaries independently of private helper names or line numbers.
  // Each case uses the exact same client instance; only caller capability changes.
  for (let boundary = 1; boundary <= 40; boundary++) {
    let generation = 1, lookups = 0, armed = false, calls = 0
    const rows = new Map()
    const rpc = () => { calls++; if (generation !== 1) violations.push({ boundary, lookups, generation }); throw Error('synthetic unavailable reply') }
    const client = { get rpc() {
      if (armed && ++lookups === boundary) generation = 2
      return rpc
    } }
    const options = { enabled: true, client,
      getCurrentContext: () => ({ enabled: true, writable: true, future: false,
        ownerId: 'synthetic-accessor-review-owner', athleteId: 'd12a0000-1234-4567-8abc-000000000001',
        date: '2026-11-09', generation, client }),
      storage: { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) },
      withExclusiveLock: async (_key, run) => await run() }
    // One journal only in each independent storage/lock domain; no competing tabs.
    const j = createIntakeIntentJournal(options)
    assert.equal((await j.prepare({ athleteId: 'd12a0000-1234-4567-8abc-000000000001', date: '2026-11-09',
      requestId: 'd12a0000-1234-4567-8abc-000000000002', grams: 73.125,
      meal: 'Synthetic accessor boundary', food: FRIDA_FOODS[1] })).status, 'prepared')
    armed = true
    await j.submit()
    if (generation !== 1) assert.equal(j.snapshot().status, 'retired')
    assert.ok(calls <= 1)
    j.dispose()
  }
  assert.deepEqual(violations, [], 'transport entered after current generation was revoked by its method getter')
})
