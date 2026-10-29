const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { existsSync as exactExists } from 'node:fs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './fokusJsx.mjs'
const root = new URL('./', import.meta.url)
const names = registryRecipe(import.meta.url, 'names')
const urlFor = name => {
  const flat = new URL(name, root)
  if (existsSync(flat)) return flat
  return new URL(name === 'ugenoegle.js' ? '../volume/' + name : '../' + name, root)
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // APP-FREM5: one exact new edge; no basename or wildcard permission.
      const strength = new URL('blokStyrke.mjs', root).href
      if (specifier === './blokStyrke.mjs' && ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs'].some(name => new URL(name, root).href === context.parentURL))
        return { url: strength, shortCircuit: true }
      if (context.parentURL === strength) {
        const dependency = { '../exerciseProgress.js': 'exerciseProgress.js', '../calendarDate.js': 'calendarDate.js', '../inputValues.js': 'inputValues.js' }[specifier]
        if (!dependency) throw new Error('Forbidden synthetic dependency: ' + specifier)
        return { url: urlFor(dependency).href, shortCircuit: true }
      }
      // APP-FREM6: exact component edge and its three read-only dependencies only.
      const repURL = new URL('./repRecords.mjs', root).href
      if (specifier === './repRecords.mjs' && ['FremgangTab.jsx', 'EnkelFremgangTab.jsx'].some(name => urlFor(name).href === context.parentURL))
        return { url: repURL, shortCircuit: true }
      if (context.parentURL === repURL) {
        const allowed = new Map(['exerciseSetView.js', 'inputValues.js', 'calendarDate.js']
          .map(name => ['../' + name, urlFor(name).href]))
        if (allowed.has(specifier)) return { url: allowed.get(specifier), shortCircuit: true }
        throw new Error('Forbidden synthetic dependency: ' + specifier)
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === '../BlokFremgang.jsx') return { url: new URL('../BlokFremgang.jsx', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/BlokFremgang.jsx') && specifier === './blokFremgang.mjs') return { url: new URL('../blokFremgang.mjs', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/BlokFremgang.jsx') && specifier === 'react') return { url: new URL('fokusDom.mjs', root).href, shortCircuit: true }
      const linked = ['udgivelseTrin.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (names.some(name => urlFor(name).href === context.parentURL)) {
        if (['react', '../athleteShared.js', './fokusDom.mjs'].includes(specifier)) return { url: new URL('fokusDom.mjs', root).href, shortCircuit: true }
        const name = specifier.split('/').at(-1)
        const found = names.find(n => n === name || n === name + '.js')
        if (!found) throw new Error('Forbidden synthetic dependency: ' + specifier)
        return { url: urlFor(found).href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/BlokFremgang.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      if (['FremgangTab.jsx', 'EnkelFremgangTab.jsx'].some(name => new URL(name, root).href === url)) {
        return { format: 'module', source: `import { h as __h } from './fokusDom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
