// Entropi 2-kobling runde 3, fund 3, og runde 4, fund 2: samtalen får kun bekræftet gemte indsendelser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bridge } from './optagBridgeHarness.mjs'
import { flushVideoCoachDraftQueue, queueVideoCoachDraft } from './videoCoachSubmission.js'
import { setImmediate } from 'node:timers'
import { createConversationAdapters, athleteConversationScope } from './entropi2/conversation/conversationAdapters.mjs'

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

// Runde 4, fund 2: en bekræftet indsendelse overleveres, også når beskedfanen ikke er monteret.
const atletId = '11111111-1111-4111-8111-111111111111'
const referenceKey = `entropi2:conversation:submissions:v1:synthetic:${atletId}`
// Syntetisk database: gemte rækker kan bagefter bekræftes via identity-RPC'en.
function syntheticDatabase() {
  const saved = new Map()
  const page = () => { const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [] }) }; return q }
  return { saved,
    from: table => table === 'video_analyses' ? { insert: async row => {
      saved.set(row.client_analysis_id, { id: `syn-v-${saved.size + 1}`, athlete_id: row.athlete_id, client_analysis_id: row.client_analysis_id, status: 'draft' })
      return { error: null } } } : page(),
    rpc: (name, args) => name === 'get_my_video_analysis_submission_identity_v3'
      ? { single: async () => saved.has(args.p_client_analysis_id) ? { data: saved.get(args.p_client_analysis_id) } : { error: { message: 'ukendt' } } }
      : Promise.resolve({ data: [] }) }
}
// Den faktiske samtaleadapter, som beskedfanen bruger ved næste load.
function laterLoad(database, storage) {
  const scope = athleteConversationScope({ enabled: true, session: { user: { id: 'synthetic' } },
    athlete: { id: atletId, user_id: 'synthetic' } })
  return createConversationAdapters({ enabled: true, database, getScope: () => scope, storage: () => storage }).load()
}
const handover = (storage, extra = {}) => bridge({ conversationRef: { current: null }, conversationHandover: true,
  storage, athleteUserId: 'synthetic', ...extra })

test('R4 F2: vellykket køflush mens beskedfanen er lukket giver referencen ved senere load', async () => {
  const storage = memoryStorage(), database = syntheticDatabase()
  assert.equal(queueVideoCoachDraft(queuedRow(atletId, clientId), storage, 'synthetic'), true)
  const f = await handover(storage)
  try {
    const results = []
    f.flush = async (_, athleteId, store, owner, onSent) => {
      const result = await flushVideoCoachDraftQueue(database, athleteId, store, owner, onSent); results.push(result); return result }
    f.effects[2](); await settle(); await settle()
    assert.deepEqual({ sent: results[0].sent, remaining: results[0].remaining }, { sent: 1, remaining: 0 })
    assert.equal([...storage.items.keys()].some(key => key.startsWith('entropi:videocoach:pending')), false)
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId])
  } finally { f.restore() }
  // Fanen åbnes senere: referencen genvalideres via identity-RPC'en og står i samtalen.
  const loaded = await laterLoad(database, storage)
  assert.deepEqual(loaded.analyses.map(row => [row.client_analysis_id, row.source_mode]), [[clientId, 'athlete_submission']])
})

test('R4 F2: upload-and-go og save-draft med lukket fane overleveres; fejl og lokal kø overleveres aldrig', async () => {
  const storage = memoryStorage()
  const f = await handover(storage)
  try {
    f.save = async () => ({ error: { message: 'syntetisk rækkefejl' } }); await f.send()
    await f.send(draft(f, 'fejl'))
    f.retryable = () => true; f.queue = () => true
    await f.send(draft(f, 'koe'))
    assert.equal(f.replies.at(-1).data.queued, true)
    assert.equal(storage.getItem(referenceKey), null)
    f.save = undefined; f.retryable = undefined; f.queue = undefined
    await f.send({ ...f.message, requestId: 'ok' })
    assert.equal(f.replies.at(-1).ok, true)
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId])
    await f.send(draft(f, 'ok'))
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId])
  } finally { f.restore() }
})

