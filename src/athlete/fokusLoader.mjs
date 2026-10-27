import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './fokusJsx.mjs'
const root = new URL('./', import.meta.url)
const names = ['fremgangFokus.mjs', 'fremgangFokusModel.mjs', 'FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'exerciseProgress.js', 'exerciseSetView.js', 'exerciseNames.js', 'inputValues.js', 'calendarDate.js', 'ugenoegle.js', 'kostNumbers.mjs', 'rekorder.js']
const urlFor = name => {
  const flat = new URL(name, root)
  if (existsSync(flat)) return flat
  return new URL(name === 'ugenoegle.js' ? '../volume/' + name : '../' + name, root)
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === '../BlokFremgang.jsx') return { url: new URL('../BlokFremgang.jsx', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/BlokFremgang.jsx') && specifier === './blokFremgang.mjs') return { url: new URL('../blokFremgang.mjs', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/BlokFremgang.jsx') && specifier === 'react') return { url: new URL('fokusDom.mjs', root).href, shortCircuit: true }
      const linked = ['dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
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
