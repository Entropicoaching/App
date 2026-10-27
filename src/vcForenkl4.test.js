import test from 'node:test'
import assert from 'node:assert/strict'
await import('./test-loader.mjs')
const { DEFAULT_VIDEOCOACH_FORENKL4, renderVideoCoachChoices, returnCompletedVideoToReview } = await import('./vcForenkl4.mjs')
const { createSaveApproveShareHandler } = await import('./videoSaveApproveShare.mjs')
const h = (tag, props, ...children) => ({ tag, props, children })

test('A2: default OFF; begge DOM-knapper vælger korrekt vej uden at sende', () => {
  assert.equal(DEFAULT_VIDEOCOACH_FORENKL4, false)
  const calls = [], options = { athleteId: 'synthetic', setInstant: v => calls.push(['instant', v]), setOpen: v => calls.push(['open', v]) }
  assert.equal(renderVideoCoachChoices(h, options), null)
  assert.equal(renderVideoCoachChoices(h, { ...options, enabled: 'true' }), null)
  const dom = renderVideoCoachChoices(h, { ...options, enabled: true })
  const buttons = dom.children.filter(node => node.tag === 'button')
  assert.deepEqual(buttons.map(b => b.children[0]), ['Send video til coach', 'Se egen analyse først'])
  assert.deepEqual(calls, [])
  buttons.forEach(b => b.props.onClick())
  assert.deepEqual(calls, [['instant', false], ['open', true], ['instant', true], ['open', true]])
  renderVideoCoachChoices(h, { ...options, enabled: true, athleteId: null }).children[1].props.onClick()
  assert.equal(calls.length, 4)
})

function fixture(overrides = {}) {
  const analysis = { id: 'video', athlete_id: 'athlete', client_analysis_id: 'clip', status: 'draft', athlete_feedback: null }
  const calls = [], state = { review: analysis, list: [analysis], dirty: true, draft: null, error: null }
  let payload
  const query = {
    update(v) { payload = v; calls.push(['update', structuredClone(v)]); return this },
    eq(...v) { calls.push(['eq', ...v]); return this },
    is(...v) { calls.push(['is', ...v]); return this },
    filter(...v) { calls.push(['filter', ...v]); return this },
    select() { return this },
    async single() { return overrides.result ? await overrides.result(payload) : { data: { ...analysis, ...payload }, error: null } },
  }
  const options = { enabled: true, selectedAthlete: { id: 'athlete' }, videoBaselines: [],
    videoAnalysisFeedbackDraft: { works: 'Du holder balancen i bunden.', focus: 'Hold trykket gennem hele foden.', next_set: 'Pres gulvet væk på næste gentagelse.' },
    videoAnalysisBaselineFindingId: '',
    supabase: { from(table) { assert.equal(table, 'video_analyses'); return query } },
    setVideoAnalysisUpdatingId: v => calls.push(['busy', v]),
    setVideoAnalysisReviewError: v => { state.error = v },
    setVideoAnalysisReview: fn => { state.review = fn(state.review) },
    setVideoAnalyses: fn => { state.list = fn(state.list) },
    setVideoAnalysisFeedbackDraft: v => { state.draft = v },
    setVideoAnalysisBaselineFindingId: v => calls.push(['baseline', v]),
    setVideoAnalysisFeedbackDirty: v => { state.dirty = v },
    setVideoAnalysisCloseWarning: v => calls.push(['warning', v]),
    fetchVideoCoachHistory: async id => calls.push(['history', id]),
    fetchVideoReviewQueue: async () => calls.push(['queue']),
    showFlash: (...args) => calls.push(['flash', ...args]), ...overrides.options }
  return { analysis, calls, state, options, run: createSaveApproveShareHandler(options) }
}

test('C2: faktisk handler gemmer, godkender og deler atomisk med scope og samtidighedsværn', async () => {
  const f = fixture(); const before = structuredClone(f.analysis)
  await f.run(f.analysis)
  assert.equal(f.calls.filter(c => c[0] === 'update').length, 1)
  assert.equal(f.state.review.status, 'shared'); assert.equal(f.state.list[0].status, 'shared')
  assert.equal(f.state.dirty, false); assert.equal(f.state.error, null)
  for (const pair of [['id', 'video'], ['athlete_id', 'athlete'], ['client_analysis_id', 'clip'], ['status', 'draft']])
    assert.ok(f.calls.some(c => c[0] === 'eq' && c[1] === pair[0] && c[2] === pair[1]))
  assert.ok(f.calls.some(c => c[0] === 'is' && c[1] === 'athlete_feedback'))
  assert.deepEqual(f.analysis, before)
  assert.ok(f.state.draft.focus.includes('Hold trykket'))
})

