const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from './testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './checklistJsx.mjs'
import * as dom from './checklistDom.mjs'
const files = registryRecipe(import.meta.url, 'files')
const stubs = new Map()
for (const file of files) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const match of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[2]
    if (!stubs.has(specifier)) stubs.set(specifier, new Set())
    const names = stubs.get(specifier), clause = match[1].trim()
    if (!clause.startsWith('{')) names.add('default')
    const named = clause.match(/\{([^}]+)\}/)?.[1] || ''
    for (const name of named.split(',').map(x => x.trim()).filter(Boolean)) names.add(name.split(/\s+as\s+/)[0])
  }
}
export const hookControl = { first: null, values: null, cursor: 0 }
const fake = () => null
const runtime = { ...dom, useRef: value => hookControl.values ? {current:value} : dom.useRef(value), useEffect: fake, useMemo: fn => fn(),
  useState: initial => {
    if (hookControl.first) { hookControl.first(typeof initial === 'function' ? initial() : initial); throw Error('FIRST_STATE_CAPTURED') }
    if (hookControl.values) { const i = hookControl.cursor++; if (!(i in hookControl.values)) hookControl.values[i] = typeof initial === 'function' ? initial() : initial; return [hookControl.values[i], value => hookControl.values[i] = typeof value === 'function' ? value(hookControl.values[i]) : value] }
    return dom.useState(initial)
  } }
globalThis[Symbol.for('checklist.runtime')] = runtime
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/fridayChecklist.mjs') && existsSync(new URL('fridayChecklist.mjs',import.meta.url))) return {url:new URL('fridayChecklist.mjs',import.meta.url).href,shortCircuit:true}
    if (specifier === 'react') return { url: 'synthetic:react', shortCircuit: true }
    if (files.some(file => context.parentURL === new URL(file, import.meta.url).href) && stubs.has(specifier)) {
      if (specifier.endsWith('fridayChecklist.mjs') || specifier.endsWith('rel1030.mjs') || specifier.endsWith('release3TestFlags.mjs') || specifier.endsWith('e2eTestFlags.mjs')) return next(specifier, context)
      return { url: 'synthetic:stub:' + encodeURIComponent(specifier), shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'synthetic:react') return { format: 'module', shortCircuit: true, source: Object.keys(runtime).map(name => `export const ${name}=globalThis[Symbol.for('checklist.runtime')].${name};`).join('\n') }
    if (url.startsWith('synthetic:stub:')) {
      const names = stubs.get(decodeURIComponent(url.slice('synthetic:stub:'.length)))
      return { format: 'module', shortCircuit: true, source: [...names].map(name => name === 'default' ? 'export default function Stub(){}' : `export const ${name}=()=>null;`).join('\n') }
    }
    if (files.some(file => url === new URL(file, import.meta.url).href)) return { format: 'module', shortCircuit: true,
      source: "import {createElement as __create} from 'react'; const __h=(t,p,unused,...c)=>__create(t,p,...c);\n" + jsx(readFileSync(new URL(url),'utf8').replaceAll('import.meta.env.MODE', "'production'")) }
    return next(url,context)
  },
})
