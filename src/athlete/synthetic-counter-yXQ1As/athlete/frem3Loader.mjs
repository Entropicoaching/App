import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './frem3Jsx.mjs'

const root = new URL('./', import.meta.url)
const components = new Set(['FremgangTab.jsx', 'EnkelFremgangTab.jsx'])
const athlete = new Set(['rekorder.js', 'kostNumbers.mjs', 'fremgangPersonalRecords.mjs'])
const names = [...components, ...athlete, 'exerciseProgress.js', 'exerciseSetView.js', 'exerciseNames.js',
  'inputValues.js', 'calendarDate.js', 'ugenoegle.js']
const urls = new Map(names.map(name => [name, (existsSync(new URL(name, root)) ? new URL(name, root) :
  new URL(name === 'ugenoegle.js' ? '../volume/' + name : athlete.has(name) || (components.has(name) || components.has(name.replace(/\.(?:jsx|js)$/, ''))) ? name : '../' + name, root)).href]))
const known = url => [...urls.values()].includes(url)
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // APP-FREM6: exact component edge and its three read-only dependencies only.
      const repURL = new URL('./repRecords.mjs', root).href
      if (specifier === './repRecords.mjs' && [...components].some(name => urls.get(name) === context.parentURL))
        return { url: repURL, shortCircuit: true }
      if (context.parentURL === repURL) {
        const allowed = new Map(['exerciseSetView.js', 'inputValues.js', 'calendarDate.js']
          .map(name => ['../' + name, urls.get(name)]))
        if (allowed.has(specifier)) return { url: allowed.get(specifier), shortCircuit: true }
        throw new Error('Forbidden synthetic dependency: ' + specifier)
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === '../BlokFremgang.jsx') return { url: new URL('../BlokFremgang.jsx', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/BlokFremgang.jsx') && specifier === 'react') return { url: new URL('frem3Dom.mjs', root).href, shortCircuit: true }
      const linked = ['dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (known(context.parentURL)) {
        if (specifier === 'react' || specifier === '../athleteShared.js')
          return { url: new URL('frem3Dom.mjs', root).href, shortCircuit: true }
        let name = specifier.split('/').at(-1)
        if (!name.includes('.')) name += '.js'
        if (urls.has(name)) return { url: urls.get(name), shortCircuit: true }
        if (specifier === './frem3Dom.mjs') return next(specifier, context)
        throw new Error('Forbidden synthetic dependency: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/BlokFremgang.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      if ([...components].some(name => urls.get(name) === url))
        return { format: 'module', source: "import { h as __h } from './frem3Dom.mjs';\n" + jsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
      return next(url, context)
    },
  })
}
