import test from 'node:test'
import assert from 'node:assert/strict'
import { coachTeamModel } from './coachTeamModel.mjs'
import { coachHomeModel } from './coachModel.mjs'

// Independent literal oracle: not the producer fixture or its sorting helper.
const day = '2026-11-04'
const roster = ['review-z', 'review-b', 'review-empty', 'review-hidden']
const permutations = xs => xs.length ? xs.flatMap((x, i) =>
  permutations(xs.filter((_, j) => i !== j)).map(tail => [x, ...tail])) : [[]]
function props(order) {
  return { today: day, session: { user: { id: 'review-coach' } },
    readContext: { coachId: 'review-coach', day, athleteIds: [...order] },
    athletes: order.map(id => ({ id, name: id, hidden: id === 'review-hidden' })),
    coachActionsStatus: { activity: { day, ids: [...order], state: 'ready', rows: [
      { athlete_id: 'review-b', logged_at: '2026-10-08' },
      { athlete_id: 'review-b', logged_at: '2026-11-03T23:30:00Z' },
      { athlete_id: 'review-b', logged_at: '2026-11-04T11:00:00Z' },
      { athlete_id: 'review-hidden', logged_at: day },
    ] } },
    coachNutrition: { coachId: 'review-coach', day, athleteIds: [...order],
      from: '2026-10-29', through: day, state: 'ready', complete: true,
      targets: [{ athlete_id: 'review-z', protein_target: 100 }],
      rows: ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', day]
        .map((date, i) => ({ id: `review-meal-${i}`, athlete_id: 'review-z', date,
          meal: 'Syntetisk', protein: 10, kcal: 1000 })) },
    get coachAnalysis() { throw Error('No snapshot may be read') },
  }
}
const inspect = p => coachTeamModel({ enabled: true, props: p, context: coachHomeModel(p, day) })

test('review oracle: all 24 roster orders preserve actual signal and coverage facts, omit empty/hidden athletes', () => {
  for (const order of permutations(roster)) {
    const result = inspect(props(order))
    assert.deepEqual(result.athletes.map(a => [a.athleteId, a.signalCount, a.trainingDays, a.nutritionDays]),
      [['review-z', 1, 0, 7], ['review-b', 0, 2, 0]])
    assert.equal(result.trainingFrom, '2026-10-08')
    assert.equal(result.nutritionFrom, '2026-10-29')
    assert.equal(result.asOf, day)
  }
})

test('review oracle: unavailable domains vanish independently and a later empty render retains no prior data', () => {
  const p = props(roster)
  assert.equal(inspect(p).athletes.length, 2)
  p.coachNutrition.complete = false
  assert.deepEqual(inspect(p).athletes.map(a => [a.athleteId, a.nutritionDays]), [['review-b', null]])
  p.coachActionsStatus.activity.state = 'error'
  assert.equal(inspect(p), null)
  p.coachNutrition.complete = true
  assert.deepEqual(inspect(p).athletes.map(a => [a.athleteId, a.trainingDays]), [['review-z', null]])
  p.coachNutrition.rows = []
  assert.equal(inspect(p), null)
})

test('review oracle: equal signal counts order by literal athlete id, irrespective of input order', () => {
  for (const order of permutations(roster)) {
    const p = props(order)
    p.coachNutrition.targets = []
    assert.deepEqual(inspect(p).athletes.map(a => a.athleteId), ['review-b', 'review-z'])
  }
})
