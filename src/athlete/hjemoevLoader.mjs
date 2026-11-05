import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './hjemoevJsx.mjs'
const root = new URL('./', import.meta.url)
const runtime = new URL('hjemoevDom.mjs', root).href
const files = ['hjemoevKompakt.mjs', '../mobilityHomework.mjs', 'mobilityCatalog.mjs', '../rel1030.mjs', 'HjemTab.jsx', 'MobiliseringTab.jsx', 'hjemoevBaseHjemTab.txt', '../mobilityAdherence.mjs', '../mobilityHelped.mjs', 'enkelPrototype.mjs',
  '../entropi2/conversation/conversationModel.mjs', '../indbakke2.mjs']
const allowed = new Set(files.map(n => new URL(n, root).href))
const stubs = JSON.parse(readFileSync(new URL('hjemoevStubs.json', root), 'utf8'))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '../entropi2/antalOrd.mjs' && ['HjemTab.jsx', 'MobiliseringTab.jsx']
        .some(name => context.parentURL === new URL(name, root).href))
        return { url: new URL('../entropi2/antalOrd.mjs', root).href, shortCircuit: true }
      if (!allowed.has(context.parentURL)) return next(specifier, context)
      if (specifier === 'react' || specifier === runtime) return { url: runtime, shortCircuit: true }
      const target = new URL(specifier, context.parentURL).href
      if (allowed.has(target)) return { url: target, shortCircuit: true }
      if (Object.hasOwn(stubs, specifier)) return { url: 'synthetic-homework:' + encodeURIComponent(specifier), shortCircuit: true }
      throw Error('Forbidden synthetic dependency: ' + specifier)
    },
    load(url, context, next) {
      if (url.startsWith('synthetic-homework:')) return { format: 'module', source: stubs[decodeURIComponent(url.slice('synthetic-homework:'.length))], shortCircuit: true }
      if (!allowed.has(url)) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (url.endsWith('.jsx') || url.endsWith('.txt')) source = `import { createElement as __create } from ${JSON.stringify(runtime)}; const __h=(t,p,_,...c)=>__create(t,p,...c);\n` + jsx(source)
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
