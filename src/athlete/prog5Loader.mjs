const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { assertRestMobilityEdge } from './restMobilityEdges.mjs'
import { withHvileBaseline } from './hvileBaseline.mjs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './prog5Jsx.mjs'
const root = new URL('./', import.meta.url)
const shared = new Set(registryRecipe(import.meta.url, 'shared'))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // Admit only the two new program block dependencies; keep all other guards.
      if (context.parentURL === new URL('./programBlockOverview.mjs', import.meta.url).href
        && ['../entropi2/program/blok/blockOverviewModel.mjs', '../entropi2/flag.mjs'].includes(specifier))
        return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
      if (context.parentURL?.startsWith(root.href) || context.parentURL === new URL('../mobilityHomework.mjs', root).href) assertRestMobilityEdge(specifier, context.parentURL, root)
      if (specifier === 'react' || /supabase(?:\.js)?$/.test(specifier)) return { url: new URL('prog5Dom.mjs', root).href, shortCircuit: true }
      if (specifier.startsWith('.') && context.parentURL?.startsWith(root.href)) {
        const name = specifier.split('/').at(-1)
        const flat = new URL(name, root)
        if (existsSync(flat)) return { url: flat.href, shortCircuit: true }
        if ((shared.has(name) && specifier === '../' + name) || specifier === '../volume/ugenoegle.js') {
          const native = new URL(specifier, context.parentURL)
          if (existsSync(native)) return { url: native.href, shortCircuit: true }
        }
        throw Error('Unapproved synthetic dependency: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('.jsx') && url.startsWith(root.href)) return { format: 'module', shortCircuit: true,
        source: `import { h as __h } from './prog5Dom.mjs';\n${jsx(url === new URL('prog5Baseline.jsx', root).href ? withHvileBaseline(readFileSync(new URL(url), 'utf8')) : readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
}
