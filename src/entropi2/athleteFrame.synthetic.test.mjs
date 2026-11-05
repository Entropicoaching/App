import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../athlete/trainingFullscreenFake.mjs'
import { dom, fakeClock } from './mobility/synthetic-dom.mjs'

// Actual copied components and native mobility mount. Synthetic hooks/DOM only;
// CSS contracts live in athleteFrame.test.mjs; this is not browser layout proof.
// Home on db7ca228 also imports useMemo. Extend this test's hook host locally;
// do not change the shared legacy fake or substitute it in the real React test.
const fake = new URL('../athlete/trainingFullscreenFake.mjs', import.meta.url).href
const hookHost = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(fake)};
  import { useRef } from ${JSON.stringify(fake)};
  export function useMemo(calculate, deps) {
    const memo = useRef(null);
    if (!memo.current || deps.length !== memo.current.deps.length ||
        deps.some((value, i) => !Object.is(value, memo.current.deps[i])))
      memo.current = { deps: [...deps], value: calculate() };
    return memo.current.value;
  }
`)
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: hookHost }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { mountMobility } = await import('./mobility/mobility-screen.mjs')
const { default: Home } = await import('./home/AthleteHome.mjs')
const { default: Profile } = await import('./profile/Profile.mjs')
const { default: Analysis } = await import('./analysis/Analysis.mjs')
const host = await import('../athlete/coachOwnTrainingFixture.mjs')
const { default: AthleteView, dispose } = await host.loadViews()
test.after(dispose)
const athlete = { id: 'synthetic-frame', goal: 'Langt syntetisk mål '.repeat(40) }
const week = { id: 'synthetic-week', start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-session', weekday: 3, exercises: [
    { id: 'synthetic-exercise', name: 'Squat', sets: 2 },
  ] }] }
const props = { athlete, now: new Date('2026-11-05T12:00:00Z'), allWeeks: [week],
  currentWeek: week, exerciseLogs: [], storage: null }

test('frame actual host: one marked page for athlete, own coach and preview; explicit OFF has none', () => {
  for (const tab of ['hjem', 'program', 'kost', 'fremgang', 'mobilisering', 'beskeder']) {
    for (const [role, profile, preview] of [
      ['athlete', host.ownAthlete, false],
      ['coach', host.ownAthlete, false],
      ['coach', host.otherAthlete, true],
      ['athlete', host.otherAthlete, true],
    ]) {
      for (const enabled of [false, true]) {
        host.seed({ athlete: profile, requestedTab: tab })
        const tree = host.render(AthleteView, { entropi2: enabled, role, session: host.session,
          ...(role === 'coach' || preview ? { coachAthleteId: profile.id } : {}),
          ...(preview ? { onExitPreview() {} } : {}) })
        const nodes = host.nodes(tree)
        const pages = nodes.filter(node => Object.hasOwn(node.props, 'data-entropi2-page'))
        assert.equal(pages.length, enabled ? 1 : 0, `${role}/${tab}/${enabled}/${preview}`)
        if (enabled) {
          assert.equal(pages[0].type, preview ? 'fieldset' : 'div')
          assert.equal(pages[0].props.disabled, preview ? true : undefined)
          assert.equal(pages[0].props['aria-label'], preview ? 'Atletvisning uden skrivninger' : undefined)
          assert.equal(Object.hasOwn(tree.props, 'data-entropi2-athlete'), true)
        }
      }
    }
  }
})

test('frame actual roots: Home, Profile and Analysis expose the CSS targets and keep inner card padding', t => {
  for (const [Component, options, marker] of [
    [Home, { enabled: true }, 'data-entropi2-home'],
    [Profile, { enabled: true }, 'data-entropi2-profile'],
    [Analysis, { entropi2: true, fremgangLogs: [] }, 'data-entropi2-analysis'],
  ]) {
    const view = mount(Component, { ...props, ...options })
    t.after(() => view.unmount())
    const roots = view.nodes(n => Object.hasOwn(n.props, marker))
    assert.equal(roots.length, 1, marker)
    assert.ok([20, '20px 16px', '20px 0'].includes(roots[0].props.style.padding))
    assert.equal(roots[0].props.style.overflowWrap, 'anywhere')
    if (Component === Profile) assert.match(view.text(), /Langt syntetisk mål/)
    if (Component === Home) assert.ok(view.nodes(n => n.props.style?.padding === 20).length > 1)
  }
})

test('frame actual mobility: marker, inline 20px layer and 640px limit exist; reads never write', () => {
  let writes = 0
  const storage = { getItem: () => null, setItem() { writes++ }, removeItem() { writes++ } }
  const root = dom(), clock = fakeClock()
  const stop = mountMobility(root, { ...props, enabled: true, storage, clock })
  try {
    assert.equal(root.attributes['data-e2-mobility'], '')
    assert.equal(root.style.padding, '20px', 'the real inline layer must be overridden by scoped CSS')
    assert.equal(root.style.maxWidth, '640px')
    assert.match(root.textContent, /Mobilitet/)
    assert.equal(root.style.overflowWrap, 'anywhere')
    assert.equal(writes, 0)
    assert.equal(clock.count, 0)
  } finally { stop() }
  assert.equal(clock.count, 0)
})

test('frame actual OFF: components and mobility never evaluate poisoned athlete data', t => {
  const poison = new Proxy({}, { get() { assert.fail('OFF athlete read') } })
  for (const [Component, options] of [[Home, { enabled: false }], [Profile, { enabled: false }],
    [Analysis, { entropi2: false }]]) {
    const view = mount(Component, { ...options, athlete: poison })
    t.after(() => view.unmount())
    assert.equal(view.tree, null)
  }
  const root = dom()
  root.textContent = 'Existing OFF content'
  mountMobility(root, { enabled: false, athlete: poison, storage: poison })()
  assert.equal(root.textContent, 'Existing OFF content')
})
