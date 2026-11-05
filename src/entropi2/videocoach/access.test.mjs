import test from 'node:test'
import assert from 'node:assert/strict'
import { createAthleteAccessController, normalizeOwnAnalysis } from './accessController.mjs'
import { renderFilmSetEntry, renderAthleteAccess } from './accessView.mjs'
import { h, nodes, text, buttons, click, options, deferred, fakeClock } from './accessSynthetic.mjs'

function fixture(extra = {}) {
  const calls = [], clock = fakeClock()
  let seq = 0
  const callbacks = {
    chooseSource(request) { calls.push(['choose', request]); return { id: 'synthetic-source', label: 'Syntetisk klip', duration: 20 } },
    analyze(request) { calls.push(['analyze', request]); return { reps: 3, path: [[5, .5, .8], [10, .5, .2], [20, .5, .8]] } },
    saveLocal(request) { calls.push(['save', request]); return { ok: true, localId: 'synthetic-local', clientAnalysisId: request.clientAnalysisId } },
    prepare(request) { calls.push(['prepare', request]); return { artifact: 'synthetic-artifact', duration: request.window.end - request.window.start } },
    upload(request) { calls.push(['upload', request]); return { ok: true, uploaded: true, clientAnalysisId: request.clientAnalysisId } },
    ...extra.callbacks,
  }
  const c = createAthleteAccessController({ enabled: true, options, clock, ...extra, callbacks, uuid: () => `synthetic-${++seq}` })
  return { c, calls, callbacks, clock, view: () => renderAthleteAccess(h, { state: c.snapshot(), controller: c }) }
}

test('default OFF, non-boolean opt-in and read-only preview do not inspect adapters or scope', async () => {
  for (const extra of [{}, { enabled: false }, { enabled: 'true' }, { enabled: 1 }, { enabled: true, readOnly: true }]) {
    const config = { ...extra, get callbacks() { throw Error('OFF adapter read') },
      get options() { throw Error('OFF option read') }, get getScope() { throw Error('OFF scope read') } }
    const c = createAthleteAccessController(config)
    assert.deepEqual(c.snapshot(), { enabled: false })
    assert.equal(c.open(), false); assert.equal(await c.chooseSource(), false); assert.equal(await c.send(), false)
    assert.equal(renderFilmSetEntry(h, { state: c.snapshot(), controller: c }), null)
    assert.equal(renderAthleteAccess(h, { state: c.snapshot(), controller: c }), null)
  }
})

test('one home entry and each set entry open the actual panel with the right context', () => {
  const f = fixture()
  assert.equal(f.view(), null)
  const home = renderFilmSetEntry(h, { state: f.c.snapshot(), controller: f.c })
  assert.equal(text(home), 'Film et sæt'); assert.equal(home.props.style.minHeight, 44)
  home.props.onClick(); assert.equal(f.c.snapshot().choice, null)
  for (const option of options) {
    const entry = renderFilmSetEntry(h, { state: f.c.snapshot(), controller: f.c, choiceKey: option.key })
    assert.equal(entry.props['aria-label'], `Film ${option.exercise_name}, sæt ${option.set_number}`)
    entry.props.onClick(); assert.equal(f.c.snapshot().choice.key, option.key)
    assert.equal(nodes(f.view()).find(n => n.tag === 'select').props.value, option.key)
  }
  assert.equal(renderFilmSetEntry(h, { state: f.c.snapshot(), controller: f.c, choiceKey: 'missing' }), null)
  assert.deepEqual(f.calls, []) // Opening never starts media, analysis, storage or sending.
})

test('own coach training and athlete use the same explicit ownership gate, with no role restriction', async () => {
  for (const role of ['athlete', 'coach']) {
    const f = fixture({ role })
    f.c.open(options[0].key)
    assert.equal(await click(f.view(), 'Optag video'), true)
    assert.equal(f.calls[0][1].mode, 'record')
    assert.equal(f.calls[0][1].choice.key, options[0].key)
    assert.deepEqual(f.calls.map(c => c[0]), ['choose', 'analyze'])
    assert.match(text(f.view()), /3 gentagelser registreret/)
    const line = nodes(f.view()).find(n => n.tag === 'polyline')
    assert.equal(line.props.points, '50,80 50,20 50,80')
    assert.equal(f.clock.timers.size, 0)
  }
})

