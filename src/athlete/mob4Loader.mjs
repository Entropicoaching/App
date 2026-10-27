import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './mob4Jsx.mjs'
const root = new URL('./', import.meta.url)
const files = ['MobiliseringTab.jsx', 'MobilitetFokus.jsx', 'MobilitetsBibliotek.jsx',
  'mobilityFocus.mjs', 'mobilityCatalog.mjs', 'mobilityLibrary.mjs', 'exerciseNames.js',
  'mobilityHelped.mjs', 'ProfilHoved.jsx']
export function moduleURL(name) {
  return [name, '../' + name, '../dashboard/' + name].map(path => new URL(path, root)).find(existsSync)
}
export function install(lineEnding) {
  const names = new Map(files.map(name => [moduleURL(name)?.href, name]))
  return registerHooks({
    resolve(specifier, context, next) {
      if (names.has(context.parentURL)) {
        if (specifier === 'react' || specifier === './mob4Dom.mjs') return { url: new URL('mob4Dom.mjs', root).href, shortCircuit: true }
        const base = specifier.split('/').at(-1)
        if (files.includes(base)) return { url: moduleURL(base).href, shortCircuit: true }
        if (['../athleteShared.js', './CountdownRing.jsx', '../coachRyd.mjs', '../supabase.js',
          '../dashboardShared.js', '../coachFremgang.js', './coachKonstanter.js', './hubSektioner.jsx'].includes(specifier))
          return { url: new URL('mob4Stubs.mjs', root).href, shortCircuit: true }
        throw Error('Forbidden synthetic import: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = names.get(url)
      if (!name) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (lineEnding) source = source.replace(/\r?\n/g, lineEnding)
      if (name.endsWith('.jsx')) source = `import { h as __h } from './mob4Dom.mjs';\n${jsx(source)}`
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
