import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './frem5Jsx.mjs'
const root = new URL('./', import.meta.url)
const paths = JSON.parse(readFileSync(new URL('frem5Files.json', root), 'utf8'))
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
