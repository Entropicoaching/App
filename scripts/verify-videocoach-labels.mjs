import assert from 'node:assert/strict'
import { VIDEOCOACH_LIFT_LABELS, videoCoachVariationLabel } from '../src/videoCoachLabels.js'

assert.equal(VIDEOCOACH_LIFT_LABELS.bench, 'Bænkpres')
assert.equal(videoCoachVariationLabel('bench', 'Konkurrence bænk (pause)'), 'Konkurrence bænk (pause)')
assert.equal(videoCoachVariationLabel('bench', 'konkurrence_baenk_pause'), 'Konkurrence bænk (pause)')
assert.equal(videoCoachVariationLabel('bench', 'konkurrence_b_nk_pause'), 'Konkurrence bænk (pause)')
assert.equal(videoCoachVariationLabel('bench', 'competition_bench'), 'Konkurrence bænkpres')
assert.equal(videoCoachVariationLabel('bench', 'touch_and_go_b_nk'), 'Touch-and-go bænk')
assert.equal(videoCoachVariationLabel('deadlift', 'rum_nsk_d_dl_ft'), 'Rumænsk dødløft')
assert.equal(videoCoachVariationLabel('deadlift', 'competition_conventional'), 'Konkurrence konventionel')
assert.equal(videoCoachVariationLabel('squat', 'standard'), 'Squat')
assert.equal(videoCoachVariationLabel('bench', ''), 'Bænkpres')
assert.equal(videoCoachVariationLabel('bench', 'custom_pause_bench'), 'custom pause bench')

console.log('VideoCoach lift- og variationsnavne er konsistente.')
