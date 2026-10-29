const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from './testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
import { jsx } from './athlete/prog5Jsx.mjs'

// Exact paths and import edges. No dependency discovery or backend at runtime.
const root = new URL('../', import.meta.url)
const dom = new URL('./trin1Dom.mjs', import.meta.url).href
const graph = registryRecipe(import.meta.url, 'manifest:./trin1Imports.json')
const paths = new Map(Object.keys(graph).map(path => [new URL(path, root).href, path]))
export function install({ trin, lineEnding } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = paths.get(context.parentURL)
      if (!parent) return next(specifier, context)
      if (specifier === dom) return { url: dom, shortCircuit: true }
      const target = graph[parent][specifier]
      if (!target) throw Error(`Closed trin1 import: ${parent} -> ${specifier}`)
      if (target.startsWith('node:')) return next(specifier, context)
      return { url: target === '@dom' ? dom : new URL(target, root).href, shortCircuit: true }
    },
    load(url, context, next) {
      const path = paths.get(url)
      if (!path || path.endsWith('.json')) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (lineEnding) source = source.replace(/\r?\n/g, lineEnding)
      if (path === 'src/udgivelseTrin.mjs' && trin !== undefined) {
        if (![0, 1].includes(trin)) throw Error('Unknown synthetic release step')
        source = source.replace('UDGIVELSE_TRIN = 0', `UDGIVELSE_TRIN = ${trin}`)
      }
      if (path.endsWith('.jsx')) source = `import { h as __h } from '${dom}';\n${jsx(source)}`
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
