// Actual copied host and profile imports with the existing, explicitly synthetic
// React boundary. Real React rendering is checked separately in profileWiring.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, nodes, fixture, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'

const { default: AthleteView, dispose } = await loadViews()
const { ProfileMenu, ProfilePage } = await import('./ProfilePage.mjs')
test.after(dispose)
const menu = tree => named(named(tree, 'Ramme')?.props.backBtn, 'ProfileMenu')

test('Mig is one native button with a direct action, a 44 px target and the return ref', () => {
  let opens = 0
  const summaryRef = { current: null }
  const button = ProfileMenu({ enabled: true, summaryRef, onOpen: () => opens++ })
  assert.equal(opens, 0)
  assert.equal(button.type, 'button')
  assert.equal(button.props.type, 'button')
  assert.ok([button.props.children].flat().includes('Mig'))
  assert.equal(button.props.ref, summaryRef)
  assert.ok(button.props.style.minHeight >= 44)
  assert.ok(button.props.style.minWidth >= 44)
  assert.equal(nodes(button).length, 1)
  button.props.onClick()
  assert.equal(opens, 1)
  assert.doesNotThrow(() => ProfileMenu({ enabled: true }).props.onClick())
})

test('only explicit ON exposes Mig; OFF and foreign profiles remain inert', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const summaryRef = { current: null }
    assert.equal(ProfileMenu({ enabled, summaryRef, onOpen: () => assert.fail('OFF opened') }), null)
    assert.equal(summaryRef.current, null)
    assert.equal(ProfilePage({ enabled, get athlete() { assert.fail('OFF read') } }), null)
  }
  assert.equal(ProfilePage({ enabled: true, ownerId: session.user.id, athlete: otherAthlete }), null)
})

test('one Mig action opens the owned profile, closes Konto and returns focus via the native button ref', () => {
  for (const role of ['athlete', 'coach']) {
    seed({ athlete: ownAthlete, accountMenuOpen: true })
    const props = { session, role, entropi2: true, ...(role === 'coach' ? {
      coachAthleteId: ownAthlete.id, onExitPreview() {},
    } : {}) }
    let tree = render(AthleteView, props)
    assert.equal(named(tree, 'ProfilePage'), undefined)
    const entry = menu(tree)
    ProfileMenu(entry.props).props.onClick()
    tree = render(AthleteView, props)
    assert.equal(named(tree, 'Ramme').props.accountMenuOpen, false)
    const page = named(tree, 'ProfilePage')
    assert.ok(page)
    assert.equal(page.props.ownerId, session.user.id)
    assert.equal(page.props.athlete, ownAthlete)
    let focused = 0
    const button = ProfileMenu(menu(tree).props)
    button.props.ref.current = { focus() { focused++ } }
    page.props.onClose()
    assert.equal(focused, 1)
    assert.equal(named(render(AthleteView, props), 'ProfilePage'), undefined)
    assert.equal(fixture.calls.some(call => call.name === 'database.from' || call.name === 'database.rpc'), false)
    if (role === 'coach') assert.ok(nodes(named(tree, 'Ramme').props.backBtn)
      .some(node => node.type === 'button' && node.props.children.includes('Til coachportalen')))
  }
})

test('OFF, wrong owner and coach athlete preview expose neither Mig nor a stale open profile', () => {
  for (const [athlete, extra] of [
    [ownAthlete, { entropi2: false }],
    [otherAthlete, {}],
    [ownAthlete, { session: { user: { id: 'wrong-owner' } } }],
    [ownAthlete, { coachAthleteId: otherAthlete.id }],
  ]) {
    seed({ athlete, profileOwner: `${session.user.id}:${athlete.id}` })
    const tree = render(AthleteView, { session, role: 'coach', entropi2: true,
      coachAthleteId: athlete.id, onExitPreview() {}, ...extra })
    assert.equal(menu(tree), undefined)
    assert.equal(named(tree, 'ProfilePage'), undefined)
    assert.equal(fixture.calls.some(call => call.name === 'database.from' || call.name === 'database.rpc'), false)
  }
})
