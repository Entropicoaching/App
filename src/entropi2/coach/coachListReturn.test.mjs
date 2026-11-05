// Actual copied Dashboard and CoachScreen. Closed synthetic hooks and host services;
// this proves state ownership/remounting, not browser layout or real React lifecycle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import * as runtime from '../../athlete/prog5Dom.mjs'
import { jsx } from '../../dashboard/coachRydJsx.mjs'
import { productionFixture, day } from './coachProductionFixture.mjs'
await import('../../rebaseHarness.mjs')

const react = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/prog5Dom.mjs', import.meta.url).href)};
export const useMemo = fn => fn(); export const useCallback = fn => fn;
export const Fragment = Symbol.for('coach-list-return.fragment');`)
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: react, shortCircuit: true }
  // The existing navigation module has two extensionless, pure imports.
  if (context.parentURL === new URL('../../dashboard/navigation.js', import.meta.url).href &&
    ['../weekDates', '../coachPriority'].includes(specifier)) return next(specifier + '.js', context)
  return next(specifier, context)
} })
const { default: CoachScreen } = await import('./CoachScreen.mjs')
const { lavNavigation } = await import('../../dashboard/navigation.js')
const url = new URL('../../Dashboard.jsx', import.meta.url).href + '?coach-list-return'
const source = readFileSync(new URL('../../Dashboard.jsx', import.meta.url), 'utf8')
const stateNames = [...source.matchAll(/const \[(\w+)(?:,\s*\w+)?\] = useState\(/g)].map(m => m[1])
let cursor = 0, generation = 0, capturedScreen
const setters = {}, fixture = productionFixture()
const fakes = { ...globalThis[Symbol.for('rebase.dashboard')].fakes }
fakes.react = {
  useState(initial) {
    const name = stateNames[cursor++]
    assert.ok(name, 'named state in the actual Dashboard')
    const overrides = { ...fixture, loading: false, view: 'list' }
    const pair = runtime.useState(() => Object.hasOwn(overrides, name) ? overrides[name]
      : typeof initial === 'function' ? initial() : initial)
    setters[name] = pair[1]
    return pair
  }, useRef: runtime.useRef, useEffect() {},
}
for (const name of Object.keys(fakes)) if (name.endsWith('.jsx')) {
  fakes[name] = { default: props => runtime.createElement(name.split('/').at(-1).slice(0, -4), props) }
}
fakes['./dashboard/navigation.js'] = { lavNavigation }
fakes['./entropi2/coachEntry.mjs'] = { ...fakes['./entropi2/coachEntry.mjs'],
  entropi2Enabled: enabled => enabled === true,
  useEntropi2ReadContext: ({ coachId }) => ({ ...fixture.readContext, coachId }),
  CoachScreen: props => {
    capturedScreen = props
    // Force a fresh screen instance even on adjacent draws: the Dashboard must
    // own the surviving search/fold state, not the test runtime's instance cache.
    return runtime.createElement(CoachScreen, { ...props, today: day, key: ++generation })
  },
}
const sharedKey = Symbol.for('coach-list-return.dashboard')
globalThis[sharedKey] = { fakes, h: runtime.h }
const prefix = 'coach-list-return://closed/'
const pure = new Set(['./analyseMissingFlag.mjs', './dashboard/ProgramOverblikView.mjs', './programOverblik.mjs', './indbakke2.mjs'])
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === url) {
      if (pure.has(specifier)) return next(new URL(specifier, url).href, context)
      assert.ok(Object.hasOwn(fakes, specifier), 'closed Dashboard dependency: ' + specifier)
      return { url: prefix + encodeURIComponent(specifier), shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(target, context, next) {
    const shared = "globalThis[Symbol.for('coach-list-return.dashboard')]"
    if (target === url) return { format: 'module', shortCircuit: true,
      source: `const __h=${shared}.h;\n` + jsx(source) }
    if (target.startsWith(prefix)) {
      const name = decodeURIComponent(target.slice(prefix.length))
      assert.ok(Object.hasOwn(fakes, name))
      return { format: 'module', shortCircuit: true, source: Object.keys(fakes[name]).map(exported =>
        `${exported === 'default' ? 'export default' : 'export const ' + exported + ' ='} ${shared}.fakes[${JSON.stringify(name)}][${JSON.stringify(exported)}];`
      ).join('\n') }
    }
    return next(target, context)
  },
})
const { default: Dashboard } = await import(url)
function Host(props) { cursor = 0; return Dashboard(props) }
const all = tree => runtime.nodes(tree, () => true)
const fold = tree => all(tree).find(n => n.props['data-coach-fold'] === 'atleter')
const input = tree => all(tree).find(n => n.type === 'input' && n.props.type === 'search')

test('Dashboard keeps only query and fold across actual profile unmount/remount; reset, coach switch and OFF clear them', () => {
  const previous = { window: globalThis.window, storage: globalThis.localStorage }
  globalThis.window = { location: { search: '' }, innerWidth: 375, scrollY: 320 }
  globalThis.localStorage = { getItem: () => null }
  try {
    const props = { entropi2: true, session: fixture.session, programCopyEnabled: false }
    const app = runtime.mount(Host, props)
    const draw = (next = props) => { capturedScreen = null; return app.render(next) }
    let tree = draw()
    assert.equal(fold(tree).props.open, false)
    const target = { open: true }
    fold(tree).props.onToggle({ target, currentTarget: target })
    input(tree).props.onChange({ target: { value: 'SYNTETISK' } })
    tree = draw()
    assert.equal(input(tree).props.value, 'SYNTETISK'); assert.equal(fold(tree).props.open, true)
    const oldOwnerCallback = capturedScreen.onAthleteQueryChange
    all(tree).find(n => n.props['data-coach-summary']).props.onClick()
    tree = draw()
    assert.equal(fold(tree), undefined); assert.equal(capturedScreen, null)
    const profile = all(tree).find(n => n.type === 'ProfilHoved')
    assert.equal(profile.props.profileReturnView, 'list')
    profile.props.setView(profile.props.profileReturnView)
    tree = draw()
    assert.equal(input(tree).props.value, 'SYNTETISK'); assert.equal(fold(tree).props.open, true)
    all(tree).find(n => n.type === 'button' && runtime.text(n) === 'Nulstil søgning').props.onClick()
    tree = draw(); assert.equal(input(tree).props.value, ''); assert.equal(fold(tree).props.open, true)
    input(tree).props.onChange({ target: { value: 'ingen match' } }); tree = draw()
    assert.match(runtime.text(fold(tree)), /Ingen match/)
    const other = { ...props, session: { user: { id: 'synthetic-other-coach' } } }
    tree = draw(other)
    assert.equal(input(tree).props.value, ''); assert.equal(fold(tree).props.open, false)
    oldOwnerCallback('stale owner callback')
    tree = draw(other); assert.equal(input(tree).props.value, '')
    tree = draw(props); assert.equal(input(tree).props.value, ''); assert.equal(fold(tree).props.open, false)
    input(tree).props.onChange({ target: { value: 'SYNTETISK' } })
    fold(tree).props.onToggle({ target, currentTarget: target }); draw()
    tree = draw({ ...props, entropi2: false }); assert.equal(capturedScreen, null)
    tree = draw(); assert.equal(input(tree).props.value, ''); assert.equal(fold(tree).props.open, false)
    // Dashboard owns presentation fields, not athlete data, reads or drafts.
    assert.deepEqual(Object.keys(currentViewState()).sort(), ['athleteQuery', 'athletesOpen', 'inboxLimit', 'owner'])
    function currentViewState() {
      let captured
      setters.coachListView(value => { captured = value; return value })
      return captured
    }
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window
    if (previous.storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.storage
  }
})

test('Dashboard preserves the inbox portion through task 17 profile return and resets it for owner/OFF changes', () => {
  const previous = { window: globalThis.window, storage: globalThis.localStorage,
    videos: fixture.coachMorningData.videos.rows }
  globalThis.window = { location: { search: '' }, innerWidth: 375, scrollY: 320 }
  globalThis.localStorage = { getItem: () => null }
  fixture.coachMorningData.videos.rows = Array.from({ length: 25 }, (_, i) => ({
    id: `synthetic-video-${i}`, athlete_id: fixture.athletes[0].id,
    status: 'draft', created_at: `${day}T10:00:00Z`,
  }))
  const before = JSON.stringify(fixture)
  try {
    const props = { entropi2: true, session: fixture.session, programCopyEnabled: false }
    const app = runtime.mount(Host, props)
    const draw = (next = props) => { capturedScreen = null; return app.render(next) }
    const actions = tree => all(tree).filter(n => n.props['data-coach-action'])
    const count = tree => runtime.text(all(tree).find(n => n.props['data-coach-inbox-count']))
    const more = tree => all(tree).find(n => n.type === 'button' && runtime.text(n) === 'Vis 10 flere')
    draw(); setters.view('inbox')
    let tree = draw()
    assert.equal(count(tree), '10 af 25')
    more(tree).props.onClick(); tree = draw()
    assert.equal(count(tree), '20 af 25')
    const shown = actions(tree).map(n => n.props['data-coach-action'])
    setters.view('list'); draw(); setters.view('inbox'); tree = draw()
    assert.equal(count(tree), '20 af 25')
    actions(tree)[16].props.onClick(); tree = draw()
    assert.equal(capturedScreen, null)
    const profile = all(tree).find(n => n.type === 'ProfilHoved')
    assert.equal(profile.props.profileReturnView, 'inbox')
    profile.props.setView(profile.props.profileReturnView); tree = draw()
    assert.equal(count(tree), '20 af 25')
    assert.deepEqual(actions(tree).map(n => n.props['data-coach-action']), shown)
    const showMore = more(tree).props.onClick
    showMore(); showMore(); tree = draw()
    assert.equal(count(tree), '25 af 25')
    assert.equal(capturedScreen.inboxLimit, 40, 'successive clicks use the current host state')
    assert.equal(more(tree), undefined)
    const staleMore = capturedScreen.onShowMoreInbox
    const other = { ...props, session: { user: { id: 'synthetic-other-coach' } } }
    tree = draw(other); assert.equal(count(tree), '10 af 25')
    staleMore(); tree = draw(other); assert.equal(count(tree), '10 af 25')
    tree = draw(); assert.equal(count(tree), '10 af 25')
    more(tree).props.onClick(); tree = draw(); assert.equal(count(tree), '20 af 25')
    draw({ ...props, entropi2: false }); assert.equal(capturedScreen, null)
    tree = draw(); assert.equal(count(tree), '10 af 25')
    assert.equal(JSON.stringify(fixture), before, 'presentation never mutates the synthetic read source')
  } finally {
    fixture.coachMorningData.videos.rows = previous.videos
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window
    if (previous.storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.storage
  }
})
