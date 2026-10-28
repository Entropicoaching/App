import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './vaerd5Jsx.mjs'

const root = new URL('./', import.meta.url)
const names = ['IntensityExplanation.jsx', 'intensityExplanation.mjs', 'programBlockOverview.mjs', 'ugeHjaelp.js', 'ProgramTab.jsx', 'inputValues.js', 'restTimer.js', 'repsPrescription.js',
  'fixedRepsEntry.js', 'exerciseSetView.js', 'exerciseNames.js', 'warmupOverride.js', 'kostNumbers.mjs',
  'vaerd5Fixture.mjs', 'rpeEvidence.mjs', 'dataEnough.mjs', 'calendarDate.js']
const urls = new Map(names.map(name => [name, (existsSync(new URL(name, root))
  ? new URL(name, root) : new URL('../' + name, root)).href]))
const approved = new Set(urls.values())
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (!approved.has(context.parentURL)) return next(specifier, context)
      if (context.parentURL === urls.get('ugeHjaelp.js') && ['../supabase', '../supabase.js'].includes(specifier))
        return { url: 'data:text/javascript,export const supabase = new Proxy({}, {get(){throw Error("Backend outside synthetic scope")}})', shortCircuit: true }
      if (['react', '../athleteShared.js', './CountdownRing.jsx', '../saetSmerte.js'].includes(specifier)) {
        return { url: new URL('./vaerd5Stubs.mjs', root).href, shortCircuit: true }
      }
      if (specifier === './vaerd5Dom.mjs') return next(specifier, context)
      const base = specifier.split('/').at(-1)
      const name = base.includes('.') ? base : base + '.js'
      if (!urls.has(name)) throw new Error('Unapproved synthetic dependency: ' + specifier)
      return { url: urls.get(name), shortCircuit: true }
    },
    load(url, context, next) {
      if (!approved.has(url)) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (url === urls.get('ProgramTab.jsx') || url === urls.get('IntensityExplanation.jsx')) {
        source = "import { h as __h } from './vaerd5Dom.mjs';\n" + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
