const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachCalendarJsx.mjs'
const root = new URL('./', import.meta.url)
const dom = new URL('coachCalendarDom.mjs', root).href
const names = new Set(registryRecipe(import.meta.url, 'names'))
const paths = registryRecipe(import.meta.url, 'paths')
const local = name => new URL(existsSync(new URL(name, root)) ? name : (paths[name] || name), root).href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/dashboardShared')) return { url: new URL('coachCalendarStubs.mjs', root).href, shortCircuit: true }
    const name = specifier.split('/').at(-1)
    if (specifier.startsWith('.') && names.has(name)) return { url: local(name), shortCircuit: true }
    if (specifier === '../planOverview') return { url: local('planOverview.js'), shortCircuit: true }
    if (specifier === './coachKonstanter') return { url: new URL('coachKonstanter.js', root).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    const name = url.split('/').at(-1)
    if (names.has(name) || name === 'coachCalendarBaseline.jsx') {
      const source = readFileSync(new URL(url), 'utf8')
      return { format: 'module', source: name.endsWith('.jsx') ? `import { createElement as __h } from '${dom}';\n${jsx(source)}` : source, shortCircuit: true }
    }
    return next(url, context)
  },
})
