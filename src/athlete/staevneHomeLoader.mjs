import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './staevneHomeJsx.mjs'
const root = new URL('./', import.meta.url)
const homes = ['HjemTab.jsx', 'EnkelHjemTab.jsx']
const actual = ['staevneHome.mjs', 'calendarDate.js', 'kostNumbers.mjs', 'enkelPrototype.mjs']
const domURL = new URL('./staevneHomeDom.mjs', root).href
const domSource = readFileSync(new URL(domURL), 'utf8')
const sources = new Map()
for (const home of homes) {
  const source = readFileSync(new URL(home, root), 'utf8')
  for (const match of source.matchAll(/import\s+(.*?)\s+from\s+'([^']+)'/g)) {
    const [, binding, specifier] = match
    const name = specifier.split('/').at(-1)
    if (actual.includes(name)) continue
    const key = `staevne-home-stub:${specifier}`
    let stub = ''
    if (binding.startsWith('{')) {
      for (const item of binding.slice(1, -1).split(',').map(s => s.trim())) {
        if (new RegExp(`export (?:const|function) ${item}\\b`).test(domSource)) {
          stub += `export { ${item} } from ${JSON.stringify(domURL)};\n`
        } else stub += `export const ${item} = () => null;\n`
      }
    } else stub = 'export default () => null;'
    sources.set(key, [...new Set(((sources.get(key) || '') + '\n' + stub).split('\n'))].join('\n'))
  }
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === domURL) return next(specifier, context)
      const parent = context.parentURL?.split('/').at(-1)
      if ([...homes, ...actual].includes(parent)) {
        const name = specifier.split('/').at(-1)
        if (actual.includes(name)) {
          // Works both in the flat delivery and src/athlete after patch apply.
          const flat = new URL(name, root)
          const native = new URL(specifier, context.parentURL)
          return { url: (existsSync(flat) ? flat : native).href, shortCircuit: true }
        }
        if (specifier === domURL) return next(specifier, context)
        const key = `staevne-home-stub:${specifier}`
        if (homes.includes(parent) && sources.has(key)) return { url: key, shortCircuit: true }
        throw Error('Unapproved synthetic dependency: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (sources.has(url)) return { format: 'module', source: sources.get(url), shortCircuit: true }
      if (homes.some(name => new URL(name, root).href === url)) {
        return { format: 'module', source: `import { h as __h } from ${JSON.stringify(domURL)};\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
