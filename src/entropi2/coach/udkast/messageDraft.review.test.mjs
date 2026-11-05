import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoachMessageDraft } from './messageDraft.mjs'

// Separate contract probes; deliberately do not reuse the producer's fixtures.
test('review: frozen report is deterministic, bounded and copies no identity or notes', () => {
  const training = Object.freeze({ completed: 4, planned: 2, rpe: 6.25, rpeCount: 4 })
  const nutrition = Object.freeze({ logged: 7, proteinGoal: 90, reached: 3 })
  const row = Object.freeze({ athlete: Object.freeze({ id: 'review-id', name: '<synthetic-name>' }),
    training, nutrition, notes: '<synthetic-note>', cycle: '<synthetic-sensitive-field>' })
  const report = Object.freeze({ ready: true, rows: Object.freeze([row]) })
  const first = createCoachMessageDraft(report, 'review-id')
  assert.equal(first.requiresCoachReview, true)
  assert.deepEqual(first, createCoachMessageDraft(report, 'review-id'))
  assert.match(first.text, /4 pas logget mod 2 planlagte/)
  assert.match(first.text, /RPE\) 6,3/)
  assert.match(first.text, /3 af 7 loggede dage/)
  assert.doesNotMatch(first.text, /<|review-id|gennemført|anbefal|øge|sænke/)
  assert.ok(first.text.length < 750)
})

test('review: every seven-day combination uses logged days as the protein denominator', () => {
  for (let logged = 0; logged <= 7; logged++) {
    for (let reached = 0; reached <= 7; reached++) {
      const result = createCoachMessageDraft({ ready: true, rows: [{ athlete: { id: 'review-id' },
        nutrition: { logged, reached, proteinGoal: 90 } }] }, 'review-id')
      assert.match(result.text, new RegExp(`kost på ${logged} af de seneste 7 dage`))
      assert.equal(result.text.includes('Proteinmålet'), logged > 0 && reached <= logged)
      if (logged > 0 && reached <= logged) assert.ok(result.text.includes(`${reached} af ${logged} ${logged === 1 ? 'logget dag' : 'loggede dage'}`))
    }
  }
})

test('review: invalid training numbers cannot become a training statement', () => {
  for (const completed of [undefined, null, false, '', '0', -1, 0.5, NaN, Infinity]) {
    const result = createCoachMessageDraft({ ready: true, rows: [{ athlete: { id: 'review-id' },
      training: { completed, planned: 3, rpe: 9, rpeCount: 0 } }] }, 'review-id')
    assert.match(result.text, /mangler et sikkert overblik over ugens loggede pas/)
    assert.doesNotMatch(result.text, /pas logget mod|RPE|undefined|NaN|Infinity/)
  }
})

test('review: unavailable report short-circuits before rows are read', () => {
  const report = { ready: false, get rows() { throw Error('unavailable report read') } }
  assert.equal(createCoachMessageDraft(report, 'review-id'), null)
})
