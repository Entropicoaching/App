const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './analyseSamletJsx.mjs'
const root = new URL('./', import.meta.url)
const flat = existsSync(new URL('dataEvidence.mjs', root))
const legacy = new Set(registryRecipe(import.meta.url, 'legacy'))
const edges = registryRecipe(import.meta.url, 'edges')
const basename = value => value.slice(value.lastIndexOf('/') + 1)
export function install({ before = false } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL && basename(context.parentURL)
      if (['analyseFix.test.js', 'analyseFixReview.test.js'].includes(parent) && ['../dataEvidence.mjs', '../dataEnough.mjs'].includes(specifier)) return { url: new URL(flat ? basename(specifier) : specifier, root).href, shortCircuit: true }
      if (parent === 'AnalyseTab.jsx' && legacy.has(specifier)) return { url: new URL('analyseFixStubs.mjs', root).href, shortCircuit: true }
      if (Object.hasOwn(edges, parent || '')) {
        if (!edges[parent].includes(specifier)) throw Error('Forbidden import: ' + parent + ' -> ' + specifier)
        const url = specifier === 'react' ? new URL('analyseSamletDom.mjs', root) : flat ? new URL(basename(specifier), root) : new URL(specifier, context.parentURL)
        return { url: url.href, shortCircuit: true }
      }
      // Dependency-free leaves cannot acquire new imports silently.
      if (['exerciseNames.js', 'kostNumbers.mjs', 'analyseSamlet.mjs', 'analyseSamletDom.mjs', 'analyseSamletJsx.mjs'].includes(parent)) throw Error('Forbidden leaf import: ' + specifier)
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === new URL('AnalyseTab.jsx', root).href) {
        let source = readFileSync(new URL(url), 'utf8')
        if (before) {
          const fixed = 'liftEvidence(athleteLogs, label).rows.map(p => ({ y: p.e1rm, label: p.dag })) : ls.actualData'
          if (source.split(fixed).length !== 2) throw Error('Expected exactly one observed fix')
          source = source.replace(fixed, 'observed.map(p => ({ y: p.e1rm, label: p.dag })) : ls.actualData')
        }
        return { format: 'module', source: `import { h as __h } from './analyseSamletDom.mjs';\n${jsx(source)}`, shortCircuit: true }
      }
      if (['AnalyseSamletPrototype.jsx', 'AnalyseSammenlign.jsx'].some(name => url === new URL(name, root).href)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
