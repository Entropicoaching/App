import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { install } from './athlete/kost2Loader.mjs'
import { reset, begin, nodes } from './athlete/kost2Dom.mjs'
const hooks = install()
// This legacy renderer's named state slots belong to AthleteView alone.
// Keep tracking explicitly inert for these OFF regressions; the actual tracking
// hook and its enabled scope are exercised in tracking/ownTrackingIntegration.
const trackingHooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './entropi2/tracking/useOwnTracking.mjs' && context.parentURL?.endsWith('/AthleteView.jsx'))
      return { url: 'rebase-tracking:off', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'rebase-tracking:off') return { format: 'module', shortCircuit: true, source: `
      import assert from 'node:assert/strict'
      export function useOwnTracking(props) {
        assert.notEqual(props.enabled, true, 'rebase OFF scenarios must not start tracking')
        return { trackingSnapshot: null, onRetryTracking() {} }
      }
    ` }
    return next(url, context)
  },
})
const { default: AthleteView } = await import('./AthleteView.jsx')
const component = (tree, name) => nodes(tree, n => n.type?.name === name)[0]
const render = props => { begin(); return AthleteView(props) }

test('rebase matrix: actual AthleteView keeps both props and release search independently', () => {
  const prior = globalThis.window
  try {
    for (const search of ['', '?rel1030=1']) for (const enkelPrototype of [false, true])
      for (const staevneHjem of [false, true, 'true']) for (const programBlokOversigt of [false, true, 'true']) {
        globalThis.window = { location: { search } }
        reset()
        const props = { session: { user: { id: 'synthetic-A' } }, role: 'athlete',
          enkelPrototype, staevneHjem, programBlokOversigt, repRecords: true }
        let tree = render(props)
        const home = component(tree, enkelPrototype ? 'LazyEnkelHjemTab' : 'HjemTab')
        assert.equal(home.props.staevneHjem, staevneHjem === true)
        assert.equal(component(tree, 'NytIAppen').props.search, search)
        assert.equal(component(tree, 'NytIAppen').props.profileId, 'synthetic-A')
        home.props.setTab('program')
        tree = render(props)
        const program = nodes(tree, n => n.props?.label === 'Program')[0]
        assert.ok(program)
        assert.equal(program.props.componentProps.programBlokOversigt, programBlokOversigt)
        assert.equal(typeof program.props.componentProps.fetchProgramBlockLogs, 'function')
      }
  } finally { if (prior === undefined) delete globalThis.window; else globalThis.window = prior }
})

test('rebase counterexample: preview and role change cannot expose the athlete announcement', () => {
  for (const extra of [{ role: 'coach' }, { role: 'athlete', coachAthleteId: 'other' },
    { role: 'athlete', onExitPreview() {} }]) {
    reset()
    const tree = render({ session: { user: { id: 'synthetic-A' } }, ...extra })
    assert.equal(component(tree, 'NytIAppen').props.role, null)
  }
})

test('rebase counterexample: repRecords baseline prop survives the two AthleteView conflicts', () => {
  for (const repRecords of [false, true]) {
    reset()
    const props = { repRecords }
    const home = component(render(props), 'HjemTab')
    home.props.setTab('fremgang')
    const tree = render(props)
    const progress = nodes(tree, n => n.props?.label === 'Fremgang')[0]
    assert.equal(progress.props.componentProps.repRecords, repRecords ? true : undefined)
  }
})
test.after(() => { trackingHooks.deregister(); hooks.deregister() })
