import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './repRecordsJsx.mjs'

// Resolve only the pinned, reconstructed module graph. No packages or backend.
const root = new URL('./', import.meta.url)
const components = ['FremgangTab.jsx', 'EnkelFremgangTab.jsx']
const athlete = ['repRecords.mjs', 'fremgangPersonalRecords.mjs', 'fremgangLinjer.mjs', 'rekorder.js', 'kostNumbers.mjs']
const shared = ['exerciseProgress.js', 'exerciseSetView.js', 'exerciseNames.js', 'inputValues.js',
  'calendarDate.js', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'ugenoegle.js']
const urls = new Map([...components, ...athlete, ...shared].map(name => [name,
  new URL(existsSync(new URL(name, root)) ? name : name === 'ugenoegle.js' ? '../volume/' + name : '../' + name, root).href]))
const dom = new URL('./repRecordsDom.mjs', root).href
const stub = new URL('./repRecordsStubs.mjs', root).href
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      // APP-FREM5: exact component edge; preserve the existing records graph.
      const strength = new URL('./blokStyrke.mjs', root).href
      if (specifier === './blokStyrke.mjs' && components.some(name => urls.get(name) === context.parentURL))
        return { url: strength, shortCircuit: true }
      if (context.parentURL === strength) {
        const allowed = new Map(['exerciseProgress.js', 'calendarDate.js', 'inputValues.js']
          .map(name => ['../' + name, urls.get(name)]))
        if (allowed.has(specifier)) return { url: allowed.get(specifier), shortCircuit: true }
        throw new Error('Forbidden synthetic dependency: ' + specifier)
      }
      if ([...urls.values()].includes(context.parentURL)) {
        if (specifier === dom) return { url: dom, shortCircuit: true }
        if (specifier === 'react' || specifier === '../athleteShared.js') return { url: dom, shortCircuit: true }
        if (specifier === '../BlokFremgang.jsx') return { url: stub, shortCircuit: true }
        const name = specifier.split('/').at(-1)
        if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
        throw new Error('Forbidden synthetic dependency: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (components.some(name => urls.get(name) === url)) return { format: 'module',
        source: `import { h as __h } from ${JSON.stringify(dom)};\n` + jsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
      return next(url, context)
    },
  })
}
