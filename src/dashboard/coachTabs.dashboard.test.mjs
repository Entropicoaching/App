// Actual copied Dashboard entry point; closed synthetic hooks/services and leaf views.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { entropi2Enabled } from '../entropi2/flag.mjs'
import { jsx } from './coachRydJsx.mjs'
import { h, nodes } from '../coachRyd2Harness.mjs'
await import('../rebaseHarness.mjs')

const url = new URL('../Dashboard.jsx', import.meta.url).href + '?coach-tabs-entry'
const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
const stateNames = [...source.matchAll(/const \[(\w+)(?:,\s*\w+)?\] = useState\(/g)].map(m => m[1])
const athlete = { id: 'synthetic-a', name: 'Syntetisk atlet' }
const noop = () => {}
const state = { cursor: 0, tab: 'hub', calls: {} }
const fakes = { ...globalThis[Symbol.for('rebase.dashboard')].fakes }
fakes.react = {
  useState(initial) {
    const name = stateNames[state.cursor++]
    assert.ok(name, 'every actual Dashboard state hook is named')
    const overrides = { loading: false, athletes: [athlete], selectedAthlete: athlete, view: 'profile', activeTab: state.tab }
    return [Object.hasOwn(overrides, name) ? overrides[name] : typeof initial === 'function' ? initial() : initial, noop]
  },
  useRef: current => ({ current }), useEffect: noop,
}
fakes['./entropi2/coachEntry.mjs'] = { ...fakes['./entropi2/coachEntry.mjs'], entropi2Enabled }
fakes['./dashboard/laesninger.js'] = { lavLaesninger: props => { state.calls.reader = props; return {} } }
fakes['./dashboard/programHandlinger.js'] = { lavProgramHandlinger: props => { state.calls.actions = props; return {} } }
const key = Symbol.for('coach-tabs.dashboard-entry')
globalThis[key] = { fakes, h }
const prefix = 'coach-tabs-entry://seam/'
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
    const shared = "globalThis[Symbol.for('coach-tabs.dashboard-entry')]"
    if (target === url) return { format: 'module', shortCircuit: true,
      source: `const __h=(type,props,ignored,...children)=>${shared}.h(type,props,...children);\n` + jsx(source) }
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
function draw(tab, entropi2, width) {
  state.cursor = 0; state.tab = tab; state.calls = {}
  const previous = { window: globalThis.window, storage: globalThis.localStorage }
  globalThis.window = { location: { search: '' }, innerWidth: width }
  globalThis.localStorage = { getItem: () => null }
  try {
    const tree = Dashboard({ entropi2, session: { user: { id: 'synthetic-coach' } }, programCopyEnabled: false })
    assert.equal(state.cursor, stateNames.length)
    return { tree, ...state.calls }
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window
    if (previous.storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous.storage
  }
}
const tabs = { hub: 'HubTab', oversigt: 'OversigtTab', log: 'LogTab', stævne: 'StaevneTab', noter: 'NoterTab', analyse: 'Analyse', program: 'Program' }
for (const [label, entropi2] of [['production default', undefined], ['explicit ON', true], ['explicit OFF', false]]) {
  test(`Dashboard ${label}: all eight profile views, readers, actions and selected athlete`, () => {
    const enabled = entropi2 !== false
    for (const width of [375, 1280]) for (const [tab, name] of Object.entries(tabs)) {
      const { tree, reader, actions } = draw(tab, entropi2, width)
      const list = nodes(tree)
      const entry = list.find(n => n.type === name || n.type === 'LazyBoundary' && n.props.label === name)
      assert.ok(entry, tab)
      const props = entry.type === 'LazyBoundary' ? entry.props.componentProps : entry.props
      const profile = list.find(n => n.type === 'ProfilHoved')
      assert.ok(profile)
      for (const options of [props, profile.props, reader, actions]) {
        assert.equal(Object.hasOwn(options, 'coachTabCleanup'), enabled, tab)
        if (enabled) assert.equal(options.coachTabCleanup, true, tab)
      }
      if (enabled) assert.equal(reader.currentProgramAthleteRef.current, athlete.id)
      else assert.equal(reader.currentProgramAthleteRef, undefined)
      if (tab === 'log') assert.equal(props.athleteId, enabled ? athlete.id : undefined)
    }
  })
}