test('C2: default OFF og ugyldigt scope/status skriver intet', async () => {
  for (const options of [{ enabled: undefined }, { enabled: false }, { enabled: 'true' }, { selectedAthlete: null }, { videoAnalysisUpdatingId: 'busy' }]) {
    const f = fixture({ options }); await f.run(f.analysis); assert.equal(f.calls.length, 0)
  }
  for (const patch of [{ status: 'shared' }, { status: 'invalid' }, { athlete_id: 'other' }, { id: null }]) {
    const f = fixture(); await f.run({ ...f.analysis, ...patch }); assert.equal(f.calls.length, 0)
  }
})

test('C2: kvalitet, længde, antal linjer og forældet baseline afviser før write og bevarer udkast', async () => {
  for (const options of [
    { videoAnalysisFeedbackDraft: { works: '', focus: '', next_set: '' } },
    { videoAnalysisFeedbackDraft: { focus: 'x'.repeat(601) } },
    { videoAnalysisFeedbackDraft: { focus: 'en\nto\ntre' } },
    { videoAnalysisBaselineFindingId: 'deleted-baseline' },
  ]) {
    const f = fixture({ options }); await f.run(f.analysis)
    assert.equal(f.calls.some(c => c[0] === 'update'), false)
    assert.equal(f.state.dirty, true); assert.equal(f.state.review.status, 'draft'); assert.ok(f.state.error)
  }
})

test('C2: writefejl, konflikt, forkert kvittering og retry bevarer ændringer', async () => {
  for (const result of [() => ({ error: { message: 'conflict' } }), () => ({ data: null }),
    payload => ({ data: { id: 'other', athlete_id: 'athlete', ...payload } }),
    payload => ({ data: { id: 'video', athlete_id: 'other', ...payload } }),
    payload => ({ data: { id: 'video', athlete_id: 'athlete', client_analysis_id: 'other', ...payload } })]) {
    const f = fixture({ result }); await f.run(f.analysis)
    assert.equal(f.state.dirty, true); assert.equal(f.state.review.status, 'draft'); assert.ok(f.state.error)
    await f.run(f.analysis)
    assert.equal(f.calls.filter(c => c[0] === 'update').length, 2)
  }
})

test('C2: dobbeltklik og nyt render deler samme lås; refreshfejl ændrer ikke bekræftet deling', async () => {
  let finish
  const f = fixture({ result: payload => new Promise(resolve => { finish = () => resolve({ data: { ...f.analysis, ...payload } }) }) })
  const first = f.run(f.analysis)
  await createSaveApproveShareHandler(f.options)(f.analysis)
  assert.equal(f.calls.filter(c => c[0] === 'update').length, 1)
  finish(); await first
  const g = fixture({ options: { fetchVideoCoachHistory: async () => { throw Error('refresh') } } })
  await g.run(g.analysis)
  assert.equal(g.state.review.status, 'shared'); assert.equal(g.state.dirty, false); assert.match(g.state.error, /er delt/)
})

test('C2: godkendt række og eksisterende feedback bruger fortsat compare-and-set', async () => {
  const f = fixture(); f.analysis.status = 'coach_approved'; f.analysis.athlete_feedback = { focus: [{ text: 'Old' }] }
  await f.run(f.analysis)
  assert.equal(f.state.review.status, 'shared')
  assert.ok(f.calls.some(c => c[0] === 'filter' && c[1] === 'athlete_feedback' && c[3] === JSON.stringify(f.analysis.athlete_feedback)))
})

test('C1: helper afviser lukket flow, forkert atlet/klip og default OFF', () => {
  const options = { active: true, pending: { athleteId: 'a', clientAnalysisId: 'c' }, data: { id: 'v', athlete_id: 'a', client_analysis_id: 'c' }, athletes: [{ id: 'a' }] }
  for (const patch of [{}, { enabled: true, active: false }, { enabled: true, data: { id: 'v', athlete_id: 'b', client_analysis_id: 'c' } }, { enabled: true, athletes: [] }, { enabled: true, data: { id: 'v', athlete_id: 'a', client_analysis_id: 'wrong' } }])
    assert.equal(returnCompletedVideoToReview({ ...options, ...patch }), false)
})

test('Modprøve: JSONB-omordnede nøgler er samme feedback, ændret feedback er ikke', async () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).reverse().map(k => [k, reorder(value[k])])) : value
  const f = fixture({ result: payload => ({ data: reorder({ ...f.analysis, ...payload }) }) })
  await f.run(f.analysis)
  assert.equal(f.state.review.status, 'shared'); assert.equal(f.state.error, null)
  const g = fixture({ result: payload => ({ data: { ...g.analysis, ...payload, athlete_feedback: {} } }) })
  await g.run(g.analysis)
  assert.equal(g.state.dirty, true); assert.ok(g.state.error)
})

test('Modprøve: forkert bekræftet status giver ingen lokal succes', async () => {
  const f = fixture({ result: payload => ({ data: { ...f.analysis, ...payload, status: 'coach_approved' } }) })
  await f.run(f.analysis)
  assert.equal(f.state.review.status, 'draft'); assert.equal(f.state.dirty, true)
  assert.equal(f.calls.some(c => c[0] === 'flash' && c[2] === 'success'), false)
})
