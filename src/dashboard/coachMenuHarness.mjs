const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'
import { jsx } from './coachRydJsx.mjs'

export const Fragment = Symbol.for('menu.fragment')
export function h(type, props, ...children) {
  children = children.flat(Infinity).filter(x => x != null && typeof x !== 'boolean')
  if (typeof type === 'function') return type({ ...props, children })
  return { type, props: props || {}, children }
}
export const nodes = tree => tree && typeof tree === 'object'
  ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'object'
  ? (tree?.children || []).map(text).join(' ') : String(tree ?? '')
export function normalize(tree) {
  if (Array.isArray(tree)) return tree.flatMap(x => {
    const value = normalize(x)
    return Array.isArray(value) ? value : [value]
  })
  if (!tree || typeof tree !== 'object') return tree
  if (tree.type === Fragment || tree.type == null) return normalize(tree.children)
  return { type: tree.type, props: Object.fromEntries(Object.entries(tree.props)
    .map(([key, value]) => [key, typeof value === 'function' ? 'handler' : value])),
  children: normalize(tree.children) }
}
const styles = new Proxy({}, { get: () => ({}) })
export const signouts = []
const fakes = {
  react: { createElement: h, Fragment },
  'dashboardShared.js': { s: styles, initials: name => name.slice(0, 2) },
  'coachKonstanter.js': { holidayInfo: () => null, ferieBadgeLabel: () => '' },
  weekDates: { nextWeekStartDate: () => { throw Error('Unused synthetic dependency') } },
  coachPriority: { coachPriorityTaskContext: () => { throw Error('Unused synthetic dependency') } },
  'supabase.js': { signOutHard: () => signouts.push('signout') },
}
globalThis[Symbol.for('menu.harness')] = { fakes, h }
const allowed = new Set([...Object.keys(fakes), 'Sidebar.jsx', 'MobilNav.jsx',
  'SidebarBase.txt', 'MobilNavBase.txt', 'coachMenuMore.mjs', 'coachRyd.mjs', 'navigation.js'])
const prefix = 'menu-test:///'
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(prefix)) {
      if (!allowed.has(specifier.slice(prefix.length))) throw Error('Forbidden dependency: ' + specifier)
      return { url: specifier, shortCircuit: true }
    }
    if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
    const name = basename(specifier)
    const imports = new Set(registryRecipe(import.meta.url, 'imports'))
    if (!imports.has(specifier) || !allowed.has(name)) throw Error('Forbidden dependency: ' + specifier)
    return { url: prefix + name, shortCircuit: true }
  },
  load(url, context, next) {
    if (!url.startsWith(prefix)) return next(url, context)
    const name = url.slice(prefix.length)
    if (!allowed.has(name)) throw Error('Forbidden dependency: ' + url)
    const state = "globalThis[Symbol.for('menu.harness')]"
    let source
    if (name in fakes) {
      source = Object.keys(fakes[name]).map(key =>
        `export const ${key} = ${state}.fakes[${JSON.stringify(name)}][${JSON.stringify(key)}];`).join('\n')
    } else {
      const local = new URL(name, import.meta.url)
      source = readFileSync(name === 'coachRyd.mjs' && !existsSync(local)
        ? new URL('../coachRyd.mjs', import.meta.url) : local, 'utf8')
      if (/\.(jsx|txt)$/.test(name)) source = `const __h = (type, props, ignored, ...children) => ${state}.h(type, props, ...children);\n` + jsx(source)
    }
    return { format: 'module', source, shortCircuit: true }
  },
})
export const load = async name => import(prefix + name)
