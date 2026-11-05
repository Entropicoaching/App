import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, nodes, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'

// Actual copied AthleteView -> HomeSession -> AthleteHome. This shallow synthetic
// host does not run effects or claim genuine React rendering fidelity.
const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
const homeFor = (athlete, extra = {}) => {
  seed({ athlete })
  const view = render(AthleteView, { role: 'coach', session,
    coachAthleteId: athlete.id, onExitPreview() {}, ...extra })
  const wrapper = named(view, 'HomeSession')
  assert.ok(wrapper, 'actual host must reach HomeSession')
  const home = named(wrapper.type(wrapper.props), 'AthleteHome')
  return { wrapper, home, tree: home.type({ ...home.props, now: new Date('2026-11-04T12:00:00Z') }) }
}
const startButtons = tree => nodes(tree).filter(node => node.type === 'button' &&
  node.props.children.some(text => /^Start (dagens|næste) pas$/.test(text)))

test('R3: coach own training keeps enabled start, filming and quick-log writers through the actual host', () => {
  for (const extra of [{}, { onExitPreview: undefined }]) {
    const { wrapper, home, tree } = homeFor(ownAthlete, extra)
    assert.equal(home.props.sessionReadOnly, false)
    assert.equal(startButtons(tree).length, 1)
    assert.equal(startButtons(tree)[0].props.disabled, false)
    for (const key of ['onLogSet', 'setLogInputs', 'onFilmSet', 'saveReadiness',
      'setReadinessInput', 'logWeight', 'setWeightInput'])
      assert.equal(typeof wrapper.props[key], 'function', key)
    assert.equal(nodes(tree).find(n => n.props['data-film-set'] === '').props.disabled, false)
    assert.ok(named(tree, 'QuickLogs'))
    assert.ok(named(tree, 'HomeCheckIn'))
  }
})

test('R3: another athlete preview hides start and has no logging or filming capability', () => {
  const { wrapper, home, tree } = homeFor(otherAthlete)
  assert.equal(home.props.sessionReadOnly, true)
  assert.equal(startButtons(tree).length, 0)
  for (const key of ['onLogSet', 'setLogInputs', 'onFilmSet', 'saveReadiness', 'logWeight'])
    assert.equal(wrapper.props[key], undefined, key)
  assert.throws(() => wrapper.props.storage.setItem('synthetic-key', 'value'), /kan ikke gemme/)
})

test('R3: explicit OFF leaves the actual host legacy route intact for own and other athletes', () => {
  for (const athlete of [ownAthlete, otherAthlete]) {
    seed({ athlete })
    const tree = render(AthleteView, { role: 'coach', session,
      coachAthleteId: athlete.id, entropi2: false })
    assert.equal(named(tree, 'HomeSession'), undefined)
    assert.ok(named(tree, 'HjemTab'))
  }
})
