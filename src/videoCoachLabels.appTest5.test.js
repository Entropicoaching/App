import test from 'node:test'
import assert from 'node:assert/strict'
import { VIDEOCOACH_LIFT_LABELS, videoCoachVariationIdentity as identity, videoCoachVariationLabel as label } from './videoCoachLabels.js'

test('APP-TEST5 Labels: empty values use the lift default', () => {
  for (const variation of [undefined, null, '', '  ', 'standard']) {
    assert.equal(identity('squat', variation), 'konkurrence_squat')
    assert.equal(label('bench', variation), 'Bænkpres')
  }
  assert.equal(label('unknown', ''), 'Standard')
})
test('APP-TEST5 Labels: Danish, English and decomposed aliases retain identity', () => {
  for (const variation of ['competition_bench_pause', 'Konkurrence bænk (pause)', 'konkurrence_baenk_pause'])
    assert.equal(identity('bench', variation), 'konkurrence_b_nk_pause')
  assert.equal(identity('deadlift', 'Rumænsk dødløft'), 'rum_nsk_d_dl_ft')
  assert.equal(identity('deadlift', 'ruma\u0301ensk doedloeft'), 'rum_nsk_d_dl_ft')
})
test('APP-TEST5 Labels: unknown variation stays descriptive without quality claims', () => {
  assert.equal(identity('squat', 'custom_pause_2'), 'custom_pause_2')
  assert.equal(label('squat', 'custom_pause_2'), 'custom pause 2')
  assert.deepEqual(VIDEOCOACH_LIFT_LABELS, { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' })
})
