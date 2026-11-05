import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, nodes, session, ownAthlete, otherAthlete, week } from '../../athlete/coachOwnTrainingFixture.mjs'

// Actual copied AthleteView -> HomeSession -> AthleteHome. This shallow synthetic
// host does not run effects or claim genuine React rendering fidelity.
const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
const homeFor = (athlete, extra = {}, state = {}) => {
  seed({ athlete, ...state })
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

test('MIN TRÆNING: the actual coach host retains its existing retry capability at a week change', () => {
  const nextWeek = { ...week, id: 'synthetic-next-week', week_number: 2, start_date: '2026-11-09' }
  const { home } = homeFor(ownAthlete, {}, { allWeeks: [week, nextWeek] })
  assert.equal(typeof home.props.onRetryProgram, 'function')
  const tree = home.type({ ...home.props, now: new Date('2026-11-10T12:00:00Z') })
  assert.equal(startButtons(tree)[0].props.disabled, true)
  const retry = nodes(tree).find(n => n.type === 'button' && n.props.children.includes('Hent igen'))
  assert.ok(retry)
  assert.equal(retry.props.disabled, false)
})

const text = tree => nodes(tree).flatMap(node => (node.props?.children ?? []).filter(value => typeof value === 'string')).join(' ')
const shortcuts = tree => nodes(tree).filter(node => node.type === 'nav' && node.props['aria-label'] === 'Genveje')

test('MIN TRÆNING: explicit presentation signal follows host ownership through HomeSession', () => {
  const own = homeFor(ownAthlete)
  assert.equal(own.wrapper.props.coachOwnTraining, true)
  assert.equal(own.home.props.coachOwnTraining, true)
  assert.equal(shortcuts(own.tree).length, 0)
  assert.doesNotMatch(text(own.tree), /Resten af din dag/)
  for (const [athlete, extra] of [
    [otherAthlete, {}], [{ ...ownAthlete, user_id: null }, {}],
    [ownAthlete, { coachAthleteId: otherAthlete.id }],
    [ownAthlete, { session: { user: { id: '' } } }],
    [ownAthlete, { role: 'athlete', coachAthleteId: null, onExitPreview: undefined }],
  ]) {
    const view = homeFor(athlete, extra)
    assert.equal(view.wrapper.props.coachOwnTraining, false)
    assert.equal(shortcuts(view.tree).length, 1)
    assert.match(text(view.tree), /Resten af din dag/)
  }
})

test('MIN TRÆNING: only boolean true hides shortcuts; contextual actions keep their routes and callbacks', () => {
  const { home } = homeFor(ownAthlete)
  for (const coachOwnTraining of [undefined, false, 'true', 1, null]) {
    const tree = home.type({ ...home.props, coachOwnTraining, now: new Date('2026-11-04T12:00:00Z') })
    assert.equal(shortcuts(tree).length, 1)
    assert.match(text(tree), /Analyse Kost Mobilitet Din coach/)
  }
  const calls = []
  const tree = home.type({ ...home.props, now: new Date('2026-11-04T12:00:00Z'),
    setTab: route => calls.push(route), onStartSession: (...args) => calls.push(args),
    onFilmSet: () => calls.push('film'), messages: [{ sender_role: 'coach', content: 'Syntetisk besked' }],
    nutritionToday: { date: '2026-11-04', kcal: 400, kcalTarget: 2400 },
  })
  const click = label => {
    const button = nodes(tree).find(node => node.type === 'button' && label.test(text(node)))
    assert.ok(button, String(label)); assert.equal(button.props.disabled, false); button.props.onClick()
  }
  click(/^Start (dagens|næste) pas$/)
  click(/^Se mit program$/)
  click(/^Film et sæt/)
  click(/^Kost i dag:/)
  click(/^Se besked og video$/)
  assert.deepEqual(calls, [['synthetic-session', 'synthetic-week'], 'program', 'film', 'kost', 'beskeder'])
  assert.ok(named(tree, 'QuickLogs'))
  assert.equal(shortcuts(tree).length, 0)
})
