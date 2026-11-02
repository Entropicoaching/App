// Entropi 2-kobling runde 3, fund 3: samtalen får kun bekræftet gemte indsendelser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bridge } from './optagBridgeHarness.mjs'
import { flushVideoCoachDraftQueue, queueVideoCoachDraft } from './videoCoachSubmission.js'
import { setImmediate } from 'node:timers'

const clientId = '22222222-2222-4222-8222-222222222222'
const settle = () => new Promise(setImmediate)
function conversation(result) {
  const calls = []
  return { calls, ref: { current: { submission: id => { calls.push(id); return result?.() } } } }
}
const draft = (f, requestId = 'draft') => ({ type: 'test:vc:save-draft', requestId,
  row: { client_analysis_id: clientId, athlete_id: f.athleteRef.current.id, lift: 'squat' } })

test('F3: upload-and-go kalder submission efter bekræftet gemning, ikke ved upload- eller rækkefejl', async () => {
  const c = conversation()
  const f = await bridge({ conversationRef: c.ref })
  try {
    f.upload = async () => ({ error: { message: 'syntetisk uploadfejl' } }); await f.send()
    assert.equal(f.replies.at(-1).ok, false); assert.deepEqual(c.calls, [])
    f.upload = async () => ({}); f.save = async () => ({ error: { message: 'syntetisk rækkefejl' } })
    await f.send({ ...f.message, requestId: 'row' })
    assert.equal(f.replies.at(-1).ok, false); assert.deepEqual(c.calls, [])
    f.save = undefined; await f.send({ ...f.message, requestId: 'ok' })
    assert.equal(f.replies.at(-1).ok, true); assert.equal(f.rows.length, 2)
    assert.deepEqual(c.calls, [clientId])
  } finally { f.restore() }
})

test('F3: save-draft kalder submission efter bekræftet gemning, ikke ved fejl eller lokal kø', async () => {
  const c = conversation()
  const f = await bridge({ conversationRef: c.ref })
  try {
    f.save = async () => ({ error: { message: 'syntetisk fejl' } }); await f.send(draft(f, 'fejl'))
    assert.equal(f.replies.at(-1).ok, false); assert.deepEqual(c.calls, [])
    const queued = []
    f.retryable = () => true; f.queue = row => { queued.push(row.client_analysis_id); return true }
    await f.send(draft(f, 'koe'))
    assert.equal(f.replies.at(-1).ok, true); assert.equal(f.replies.at(-1).data.queued, true)
    assert.deepEqual(queued, [clientId]); assert.deepEqual(c.calls, [])
    f.save = undefined; f.retryable = undefined; f.queue = undefined
    await f.send(draft(f, 'ok'))
    assert.equal(f.replies.at(-1).ok, true); assert.equal(f.replies.at(-1).data.queued, undefined)
    assert.deepEqual(c.calls, [clientId])
  } finally { f.restore() }
})

test('F3: en kastende eller afvist submission ændrer ikke svaret og giver ingen uhåndteret afvisning', async () => {
  for (const result of [() => { throw Error('syntetisk kast') }, () => Promise.reject(Error('syntetisk afvisning'))]) {
    const c = conversation(result)
    const f = await bridge({ conversationRef: c.ref })
    try {
      await f.send(draft(f)); await settle()
      assert.equal(f.replies.at(-1).ok, true); assert.deepEqual(c.calls, [clientId])
    } finally { f.restore() }
  }
})

test('F3: uden conversationRef er broen som før', async () => {
  const f = await bridge()
  try { await f.send(draft(f)); assert.equal(f.replies.at(-1).ok, true) } finally { f.restore() }
})

function memoryStorage() {
  const items = new Map()
  return { items, get length() { return items.size }, key: i => [...items.keys()][i] ?? null,
    getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) }
}
const queuedRow = (athleteId, id) => ({ athlete_id: athleteId, client_analysis_id: id, status: 'draft', reps_count: 1,
  metrics: {}, findings: [], rep_details: [{ start_s: 0, end_s: 1 }] })

test('F3: den faktiske flush kalder onSent kun efter gemning og fjernelse fra køen', async () => {
  const storage = memoryStorage(), ok = 'syn-ok', bad = 'syn-fejl', stuck = 'syn-fast'
  for (const id of [ok, bad, stuck]) assert.equal(queueVideoCoachDraft(queuedRow('syn-a', id), storage, 'syn-owner'), true)
  const supabase = { from: () => ({ insert: async row => row.client_analysis_id === bad ? { error: { message: 'syntetisk' } } : { error: null } }) }
  const realRemove = storage.removeItem
  storage.removeItem = key => { if (key.endsWith(stuck)) throw Error('syntetisk lager'); return realRemove(key) }
  const sent = []
  const result = await flushVideoCoachDraftQueue(supabase, 'syn-a', storage, 'syn-owner', id => sent.push(id))
  assert.deepEqual(sent, [ok])
  assert.deepEqual({ sent: result.sent, remaining: result.remaining }, { sent: 1, remaining: 2 })
  // En kastende modtager påvirker hverken tal eller kø.
  storage.removeItem = realRemove
  const again = await flushVideoCoachDraftQueue(supabase, 'syn-a', storage, 'syn-owner', () => { throw Error('modtager') })
  assert.deepEqual({ sent: again.sent, remaining: again.remaining }, { sent: 1, remaining: 1 })
  // Uden modtager er funktionen som før.
  assert.equal((await flushVideoCoachDraftQueue(supabase, 'syn-a', memoryStorage(), 'syn-owner')).sent, 0)
})

test('F3: broens flush giver samtalens submission som onSent', async () => {
  const c = conversation()
  const f = await bridge({ conversationRef: c.ref })
  try {
    const args = []
    f.flush = async (...given) => { args.push(given); given[4](clientId); return { sent: 1, remaining: 0, expired: 0, invalid: 0 } }
    f.effects[2](); await settle()
    assert.equal(args.length, 1); assert.equal(args[0][1], f.athleteRef.current.id)
    assert.deepEqual(c.calls, [clientId])
  } finally { f.restore() }
})
