import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../coachRyd2Jsx.mjs'
const root = new URL('./', import.meta.url)
const runtime = new URL('./painCoachTestRuntime.mjs', root).href
const tab = new URL('../../../dashboard/OversigtTab.jsx', root).href
const coach = new URL('./CoachPainHistory.mjs', root).href
const history = new URL('./PainHistory.mjs', root).href
const replacements = {
  '../BlokFremgang.jsx': 'BlokFremgang', '../LazyBoundary.jsx': 'LazyBoundary',
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' && [coach, history].includes(context.parentURL)) return { url: runtime, shortCircuit: true }
      if (context.parentURL === tab) {
        if (Object.hasOwn(replacements, specifier)) return { shortCircuit: true,
          url: 'data:text/javascript,' + encodeURIComponent(`export { ${replacements[specifier]} as default } from '${runtime}'`) }
        if (['../dashboardShared.js', '../dataEnough.mjs', '../entropi2/flag.mjs'].includes(specifier)) return { url: runtime, shortCircuit: true }
      }
      if (specifier.startsWith('.') && new URL(specifier, context.parentURL).href === new URL('../../../supabase.js', root).href)
        throw Error('Real client import forbidden in synthetic pain tests')
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === tab) return { format: 'module', shortCircuit: true,
        source: `import { createElement as __h } from '${runtime}';\n${jsx(readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
}
