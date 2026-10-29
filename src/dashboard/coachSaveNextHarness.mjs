const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { posix } from 'node:path'
import { jsx } from './coachSaveNextJsx.mjs'
const paths = registryRecipe(import.meta.url, 'manifest:./test-paths.json')
const states = new Map()
globalThis[Symbol.for('coach14.tests')] = states
let counter = 0
export function h(type, props, ignored, ...children) {
  const flat = children.flat(Infinity).filter(x => x != null && x !== false)
  return typeof type === 'function' ? type({ ...props, children: flat }) : { type, props, children: flat }
}
export const nodes = t => t && typeof t === 'object' ? [t, ...(t.children || []).flatMap(nodes)] : []
export const text = t => typeof t === 'string' || typeof t === 'number' ? String(t) : (t?.children || []).map(text).join(' ')
export async function app(backend) {
  const id = String(++counter), prefix = `coach14://${id}/`
  states.set(id, { backend, h })
  registerHooks({
    resolve(spec, context, next) {
      if (spec.startsWith(prefix)) return { url: spec, shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(spec, context)
      let path = spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(context.parentURL.slice(prefix.length)), spec)) : spec
      if (path.startsWith('src/') && !posix.extname(path)) path += '.js'
      if (path !== 'react' && path !== 'src/supabase.js' && !paths[path]) throw new Error(`Blocked import ${path}`)
      return { url: prefix + path, shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context)
      const path = url.slice(prefix.length)
      const state = `globalThis[Symbol.for('coach14.tests')].get(${JSON.stringify(id)})`
      let source
      if (path === 'src/supabase.js') source = `export const supabase = ${state}.backend; export const withRetry = fn => fn();`
      else if (path === 'react') source = `export const createElement = (t,p,...c) => ${state}.h(t,p,null,...c); export const Fragment = null; export const useEffect = () => {}; export const useState = v => [typeof v === 'function' ? v() : v, () => {}]; export const useRef = v => ({current:v});`
      else {
        if (!paths[path]) throw new Error(`Blocked source ${path}`)
        const flat = existsSync(new URL('./dashboardShared.js', import.meta.url))
        const sourceUrl = new URL(flat ? paths[path] : '../' + path.slice(4), import.meta.url)
        source = readFileSync(sourceUrl, 'utf8')
        if (path.endsWith('.jsx')) source = `const __h = ${state}.h;\n` + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
  return path => import(prefix + path)
}
