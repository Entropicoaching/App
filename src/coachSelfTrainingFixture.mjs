// Genuine React hooks/ReactDOM. Only host read snapshots, transport and unrelated children are synthetic.
import * as React from 'react'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './athlete/prog3Jsx.mjs'
const root = new URL('./', import.meta.url), self = import.meta.url
const hosts = new Map(['App.jsx', 'Dashboard.jsx', 'AthleteView.jsx'].map(name => [new URL(name, root).href, name]))
export const session = { user: { id: 'synthetic-coach' } }
export const dual = { id: 'synthetic-self', coach_id: session.user.id, user_id: 'synthetic-athlete-login', name: 'Egen testprofil' }
export const foreign = { id: 'synthetic-foreign', coach_id: session.user.id, user_id: 'synthetic-foreign-login', name: 'Anden testprofil' }
export const week = { id: 'synthetic-week', week_number: 1, start_date: '2026-11-02', sessions: [
  { id: 'synthetic-day', title: 'Testpas', day_of_week: 3, exercises: [{ id: 'synthetic-lift', name: 'Squat', sets: 1, reps: '3', weight: 60, recommended_weight: 60 }] }] }
export const fixture = { snapshots: {}, captured: {}, setters: {}, calls: [], authSession: session, role: 'coach', pauseRole: null, queue: null }
const noop = () => {}
export function seededState(host, name, initial) {
  const snap = fixture.snapshots[host] ?? {}
  const pair = React.useState(Object.hasOwn(snap, name) ? snap[name] : initial)
  fixture.setters[host + ':' + name] = pair[1]
  return pair
}
export const withRetry = fn => fn()
export const queueWrite = (fn, options = {}) => {
  const run = () => { options.onStart?.(); return fn() }
  return fixture.queue ? fixture.queue(run) : run()
}
export const isPasswordRecoveryUrl = () => false
export const signOutHard = () => { throw Error('No actual auth actions') }
export const supabase = {
  auth: {
    getSession: async () => fixture.pendingSession ? await fixture.pendingSession : ({ data: { session: fixture.authSession } }),
    onAuthStateChange(fn) { fixture.auth = fn; return { data: { subscription: { unsubscribe() { fixture.auth = null } } } } },
  },
  from(table) {
    let op = 'select', body, single = false
    const filters = []
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (ok, fail) => Promise.resolve().then(async () => {
        if (table === 'profiles' && fixture.pauseRole) await fixture.pauseRole
        fixture.calls.push({ table, op, body, filters: [...filters] })
        if (table === 'athletes' && fixture.athleteRead) return await fixture.athleteRead()
        if (table === 'profiles') return { data: { role: fixture.role }, error: null }
        if (fixture.returnAthlete && table === 'athletes') return { data: fixture.snapshots['AthleteView.jsx'].athlete, error: null }
        if (fixture.returnAthlete && table === 'weeks') return { data: [week], error: null }
        const inserted = { id: body?.id || 'synthetic-saved' }
        return { data: op === 'insert' ? single ? inserted : [inserted] : single ? null : [], error: null }
      }).then(ok, fail)
      return (...args) => {
        if (['insert', 'update', 'delete', 'upsert'].includes(method)) { op = method; body = args[0] }
        if (['single', 'maybeSingle'].includes(method)) single = true
        if (method === 'eq') filters.push(args)
        return query
      }
    } })
    return query
  },
  rpc(name) {
    if (name === 'complete_athlete_onboarding_v1' || name === 'claim_athlete_profile_v3') {
      fixture.calls.push({ table: 'rpc', op: 'rpc', name })
      return Promise.resolve({ data: name === 'claim_athlete_profile_v3' ? '00000000-0000-4000-8000-000000000001' : null, error: null })
    }
    if (name === 'get_my_shared_video_analyses_v3') return Promise.resolve({ data: [], error: null })
    throw Error('Unexpected RPC in synthetic training test: ' + name)
  },
}
export function capturedChild(name) {
  return props => {
    fixture.captured[name] = props
    return React.createElement('div', { 'data-test-child': name }, props.backBtn, props.children)
  }
}
export function capture(type, props) {
  if (typeof type === 'function' && type.name) fixture.captured[type.name] = props
}
export function LazyBoundary(props) {
  fixture.captured[props.label] = props.componentProps
  React.useEffect(() => {
    fixture.lazyMounts.push(['mount', props.label])
    return () => fixture.lazyMounts.push(['dispose', props.label])
  }, [])
  return null
}
export function factory() { return new Proxy({}, { get: () => noop }) }
export const special = {
  s: new Proxy({}, { get: () => ({}) }), today: () => '2026-11-04', parsePlannedRpe: () => null, WEEKDAYS_LONG: [],
  coachInboxEntryIntent: () => ({ view: 'list' }), coachRydEntryView: () => 'list',
  coachRydEnabled: () => fixture.cleanNav === true,
  useCoachPrioritet: () => ({ coachPriorityItems: [], coachPriorityCount: 0 }),
  createWeekDeletionQueue: () => ({ activate: noop, dispose: noop }),
  createInboxSaveNext: () => noop,
  loadParkedSets: () => ({}), grundlagFoer: () => null, loadRekordIndeks: () => null, tomtIndeks: () => ({}),
  useOwnTracking: () => ({}),
}
const actualHostImports = new Set([
  './coachSelfTraining.mjs', './dashboard/navigation.js', './dashboard/Sidebar.jsx', './dashboard/MobilNav.jsx',
  './athlete/saetSkrivning.js', './athlete/laesninger.js', './athlete/beskederOgVaegt.jsx', './athlete/kostHandlinger.js',
  './athlete/kostValg.mjs', './athlete/enkelPrototype.mjs', './entropi2/athleteEntry.mjs', './entropi2/home/homeProgramRead.mjs',
  './entropi2/profile/ProfilePage.mjs', './entropi2/conversation/Conversation.mjs', './entropi2/Entropi2Kost.mjs',
  './opvarmStige.mjs', './hviledageListe.mjs', './rel1030.mjs', './release3TestFlags.mjs', './e2eTestFlags.mjs',
])
export async function load() {
  const sourceFor = url => readFileSync(new URL(url), 'utf8')
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL
      if (parent?.startsWith(root.href) && /(?:^|\/)supabase(?:\.js)?$/.test(specifier)) return { url: self, shortCircuit: true }
      if (hosts.has(parent) && specifier !== 'react' && specifier !== self && !actualHostImports.has(specifier)) {
        if (specifier === './LazyBoundary.jsx') return { url: 'data:text/javascript,' + encodeURIComponent(`export { LazyBoundary as default } from ${JSON.stringify(self)}`), shortCircuit: true }
        const clauses = [...sourceFor(parent).matchAll(/import\s+(\w+\s*,\s*\{[^}]+\}|\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g)].filter(m => m[2] === specifier).map(m => m[1])
        if (!clauses.length) throw Error('Closed host import: ' + specifier)
        const names = clauses.map(c => c.includes('{') ? c.slice(c.indexOf('{') + 1, -1) : '').join(',').split(',').map(s => s.trim()).filter(Boolean)
        const defaultExport = clauses.some(c => !c.startsWith('{')) ? `export default capturedChild(${JSON.stringify(specifier.split('/').at(-1).replace(/\.(?:jsx|mjs|js)$/, ''))});` : ''
        const content = `import { special, capturedChild, factory } from ${JSON.stringify(self)}; const noop=()=>{};` + defaultExport + names.map(name =>
          `export const ${name} = ${Object.hasOwn(special, name) ? `special[${JSON.stringify(name)}]` : name.startsWith('lav') ? 'factory' : /^[A-Z]/.test(name) ? `capturedChild(${JSON.stringify(name)})` : 'noop'};`).join('\n')
        return { url: 'data:text/javascript,' + encodeURIComponent(content), shortCircuit: true }
      }
      if (parent?.startsWith(root.href) && specifier.startsWith('.')) {
        let url = new URL(specifier, parent)
        if (!existsSync(url)) for (const ext of ['.js', '.jsx', '.mjs']) { const candidate = new URL(url.href + ext); if (existsSync(candidate)) { url = candidate; break } }
        return next(url.href, context)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.startsWith(root.href) && url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {}' }
      if (!url.startsWith(root.href) || !url.endsWith('.jsx')) return next(url, context)
      let source = sourceFor(url).replaceAll('import.meta.env.MODE', "'test'")
      const host = hosts.get(url)
      if (host) source = source.replace(/const \[([\w]+),\s*([^\]]+)\] = useState\(/g, (_, name, setter) => `const [${name}, ${setter}] = seededState(${JSON.stringify(host)}, ${JSON.stringify(name)},`)
      return { format: 'module', shortCircuit: true, source:
        `import { createElement as __create, Fragment as __fragment } from 'react';
        import { capture${host ? ', seededState' : ''} } from ${JSON.stringify(self)};
        const __h=(t,p,k,...c)=>{ capture(t,p); return __create(t??__fragment,{...p,...(k==null?{}:{key:k})},...c) };
        ${jsx(source)}` }
    },
  })
  try {
    const App = (await import('./App.jsx')).default
    const Dashboard = (await import('./Dashboard.jsx')).default
    const AthleteView = (await import('./AthleteView.jsx')).default
    return { App, Dashboard, AthleteView, dispose: () => hooks.deregister() }
  } catch (error) { hooks.deregister(); throw error }
}
