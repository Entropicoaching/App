const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { existsSync, readFileSync } from 'node:fs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { jsx } from './mob3Jsx.mjs'
const root = new URL('./', import.meta.url)
const actual = new Set(registryRecipe(import.meta.url, 'actual'))
const peripheral = new Set(registryRecipe(import.meta.url, 'peripheral'))
export function moduleURL(name) {
  return ['./' + name, '../' + name, '../volume/' + name].map(path => new URL(path, root)).find(url => existsSync(url))
}
const urls = new Map([...actual].map(name => [moduleURL(name)?.href, name]))
const nameOf = url => urls.get(url)
let configuredLineEndings
export function setLineEndings(value) { configuredLineEndings = value }
export function install({ lineEndings = configuredLineEndings } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      if (actual.has(nameOf(context.parentURL))) {
        if (specifier === 'react' || specifier === 'react-dom' || specifier === './mob3Dom.mjs') return { url: new URL('mob3Dom.mjs', root).href, shortCircuit: true }
        const basename = specifier.split('/').at(-1)
        const file = [basename, basename + '.js', basename + '.jsx', basename + '.mjs'].find(name => actual.has(name))
        if (file) return { url: moduleURL(file).href, shortCircuit: true }
        if ((peripheral.has(basename) || peripheral.has(basename.replace(/\.(?:jsx|js)$/, '')))) return { url: new URL('mob3Stubs.mjs', root).href, shortCircuit: true }
        throw Error(`Forbidden synthetic import: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = nameOf(url)
      if (!actual.has(name)) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (lineEndings) source = source.replace(/\r?\n/g, lineEndings)
      if (name.endsWith('.jsx')) {
        try { source = `import { h as __h } from './mob3Dom.mjs';\n${jsx(source)}` }
        catch (error) { throw Error(`${name}: ${error.message}`, { cause: error }) }
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
