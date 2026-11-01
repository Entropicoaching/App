const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './frem5Jsx.mjs'
const root = new URL('./', import.meta.url)
const paths = registryRecipe(import.meta.url, 'manifest:frem5Files.json')
for (const name of ['blokStyrke.mjs', 'blokStyrke.test.js', 'frem5App.test.js', 'frem5Review.test.js', 'frem5Fixture.mjs']) paths['src/athlete/' + name] = name
paths['src/App.jsx'] = 'App.jsx'
paths['src/AthleteView.jsx'] = 'AthleteView.jsx'
const urls = new Map(Object.entries(paths).map(([path, name]) => [name,
  existsSync(new URL(name, root)) ? new URL(name, root) : new URL('../../' + path, root)]))
export const fileURL = name => {
  if (!urls.has(name)) throw new Error('Unknown synthetic file: ' + name)
  return urls.get(name)
}
const known = url => [...urls.values()].some(value => value.href === url)
const dom = new URL('frem5Dom.mjs', root).href
let installed = false
export function install() {
  if (installed) return
  installed = true
  return registerHooks({
    resolve(specifier, context, next) {
      // APP-ANALYSE-ATLET1: exact entry edges and four real read-only dependencies.
      const analysis = new URL('./analyseAtlet1.mjs', root).href
      const release = new URL('../rel1101.mjs', root).href
      if (specifier === './analyseAtlet1.mjs' && ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs']
        .some(name => new URL(name, root).href === context.parentURL))
        return { url: analysis, shortCircuit: true }
      if (context.parentURL === analysis) {
        const dependencies = new Map(['rel1101.mjs', 'inputValues.js', 'calendarDate.js', 'exerciseProgress.js']
          .map(name => ['../' + name, new URL('../' + name, root).href]))
        if (dependencies.has(specifier)) return { url: dependencies.get(specifier), shortCircuit: true }
        throw new Error('Forbidden analysis dependency: ' + specifier)
      }
      if (context.parentURL === release) throw new Error('Forbidden release dependency: ' + specifier)
      if (!known(context.parentURL)) return next(specifier, context)
      if (specifier === 'react' || specifier === '../athleteShared.js' || specifier === dom)
        return { url: dom, shortCircuit: true }
      const name = specifier.split('/').at(-1)
      if (specifier.startsWith('.') && urls.has(name)) return { url: fileURL(name).href, shortCircuit: true }
      // Test files can load their local harness and Node builtins.
      if (context.parentURL.endsWith('.test.js') && (specifier.startsWith('node:') || /^\.\/frem5(?:Dom|Jsx|Loader)\.mjs$/.test(specifier))) return next(specifier, context)
      throw new Error('Forbidden hermetic dependency: ' + specifier)
    },
    load(url, context, next) {
      if (!known(url) || url.endsWith('.test.js')) return next(url, context)
      const source = readFileSync(new URL(url), 'utf8')
      return { format: 'module', source: url.endsWith('.jsx')
        ? `import { h as __h } from ${JSON.stringify(dom)};\n` + jsx(source) : source, shortCircuit: true }
    },
  })
}
