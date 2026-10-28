import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'
import { jsx } from './profileWeekJsx.mjs'
export const effects = []
export const requests = []
export let response = { data: [], error: null }
export function respond(value) { response = value }
export const Fragment = Symbol.for('profile-week.fragment')
export function h(type, props, ...children) {
  children = children.flat(Infinity).filter(x => x != null && x !== false && x !== true)
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children }
}
export const nodes = tree => tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
const key = Symbol.for('profile-week-test-runtime')
const fakeQuery = new Proxy({}, { get(_, method) {
  if (method === 'then') return (yes, no) => Promise.resolve(response).then(yes, no)
  return (...args) => { requests.push([method, ...args]); return fakeQuery }
} })
globalThis[key] = { h, Fragment, effects, supabase: { from: (...args) => { requests.push(['from', ...args]); return fakeQuery } } }
const root = new URL('./', import.meta.url)
const real = new Set(['coachInactive.mjs', 'coachMeetSource.mjs', 'coachMeetSoon.mjs', 'coachWeekOverview.mjs','profileWeekSummary.mjs', 'coachFourWeeks.mjs', 'nextSet.js', 'exerciseProgress.js', 'udgivelseTrin.mjs', 'dataEnough.mjs', 'inputValues.js', 'calendarDate.js', 'kostNumbers.mjs', 'rpeEvidence.mjs', 'exerciseSetView.js', 'exerciseNames.js', 'ugenoegle.js', 'coachKonstanter.js', 'laesninger.js', 'useDashboardEffekter.js'])
const data = source => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true })
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('node:') || specifier.startsWith('data:')) return next(specifier, context)
    if (specifier === 'react') return data(`const r=globalThis[Symbol.for('profile-week-test-runtime')]; export const useState=()=>{throw Error('Unexpected meet UI hook')}; export const createElement=r.h, Fragment=r.Fragment, useEffect=(fn,deps)=>r.effects.push({fn,deps});`)
    const name = basename(specifier)
    if (real.has(name)) {
      const flat = new URL(name, root)
      if (existsSync(flat)) return { url: flat.href, shortCircuit: true }
      return next(specifier, context)
    }
    if (name === 'supabase.js') return data(`export const supabase=globalThis[Symbol.for('profile-week-test-runtime')].supabase; export const withRetry=fn=>fn();`)
    if (context.parentURL?.startsWith('file:') && specifier.startsWith('.')) {
      const source = readFileSync(new URL(context.parentURL), 'utf8')
      const declarations = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].filter(m => m[2] === specifier)
      const names = declarations.flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean))
      if (!names.length) throw Error('Unpinned import: ' + specifier)
      return data(names.map(name => `export const ${name}=()=>{throw Error('Unpinned dependency called: ${name}')};`).join('\n'))
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root.href) && real.has(basename(new URL(url).pathname))) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    return next(url, context)
  },
})
export function parseDashboard(source) { return jsx(source) }
