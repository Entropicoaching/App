const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../src/testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
import { jsx } from './restMobilityJsx.mjs'
const root = new URL('../', import.meta.url)
const dom = new URL('./restMobilityDom.mjs', import.meta.url).href
const inventory = registryRecipe(import.meta.url, 'manifest:./restMobilityStubs.json')
const names = registryRecipe(import.meta.url, 'names')
const allowed = new Set(['src/', 'reference/src/'].flatMap(prefix => [
  ...names.map(name => new URL(prefix + 'athlete/' + name, root).href),
  ...['mobilityHomework.mjs', 'nextSet.js'].map(name => new URL(prefix + name, root).href),
]))
const stubUrl = spec => 'rest-stub:' + encodeURIComponent(spec)
export function install() {
  return registerHooks({
    resolve(spec, context, next) {
      if (!allowed.has(context.parentURL)) return next(spec, context)
      if (spec === dom || spec === 'react') return { url: dom, shortCircuit: true }
      const target = spec.startsWith('.') ? new URL(spec, context.parentURL).href : null
      if (allowed.has(target)) return { url: target, shortCircuit: true }
      if (Object.hasOwn(inventory, spec)) return { url: stubUrl(spec), shortCircuit: true }
      throw Error('Closed loader rejected: ' + spec)
    },
    load(url, context, next) {
      if (url.startsWith('rest-stub:')) {
        const spec = decodeURIComponent(url.slice(10))
        if (!Object.hasOwn(inventory, spec)) throw Error('Unknown stub')
        return { format: 'module', shortCircuit: true, source: `import { stub } from ${JSON.stringify(dom)}; export default () => null;` + inventory[spec].map(name => `export const ${name} = stub(${JSON.stringify(name)});`).join('\n') }
      }
      if (allowed.has(url)) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', shortCircuit: true, source: url.endsWith('.jsx') ? `import { h as __h } from ${JSON.stringify(dom)};\n${jsx(source)}` : source }
      }
      return next(url, context)
    },
  })
}
