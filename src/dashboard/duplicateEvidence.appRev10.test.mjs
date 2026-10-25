import test from 'node:test'
import assert from 'node:assert/strict'
import { videoCoachFeedbackPayload as payload, videoCoachFeedbackDraft as draft } from './coachVideoHjaelp.js'
import { lavVideoReviewHandlinger as handlers } from './videoReviewHandlinger.js'
import { setDatabase } from './videoCoachNotes.appRev10.fake.mjs'

for (const key of ['works', 'focus', 'next_set']) {
  for (const newline of ['\n', '\r\n', '\r']) {
    test(`K1 ${key} reduktion af ens noter med ${JSON.stringify(newline)}`, () => {
      const existing = { [key]: [
        {text: ' Ærlig ro ', evidence_refs: ['rep_1'], confidence: 0.9, metric_key: 'drift'},
        {text: 'Ærlig ro', evidence_refs: ['rep_2'], confidence: 0.8, metric_key: 'pause'},
      ] }
      const before = structuredClone(existing)
      const result = payload(existing, {[key]: `${newline}Ærlig ro${newline}`})
      assert.deepEqual(result[key], [{text: 'Ærlig ro', evidence_refs: ['coach_review']}])
      assert.deepEqual(existing, before)
    })
  }
}

test('K1 gammel strengnote og objekt med samme tekst er også tvetydige', () => {
  assert.deepEqual(payload({focus: ['Ro', {text: 'Ro', evidence_refs: ['rep_2'], confidence: 1}]}, {focus: 'Ro'}).focus,
    [{text: 'Ro', evidence_refs: ['coach_review']}])
})

test('K1 tre gamle ens noter reduceret til to får ingen målingsmetadata', () => {
  const existing = {works: [1, 2, 3].map(n => ({text: 'Ro', evidence_refs: [`rep_${n}`], confidence: n}))}
  assert.deepEqual(payload(existing, {works: 'Ro\nRo'}).works, [1, 2].map(() => ({text: 'Ro', evidence_refs: ['coach_review']})))
})

test('K1 uændret antal dubletter bevarer hver post og kopierer evidenslisten', () => {
  const existing = {works: [1, 2].map(n => ({text: 'Ro', evidence_refs: [`rep_${n}`], confidence: n}))}
  const result = payload(existing, draft(existing))
  assert.deepEqual(result.works, existing.works)
  result.works[0].evidence_refs.push('ny')
  assert.deepEqual(existing.works[0].evidence_refs, ['rep_1'])
})

test('K1 entydig ombytning og sletning bevarer rette metadata', () => {
  const a = {text: 'En', evidence_refs: ['rep_1'], confidence: 0.8}
  const b = {text: 'To', evidence_refs: ['rep_2'], confidence: 0.9}
  assert.deepEqual(payload({focus: [a,b]}, {focus: 'To\nEn'}).focus, [b,a])
  assert.deepEqual(payload({focus: [a,b]}, {focus: 'To'}).focus, [b])
})

test('K1 sikker evidens gemmes gennem handleren og kladden nulstilles efter bekræftelse', async () => {
  const row = {id: 'analysis', athlete_id: 'athlete', status: 'draft', athlete_feedback: {
    focus: [1, 2].map(n => ({text: 'God ro', evidence_refs: [`rep_${n}`], confidence: 1})),
  }}
  const original = structuredClone(row), events = [], filters = []
  let written
  setDatabase({from(table) {
    assert.equal(table, 'video_analyses')
    const q = {
      update(value) {written = structuredClone(value); return q},
      eq(...args) {filters.push(args); return q},
      filter(key, op, value) {assert.equal(op, 'eq'); assert.deepEqual(JSON.parse(value), original.athlete_feedback); return q},
      select() {return q},
      async single() {return {data: {...row, ...written}, error: null}},
    }
    return q
  }})
  const options = {selectedAthlete: {id:'athlete'}, videoAnalysisFeedbackDraft: {focus:'God ro'}, videoBaselines: [],
    showFlash: (...args) => events.push(['flash', ...args])}
  for (const name of ['setVideoAnalyses','setVideoAnalysisBaselineFindingId','setVideoAnalysisCloseWarning','setVideoAnalysisError','setVideoAnalysisFeedbackDirty','setVideoAnalysisFeedbackDraft','setVideoAnalysisReview','setVideoAnalysisReviewError','setVideoAnalysisReviewLoadingId','setVideoAnalysisUpdatingId'])
    options[name] = value => events.push([name,value])
  await handlers(options).saveVideoAnalysisFeedback(row)
  assert.deepEqual(written.athlete_feedback.focus, [{text:'God ro', evidence_refs:['coach_review']}])
  assert.ok(filters.some(([key,value]) => key === 'status' && value === 'draft'))
  assert.ok(events.some(([key,value]) => key === 'setVideoAnalysisFeedbackDirty' && value === false))
  assert.deepEqual(row, original)
})


test('K1 tilføjet ens linje kan heller ikke identificere den gamle forekomst', () => {
  const existing = {next_set: [{text: 'Ro', evidence_refs: ['rep_1'], confidence: 1}]}
  assert.deepEqual(payload(existing, {next_set: 'Ro\nRo'}).next_set,
    [1, 2].map(() => ({text: 'Ro', evidence_refs: ['coach_review']})))
})
