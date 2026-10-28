import { withHvileBaseline } from './hvileBaseline.mjs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './prog5Jsx.mjs'
const root = new URL('./', import.meta.url)
const shared = new Set(['inputValues.js', 'restTimer.js', 'repsPrescription.js', 'fixedRepsEntry.js', 'exerciseSetView.js', 'exerciseNames.js', 'athleteShared.js', 'saetSmerte.js', 'calendarDate.js', 'coachFremgang.js', 'exerciseProgress.js', 'coachBriefingRules.js', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' || /supabase(?:\.js)?$/.test(specifier)) return { url: new URL('prog5Dom.mjs', root).href, shortCircuit: true }
      if (specifier.startsWith('.') && context.parentURL?.startsWith(root.href)) {
        const name = specifier.split('/').at(-1)
        const flat = new URL(name, root)
        if (existsSync(flat)) return { url: flat.href, shortCircuit: true }
        if ((shared.has(name) && specifier === '../' + name) || specifier === '../volume/ugenoegle.js') {
          const native = new URL(specifier, context.parentURL)
          if (existsSync(native)) return { url: native.href, shortCircuit: true }
        }
        throw Error('Unapproved synthetic dependency: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('.jsx') && url.startsWith(root.href)) return { format: 'module', shortCircuit: true,
        source: `import { h as __h } from './prog5Dom.mjs';\n${jsx(url === new URL('prog5Baseline.jsx', root).href ? withHvileBaseline(readFileSync(new URL(url), 'utf8')) : readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
}
