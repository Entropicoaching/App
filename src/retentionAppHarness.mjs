const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from './testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './retentionJsx.mjs'
export const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...(n.children || []).flatMap(nodes)] : []
export const text = n => Array.isArray(n) ? n.map(text).join(' ') : n && typeof n === 'object' ? n.children.map(text).join(' ') : String(n ?? '')
let serial = 0
const registry = Symbol.for('retention.synthetic')
globalThis[registry] = new Map()
const stubs = registryRecipe(import.meta.url, 'stubs')
export async function app({ before = false } = {}) {
  const id = String(++serial), prefix = `retention-${id}://app/`
  const state = { buckets: new Map(), active: null }
  state.useState = initial => {
    const b = state.active, i = b.cursor++
    if (!(i in b.values)) b.values[i] = initial
    return [b.values[i], v => { b.values[i] = v }]
  }
  state.h = (type, props, ignored, ...children) => {
    const flat = children.flat(Infinity).filter(v => v != null && v !== false)
    if (typeof type !== 'function') return { type, props, children: flat }
    const key = type.name + ':' + (props?.key ?? '')
    const old = state.active, b = state.buckets.get(key) || { cursor: 0, values: [] }
    state.buckets.set(key, b); b.cursor = 0; state.active = b
    try { return type({ ...props, children: flat }) } finally { state.active = old }
  }
  globalThis[registry].set(id, state)
  const real = new Set(registryRecipe(import.meta.url, 'real'))
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      const name = specifier.split('/').pop()
      if (name !== 'react' && !real.has(name) && !Object.hasOwn(stubs, name)) throw Error('Forbidden dependency: ' + specifier)
      return { url: prefix + name, shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context)
      const name = url.slice(prefix.length), access = `globalThis[Symbol.for('retention.synthetic')].get('${id}')`
      let source
      if (name === 'react') source = `export const useState=${access}.useState; export const useRef=v=>{const [ref]=${access}.useState({current:v});return ref}; export const createElement=(t,p,...c)=>${access}.h(t,p,null,...c);`
      else if (Object.hasOwn(stubs, name)) source = stubs[name]
      else {
        const relative = before && name === 'AnalyseTab.jsx' ? './retentionBeforeAnalyseTab.txt' : ['analyseConclusion.mjs','analyseConclusionMessage.mjs'].includes(name) ? './dashboard/' + name : './' + name
        const local = new URL(relative, import.meta.url)
        source = readFileSync(name === 'AnalyseTab.jsx' && !before && !existsSync(local) ? new URL('./dashboard/AnalyseTab.jsx', import.meta.url) : local, 'utf8')
        if (name.endsWith('.jsx')) source = `const __h=${access}.h;\n` + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
  const View = (await import(prefix + 'AnalyseTab.jsx')).default
  return { render: props => state.h(View, props, null) }
}