test('empty pass supports honest own analysis and local save without a send or synthetic set', async () => {
  const f = fixture({ options: [] }); f.c.open()
  assert.match(text(f.view()), /Ingen sæt i dagens pas/)
  assert.equal(await click(f.view(), 'Vælg video'), true)
  assert.equal(await click(f.view(), 'Gem lokalt'), true)
  assert.match(text(f.view()), /Gemt lokalt på denne enhed/)
  assert.equal(await click(f.view(), 'Send til din coach'), false)
  assert.equal(await f.c.send(), false)
  assert.deepEqual(f.calls.map(c => c[0]), ['choose', 'analyze', 'save'])
  assert.equal(f.calls[2][1].choice, null)
  assert.deepEqual(f.calls[2][1].window, { start: 5, end: 20 })
})

test('local save needs a matching explicit receipt and retries the same ID', async () => {
  let fail = true
  const f = fixture({ callbacks: { saveLocal(request) {
    return { ok: !fail, localId: 'synthetic-local', clientAnalysisId: request.clientAnalysisId }
  } } })
  f.c.open(); await f.c.chooseSource()
  const id = f.c.snapshot().clientAnalysisId
  assert.equal(await f.c.saveLocal(), false)
  assert.match(text(f.view()), /Lokal gemning er ikke bekræftet/)
  assert.equal(f.c.snapshot().localId, null); assert.ok(f.c.snapshot().analysis)
  fail = false; assert.equal(await f.c.saveLocal(), true)
  assert.equal(f.c.snapshot().clientAnalysisId, id)
  assert.equal(await f.c.saveLocal(), false)
})

test('existing prepare/upload contract keeps set and window and only confirms matching receipt', async () => {
  let fail = true
  const seen = []
  const f = fixture({ callbacks: { upload(request) {
    seen.push(request)
    return { ok: !fail, uploaded: true, clientAnalysisId: request.clientAnalysisId }
  } } })
  f.c.open(options[1].key); await f.c.chooseSource()
  assert.equal(await click(f.view(), 'Send til din coach'), false)
  assert.equal(f.c.snapshot().delivery.phase, 'error')
  assert.match(text(f.view()), /Afsendelsen er ikke bekræftet/)
  assert.doesNotMatch(text(f.view()), /Sendt til din coach\./)
  assert.equal(f.c.reset(), false); assert.equal(await f.c.chooseSource(), false)
  fail = false; assert.equal(await click(f.view(), 'Prøv afsendelse igen'), true)
  assert.equal(seen.length, 2)
  assert.equal(seen[0].clientAnalysisId, seen[1].clientAnalysisId)
  assert.equal(seen[0].choice.key, options[1].key)
  assert.deepEqual(seen[0].window, { start: 5, end: 20 })
  assert.equal(seen[0].artifact, 'synthetic-artifact')
  assert.equal(f.calls.filter(c => c[0] === 'prepare').length, 1)
  assert.match(text(f.view()), /Sendt til din coach\./)
  assert.equal(f.c.reset(), true); assert.equal(f.c.snapshot().source, null)
})

test('missing adapters show disabled actions, empty result never fabricates reps or a path', () => {
  const c = createAthleteAccessController({ enabled: true })
  c.open()
  const tree = renderAthleteAccess(h, { state: c.snapshot(), controller: c })
  assert.match(text(tree), /ikke tilgængeligt her endnu/)
  assert.ok(buttons(tree).find(n => text(n) === 'Vælg video').props.disabled)
  assert.equal(nodes(tree).some(n => n.tag === 'svg'), false)
  assert.doesNotMatch(text(tree), /gentagelser registreret/)
})

test('picker cancellation and failure preserve the chosen clip and analysis', async () => {
  const f = fixture(); f.c.open(); await f.c.chooseSource()
  const before = f.c.snapshot()
  f.callbacks.chooseSource = () => null
  assert.equal(await f.c.chooseSource(), true)
  assert.deepEqual(f.c.snapshot().analysis, before.analysis)
  f.callbacks.chooseSource = () => { throw Error('Syntetisk afvisning') }
  assert.equal(await f.c.chooseSource(), false)
  assert.match(text(f.view()), /Syntetisk afvisning/)
  assert.deepEqual(f.c.snapshot().source, before.source)
  f.callbacks.chooseSource = () => ({ id: 'bad', label: 'Ugyldig', duration: NaN })
  assert.equal(await f.c.chooseSource(), false)
  assert.equal(f.c.snapshot().clientAnalysisId, before.clientAnalysisId)
})

