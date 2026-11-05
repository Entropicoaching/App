// Separate adversarial cases: direct public imports; no producer fixture helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoAnalysisController } from './analysisController.mjs'
import { renderVideoAnalyses } from './analysisView.mjs'
import { renderAthleteAccess } from './accessView.mjs'

const choice = { key: 'synthetic-set', exercise_id: 'synthetic-lift', exercise_name: 'Syntetisk løft',
  set_number: 3, session_id: 'synthetic-pass', session_date: '2026-11-05' }
const h = (tag, props, ...children) => ({ tag, props: props ?? {}, children: children.flat(Infinity).filter(x => x != null && x !== false) })
const walk = n => n && typeof n === 'object' ? [n, ...n.children.flatMap(walk)] : []
function rig({ missing = false, receipt = true } = {}) {
  let uploads = 0, registered = 0, shared = 0
  const state = { available: true, loaded: true, role: 'athlete', draft: '', busy: false, loading: false, error: '', thread: [] }
  const conversation = { snapshot: () => structuredClone(state),
    async submission(id) { registered++; state.thread.push({ kind: 'video', value: { id: 'synthetic-video', client_analysis_id: id } }); return true },
    async shareSet(label, note) {
      shared++; state.operation = { status: 'sent', row: { id: 'synthetic-message', content: `Fra passet · ${label}\n${note}` } }; return true
    } }
  class Adapter {
    constructor() { this.seen = [] }
    chooseSource() { this.seen.push('choose'); return { id: 'synthetic-frames', label: 'Syntetisk', duration: 20 } }
    analyze(request) { this.seen.push('analyze'); return { reps: 1, path: [[request.window.start, 0, 0], [request.window.end, 1, 1]] } }
    prepare(request) { this.seen.push('prepare'); return { artifact: 'synthetic', duration: request.window.end - request.window.start } }
    upload(request) { this.seen.push('upload'); uploads++; return { ok: receipt, clientAnalysisId: receipt ? request.clientAnalysisId : 'wrong' } }
  }
  const adapter = new Adapter()
  const c = createVideoAnalysisController({ enabled: true, options: [choice], conversation: missing ? undefined : conversation,
    callbacks: adapter, uuid: () => 'synthetic-analysis' })
  return { c, adapter, state, counts: () => ({ uploads, registered, shared }) }
}

test('separate check: prototype adapter keeps its receiver and history sends after access is closed', async () => {
  const f = rig(); f.c.access.open(choice.key)
  assert.equal(await f.c.access.chooseSource(), true); f.c.access.close()
  assert.equal(await f.c.send('synthetic-analysis'), true)
  assert.deepEqual(f.adapter.seen, ['choose', 'analyze', 'prepare', 'upload'])
  assert.deepEqual(f.counts(), { uploads: 1, registered: 1, shared: 1 })
  f.c.dispose()
})

test('separate check: wrong upload receipt never registers a reference, sends a message or claims success', async () => {
  const f = rig({ receipt: false }); f.c.access.open(choice.key); await f.c.access.chooseSource()
  assert.equal(await f.c.send('synthetic-analysis'), false)
  assert.equal(f.c.snapshot().records[0].phase, 'error')
  assert.deepEqual(f.counts(), { uploads: 1, registered: 0, shared: 0 })
  f.c.dispose()
})

test('separate check: no conversation disables both send views, invalid selectors never leak another pass', async () => {
  const f = rig({ missing: true }); f.c.access.open(choice.key)
  assert.equal(f.c.access.snapshot().canSend, false)
  await f.c.access.chooseSource()
  const history = renderVideoAnalyses(h, { state: f.c.snapshot(), controller: f.c })
  const send = walk(history).find(n => n.tag === 'button')
  assert.equal(send.props.disabled, true)
  const access = renderAthleteAccess(h, { state: f.c.access.snapshot(), controller: f.c.access })
  const accessSend = walk(access).find(n => n.tag === 'button' && n.children[0] === 'Send til din coach')
  assert.equal(accessSend.props.disabled, true)
  const filtered = renderVideoAnalyses(h, { state: f.c.snapshot(), controller: f.c, sessionId: null })
  assert.equal(walk(filtered).some(n => n.tag === 'article'), false)
  assert.equal(await f.c.send('synthetic-analysis'), false)
  assert.deepEqual(f.counts(), { uploads: 0, registered: 0, shared: 0 })
  f.c.dispose()
})

test('separate check: read errors and changed roles block all sharing; empty analysis cannot send through access', async () => {
  for (const patch of [{ loaded: false }, { loading: true }, { role: 'coach' }, { available: false }, { error: 'synthetic' }]) {
    const f = rig(); f.c.access.open(choice.key)
    assert.equal(await f.c.access.send(), false)
    await f.c.access.chooseSource(); Object.assign(f.state, patch)
    assert.equal(await f.c.send('synthetic-analysis'), false)
    assert.deepEqual(f.counts(), { uploads: 0, registered: 0, shared: 0 })
    f.c.dispose()
  }
})

test('separate check: a changed conversation draft during upload is preserved without a message', async () => {
  const f = rig()
  f.adapter.upload = request => {
    f.state.draft = 'Syntetisk ny kladde'
    return { ok: true, clientAnalysisId: request.clientAnalysisId }
  }
  f.c.access.open(choice.key); await f.c.access.chooseSource()
  assert.equal(await f.c.send('synthetic-analysis'), false)
  assert.equal(f.state.draft, 'Syntetisk ny kladde'); assert.equal(f.counts().shared, 0)
  f.c.dispose()
})
