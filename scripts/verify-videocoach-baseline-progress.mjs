import assert from 'node:assert/strict'
import {
  buildVideoCoachBaselineProfiles,
  countReadyVideoCoachBaselineProfiles,
  videoCoachBaselineReviewImpact,
} from '../src/videoCoachBaselineProgress.js'

const profiles = buildVideoCoachBaselineProfiles([
  { lift: 'squat', variation: 'konkurrence_squat', metric_key: 'rom_cm', n_analyses: 4 },
  { lift: 'squat', variation: 'competition_squat', metric_key: 'bar_drift_cm', n_analyses: 3 },
  { lift: 'bench', variation: 'konkurrence_baenk_pause', metric_key: 'rom_cm', n_analyses: 5 },
  { lift: 'bench', variation: 'konkurrence_b_nk_pause', metric_key: 'bar_drift_cm', n_analyses: 6 },
  { lift: 'deadlift', variation: 'rumaensk_doedloeft', metric_key: 'rom_cm', n_analyses: 2 },
  { lift: 'unknown', variation: 'standard', metric_key: 'rom_cm', n_analyses: 9 },
  { lift: 'squat', variation: 'pause_squat', metric_key: 'rom_cm', n_analyses: 0 },
])

assert.equal(profiles.length, 3)
assert.equal(countReadyVideoCoachBaselineProfiles(profiles), 1)

assert.deepEqual(profiles[0], {
  key: 'bench:konkurrence_b_nk_pause',
  lift: 'bench',
  variation: 'konkurrence_b_nk_pause',
  label: 'Bænkpres · Konkurrence bænk (pause)',
  nAnalyses: 6,
  remaining: 0,
  progressPct: 100,
  stage: 'ready',
})

const squat = profiles.find(profile => profile.lift === 'squat')
assert.equal(squat.nAnalyses, 4)
assert.equal(squat.remaining, 1)
assert.equal(squat.progressPct, 80)
assert.equal(squat.stage, 'preliminary')

const deadlift = profiles.find(profile => profile.lift === 'deadlift')
assert.equal(deadlift.label, 'Dødløft · Rumænsk dødløft')
assert.equal(deadlift.remaining, 3)
assert.equal(deadlift.progressPct, 40)
assert.equal(deadlift.stage, 'building')

const analysisOnly = buildVideoCoachBaselineProfiles([], [
  { id: 'a', status: 'coach_approved', lift: 'bench', variation: 'konkurrence_baenk_pause', low_conf_pct: 4,
    metrics: { rom_cm: { value: 34, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true, confidence: null } } },
  { id: 'b', status: 'shared', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 10,
    metrics: { bar_drift_cm: { value: 3, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true, confidence: 0.8 } } },
  { id: 'c', status: 'coach_approved', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 16,
    metrics: { rom_cm: { value: 35, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true } } },
  { id: 'd', status: 'draft', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 1,
    metrics: { rom_cm: { value: 35, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true } } },
  { id: 'e', status: 'coach_approved', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 1,
    metrics: { rom_cm: { value: 35, method: '', eligible_for_baseline: true } } },
  { id: 'f', status: 'coach_approved', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 1,
    metrics: [{ value: 35, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true, confidence: 0.9 }] },
  { id: 'g', status: 'coach_approved', lift: 'bench', variation: 'konkurrence_b_nk_pause', low_conf_pct: 1,
    metrics: { rom_cm: { value: 'abc', method: 'tracked_path_calibrated_v1', eligible_for_baseline: true, confidence: 0.9 } } },
])
assert.equal(analysisOnly.length, 1)
assert.equal(analysisOnly[0].nAnalyses, 1)
assert.equal(analysisOnly[0].remaining, 4)
assert.equal(analysisOnly[0].stage, 'building')

const cacheWins = buildVideoCoachBaselineProfiles([
  { lift: 'bench', variation: 'konkurrence_b_nk_pause', n_analyses: 7 },
], analysisOnly)
assert.equal(cacheWins[0].nAnalyses, 7)

const eligibleMetric = {
  rom_cm: { value: 34, method: 'tracked_path_calibrated_v1', eligible_for_baseline: true, confidence: 0.9 },
}
const startsProfile = videoCoachBaselineReviewImpact([], [], {
  id: 'draft-a', status: 'draft', lift: 'bench', variation: 'konkurrence_baenk_pause',
  low_conf_pct: 2, metrics: eligibleMetric,
})
assert.equal(startsProfile.kind, 'building')
assert.equal(startsProfile.current, 0)
assert.equal(startsProfile.after, 1)
assert.equal(startsProfile.title, 'Starter personlig baseline')

const makesPreliminary = videoCoachBaselineReviewImpact([
  { lift: 'squat', variation: 'konkurrence_squat', n_analyses: 2 },
], [], {
  id: 'draft-b', status: 'draft', lift: 'squat', variation: 'competition_squat',
  low_conf_pct: 5, metrics: eligibleMetric,
})
assert.equal(makesPreliminary.kind, 'preliminary')
assert.equal(makesPreliminary.after, 3)
assert.equal(makesPreliminary.title, 'Giver en foreløbig retning')

const makesReady = videoCoachBaselineReviewImpact([
  { lift: 'deadlift', variation: 'konkurrence_konventionel', n_analyses: 4 },
], [], {
  id: 'draft-c', status: 'draft', lift: 'deadlift', variation: 'competition_conventional',
  low_conf_pct: 5, metrics: eligibleMetric,
})
assert.equal(makesReady.kind, 'ready')
assert.equal(makesReady.after, 5)
assert.equal(makesReady.title, 'Gør baseline klar')

const blocked = videoCoachBaselineReviewImpact([], [], {
  id: 'draft-d', status: 'draft', lift: 'bench', variation: 'competition_bench',
  low_conf_pct: 16.4, metrics: eligibleMetric,
})
assert.equal(blocked.kind, 'blocked')
assert.match(blocked.detail, /16,4%/)

const noMetric = videoCoachBaselineReviewImpact([], [], {
  id: 'draft-e', status: 'draft', lift: 'bench', variation: 'competition_bench',
  low_conf_pct: 2, metrics: {},
})
assert.equal(noMetric.kind, 'blocked')

const alreadyIncluded = videoCoachBaselineReviewImpact([], [{
  id: 'approved-a', status: 'coach_approved', lift: 'bench', variation: 'competition_bench',
  low_conf_pct: 2, metrics: eligibleMetric,
}], {
  id: 'approved-a', status: 'coach_approved', lift: 'bench', variation: 'competition_bench',
  low_conf_pct: 2, metrics: eligibleMetric,
})
assert.equal(alreadyIncluded.kind, 'included')
assert.equal(alreadyIncluded.current, 1)

const excluded = videoCoachBaselineReviewImpact([], [], {
  id: 'invalid-a', status: 'invalid', lift: 'bench', variation: 'competition_bench',
  low_conf_pct: 2, metrics: eligibleMetric,
})
assert.equal(excluded.kind, 'excluded')

assert.deepEqual(buildVideoCoachBaselineProfiles(null), [])
assert.equal(countReadyVideoCoachBaselineProfiles(null), 0)

console.log('VideoCoach baseline-fremdrift tæller profiler og aliases korrekt.')