test('invalid or empty analysis is an error with retry and no fabricated result', async () => {
  const f = fixture({ callbacks: { analyze: () => ({ reps: 0, path: [] }) } })
  f.c.open(options[0].key)
  assert.equal(await f.c.chooseSource(), false)
  assert.ok(f.c.snapshot().source); assert.equal(f.c.snapshot().analysis, null)
  assert.match(text(f.view()), /Analysen mangler/)
  f.callbacks.analyze = () => ({ reps: 0, path: [[5, 0, 0], [20, 1, 1]] })
  assert.equal(await click(f.view(), 'Analysér klippet'), true)
  assert.match(text(f.view()), /0 gentagelser registreret/)
})

test('single rep grammar and normalized paths are validated before display', () => {
  const window = { start: 0, end: 10 }
  const valid = { reps: 1, path: [[0, .2, .8], [10, .3, .7]] }
  const result = normalizeOwnAnalysis(valid, window)
  result.path[0][1] = .9; assert.equal(valid.path[0][1], .2)
  for (const invalid of [{}, { ...valid, reps: 1.2 }, { ...valid, reps: -1 }, { ...valid, reps: Infinity },
    { ...valid, path: [[0, 0, 0], [0, 1, 1]] }, { ...valid, path: [[-1, 0, 0], [1, 1, 1]] },
    { ...valid, path: [[0, 2, 0], [1, 1, 1]] }, { ...valid, path: [[0, 0, 0], [11, 1, 1]] },
    { ...valid, path: [[0, 0, 0], [1, NaN, 1]] }]) assert.throws(() => normalizeOwnAnalysis(invalid, window))
})

test('double taps are locked and closing cancels pending analysis without late UI writes', async () => {
  const pending = deferred()
  const f = fixture({ callbacks: { analyze: () => pending.promise } })
  f.c.open(); const task = f.c.chooseSource()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.c.snapshot().phase, 'analyzing')
  assert.equal(await f.c.chooseSource(), false); assert.equal(f.c.chooseSet(options[0].key), false)
  assert.equal(f.c.close(), true); assert.equal(await task, false)
  pending.resolve({ reps: 99, path: [[5, 0, 0], [20, 1, 1]] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.view(), null); assert.equal(f.c.snapshot().analysis, null)
  f.c.open(); assert.ok(f.c.snapshot().source); assert.equal(f.clock.timers.size, 0)
})

test('scope changes permanently revoke the draft and suppress pending results', async () => {
  let scope = 'synthetic-a'
  const pending = deferred()
  const f = fixture({ getScope: () => scope, callbacks: { chooseSource: () => pending.promise } })
  f.c.open(); const task = f.c.chooseSource()
  await new Promise(resolve => setImmediate(resolve))
  scope = 'synthetic-b'; assert.deepEqual(f.c.snapshot(), { enabled: false })
  scope = 'synthetic-a'; assert.deepEqual(f.c.snapshot(), { enabled: false })
  pending.resolve({ id: 'late', label: 'Sent syntetisk klip', duration: 10 })
  assert.equal(await task, false)
  assert.equal(f.c.open(), false); assert.equal(f.clock.timers.size, 0)
})

test('timeouts retain source and expose retry; cancellation and dispose clear all timers', async () => {
  const f = fixture({ callbacks: { analyze: () => new Promise(() => {}) } })
  f.c.open(); const task = f.c.chooseSource()
  await new Promise(resolve => setImmediate(resolve))
  f.clock.expire(); assert.equal(await task, false)
  assert.match(text(f.view()), /længere tid end ventet/); assert.ok(f.c.snapshot().source)
  assert.equal(f.clock.timers.size, 0)
  const again = f.c.analyze(); f.c.dispose()
  assert.equal(await again, false); assert.equal(f.clock.timers.size, 0)
})

test('changing context invalidates saved analysis and ID; another set cannot silently replace a draft', async () => {
  const f = fixture(); f.c.open(options[0].key); await f.c.chooseSource(); await f.c.saveLocal()
  const before = f.c.snapshot()
  assert.equal(f.c.open(options[1].key), false)
  assert.equal(f.c.snapshot().choice.key, options[0].key)
  assert.equal(f.c.chooseSet(options[1].key), true)
  assert.equal(f.c.snapshot().analysis, null); assert.equal(f.c.snapshot().localId, null)
  assert.notEqual(f.c.snapshot().clientAnalysisId, before.clientAnalysisId)
  assert.equal(f.c.chooseSet('missing'), false)
})
