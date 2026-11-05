import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'
import { syntheticDom } from '../session/sessionSyntheticDom.mjs'

// Shallow synthetic hook scheduling only. The actual wrapper, Home, bridge and
// default dynamic renderer all execute; this is supplementary to genuine React.
const host = new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href
const wrapper = new URL('./HomeSession.mjs', import.meta.url).href
const scheduled = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(host)};
  import { useRef } from ${JSON.stringify(host)};
  const refs = new Set(); let queue = [];
  export function useEffect(run, deps) {
    const ref = useRef(null); refs.add(ref);
    if (!ref.current || !deps || deps.some((d, i) => !Object.is(d, ref.current.deps[i])))
      queue.push(() => { ref.current?.cleanup?.(); ref.current = { deps, cleanup: run() }; });
  }
  export function flushEffects() { const work = queue; queue = []; work.forEach(run => run()); }
  export function cleanupEffects() { refs.forEach(ref => ref.current?.cleanup?.()); refs.clear(); queue = []; }
`)
// AthleteHome now memoizes its record snapshot; the shallow fake host has no useMemo.
const hostPlus = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(host)};
  export function useMemo(compute) { return compute(); }
`)
let imports = 0
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: context.parentURL === wrapper ? scheduled : context.parentURL?.endsWith('/AthleteHome.mjs') ? hostPlus : host }
  if (specifier.endsWith('/sessionView.mjs') && context.parentURL.endsWith('/homeSessionBridge.mjs')) imports++
  return next(specifier, context)
} })
test.after(() => hooks.deregister())
const { flushEffects, cleanupEffects } = await import(scheduled)
const { default: HomeSession } = await import('./HomeSession.mjs')
const { default: Home } = await import('./AthleteHome.mjs')
const week = { id: 'synthetic-w', athlete_id: 'synthetic-a', week_number: 1, start_date: '2026-11-02',
  sessions: [{ id: 'synthetic-s', exercises: [{ id: 'synthetic-e', name: 'Syntetisk løft', sets: 2, reps: 5, recommended_weight: 40 }] }] }
const props = () => ({ enabled: true, athlete: { id: 'synthetic-a' }, allWeeks: [week], currentWeek: week,
  now: new Date('2026-11-03T12:00:00Z'), exerciseLogs: [], storage: null,
  onLogSet() { assert.fail('opening must not log') }, setLogInputs() {}, parsePlannedRpe() {} })
const child = view => view.nodes(n => n.type === Home)[0]

test('actual wrapper mounts local host, propagates loading lock, opens on start and disposes on OFF', async t => {
  const dom = syntheticDom(), view = mount(HomeSession, props())
  t.after(() => { cleanupEffects(); view.unmount() })
  child(view).props.sessionRootRef.current = dom.root
  flushEffects()
  assert.equal(imports, 0); assert.equal(dom.root.children.length, 0)
  const pending = child(view).props.onStartSession('synthetic-s', 'synthetic-w')
  view.render(); flushEffects()
  assert.equal(child(view).props.sessionLoading, true)
  const home = mount(Home, child(view).props)
  try {
    const start = home.nodes(n => n.type === 'button' && n.children.includes('Start dagens pas'))[0]
    assert.equal(start.props.disabled, true)
    const card = home.nodes(n => n.props['aria-label'] === 'Dit næste pas')[0]
    assert.ok(card.children.some(n => n?.props?.ref === child(view).props.sessionRootRef))
  } finally { home.unmount() }
  assert.equal(child(view).props.onStartSession('synthetic-s', 'synthetic-w'), false)
  assert.equal(await pending, true); assert.equal(imports, 1)
  view.render(); flushEffects()
  assert.equal(child(view).props.sessionLoading, false)
  assert.ok(dom.root.querySelector('dialog').open)
  view.render({ enabled: false }); flushEffects()
  assert.equal(view.tree, null); assert.equal(dom.root.children.length, 0)
})

test('unmount during the default import cannot open a session later', async t => {
  const dom = syntheticDom(), view = mount(HomeSession, props())
  t.after(() => { cleanupEffects(); view.unmount() })
  child(view).props.sessionRootRef.current = dom.root
  flushEffects()
  const start = child(view).props.onStartSession
  const pending = start('synthetic-s', 'synthetic-w')
  cleanupEffects(); view.unmount()
  assert.equal(await pending, false)
  assert.equal(dom.root.children.length, 0)
  assert.equal(start('synthetic-s', 'synthetic-w'), false)
})
