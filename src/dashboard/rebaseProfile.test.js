import test from 'node:test'
import assert from 'node:assert/strict'
import { nodes, text } from './profileWeekHarness.mjs'
const { ProfileWeekSummary, profileWeekFlag } = await import('./profileWeekSummary.mjs')
const id = 'counter-a'
const log = (weight, at, name, reps = 5, athlete_id = id) => ({ athlete_id, exercise_id: name, weight, logged_at: at, reps_completed: reps, exercises: { name } })
function render(logs) {
  const reads = Object.fromEntries(['weeks','logs','messages','videos'].map(kind => [kind, { athleteId: id, status: 'ready', rows: kind === 'logs' ? logs : [] }]))
  const original = structuredClone(reads)
  const tree = ProfileWeekSummary({ enabled: true, athleteId: id, today: '2026-10-28', reads })
  assert.deepEqual(reads, original)
  assert.equal(nodes(tree).filter(n => n.type === 'p').length, 3)
  return text(tree)
}
test('rebase counter: profile strict flag and OFF reject poison reads', () => {
  const reads = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(ProfileWeekSummary({ enabled, reads }), null)
  for (const flag of ['', '?coachProfilUge=1&coachProfilUge=0', '?coachStaevne=1', '?coachProfilUge=true']) assert.equal(profileWeekFlag(flag), false)
  assert.equal(profileWeekFlag('?coachProfilUge=1'), true)
})
test('rebase counter: both Danish-boundary winner directions retain names', () => {
  assert.match(render([log(65, '2026-10-25T23:30:00Z', 'Monday'), log(125, '2026-10-27', 'Tuesday')]), /Tuesday 125 kg/)
  assert.match(render([log(125, '2026-10-25T23:30:00Z', 'Monday'), log(65, '2026-10-27', 'Tuesday')]), /Monday 125 kg/)
})
test('rebase counter: comma weight and reps retain winner exercise name', () => {
  assert.match(render([log('87,25', '2026-10-27', 'DecimalLift', '7,5')]), /DecimalLift 87.25 kg × 7.5/)
})
test('rebase counter: foreign and future logs cannot replace scoped winner', () => {
  const result = render([log(75, '2026-10-27', 'Visible'), log(999, '2026-10-27', 'Foreign', 5, 'other'), log(998, '2026-10-29', 'Future')])
  assert.match(result, /Visible 75 kg/)
  assert.doesNotMatch(result, /Foreign|Future/)
})
