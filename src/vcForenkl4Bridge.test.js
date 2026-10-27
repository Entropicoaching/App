import test from 'node:test'
import assert from 'node:assert/strict'
await import('./test-loader.mjs')
const { useVideoCoachBro } = await import('./useVideoCoachBro.js')
const runtime = await import('./syntheticRuntime.mjs')
const { resetEffects } = runtime
const prefix = 'entropi:videocoach:v3'
function fixture(enabled = true, result = null) {
  resetEffects()
  const calls = [], listeners = new Map(), source = { postMessage: message => calls.push(['reply', message]) }
  globalThis.window = { location: { origin: 'https://synthetic.invalid' },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  globalThis.localStorage = { getItem: () => null }
  const pending = { athleteId: 'athlete', clientAnalysisId: 'clip', url: 'synthetic-video' }
  const ref = current => ({ current })
  const opts = { videoCoachForenkl4: enabled, athletes: [{ id: 'athlete', name: 'Syntetisk atlet' }],
    selectedAthlete: { id: 'athlete' },
    fetchVideoCoachHistory: id => calls.push(['history', id]), fetchVideoReviewQueue: () => calls.push(['queue']),
    openProfile: (...args) => calls.push(['profile', ...args]), setConfirmDialog: v => calls.push(['dialog', v]),
    setSelectedAthlete: v => calls.push(['selected', v]), setVideoCoachOpen: v => calls.push(['open', v]),
    setVideoReviewRequest: v => calls.push(['review', v]), setView: v => calls.push(['view', v]),
    showFlash: (...args) => calls.push(['flash', ...args]), videoCoachAthletesRef: ref([]),
    videoCoachClientsRef: ref(new Set([source])), videoCoachFrameRef: ref({ contentWindow: source }),
    videoCoachPendingCompletionRef: ref(pending), videoCoachPendingShareRef: ref(null), videoCoachSelectedAthleteRef: ref('athlete') }
  let payload
  const query = { update(v) { payload = v; calls.push(['write', v]); return this },
    insert(v) { payload = v; calls.push(['insert', v]); return this }, eq() { return this }, select() { return this },
    async single() { return result ? result(payload) : { data: { id: 'saved-video', ...payload }, error: null } } }
  globalThis.syntheticFrom = table => { assert.equal(table, 'video_analyses'); return query }
  if (enabled === 'default') delete opts.videoCoachForenkl4
  useVideoCoachBro(opts)
  const cleanups = runtime.effects.map(fn => fn())
  calls.length = 0
  const row = { client_analysis_id: 'clip', athlete_id: 'athlete', status: 'draft', source_mode: 'athlete_submission', schema_version: 3, schema_v: 3,
    lift: 'squat', variation: 'competition', reps: [1], reps_count: 1, metrics: {}, findings: [],
    rep_details: [{ start_s: 0, end_s: 1, valid_ratio: 1, confidence: 0.9 }] }
  const send = (message = { type: `${prefix}:save-draft`, requestId: 'request', row }, sender = source, origin = window.location.origin) => listeners.get('message')({ data: message, source: sender, origin })
  return { calls, opts, row, send, source, close: () => send({ type: `${prefix}:close` }), cleanup: () => cleanups.forEach(fn => fn?.()) }
}

test('C1: faktisk hook gemmer den sporede atletvideo og åbner netop dens review uden deling', async () => {
  const f = fixture(); await f.send()
  assert.equal(f.calls.filter(c => c[0] === 'write').length, 1)
  assert.equal(f.calls.some(c => c[0] === 'insert'), false)
  assert.deepEqual(f.calls.find(c => c[0] === 'review')[1].item, { id: 'saved-video', athlete_id: 'athlete' })
  assert.equal(f.calls.find(c => c[0] === 'profile')[2], 'analyse')
  assert.ok(f.calls.some(c => c[0] === 'open' && c[1] === false))
  assert.equal(f.calls.find(c => c[0] === 'write')[1].status, 'draft')
  assert.equal(f.opts.videoCoachPendingCompletionRef.current, null)
  await f.send()
  assert.equal(f.calls.filter(c => c[0] === 'review').length, 1)
  f.cleanup()
})

test('C1: flag OFF bevarer den åbne tracker og åbner intet review', async () => {
  for (const enabled of [false, 'default', 'true']) {
    const f = fixture(enabled); await f.send()
    assert.equal(f.calls.some(c => c[0] === 'review' || c[0] === 'open'), false)
    assert.equal(f.calls.filter(c => c[0] === 'write').length, 1); f.cleanup()
  }
})

test('C1: gemmefejl eller forkert kvittering åbner intet og bevarer retry-bindingen', async () => {
  for (const result of [() => ({ error: { message: 'synthetic failure' } }),
    payload => ({ data: { id: 'wrong', ...payload, athlete_id: 'other' } })]) {
    const f = fixture(true, result); await f.send()
    assert.equal(f.calls.some(c => c[0] === 'review'), false)
    assert.equal(f.opts.videoCoachPendingCompletionRef.current.clientAnalysisId, 'clip')
    assert.equal(f.calls.find(c => c[0] === 'reply')[1].ok, false); f.cleanup()
  }
})

test('C1: forkert atlet, klip og origin kan ikke udløse review', async () => {
  for (const patch of [{ athlete_id: 'other' }, { client_analysis_id: 'other' }]) {
    const f = fixture(); await f.send({ type: `${prefix}:save-draft`, row: { ...f.row, ...patch } })
    assert.equal(f.calls.some(c => c[0] === 'write' || c[0] === 'review'), false); f.cleanup()
  }
  const f = fixture(); await f.send(undefined, f.source, 'https://other.invalid')
  assert.equal(f.calls.length, 0); f.cleanup()
})

test('C1: lukket iframe under write genåbnes ikke; et nyere pending-flow bevares', async () => {
  for (const replace of [false, true]) {
    let finish
    const f = fixture(true, payload => new Promise(resolve => { finish = () => resolve({ data: { id: 'saved-video', ...payload } }) }))
    const save = f.send(); await f.close()
    const newer = { athleteId: 'athlete', clientAnalysisId: 'new-clip' }
    if (replace) f.opts.videoCoachPendingCompletionRef.current = newer
    finish(); await save
    assert.equal(f.calls.some(c => c[0] === 'review' || c[0] === 'profile'), false)
    assert.equal(f.opts.videoCoachPendingCompletionRef.current, replace ? newer : null)
    f.cleanup()
  }
})

test('Modprøve: to samtidige completion-svar giver kun én retur til review', async () => {
  const finishes = []
  const f = fixture(true, payload => new Promise(resolve => { finishes.push(() => resolve({ data: { id: 'saved-video', ...payload } })) }))
  const first = f.send(), second = f.send()
  finishes[0](); await first
  finishes[1](); await second
  assert.equal(f.calls.filter(c => c[0] === 'review').length, 1)
  assert.equal(f.calls.filter(c => c[0] === 'profile').length, 1)
  f.cleanup()
})

test('Modprøve: afmonteret iframe uden close-besked giver ingen navigation', async () => {
  let finish
  const f = fixture(true, payload => new Promise(resolve => { finish = () => resolve({ data: { id: 'saved-video', ...payload } }) }))
  const save = f.send()
  f.opts.videoCoachFrameRef.current = null
  finish(); await save
  assert.equal(f.calls.some(c => c[0] === 'review' || c[0] === 'profile'), false)
  f.cleanup()
})
