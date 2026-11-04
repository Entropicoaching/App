const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { assertRestMobilityEdge } from './restMobilityEdges.mjs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './hvileJsx.mjs'
const root = new URL('./', import.meta.url)
const paths = registryRecipe(import.meta.url, 'manifest:hvilePaths.json')
const urls = new Map(Object.entries(paths).map(([name, path]) => {
  const flat = new URL(name, root)
  return [name, (existsSync(flat) ? flat : new URL('../../' + path, root)).href]
}))
for (const name of ['RestDays.jsx', 'restDays.mjs']) urls.set(name, new URL(name, root).href)
const allowed = new Set(urls.values())
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // Admit only the two new program block dependencies; keep all other guards.
      if (context.parentURL === new URL('./programBlockOverview.mjs', import.meta.url).href
        && ['../entropi2/program/blok/blockOverviewModel.mjs', '../entropi2/flag.mjs'].includes(specifier))
        return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
      if (allowed.has(context.parentURL)) assertRestMobilityEdge(specifier, context.parentURL, root)
      if (!allowed.has(context.parentURL) || specifier === new URL('hvileDom.mjs', root).href) return next(specifier, context)
      if (specifier === 'react' || /\/supabase(?:\.js)?$/.test(specifier))
        return { url: new URL('hvileDom.mjs', root).href, shortCircuit: true }
      const base = specifier.split('/').at(-1)
      const name = urls.has(base) ? base : base + '.js'
      if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
      throw Error('Unapproved hermetic dependency: ' + specifier)
    },
    load(url, context, next) {
      if (allowed.has(url) && url.endsWith('.jsx')) return { format: 'module', shortCircuit: true,
        source: `import { h as __h } from '${new URL('hvileDom.mjs', root).href}';\n${jsx(readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
}
