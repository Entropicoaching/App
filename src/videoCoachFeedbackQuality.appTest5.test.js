import test from 'node:test'
import assert from 'node:assert/strict'
import { videoCoachFeedbackQuality as quality } from './videoCoachFeedbackQuality.js'

const good = () => ({ works: 'Bevægelsen er synlig i dette sæt.', focus: 'Stangen flytter sig frem i starten.', next_set: 'Pres fødderne ned i gulvet' })
test('APP-TEST5 Quality: absent feedback never offers sharing', () => {
  for (const value of [undefined, null, {}, { focus: ' ', next_set: [] }]) {
    const result = quality(value)
    assert.equal(result.canShare, false)
    assert.equal(result.level, 'blocked')
    assert.ok(result.blockers.length >= 2)
  }
})
test('APP-TEST5 Quality: one observation and one cue are shareable and immutable', () => {
  const value = good(), before = structuredClone(value), result = quality(value)
  assert.equal(result.canShare, true)
  assert.equal(result.level, 'strong')
  assert.deepEqual(value, before)
  assert.deepEqual(result.nextSet, [value.next_set])
})
test('APP-TEST5 Quality: LF and CRLF give identical cue counts', () => {
  const first = quality({ ...good(), next_set: 'Pres gulvet\nHold grebet' })
  const second = quality({ ...good(), next_set: 'Pres gulvet\r\nHold grebet' })
  assert.deepEqual(first, second)
  assert.equal(first.canShare, false)
})
test('APP-TEST5 Quality: repetition is blocked and numeric cue is reviewed', () => {
  assert.equal(quality({ ...good(), next_set: good().focus }).canShare, false)
  const result = quality({ ...good(), next_set: 'Hold 3 cm afstand' })
  assert.equal(result.level, 'review')
  assert.ok(result.warnings.some(s => s.includes('måltal')))
})
test('APP-TEST5 Quality: missing positive evidence asks for an honest observation', () => {
  const result = quality({ ...good(), works: '' })
  assert.equal(result.needsReview, true)
  assert.match(result.warnings.join(' '), /hvis målingen understøtter/)
  assert.deepEqual(result.works, [])
})
