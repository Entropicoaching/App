// E2-SAMLET-PROEVE1: genuine React SSR of the copied AthleteView and its leaves.
// Only host useState snapshots, the database capability, and async chunk scheduling
// are adapted. No presentation component is replaced by a placeholder.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from './prog3Jsx.mjs'

const root = new URL('../', import.meta.url)
const host = new URL('AthleteView.jsx', root).href
const self = import.meta.url
const hostSource = readFileSync(new URL(host), 'utf8')
const statePattern = /const \[([\w]+),\s*([^\]]+)\] = useState\(/g
const stateNames = new Set([...hostSource.matchAll(statePattern)].map(match => match[1]))
let snapshots = {}, pending = []
const chunks = new Map()
export const importedModules = new Set()
export const boundaryCalls = []
export const deny = (...args) => { boundaryCalls.push(args); throw Error('Forbidden external capability in samletProeve') }
export const supabase = new Proxy({}, { get: () => deny })
export const withRetry = deny, queueWrite = deny, signOutHard = deny, createAbortableUploadClient = deny
export const isPasswordRecoveryUrl = deny

export function useSeededState(name, initial) {
  return React.useState(Object.hasOwn(snapshots, name) ? snapshots[name] : initial)
}

// Resolve the host's actual factory, then render its actual default export with
// the host's unchanged componentProps. The intermediate loading pass is discarded.
export function ResolvedLazyBoundary({ factory, loading, componentProps }) {
  const entry = chunks.get(factory)
  if (entry?.error) throw entry.error
  if (entry?.component) return React.createElement(entry.component, componentProps)
  if (!entry) {
    const next = {}
    chunks.set(factory, next)
    pending.push(Promise.resolve().then(factory).then(module => { next.component = module.default }, error => {
      next.error = error
      throw error
    }))
  }
  return loading ?? null
}

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(root.href) && specifier.startsWith('.')) {
      let url = new URL(specifier, context.parentURL)
      if (!existsSync(url)) {
        for (const extension of ['.js', '.jsx', '.mjs']) {
          const candidate = new URL(url.href + extension)
          if (existsSync(candidate)) { url = candidate; break }
        }
      }
      if (url.href === new URL('supabase.js', root).href) return { url: self, shortCircuit: true }
      if (url.href === new URL('LazyBoundary.jsx', root).href) {
        return { url: 'data:text/javascript,' + encodeURIComponent(`export { ResolvedLazyBoundary as default } from ${JSON.stringify(self)}`), shortCircuit: true }
      }
      return { url: url.href, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root.href)) importedModules.add(url)
    // Styles are bundled by the app; Node SSR only needs an inert local module.
    if (url.startsWith(root.href) && url.endsWith('.css'))
      return { format: 'module', shortCircuit: true, source: 'export default {}' }
    if (!url.startsWith(root.href) || !url.endsWith('.jsx')) return next(url, context)
    let source = readFileSync(new URL(url), 'utf8')
    if (url === host) source = source.replace(statePattern, (_, name, setter) =>
      `const [${name}, ${setter}] = useSeededState(${JSON.stringify(name)},`)
    return { format: 'module', shortCircuit: true, source:
      `import { createElement as __create, Fragment as __fragment } from 'react';
       ${url === host ? `import { useSeededState } from ${JSON.stringify(self)};` : ''}
       const __h = (type, props, key, ...children) => __create(type ?? __fragment, props, ...children);
       ${jsx(source)}` }
  },
})

export { athletes, week, tabs, scenario } from './samletProeveData.mjs'

const originals = new Map()
function replaceGlobal(key, value) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
const NativeDate = globalThis.Date
replaceGlobal('Date', class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])) }
  static now() { return new NativeDate('2026-11-04T12:00:00Z').getTime() }
})
replaceGlobal('fetch', deny)
// No persistent storage is touched, even by legacy initializer reads.
replaceGlobal('localStorage', Object.freeze({ getItem: () => null, setItem: deny, removeItem: deny }))

let AthleteView
export async function renderScenario(input) {
  snapshots = input.seed
  for (const name of Object.keys(snapshots)) assert.ok(stateNames.has(name), `Fixture invented host state: ${name}`)
  boundaryCalls.length = 0
  AthleteView ??= (await import(host)).default
  for (let pass = 0; pass < 6; pass++) {
    pending = []
    const html = renderToStaticMarkup(React.createElement(AthleteView, input.props))
    if (!pending.length) {
      assert.deepEqual(boundaryCalls, [], 'SSR attempted an external capability')
      return html
    }
    await Promise.all(pending)
  }
  assert.fail('Resolved lazy render did not settle after six passes')
}

export function dispose() {
  hooks.deregister()
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
