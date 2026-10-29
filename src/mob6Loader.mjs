const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from './testModuleRegistry.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './mob6Jsx.mjs'
const root = new URL('./', import.meta.url)
const actual = new Set(registryRecipe(import.meta.url, 'actual'))
const moduleURL = name => [name, 'dashboard/' + name, 'athlete/' + name].map(path => new URL(path, root)).find(existsSync)
const urls = new Map([...actual].map(name => [moduleURL(name)?.href, name]))
const peripheral = new Set(registryRecipe(import.meta.url, 'peripheral'))
export function install({ baseline = false, lineEnding } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === './ProfilHoved.jsx' && ['mobilityHomework.test.js', '[eval1]'].some(name => context.parentURL === new URL(name, root).href)) return { url: moduleURL('ProfilHoved.jsx').href, shortCircuit: true }
      const parent = urls.get(context.parentURL)
      if (actual.has(parent)) {
        if (specifier === 'react' || specifier === './mob6Dom.mjs') return { url: new URL('mob6Dom.mjs', root).href, shortCircuit: true }
        if (['./athlete/mobilityCatalog.mjs', '../mobilityHomework.mjs', '../athlete/CoachMobility.jsx', './coachMobility.mjs', './mobilityFocus.mjs', './mobilityCatalog.mjs'].includes(specifier)) return { url: moduleURL(specifier.split('/').at(-1)).href, shortCircuit: true }
        if (parent === 'ProfilHoved.jsx' && peripheral.has(specifier)) return { url: new URL('mob6Stubs.mjs', root).href, shortCircuit: true }
        throw Error('Forbidden synthetic import: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = urls.get(url)
      if (!actual.has(name)) return next(url, context)
      const target = baseline && name === 'ProfilHoved.jsx' ? 'mob6BaselineProfile.txt' : name
      let source = readFileSync(baseline && name === 'ProfilHoved.jsx' ? new URL(target, root) : moduleURL(name), 'utf8')
      if (lineEnding) source = source.replace(/\r?\n/g, lineEnding)
      if (name.endsWith('.jsx')) source = `import { h as __h } from './mob6Dom.mjs';\n${jsx(source)}`
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
