const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { assertRestMobilityEdge } from './restMobilityEdges.mjs'
import { existsSync as exactExists } from 'node:fs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './forenkl6Jsx.mjs'
const root = new URL('./', import.meta.url)
const components = new Set(registryRecipe(import.meta.url, 'components'))
const paths = registryRecipe(import.meta.url, 'paths')
const urls = new Map([...components].map(n => [n, new URL(n, root).href]))
for (const [name, native] of Object.entries(paths)) {
  const flat = new URL(name, root)
  urls.set(name, (existsSync(flat) ? flat : new URL(native, root)).href)
}
const approved = new Set(urls.values())
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // Admit only the two new program block dependencies; keep all other guards.
      if (context.parentURL === new URL('./programBlockOverview.mjs', import.meta.url).href
        && ['../entropi2/program/blok/blockOverviewModel.mjs', '../entropi2/flag.mjs'].includes(specifier))
        return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
      if (approved.has(context.parentURL)) assertRestMobilityEdge(specifier, context.parentURL, root)
      if (approved.has(context.parentURL) && ['RestDays', 'RestDays.jsx', 'restDays', 'restDays.mjs'].includes(specifier.split('/').at(-1)) && !['./RestDays.jsx', './restDays.mjs'].includes(specifier))
        throw Error('Unapproved synthetic dependency: ' + specifier)
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const linked = ['udgivelseTrin.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (approved.has(context.parentURL)) {
        if (specifier === 'react' || specifier === '../supabase.js') return { url: new URL('forenkl6Dom.mjs', root).href, shortCircuit: true }
        if (specifier === './forenkl6Dom.mjs') return next(specifier, context)
        const base = specifier.split('/').at(-1)
        const name = base.includes('.') ? base : components.has(base + '.jsx') ? base + '.jsx' : base + '.js'
        if (['RestDays.jsx', 'restDays.mjs'].includes(name) && specifier !== './' + name) throw Error('Unapproved synthetic dependency: ' + specifier)
        if (urls.has(name)) return { url: urls.get(name), shortCircuit: true }
        throw Error(`Unapproved synthetic dependency: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([...components].some(n => urls.get(n) === url)) return {
        format: 'module', shortCircuit: true,
        source: `import { h as __h } from './forenkl6Dom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`,
      }
      return next(url, context)
    },
  })
}
