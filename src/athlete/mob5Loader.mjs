const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './mob4Jsx.mjs'
const root = new URL('./', import.meta.url)
const files = registryRecipe(import.meta.url, 'files')
const stubs = registryRecipe(import.meta.url, 'stubs')
export function moduleURL(name) {
  return [name, '../' + name, '../dashboard/' + name].map(path => new URL(path, root)).find(existsSync)
}
export function install(ending = '\n') {
  const names = new Map(files.map(name => [moduleURL(name)?.href, name]))
  return registerHooks({
    resolve(specifier, context, next) {
      if (names.has(context.parentURL)) {
        if (specifier === 'react' || specifier === './mob4Dom.mjs') return { url: new URL('mob4Dom.mjs', root).href, shortCircuit: true }
        const name = specifier.split('/').at(-1)
        if (files.includes(name)) return { url: moduleURL(name)?.href, shortCircuit: true }
        if (stubs.includes(specifier)) return { url: new URL('mob4Stubs.mjs', root).href, shortCircuit: true }
        throw Error('Forbidden synthetic import: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = names.get(url)
      if (!name) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8').replace(/\r?\n/g, ending)
      if (name.endsWith('.jsx')) source = `import { h as __h } from './mob4Dom.mjs';\n${jsx(source)}`
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
