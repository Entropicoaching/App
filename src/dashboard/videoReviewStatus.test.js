import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoReviewStatusHandler } from './videoReviewStatus.mjs'

function fixture(overrides = {}, result = {}) {
  const calls = [], flashes = [], errors = [], busy = [], reviews = []
  const analysis = { id: 'analysis-1', athlete_id: 'athlete-1', status: 'draft',
    client_analysis_id: 'client-1', athlete_feedback: null }
  let status
  const query = {
    update(payload) { status = payload.status; calls.push(['update', payload]); return this },
    eq(...args) { calls.push(['eq', ...args]); return this },
    is(...args) { calls.push(['is', ...args]); return this },
    filter(...args) { calls.push(['filter', ...args]); return this },
    select(...args) { calls.push(['select', ...args]); return this },
    async single() { return { data: { id: analysis.id, athlete_id: analysis.athlete_id,
      status }, error: null, ...result } },
  }
  const options = {
    selectedAthlete: { id: analysis.athlete_id }, videoBaselines: [],
    videoAnalysisUpdatingId: null, videoAnalysisFeedbackDirty: false,
    videoCoachFeedbackQuality: () => ({ canShare: true }),
    videoCoachPersonalBaselineOptions: () => [],
    videoCoachPersonalBaselineSelection: () => true,
    openVideoAnalysisReview: async () => calls.push(['open']),
    setVideoAnalysisReviewError: error => errors.push(error),
    showFlash: (...args) => flashes.push(args),
    setVideoAnalysisUpdatingId: id => busy.push(id),
    setVideoAnalysisError: error => errors.push(error),
    supabase: { from: table => { calls.push(['from', table]); return query } },
    fetchVideoCoachHistory: async id => calls.push(['history', id]),
    fetchVideoReviewQueue: () => calls.push(['queue']),
    setVideoAnalysisReview: fn => reviews.push(fn(analysis)),
    ...overrides,
  }
  return { handler: createVideoReviewStatusHandler(options), analysis, calls,
    flashes, errors, busy, reviews }
}

test('F1 C2: den faktiske status-handler viser næste trin efter bekræftet godkendelse', async () => {
  const f = fixture()
  await f.handler(f.analysis, 'coach_approved')
  assert.deepEqual(f.flashes, [['Godkendt til baseline. Atleten ser intet endnu. Næste skridt: ret feedbacken, og tryk Del feedback med atlet.', 'success']])
  assert.deepEqual(f.busy, ['analysis-1', null])
  assert.deepEqual(f.reviews, [{ ...f.analysis, status: 'coach_approved' }])
  assert.ok(f.calls.some(row => row[0] === 'history' && row[1] === 'athlete-1'))
  for (const filter of [['eq', 'id', 'analysis-1'], ['eq', 'athlete_id', 'athlete-1'],
    ['eq', 'client_analysis_id', 'client-1'], ['eq', 'status', 'draft'],
    ['is', 'athlete_feedback', null]]) assert.ok(f.calls.some(row => JSON.stringify(row) === JSON.stringify(filter)))
})

test('F1 C2: ingen succesbesked mens databasesvaret afventes', async () => {
  let resolve
  const response = new Promise(done => { resolve = done })
  const query = { update() { return this }, eq() { return this }, is() { return this },
    select() { return this }, single() { return response } }
  const f = fixture({ supabase: { from: () => query } })
  const action = f.handler(f.analysis, 'coach_approved')
  assert.deepEqual(f.flashes, [])
  resolve({ data: { id: 'analysis-1', athlete_id: 'athlete-1', status: 'coach_approved' } })
  await action
  assert.equal(f.flashes.length, 1)
  assert.equal(f.flashes[0][1], 'success')
})

test('F1 C2: forkert svar eller skrivefejl giver kun fejlbesked', async () => {
  for (const result of [{ data: { id: 'other', athlete_id: 'athlete-1', status: 'coach_approved' } },
    { error: new Error('syntetisk skrivefejl') }]) {
    const f = fixture({}, result)
    await f.handler(f.analysis, 'coach_approved')
    assert.deepEqual(f.flashes, [['Videoanalysen kunne ikke opdateres', 'error']])
    assert.deepEqual(f.busy, ['analysis-1', null])
    assert.equal(f.reviews.length, 0)
  }
})

test('F1 C2: deling kræver godkendelse, gemt feedback og brugbart cue', async () => {
  const draft = fixture()
  await draft.handler(draft.analysis, 'shared')
  assert.deepEqual(draft.calls, [])
  const dirty = fixture({ videoAnalysisFeedbackDirty: true })
  await dirty.handler({ ...dirty.analysis, status: 'coach_approved' }, 'shared')
  assert.deepEqual(dirty.flashes, [['Gem feedbacken først, så kan du dele den', 'error']])
  assert.deepEqual(dirty.calls, [])
  const badCue = fixture({ videoCoachFeedbackQuality: () => ({ canShare: false, detail: 'cue mangler' }) })
  await badCue.handler({ ...badCue.analysis, status: 'coach_approved' }, 'shared')
  assert.deepEqual(badCue.calls, [['open']])
  assert.deepEqual(badCue.errors, ['cue mangler'])
})

test('F1 C2: personlig baseline kontrolleres før deling', async () => {
  const f = fixture({ videoCoachPersonalBaselineSelection: () => false })
  await f.handler({ ...f.analysis, status: 'coach_approved', athlete_feedback: { personal_baseline: 'old' } }, 'shared')
  assert.deepEqual(f.calls, [['open']])
  assert.equal(f.flashes[0][1], 'error')
  assert.equal(f.busy.length, 0)
})

test('F1 C2: øvrige statustekster og feedback-filter bevares', async () => {
  for (const [status, message] of [['shared', 'Feedback delt. Atleten kan se den i appen.'],
    ['invalid', 'Videoanalyse udeladt fra personlig baseline'],
    ['draft', 'Videoanalyse flyttet tilbage til kladde']]) {
    const f = fixture()
    const analysis = { ...f.analysis, status: 'coach_approved', athlete_feedback: { cue: 'syntetisk' } }
    await f.handler(analysis, status)
    assert.deepEqual(f.flashes, [[message, 'success']])
    assert.ok(f.calls.some(row => row[0] === 'filter' && row[1] === 'athlete_feedback' && row[3] === JSON.stringify(analysis.athlete_feedback)))
  }
})

test('F1 C2: manglende identitet, ukendt status og igangværende skrivning afvises', async () => {
  for (const [options, status] of [[{ selectedAthlete: null }, 'coach_approved'],
    [{ videoAnalysisUpdatingId: 'busy' }, 'coach_approved'], [{}, 'unknown']]) {
    const f = fixture(options)
    await f.handler(f.analysis, status)
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.flashes, [])
  }
})
