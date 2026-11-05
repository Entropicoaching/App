// Test-only closed boundary around the complete App and AthleteView modules.
// React mode uses genuine React hooks and SSR; synthetic mode is labelled separately.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './prog3Jsx.mjs'

const root = new URL('../', import.meta.url)
const self = import.meta.url
const viewURL = new URL('AthleteView.jsx', root).href
const appURL = new URL('App.jsx', root).href
const sources = new Map([viewURL, appURL].map(url => [url, readFileSync(new URL(url), 'utf8')]))
const labels = new Map([...sources].map(([url, source]) => [url,
  [...source.matchAll(/const \[([^,]+),[^\]]+\] = useState\(/g)].map(match => match[1])]))
let real, current = viewURL, cursor = 0, states = {}, seeds = {}, effects = []
export const fixture = { calls: [], bridge: null, readiness: null, database: null }
export const session = { user: { id: 'synthetic-owner' } }
export const ownAthlete = { id: 'synthetic-own', user_id: session.user.id, name: 'Testprofil' }
export const otherAthlete = { id: 'synthetic-other', user_id: 'synthetic-other-owner', name: 'Anden testprofil' }
export const week = { id: 'synthetic-week', week_number: 1, start_date: '2026-11-02', sessions: [
  { id: 'synthetic-session', title: 'Testpas', day_of_week: 3, exercises: [{ id: 'synthetic-exercise', name: 'Squat', sets: 1, reps: '3', weight: 60 }] },
] }
export function seed(values = {}, app = false) {
  current = app ? appURL : viewURL
  cursor = 0; states = {}; effects = []
  seeds = app ? { session, role: 'coach', loading: false, previewMode: false, ...values }
    : { athlete: ownAthlete, loading: false, homeProgramLoading: false, onboardingDone: true, currentWeek: week, allWeeks: [week], ...values }
  fixture.calls = []; fixture.bridge = null; fixture.readiness = null
}
export function begin() { cursor = 0; effects = [] }
export function useState(initial) {
  const label = labels.get(current)[cursor++]
  const value = Object.hasOwn(seeds, label) ? seeds[label] : initial
  if (real) return real.useState(value)
  if (!Object.hasOwn(states, label)) states[label] = typeof value === 'function' ? value() : value
  return [states[label], next => { states[label] = typeof next === 'function' ? next(states[label]) : next }]
}
export const useRef = initial => real ? real.useRef(initial) : { current: initial }
export const useMemo = (fn, deps) => real ? real.useMemo(fn, deps) : fn()
export const useEffect = (fn, deps) => real ? real.useEffect(fn, deps) : effects.push(fn)
export const useId = () => 'synthetic-id'
export const useReducer = (fn, initial) => [initial, () => {}]
export const Fragment = Symbol.for('react.fragment')
export const createElement = (type, props, ...children) => real ? real.createElement(type, props, ...children)
  : { type, props: { ...props, children: children.flat(Infinity) } }
export const nodes = tree => !tree || typeof tree !== 'object' ? []
  : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
export const named = (tree, name) => nodes(tree).find(node => node.type?.name === name)
export function render(Component, props = {}) { begin(); return Component(props) }
export function runEffects() { const cleanups = effects.map(fn => fn()).filter(fn => typeof fn === 'function'); return () => cleanups.reverse().forEach(fn => fn()) }
export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-11-04'
export const noop = () => {}
export const empty = () => ({})
export const parsePlannedRpe = () => 8
export const WEEKDAYS_LONG = []
export const spy = name => (...args) => { fixture.calls.push({ name, args }); return Promise.resolve() }
export function stub(name) {
  const component = props => createElement('div', { 'data-test-boundary': name }, props.children, props.backBtn)
  Object.defineProperty(component, 'name', { value: name })
  return component
}
export const factory = () => new Proxy({}, { get: (_, name) => name === 'inboxDatabase' ? fixture.database ?? database : spy(name) })
export function useVideoCoachBro(props) { fixture.bridge = props }
export function useParathedUdkast(props) { fixture.readiness = props }
export const database = { from: spy('database.from'), rpc: spy('database.rpc') }

export async function loadViews({ realReact = false } = {}) {
  if (realReact) real = await import('react')
  const actual = new Set(['./athlete/kostValg.mjs', './athlete/enkelPrototype.mjs', './entropi2/athleteEntry.mjs',
    './entropi2/home/homeProgramRead.mjs',
    './entropi2/profile/ProfilePage.mjs', './entropi2/conversation/Conversation.mjs', './entropi2/conversation/conversationController.mjs', './entropi2/Entropi2Kost.mjs',
    './opvarmStige.mjs', './hviledageListe.mjs', './rel1030.mjs', './release3TestFlags.mjs', './e2eTestFlags.mjs'])
  const special = new Set(['s', 'today', 'parsePlannedRpe', 'WEEKDAYS_LONG', 'useVideoCoachBro', 'useParathedUdkast'])
  const objects = new Set(['loadParkedSets', 'grundlagFoer', 'loadRekordIndeks', 'tomtIndeks'])
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' && (!realReact && context.parentURL?.startsWith(root.href) || sources.has(context.parentURL)))
        return { url: self, shortCircuit: true }
      if (sources.has(context.parentURL) && specifier !== self) {
        if (actual.has(specifier)) return next(specifier, context)
        const source = sources.get(context.parentURL)
        const clauses = [...source.matchAll(/import\s+(\w+\s*,\s*\{[^}]+\}|\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g)]
          .filter(match => match[2] === specifier).map(match => match[1])
        if (!clauses.length) throw Error('Closed host import: ' + specifier)
        const namedClause = clauses.map(clause => clause.includes('{') ? clause.slice(clause.indexOf('{') + 1, -1) : '').join(',')
        const defaultClause = clauses.some(clause => !clause.startsWith('{'))
          ? `export default stub(${JSON.stringify(specifier.split('/').at(-1).replace(/\.(?:jsx|js|mjs)$/, ''))});` : ''
        const content = defaultClause + namedClause.split(',').map(s => s.trim()).filter(Boolean).map(name =>
          special.has(name) ? `export { ${name} } from ${JSON.stringify(self)};`
            : `export const ${name} = ${name.startsWith('lav') ? 'factory' : objects.has(name) ? 'empty' : name === 'release3TestFlags' ? '() => ({ athlete: {}, coach: {} })' : 'noop'};`).join('\n')
        return { url: 'data:text/javascript,' + encodeURIComponent(`import { stub, factory, empty, noop } from ${JSON.stringify(self)};\n${content}`), shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!sources.has(url)) return next(url, context)
      const source = sources.get(url).replaceAll('import.meta.env.MODE', "'test'")
      return { format: 'module', shortCircuit: true, source:
        `import { createElement as __create, Fragment as __fragment } from ${JSON.stringify(self)};\nconst __h = (type, props, key, ...children) => __create(type ?? __fragment, props, ...children);\n${jsx(source)}` }
    },
  })
  try {
    const view = await import(viewURL)
    const { default: App } = await import(appURL)
    return { ...view, App, dispose: () => hooks.deregister() }
  } catch (error) { hooks.deregister(); throw error }
}
