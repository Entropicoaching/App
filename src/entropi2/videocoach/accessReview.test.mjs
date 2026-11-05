// Separate adversarial checks: no producer fixture or copied implementation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAthleteAccessController, normalizeOwnAnalysis } from './accessController.mjs'
import { renderAthleteAccess, renderFilmSetEntry } from './accessView.mjs'

const options = [{ key: 'synthetic-set', exercise_name: 'Syntetisk løft', set_number: 1 }]
const source = { id: 'synthetic-source', label: 'Syntetisk billedserie', duration: 2 }
const result = { reps: 1, path: [[0, 0, 0], [1, .5, 1], [2, 1, 0]] }
const h = (tag, props, ...children) => ({ tag, props: props ?? {}, children: children.flat(Infinity).filter(x => x != null && x !== false) })
const walk = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(walk)] : []
const text = node => node && typeof node === 'object' ? node.children.map(text).join(' ') : String(node ?? '')
const flush = () => new Promise(resolve => setImmediate(resolve))
function rig(callbacks = {}, extra = {}) {
  const c = createAthleteAccessController({ enabled: true, options, uuid: () => 'synthetic-id', ...extra,
    callbacks: { chooseSource: () => source, analyze: () => result, ...callbacks } })
  c.open(options[0].key)
  return c
}

test('independent: imports and visible clicks need no browser, media, network or storage', async () => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = () => { throw Error('Network forbidden in this fixture') }
  try {
    const c = rig()
    const entry = renderFilmSetEntry(h, { state: c.snapshot(), controller: c, choiceKey: options[0].key })
    entry.props.onClick()
    await c.chooseSource()
    const tree = renderAthleteAccess(h, { state: c.snapshot(), controller: c })
    assert.match(text(tree), /1 gentagelse registreret/)
    assert.doesNotMatch(text(tree), /1 gentagelser/)
    assert.equal(walk(tree).filter(n => n.tag === 'polyline').length, 1)
    assert.equal(walk(tree).filter(n => ['iframe', 'video', 'input'].includes(n.tag)).length, 0)
    c.dispose()
  } finally { globalThis.fetch = oldFetch }
})

test('independent: wrong local receipt cannot show success and all payloads are defensive copies', async () => {
  let received
  const c = rig({ saveLocal(request) {
    received = request
    request.analysis.path[0][1] = .99; request.choice.exercise_name = 'mutation'
    return { ok: true, localId: 'synthetic-save', clientAnalysisId: 'wrong-id' }
  } })
  await c.chooseSource(); assert.equal(await c.saveLocal(), false)
  assert.equal(c.snapshot().analysis.path[0][1], 0)
  assert.equal(c.snapshot().choice.exercise_name, 'Syntetisk løft')
  assert.equal(c.snapshot().localId, null); assert.equal(received.clientAnalysisId, 'synthetic-id')
  const snapshot = c.snapshot(); snapshot.source.id = 'mutation'; snapshot.options[0].key = 'mutation'
  assert.equal(c.snapshot().source.id, source.id)
  assert.equal(c.snapshot().options[0].key, options[0].key)
  c.dispose()
})

test('independent: duplicate send, cancel, retry and matching acknowledgement use one operation', async () => {
  let resolveUpload, attempts = 0, prepared = 0, savedId
  const c = rig({
    prepare(request) { prepared++; return { duration: 2, artifact: 'synthetic-frame-series' } },
    upload(request) {
      attempts++; savedId ??= request.clientAnalysisId
      assert.equal(request.clientAnalysisId, savedId)
      if (attempts === 1) return new Promise(resolve => { resolveUpload = resolve })
      return { ok: true, uploaded: true, clientAnalysisId: request.clientAnalysisId }
    },
  })
  await c.chooseSource(); const send = c.send(); await flush()
  assert.equal(await c.send(), false); assert.equal(attempts, 1)
  assert.equal(c.close(), true); assert.equal(await send, false)
  assert.equal(c.snapshot().delivery.phase, 'cancelled')
  resolveUpload({ ok: true, clientAnalysisId: savedId }); await flush()
  assert.equal(c.snapshot().delivery.phase, 'cancelled')
  c.open(options[0].key)
  assert.equal(await c.retrySend(), true)
  assert.equal(prepared, 1); assert.equal(attempts, 2)
  assert.equal(c.snapshot().delivery.phase, 'sent')
  c.dispose()
})

test('independent: scope change during upload rejects late completion and later retry', async () => {
  let scope = 'synthetic-owner', finish
  const c = rig({ prepare: () => ({ duration: 2, artifact: 'synthetic' }),
    upload: request => new Promise(resolve => { finish = () => resolve({ ok: true, clientAnalysisId: request.clientAnalysisId }) }),
  }, { getScope: () => scope })
  await c.chooseSource(); const task = c.send(); await flush()
  scope = 'synthetic-other'; assert.deepEqual(c.snapshot(), { enabled: false })
  finish(); assert.equal(await task, false)
  assert.equal(await c.retrySend(), false)
})

test('independent: analysis rejects descending, out-of-window and oversized point series', () => {
  const window = { start: 0, end: 2 }
  for (const path of [[[1, 0, 0], [0, 1, 1]], [[0, 0, 0], [3, 1, 1]],
    [[0, 0, 0, 1], [1, 1, 1]], Array.from({ length: 501 }, (_, i) => [i / 250, .5, .5])])
    assert.throws(() => normalizeOwnAnalysis({ reps: 1, path }, window))
  assert.throws(() => createAthleteAccessController({ enabled: true, options: [...options, ...options] }))
  for (const getScope of [() => null, () => { throw Error('No scope') }]) {
    const c = rig({}, { getScope })
    assert.deepEqual(c.snapshot(), { enabled: false })
  }
})