test('R4 F2: med flaget slukket og i coachens forhåndsvisning overleveres intet', async () => {
  for (const options of [{ conversationHandover: undefined }, { athleteUserId: 'syn-anden' }, { athleteUserId: undefined }]) {
    const storage = memoryStorage()
    const f = await handover(storage, options)
    try {
      await f.send(draft(f))
      assert.equal(f.replies.at(-1).ok, true)
      assert.equal(storage.items.size, 0, JSON.stringify(options))
    } finally { f.restore() }
  }
})

test('R4 F2: monteret samtale får submission; lukkes fanen før den har gemt, overleveres referencen', async () => {
  for (const [result, closeFirst, expected] of [[true, false, null], [false, false, null], [false, true, [clientId]], [true, true, null]]) {
    const storage = memoryStorage(), ref = { current: null }, calls = []
    ref.current = { submission: async id => { calls.push(id); if (closeFirst) ref.current = null; return result } }
    const f = await handover(storage, { conversationRef: ref })
    try {
      await f.send(draft(f)); await settle()
      assert.deepEqual(calls, [clientId])
      assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), expected, JSON.stringify([result, closeFirst]))
    } finally { f.restore() }
  }
})

test('R4 F2: en ugyldig eller fuld referenceliste overskrives ikke, og en kendt reference dubleres ikke', async () => {
  const full = JSON.stringify(Array.from({ length: 10000 }, (_, i) => `syn-${i}`))
  for (const before of ['ikke json', '{"a":1}', '["ugyldig id!"]', JSON.stringify([clientId]), full]) {
    const storage = memoryStorage(); storage.setItem(referenceKey, before)
    const f = await handover(storage)
    try {
      await f.send(draft(f))
      assert.equal(f.replies.at(-1).ok, true)
      assert.equal(storage.getItem(referenceKey), before)
    } finally { f.restore() }
  }
})

// Runde 5, fund 1: flaget læses ved hvert kald, også fra effekter fra en tidligere gengivelse.
test('R5 F2: flagskift ON til OFF på samme monterede instans overleverer ikke længere', async () => {
  const storage = memoryStorage()
  const f = await handover(storage)
  try {
    f.rerender({ conversationHandover: false })
    await f.send(draft(f, 'off'))
    assert.equal(f.replies.at(-1).ok, true)
    assert.equal(storage.getItem(referenceKey), null)
    f.rerender({ conversationHandover: true })
    await f.send(draft(f, 'on'))
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId])
  } finally { f.restore() }
})

test('R5 F2: flagskift OFF til ON på samme monterede instans overleverer ved save og køflush', async () => {
  const storage = memoryStorage(), database = syntheticDatabase()
  const f = await bridge({ conversationRef: { current: null }, storage, athleteUserId: 'synthetic' })
  try {
    await f.send(draft(f, 'off'))
    assert.equal(storage.getItem(referenceKey), null)
    f.rerender({ conversationHandover: true })
    await f.send(draft(f, 'on'))
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId])
    // Køeffekten fra den første (OFF) gengivelse læser også den aktuelle værdi.
    const queued = '33333333-3333-4333-8333-333333333333'
    assert.equal(queueVideoCoachDraft(queuedRow(atletId, queued), storage, 'synthetic'), true)
    f.flush = (_, athleteId, store, owner, onSent) => flushVideoCoachDraftQueue(database, athleteId, store, owner, onSent)
    f.effects[2](); await settle(); await settle()
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId, queued])
    f.rerender({ conversationHandover: false })
    assert.equal(queueVideoCoachDraft(queuedRow(atletId, 'syn-sidst'), storage, 'synthetic'), true)
    f.effects[2](); await settle(); await settle()
    assert.deepEqual(JSON.parse(storage.getItem(referenceKey)), [clientId, queued])
  } finally { f.restore() }
})
