import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, nodes, fixture, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'

// Actual copied AthleteView and HomeSession; only the event host and service
// boundaries are synthetic. This does not replace the real-React render test.
const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
const adapterKeys = ['readinessLog', 'readinessInput', 'setReadinessInput', 'saveReadiness',
  'savingReadiness', 'readinessError', 'weightLogs', 'weightInput', 'setWeightInput', 'logWeight', 'savingWeight']
const handlers = ['saveReadiness', 'setReadinessInput', 'logWeight', 'setWeightInput']
const props = (role, athlete = ownAthlete, preview = role === 'coach') => ({
  entropi2: true, session, role, coachAthleteId: preview ? athlete.id : null,
  onExitPreview: preview ? () => {} : undefined,
})

for (const role of ['athlete', 'coach']) test(`synthetic actual adapter: ${role} owns the existing drafts, records and save handlers`, async () => {
  const readinessInput = { sleep: '7,5', energy: 3, motivation: 3, stress: 3, soreness: 3, soreZones: [] }
  const readinessLog = { athlete_id: ownAthlete.id, logged_date: '2026-11-04' }
  const weightLogs = [{ athlete_id: ownAthlete.id, logged_at: '2026-11-04', weight: 82.5 }]
  seed({ athlete: ownAthlete, readinessInput, readinessLog, weightLogs, weightInput: '82,5',
    savingReadiness: true, readinessError: 'synthetic readiness error', savingWeight: true })
  const home = named(render(AthleteView, props(role)), 'HomeSession')
  assert.ok(home)
  for (const key of handlers) assert.equal(typeof home.props[key], 'function', key)
  assert.equal(home.props.readinessInput, readinessInput)
  assert.equal(home.props.readinessLog, readinessLog)
  assert.equal(home.props.weightLogs, weightLogs)
  assert.equal(home.props.weightInput, '82,5')
  assert.equal(home.props.savingReadiness, true)
  assert.equal(home.props.savingWeight, true)
  assert.equal(home.props.readinessError, 'synthetic readiness error')
  for (const key of ['loadWeight', 'fetchWeightLogs']) assert.equal(Object.hasOwn(home.props, key), false)
  home.props.setReadinessInput(input => ({ ...input, sleep: '8' }))
  home.props.setWeightInput('83')
  const updated = named(render(AthleteView, props(role)), 'HomeSession')
  assert.equal(updated.props.readinessInput.sleep, '8')
  assert.equal(updated.props.readinessInput.energy, 3)
  assert.equal(updated.props.weightInput, '83')
  await updated.props.saveReadiness()
  await updated.props.logWeight()
  assert.deepEqual(fixture.calls.map(call => call.name), ['saveReadiness', 'logWeight'])
})

test('synthetic actual adapter: coach preview and athlete preview receive none of the eleven adapter props', () => {
  for (const role of ['coach', 'athlete']) {
    seed({ athlete: otherAthlete })
    const tree = render(AthleteView, props(role, otherAthlete, true))
    const home = named(tree, 'HomeSession')
    assert.ok(home)
    for (const key of adapterKeys) assert.equal(Object.hasOwn(home.props, key), false, `${role}: ${key}`)
    assert.equal(home.props.onLogSet, undefined)
    assert.equal(home.props.setLogInputs, undefined)
    assert.equal(home.props.onFilmSet, undefined)
    assert.equal(nodes(tree).find(node => node.type === 'fieldset').props.disabled, true)
    assert.deepEqual(fixture.calls, [])
  }
})

test('synthetic actual adapter: explicit OFF retains legacy Hjem for normal athlete, own coach and preview', () => {
  for (const role of ['coach', 'athlete']) for (const athlete of [ownAthlete, otherAthlete]) {
    seed({ athlete })
    const tree = render(AthleteView, { ...props(role, athlete), entropi2: false })
    assert.equal(named(tree, 'HomeSession'), undefined)
    assert.ok(named(tree, 'HjemTab'))
    assert.equal(nodes(tree).some(node => node.type === 'fieldset'), false)
    assert.deepEqual(fixture.calls, [])
  }
})
