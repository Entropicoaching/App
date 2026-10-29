const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachNotesJsx.mjs'
import * as dom from './coachNotesDom.mjs'

export const effects = []
export const calls = []
export const results = []
export const client = { from(table) {
  const call = { table, steps: [] }; calls.push(call)
  const request = new Proxy({}, { get(_, key) {
    if (key === 'then') return (yes, no) => {
      if (!results.length) throw Error('Unexpected synthetic persistence')
      return Promise.resolve(results.shift()).then(yes, no)
    }
    return (...args) => { call.steps.push([key, ...args]); return request }
  } })
  return request
} }
const styleValue = () => ({})
const style = new Proxy({}, { get: () => styleValue })
const fakes = {
  createElement: (type, props, ...children) => dom.h(type, props, null, ...children),
  useState: dom.useState, useRef: dom.useRef,
  useMemo: fn => fn(), useEffect: (fn, deps) => effects.push({ fn, deps }),
  s: style, supabase: client, initials: () => 'SA', formatLastSeen: () => null,
  statusLabels: { active: 'Aktiv' },
  CoachFold: ({ children }) => dom.h(null, {}, null, children),
  useCoachPrioritet: () => ({ coachPriorityItems: [], coachPriorityCount: 0 }),
}
globalThis[Symbol.for('coachNotes.test')] = { fakes, h: dom.h }
const real = new Set(registryRecipe(import.meta.url, 'real'))
const prefix = 'coach-notes-test:///'
export const load = name => import(prefix + name)
// Allowlisted public modules only. Other static imports get inert exports derived
// from the importing copy; they are never resolved to the app or its dependencies.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(prefix)) {
      if (!real.has(specifier.slice(prefix.length))) throw Error('Unpinned module')
      return { url: specifier, shortCircuit: true }
    }
    if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
    const parent = context.parentURL.slice(prefix.length)
    const name = specifier.split('/').at(-1)
    if (real.has(name)) {
      const target = parent === 'coachNotesDashboardBase.txt' && name === 'NoterTab.jsx' ? 'coachNotesTabBase.txt' : name
      return { url: prefix + target, shortCircuit: true }
    }
    if (!(specifier === 'react' || specifier.startsWith('.'))) throw Error('Unexpected import: ' + specifier)
    const source = readFileSync(sourcePath(parent), 'utf8')
    const clause = [...source.matchAll(/import\s+([^\n]+?)\s+from\s+['"]([^'"]+)['"]/g)].find(m => m[2] === specifier)?.[1]
    if (!clause) throw Error('Unexpected dynamic dependency: ' + specifier)
    const names = clause.match(/\{([^}]+)\}/)?.[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) || []
    const exports = names.map(name => `export const ${name} = ${name in fakes
      ? `globalThis[Symbol.for('coachNotes.test')].fakes.${name}`
      : /^[A-Z_]+$/.test(name) ? 'false' : /^[A-Z]/.test(name) ? '() => null' : name.endsWith('Flag') || name.endsWith('Enabled') ? '() => false' : '() => ({})'};`).join('\n')
    return { url: `data:text/javascript,${encodeURIComponent('export default function Stub(){return null};\n' + exports)}`, shortCircuit: true }
  },
  load(url, context, next) {
    if (!url.startsWith(prefix)) return next(url, context)
    const name = url.slice(prefix.length)
    let source = readFileSync(sourcePath(name), 'utf8')
    if (/\.(jsx|txt)$/.test(name)) source = `const __h = globalThis[Symbol.for('coachNotes.test')].h;\n` + jsx(source)
    return { format: 'module', source, shortCircuit: true }
  },
})
const paths = registryRecipe(import.meta.url, 'paths')
export function sourcePath(name) {
  const flat = new URL(name, import.meta.url)
  return existsSync(flat) ? flat : new URL(paths[name] || name, import.meta.url)
}
export { mount, text, nodes, button } from './coachNotesDom.mjs'
