// Test-only JSX syntax bridge. Runtime selection is explicit; real React never falls back.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../coachRyd2Jsx.mjs'

export async function loadBundNav(runtime) {
  if (!['react', 'synthetic'].includes(runtime)) throw Error('Unknown test runtime')
  const component = new URL('./BundNav.jsx', import.meta.url).href
  const items = new URL('./NavItems.jsx', import.meta.url).href
  const fixture = new URL('./kost2Dom.mjs', import.meta.url).href
  const actual = new Set([component, items])
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === component && specifier === './NavItems')
        return { url: items, shortCircuit: true }
      if (actual.has(context.parentURL)) {
        if (runtime === 'synthetic' && specifier === fixture)
          return { url: fixture, shortCircuit: true }
        if (runtime === 'react' && specifier === 'react') return next(specifier, context)
        throw Error('Unapproved BundNav test import: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!actual.has(url)) return next(url, context)
      const bridge = runtime === 'react'
        ? "import { createElement as __element, Fragment as __fragment } from 'react';\nconst __h = (t,p,_,...c) => __element(t === null ? __fragment : t,p,...c);\n"
        : `import { h as __h } from ${JSON.stringify(fixture)};\n`
      return { format: 'module', shortCircuit: true,
        source: bridge + jsx(readFileSync(new URL(url), 'utf8')) }
    },
  })
  try {
    const { default: BundNav } = await import(component)
    return { BundNav, dispose: () => hooks.deregister() }
  } catch (error) { hooks.deregister(); throw error }
}

export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object' || !tree.props) return []
  return [tree, ...nodes(tree.props.children)]
}
export function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (tree == null || typeof tree === 'boolean') return ''
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree)
}
export const marked = (tree, name) => nodes(tree).find(n => Object.hasOwn(n.props, name))
export const fixtureProps = extra => ({ athlete: { id: 'synthetic-athlete' }, hasMeetPlan: false,
  tab: 'hjem', unreadMsgCount: 0, sharedVideoAnalyses: [], setTab() {}, ...extra })
