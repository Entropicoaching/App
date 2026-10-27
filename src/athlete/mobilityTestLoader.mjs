import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './mobilityJsx.mjs'
const root = new URL('./', import.meta.url)
const files = ['MobiliseringTab.jsx', 'MobilitetFokus.jsx', 'mobilityFocus.mjs', 'exerciseNames.js', 'MobilitetsBibliotek.jsx', 'mobilityLibrary.mjs']
const urls = new Map(files.map(name => [name, new URL(existsSync(new URL(name, root)) ? name : '../' + name, root).href]))
const nameOf = url => [...urls].find(([, value]) => value === url)?.[0]
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (nameOf(context.parentURL)) {
        if (['react', '../athleteShared', './CountdownRing', './mobilityDom.mjs'].includes(specifier)) return { url: new URL('./mobilityDom.mjs', root).href, shortCircuit: true }
        const basename = specifier.split('/').at(-1)
        const name = files.find(file => file === basename || file === basename + '.jsx' || file === basename + '.js')
        if (name) return { url: urls.get(name), shortCircuit: true }
        throw new Error(`Forbidden synthetic import: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = nameOf(url)
      if (name) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: name === 'MobiliseringTab.jsx' ? `import { h as __h } from './mobilityDom.mjs';\n${jsx(source)}` : source, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
