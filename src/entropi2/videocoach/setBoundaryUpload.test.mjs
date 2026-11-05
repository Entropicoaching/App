import test from 'node:test'
import assert from 'node:assert/strict'
import { createUploadController } from './uploadController.mjs'
import { DEFAULT_VIDEOCOACH, initialWindow, validWindow } from './model.mjs'
import { pausedSet, sourceFor } from './setBoundaryFixture.mjs'

const clock = { set: () => 0, clear: () => {} }
export function chooseController(extra = {}) {
  const c = createUploadController({ enabled: true, options: [{ key: 'synthetic', exercise_name: 'Syntetisk løft', set_number: 1 }],
    uuid: () => 'synthetic-op', clock, ...extra })
  c.choose('synthetic'); c.next()
  return c
}
test('regression: detected start replaces last-15-second default without clipping the first movement', () => {
  const c = chooseController(), source = sourceFor(pausedSet(), 30)
  assert.equal(c.select(source), true)
  assert.ok(initialWindow(30).start > 1.5, 'old tail-window excludes the first movement')
  assert.ok(c.snapshot().window.start < 1.5)
  assert.equal(c.snapshot().setBoundary.repCount, 2)
  assert.equal(c.next(), true)
})
test('synthetic prepare and upload receive the entire buffered selection and no motion arrays', async () => {
  const calls = [], c = chooseController({ callbacks: {
    prepare(request) { calls.push(request); return { artifact: 'synthetic-artifact', duration: request.window.end - request.window.start } },
    upload(request) { calls.push(request); return { ok: true, clientAnalysisId: request.clientAnalysisId } },
  } })
  c.select(sourceFor(pausedSet('bench', { lockoutPause: 4 })))
  const selected = c.snapshot().window
  assert.equal(c.next(), true); assert.equal(await c.send(), true)
  assert.equal(c.snapshot().phase, 'sent')
  for (const call of calls) assert.deepEqual(call.window, selected)
  assert.equal(calls[0].source.motion, undefined)
  assert.equal(c.snapshot().source.motion, undefined)
})
test('over-limit whole set blocks automatic continuation without silently trimming it', async () => {
  let sends = 0
  const c = chooseController({ callbacks: { prepare() { sends++ }, upload() { sends++ } } })
  c.select(sourceFor(pausedSet('bench', { chestPause: 10, lockoutPause: 6 }), 40))
  assert.equal(c.snapshot().setBoundary.status, 'too-long')
  assert.ok(c.snapshot().setBoundary.window.end - c.snapshot().setBoundary.window.start > 15)
  assert.equal(c.next(), false); assert.equal(await c.send(), false); assert.equal(sends, 0)
  assert.equal(c.resize('start', 26), true)
  assert.equal(c.snapshot().setBoundary.manual, true); assert.equal(c.next(), true)
})
for (const motion of [{ lift: 'bench', samples: [] }, pausedSet('bench', { finalRest: 0.2 })]) {
  test(`unconfirmed ${motion.samples.length ? 'end' : 'empty series'} requires an explicit manual choice`, () => {
    const c = chooseController()
    c.select(sourceFor(motion))
    assert.equal(c.next(), false)
    assert.equal(c.move(0), true)
    assert.equal(c.snapshot().setBoundary.manual, true); assert.equal(c.next(), true)
  })
}
test('manual resize, keyboard move and pointer drag supersede only the automatic selection', () => {
  for (const act of [c => c.resize('start', 0), c => c.move(0), c => { c.dragStart(1, 20, 100); c.dragMove(1, 25); c.dragEnd() }]) {
    const c = chooseController(); c.select(sourceFor(pausedSet()))
    act(c)
    assert.equal(c.snapshot().setBoundary.manual, true)
    assert.equal(validWindow(c.snapshot().window, 15), true)
  }
})
test('selecting another source clears old boundary and preserves legacy manual-only metadata behavior', () => {
  const c = chooseController(); c.select(sourceFor(pausedSet()))
  assert.equal(c.select({ id: 'synthetic-other', label: 'Syntetisk', duration: 30 }), true)
  assert.equal(c.snapshot().setBoundary, null)
  assert.deepEqual(c.snapshot().window, { start: 15, end: 30 })
  assert.equal(c.next(), true)
})
test('invalid signals show an error and preserve the previous source and selection', () => {
  const c = chooseController(); c.select(sourceFor(pausedSet()))
  const before = c.snapshot()
  assert.equal(c.select(sourceFor({ lift: 'bench', samples: [{ time: 0, position: NaN, atRest: true }] })), false)
  const after = c.snapshot()
  assert.deepEqual(after.window, before.window); assert.deepEqual(after.source, before.source)
  assert.deepEqual(after.setBoundary, before.setBoundary); assert.match(after.error, /Bevægelsesdata/)
})
test('caller or subscriber mutation cannot change the chosen window', () => {
  const c = chooseController(), source = sourceFor(pausedSet())
  c.select(source); const before = c.snapshot()
  source.motion.samples[0].position = 1
  const snapshot = c.snapshot(); snapshot.window.start = 12; snapshot.setBoundary.window.start = 12
  assert.deepEqual(c.snapshot(), before)
})
test('default OFF avoids source/scope/adapter reads and produces no actions', async () => {
  assert.equal(DEFAULT_VIDEOCOACH, false)
  const poison = new Proxy({}, { get() { assert.fail('OFF read') } })
  const c = createUploadController({ getScope() { assert.fail('OFF scope') }, callbacks: poison })
  assert.equal(c.select(poison), false); assert.equal(c.next(), false); assert.equal(await c.send(), false)
  assert.equal(c.snapshot().phase, 'off')
})
test('scope changes and disposal prevent analysis or operations on another scope', async () => {
  let scope = 'synthetic-a'
  const c = chooseController({ getScope: () => scope }); c.select(sourceFor(pausedSet()))
  scope = 'synthetic-b'
  const poison = new Proxy({}, { get() { assert.fail('unavailable source read') } })
  assert.equal(c.select(poison), false); assert.equal(c.move(0), false); assert.equal(await c.send(), false)
  c.dispose(); assert.equal(c.snapshot().enabled, false)
})
