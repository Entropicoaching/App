import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachPlanJsx.mjs'
const root = new URL('./', import.meta.url)
const names = ['ProgramTab.jsx', 'CoachPlanCopy.jsx', 'coachPlanCopy.mjs',
  'ProgramCopyOptions.jsx', 'programCopy.js', 'calendarDate.js', 'inputValues.js',
  'kostNumbers.mjs', 'udgivelseTrin.mjs', 'dataEnough.mjs', 'rpeEvidence.mjs', 'exerciseSetView.js', 'exerciseNames.js', 'weekDates.js']
const canonical = new Map(names.map(name => [name.toLowerCase(), name]))
const programImports = new Set(['./coachplancopy.mjs', './coachplancopy.jsx',
  './programcopyoptions.jsx', './programcopy.js', '../dataenough.mjs'])
// Whole filenames, including extensions, distinguish JSX from the pure module.
// The injected root/flat mode also allows platform independent FS probes.
export function createHooks(base = root, flat = existsSync(new URL('calendarDate.js', base))) {
  return {
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const parent = context.parentURL?.split('/').at(-1).toLowerCase()
      const folded = specifier.toLowerCase()
      if (specifier === './coachPlanDom.mjs' || specifier === new URL('coachPlanDom.mjs', base).href) return next(specifier, context)
      if (specifier === 'react' || specifier === '../supabase.js') return { url: new URL('coachPlanDom.mjs', base).href, shortCircuit: true }
      if (specifier === '../dataEnough.mjs') return { url: new URL('../dataEnough.mjs', base).href, shortCircuit: true }
      if (parent === 'programtab.jsx' || parent === 'input-365-362-programtab.jsx') {
        if (!programImports.has(folded)) return { url: new URL('coachPlanStubs.mjs', base).href, shortCircuit: true }
      }
      if (specifier === '../dashboardShared.js') return { url: new URL('coachPlanStubs.mjs', base).href, shortCircuit: true }
      if (specifier.startsWith('.')) {
        let name = canonical.get(folded.split('/').at(-1))
        if (name && (flat || programImports.has(folded))) return { url: new URL(name, base).href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = url.split('/').at(-1).toLowerCase()
      if (['coachplancopy.jsx', 'programtab.jsx', 'programcopyoptions.jsx', 'input-365-362-programtab.jsx'].includes(name)) {
        return { format: 'module', source: `import { h as __h } from '${new URL('coachPlanDom.mjs', base).href}';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      }
      return next(url, context)
    },
  }
}
export function install() { return registerHooks(createHooks()) }
