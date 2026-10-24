import test from 'node:test'
import assert from 'node:assert/strict'
import { videoCoachPersonalBaselineOptions as options, sanitizeVideoCoachPersonalBaseline as sanitize,
  videoCoachPersonalBaselineForAnalysis as forAnalysis, videoCoachPersonalBaselineAthleteText as athleteText,
  videoCoachPersonalBaselineSelection as selection, withVideoCoachPersonalBaseline as withBaseline } from './videoCoachPersonalFeedback.js'

function fixture() {
  const baseline = { lift: 'squat', variation: 'competition_squat', metric_key: 'rom', metric_method: 'synthetic-v1',
    n_analyses: 5, median: 40, baseline_version: 'v1' }
  const analysis = { id: 'analysis1', athlete_id: 'athlete1', lift: 'squat', variation: 'competition_squat', low_conf_pct: 5,
    metrics: { rom: { value: 42, method: 'synthetic-v1', confidence: 0.9, eligible_for_baseline: true } },
    findings: [{ id: 'baseline_rom', summary: 'OBS: ROM over atletens median i dette sæt', evidence_refs: ['rom'], confidence: 0.8 }],
    session_context: { baseline_snapshot: [{ ...baseline }] } }
  return { baseline, analysis }
}
test('APP-TEST5 Personal: no history or snapshot means no personal claim', () => {
  assert.deepEqual(options([], null, 'athlete1'), [])
  const { baseline, analysis } = fixture()
  assert.deepEqual(options([], analysis, 'athlete1'), [])
  assert.deepEqual(options([baseline], { ...analysis, session_context: {} }, 'athlete1'), [])
  assert.equal(athleteText(null), '')
  assert.equal(sanitize({ text: 'Du bliver stærkere' }), null)
})
test('APP-TEST5 Personal: binds metric, method, version, athlete and analysis', () => {
  const { baseline, analysis } = fixture(), before = structuredClone(analysis)
  const result = options([baseline], analysis, 'athlete1')
  assert.equal(result.length, 1)
  const feedback = withBaseline({ focus: 'Bevar retningen' }, result[0])
  assert.equal(selection(feedback, result), 'baseline_rom')
  assert.equal(forAnalysis(feedback, analysis, 'athlete1').evidence_ref.analysis_id, 'analysis1')
  assert.equal(forAnalysis(feedback, { ...analysis, id: 'other' }, 'athlete1'), null)
  assert.equal(forAnalysis(feedback, analysis, 'other'), null)
  assert.equal(athleteText(result[0]), 'ROM over din median i dette sæt')
  assert.deepEqual(analysis, before)
  assert.equal(Object.hasOwn(withBaseline(feedback, null), 'personal_baseline'), false)
})
test('APP-TEST5 Personal: insufficient or mismatched evidence removes options', () => {
  const changes = [
    f => { f.baseline.n_analyses = 2 },
    f => { f.baseline.baseline_version = 'old' },
    f => { f.analysis.metrics.rom.method = 'other' },
    f => { f.analysis.metrics.rom.confidence = 0.74 },
    f => { f.analysis.findings[0].confidence = 0.64 },
    f => { f.analysis.findings[0].evidence_refs = [] },
    f => { f.analysis.low_conf_pct = 16 },
    f => { f.analysis.athlete_id = 'other' },
  ]
  for (const change of changes) {
    const f = fixture(); change(f)
    assert.deepEqual(options([f.baseline], f.analysis, 'athlete1'), [])
  }
})
test('APP-TEST5 Personal: missing and nonfinite values cannot support athlete text', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, '', false]) {
    const { baseline, analysis } = fixture()
    analysis.metrics.rom.value = value
    assert.deepEqual(options([baseline], analysis, 'athlete1'), [], String(value))
  }
})
test('APP-TEST5 Personal: missing angle metric has no angle comparison', () => {
  const { baseline, analysis } = fixture()
  analysis.metrics = {}
  assert.deepEqual(options([baseline], analysis, 'athlete1'), [])
  assert.equal(athleteText(withBaseline({}, null).personal_baseline), '')
})
