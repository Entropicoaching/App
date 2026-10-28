import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './kost2Jsx.mjs'
import { athleteViewUrl } from './kost2Paths.mjs'
const root = new URL('./', import.meta.url)
const real = new Set(['AthleteView.jsx', 'BundNav.jsx', 'NavItems.jsx', 'enkelPrototype.mjs', 'kostValg.mjs', 'readinessShortcut.mjs'])
const files = new Map([...real].map(n => [new URL(n, root).href, n]))
files.delete(new URL('AthleteView.jsx', root).href)
files.set(athleteViewUrl.href, 'AthleteView.jsx')

const addedPaths = {"CoachMobility.jsx": "./CoachMobility.jsx", "coachMobility.mjs": "./coachMobility.mjs", "mobilityFocus.mjs": "./mobilityFocus.mjs", "mobilityCatalog.mjs": "./mobilityCatalog.mjs", "mobilityHomework.mjs": "../mobilityHomework.mjs"}
const addedEdges = {"CoachMobility.jsx": ["./mobilityFocus.mjs", "./mobilityCatalog.mjs", "./coachMobility.mjs"], "coachMobility.mjs": ["./mobilityFocus.mjs"], "mobilityFocus.mjs": [], "mobilityCatalog.mjs": [], "mobilityHomework.mjs": ["./athlete/mobilityCatalog.mjs"]}
const addedURLs = new Map(Object.entries(addedPaths).map(([name,path])=>[new URL(path,root).href,name]))
const fake = new URL('kost2Dom.mjs', root).href
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const addedName=addedURLs.get(context.parentURL)
      if (context.parentURL===athleteViewUrl.href && (specifier==='./athlete/CoachMobility.jsx' || specifier==='./mobilityHomework.mjs' && addedPaths['mobilityHomework.mjs']))
        return {url:new URL(addedPaths[specifier.split('/').at(-1)],root).href,shortCircuit:true}
      if (addedName) {
        if (specifier==='react') return {url:fake,shortCircuit:true}
        if (!addedEdges[addedName].includes(specifier)) throw Error('Closed mobility import: '+specifier)
        return {url:new URL(addedPaths[specifier.split('/').at(-1)],root).href,shortCircuit:true}
      }
      // Rebase APP-NYT1: execute the actual card, gate and navigation factory.
      const nyt = new URL('../nytIAppen.mjs', root).href
      if (context.parentURL === athleteViewUrl.href && specifier === './nytIAppen.mjs')
        return { url: nyt, shortCircuit: true }
      if (context.parentURL === nyt && specifier === 'react') return { url: fake, shortCircuit: true }
      if (files.has(context.parentURL)) {
        if (specifier === './kost2Dom.mjs') return { url: fake, shortCircuit: true }
        const base = specifier.split('/').at(-1)
        const name = real.has(base) ? base : real.has(base + '.jsx') ? base + '.jsx' : null
        if (name) return { url: new URL(name, root).href, shortCircuit: true }
        if (specifier === 'react' || specifier === './athleteShared') return { url: fake, shortCircuit: true }
        return { url: 'kost2stub:' + encodeURIComponent(specifier), shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.startsWith('kost2stub:')) {
        const specifier = decodeURIComponent(url.slice(10))
        const source = readFileSync(athleteViewUrl, 'utf8')
        const imports = [...source.matchAll(/import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g)]
        const clause = imports.find(m => m[2] === specifier)?.[1]
        if (!clause) throw Error('Unapproved stub: ' + specifier)
        const named = clause.startsWith('{') ? clause.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean) : []
        const values = { loadParkedSets: 'empty', grundlagFoer: 'empty', loadRekordIndeks: 'empty', tomtIndeks: 'empty', udenForslagVedSmerte: 'noop' }
        const exports = named.map(n => `export const ${n} = ${n.startsWith('lav') ? 'factory' : values[n] || 'noop'};`).join('\n')
        return { format: 'module', source: `import { stub, factory, empty, noop } from ${JSON.stringify(fake)};\n${exports}\nexport default stub(${JSON.stringify(specifier.split('/').at(-1).replace(/\.(?:jsx|js)$/, ''))});`, shortCircuit: true }
      }
      if (addedURLs.has(url)) return {format:'module',source:readFileSync(new URL(url),'utf8'),shortCircuit:true}
      if (files.get(url)?.endsWith('.jsx')) return { format: 'module', source: `import { h as __h } from './kost2Dom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      return next(url, context)
    },
  })
}
