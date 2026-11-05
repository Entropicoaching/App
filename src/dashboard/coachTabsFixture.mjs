// Hermetic service/child seams. Every changed view and reader is imported from its actual file.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './coachRydJsx.mjs'
const root = new URL('../', import.meta.url)
const self = import.meta.url
export const service = { responses: [], calls: [], invoke: null }
export const supabase = {
  functions: { invoke: (...args) => service.invoke(...args) },
  from(table) {
    const call = { table, steps: [] }; service.calls.push(call)
    return new Proxy({}, { get(target, key, receiver) {
      if (key === 'then') return (yes, no) => {
        const result = service.responses.shift()
        return (typeof result === 'function' ? result() : result instanceof Error ? Promise.reject(result) : Promise.resolve(result ?? { data: [], error: null })).then(yes, no)
      }
      return (...args) => { call.steps.push([key, ...args]); return receiver }
    } })
  },
}
export const withRetry = fn => fn()
export const Fragment = Symbol.for('coach-tabs.fragment')
export function createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export function useRef(current) { return { current } }
export function useState(initial) { let value = typeof initial === 'function' ? initial() : initial; return [value, next => { value = typeof next === 'function' ? next(value) : next }] }
export function useEffect() {}
export function useMemo(fn) { return fn() }
export function useCallback(fn) { return fn }
export function EmptyChild() { return null }
export function PassChild({ children }) { return children }
export function targetPrescriptionForExercise() { throw Error('Shared progression motor was not supplied; no substitute calculation') }
const views = ['OversigtTab', 'LogTab', 'ProgramTab', 'AnalyseTab', 'StaevneTab', 'HubTab', 'NoterTab', 'ProfilHoved', 'VolumenKort']
const viewURLs = new Set(views.map(name => new URL(`dashboard/${name}.jsx`, root).href))
const empty = new Set([
  'BlokFremgang.jsx', 'LazyBoundary.jsx', 'AthleteSilentFailNote.jsx', 'VideoRetentionLocalPreview.mjs',
  'dashboard/AnalyseLokaltVaerktoej.jsx', 'dashboard/AnalyseSammenlign.jsx', 'dashboard/AnalyseSamletPrototype.jsx',
  'dashboard/CoachPlanCopy.jsx', 'dashboard/ProgramCopyOptions.jsx', 'dashboard/UgeFeedbackKort.jsx', 'dashboard/VideoCoachNote.jsx',
  'dashboard/CoachNotesPage.mjs', 'dashboard/KortlaegningRedigering.jsx', 'dashboard/VolumenGraf.jsx', 'dashboard/VolumenGrafForloeb.jsx',
  'entropi2/coach/blokplan/CoachProgramTools.mjs', 'entropi2/staevne/CoachStaevnePlan.mjs',
  'entropi2/analysis/prognose/CoachMeetPrognose.mjs', 'entropi2/kostplan/staevne/CoachWeightPlan.mjs',
].map(path => new URL(path, root).href))
export function installCoachTabsFixture({ realReact = false } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' && !realReact) return { url: self, shortCircuit: true }
      if (context.parentURL?.startsWith(root.href) && specifier.startsWith('.')) {
        let url = new URL(specifier, context.parentURL)
        if (!/\.(?:jsx|mjs|js|json)$/.test(url.pathname)) url = new URL(url.href + '.js')
        if (url.href === new URL('supabase.js', root).href) return { url: self, shortCircuit: true }
        if (url.href.endsWith('/supabase/functions/_shared/progressionState.js')) return { url: self, shortCircuit: true }
        if (empty.has(url.href)) return { url: 'data:text/javascript,export default function EmptyChild(){return null}', shortCircuit: true }
        return next(url.href, context)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (viewURLs.has(url) || url.startsWith(root.href) && url.endsWith('.jsx')) return { format: 'module', shortCircuit: true, source:
        "import { createElement as __create, Fragment as __fragment } from 'react'; const __h=(t,p,ignored,...c)=>__create(t??__fragment,p,...c);\n" + jsx(readFileSync(new URL(url), 'utf8')) }
      return next(url, context)
    },
  })
}
export function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand)
  if (node == null || typeof node === 'boolean') return []
  if (typeof node !== 'object') return [node]
  if (typeof node.type === 'function') return expand(node.type(node.props || {}))
  return [{ ...node, children: expand(node.props?.children || []) }]
}
export const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' && value ? [value, ...nodes(value.children || [])] : []
export const text = value => Array.isArray(value) ? value.map(text).join(' ') : value == null ? '' : typeof value === 'object' ? text(value.children) : String(value)
export function ready(rows = [], athleteId = 'synthetic-a') { return Object.assign(rows, { coachRead: { athleteId, state: 'ready' } }) }
export function baseProps(extra = {}) {
 const noop = () => {}
 return { coachTabCleanup: true, a: { id: 'synthetic-a', user_id: 'synthetic-user', name: 'Syntetisk atlet' },
   selectedAthlete: { id: 'synthetic-a', name: 'Syntetisk atlet' }, session: { user: { id: 'synthetic-coach' } },
   athleteLogs: ready(), athleteReadiness: ready(), athletePRHistory: ready(), athletePRs: ready(), weeks: ready(),
   meetResults: ready(), meetPlanForm: { meet_type: 'sbd', coachRead: { athleteId: 'synthetic-a', state: 'ready' } },
   editData: {}, profilesLastSeen: {}, exerciseLibrary: [], videoAnalyses: [], videoBaselines: [],
   athleteWeightLogs: [], videoLiftFilter: 'all', openLogWeeks: new Set(), unreadCounts: {}, weeklyActivity: {},
   blockPlan: [], programShownWeeks: () => [], weekForm: {}, currentWeight: null, weightTrend: null,
   setLogExerciseFilter: noop, setEditing: noop, startEdit: noop, openMeetResult: noop, programActiveStart: noop,
   setActiveTab: noop, openVideoCoachV3: noop, ...extra }
}
