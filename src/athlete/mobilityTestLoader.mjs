import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './mobilityJsx.mjs'
const root = new URL('./', import.meta.url)
const files = ['CoachMobility.jsx', 'coachMobility.mjs', 'mobilityHelped.mjs', 'MobiliseringTab.jsx', 'MobilitetFokus.jsx', 'mobilityFocus.mjs', 'exerciseNames.js', 'MobilitetsBibliotek.jsx', 'mobilityLibrary.mjs', 'mobilityCatalog.mjs']
const urls = new Map(files.map(name => [name, new URL(existsSync(new URL(name, root)) ? name : '../' + name, root).href]))
const nameOf = url => [...urls].find(([, value]) => value === url)?.[0]
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (nameOf(context.parentURL)) {
        if (['react', '../athleteShared.js', './CountdownRing.jsx', './mobilityDom.mjs'].includes(specifier)) return { url: new URL('./mobilityDom.mjs', root).href, shortCircuit: true }
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
