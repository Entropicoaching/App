import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachPlanJsx.mjs'
const root = new URL('./', import.meta.url)
const flat = existsSync(new URL('calendarDate.js', root))
const component = new URL(flat ? 'CoachPlanCopy.jsx' : './CoachPlanCopy.jsx', root)
const program = new URL('ProgramTab.jsx', root)
const native = new Set(['coachPlanCopy.mjs', 'CoachPlanCopy.jsx', 'calendarDate.js', 'inputValues.js', 'kostNumbers.mjs'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL?.split('/').at(-1)
      if (specifier === './coachPlanDom.mjs') return next(specifier, context)
      if (specifier === 'react' || specifier === '../supabase') return { url: new URL('coachPlanDom.mjs', root).href, shortCircuit: true }
      if (parent === 'ProgramTab.jsx' || parent === 'input-365-362-ProgramTab.jsx') {
        if (!['./coachPlanCopy.mjs', './CoachPlanCopy.jsx'].includes(specifier)) return { url: new URL('coachPlanStubs.mjs', root).href, shortCircuit: true }
      }
      if (specifier === '../dashboardShared') return { url: new URL('coachPlanStubs.mjs', root).href, shortCircuit: true }
      if (flat && native.has(parent) && specifier.startsWith('.')) {
        const name = specifier.split('/').at(-1)
        if (!native.has(name)) throw new Error('Unapproved local dependency: ' + specifier)
        return { url: new URL(name, root).href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([component.href, program.href].includes(url) || url.endsWith('/input-365-362-ProgramTab.jsx')) {
        return { format: 'module', source: `import { h as __h } from './coachPlanDom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
