import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachFourWeeksLoader.mjs'
install()
const { buildFourWeeks, fourWeekRpe } = await import('./coachFourWeeks.mjs')
const { default: View } = await import('./CoachFourWeeks.jsx')
const { mount, text, nodes, button } = await import('./coachFourWeeksDom.mjs')
const ready = (rows, athleteId = 'a') => ({ rows, athleteId, status: 'ready' })

test('review: year boundary and daylight saving retain four calendar weeks', () => {
  const january = buildFourWeeks({ athleteId: 'a', today: '2027-01-01' })
  assert.equal(january.start, '2026-12-07'); assert.equal(january.end, '2027-01-03'); assert.equal(january.days, 28)
  const dst = buildFourWeeks({ athleteId: 'a', today: '2026-10-25', reads: { logs: ready([
    { id: 1, logged_at: '2026-10-24T22:30:00Z' }, { id: 2, logged_at: '2026-10-25T23:30:00Z' },
  ]) } })
  assert.deepEqual(dst.weeks[0].logs.map(l => l.id), [1]); assert.equal(dst.days, 28)
})

test('review: absent and failed sources never appear as confirmed zero counts', () => {
  const tree = mount(View, { athlete: { id: 'a', name: 'Syntetisk' }, today: '2026-10-27', reads: { logs: { athleteId: 'a', status: 'error' }, videos: ready([]) } }).render()
  assert.ok(!text(tree).includes('0 loggede sæt'))
  assert.ok(!text(tree).includes('0 planlagte sæt'))
  assert.ok(text(tree).includes('kunne ikke hentes'))
  assert.equal(nodes(tree, n => n.type === 'article').length, 4)
})

test('review: RPE missing, zero, decimal and skipped values stay distinct', () => {
  assert.equal(fourWeekRpe({ rpe_actual: 0, rpe_planned: 8 }), -8)
  assert.equal(fourWeekRpe({ rpe_actual: '', rpe_planned: 8 }), null)
  assert.equal(fourWeekRpe({ rpe_actual: 8, rpe_planned: '', exercises: { intensity: 'RPE 7,5' } }), 0.5)
  assert.equal(fourWeekRpe({ rpe_actual: 8, exercises: { intensity: '80%' } }), null)
  assert.equal(fourWeekRpe({ skipped: true, rpe_actual: 10, rpe_planned: 8 }), null)
})

test('review: waiting video uses existing tracking handler, errors visible, busy disables button', () => {
  let seen
  const props = { athlete: { id: 'a', name: 'Syntetisk' }, today: '2026-10-27', reads: { weeks: ready([]), logs: ready([]), videos: ready([{ id: 'waiting', created_at: '2026-10-27', analysis_state: 'awaiting_analysis', video_path: 'synthetic' }]) },
    onOpenAwaitingVideo: row => { seen = row.id }, onOpenVideo: () => assert.fail('wrong handler'), videoError: 'Syntetisk fejl' }
  let tree = mount(View, props).render()
  button(tree, 'Åbn til sporing').props.onClick(); assert.equal(seen, 'waiting')
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
  tree = mount(View, { ...props, videoOpening: 'waiting' }).render()
  assert.equal(button(tree, 'Åbn til sporing').props.disabled, true)
})

test('review: malformed and undated plans do not hide valid current plans or leak foreign notes', () => {
  const model = buildFourWeeks({ athleteId: 'a', today: '2026-10-27', reads: { weeks: ready([
    { athlete_id: 'a', start_date: null }, { athlete_id: 'a', start_date: '2026-02-30' },
    { athlete_id: 'b', start_date: '2026-10-26', sessions: [{ athlete_comment: 'foreign' }] },
    { athlete_id: 'a', start_date: '2026-10-26', sessions: [{ athlete_comment: 'egen', exercises: [{ sets: '4' }] }] },
  ]) } })
  assert.equal(model.undated, 2); assert.equal(model.weeks[0].plannedSets, 4)
  assert.deepEqual(model.weeks[0].notes.map(n => n.text), ['egen'])
})
