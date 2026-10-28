import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
const dom = new URL('./coachInactiveDom.mjs', import.meta.url).href
const fake = new URL('./coachInactiveFake.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: dom, shortCircuit: true }
    if (specifier === './CoachTemplateMessage.jsx') return { url: 'data:text/javascript,export default function Template(){throw Error("Unexpected message editor")}', shortCircuit: true }
    if (context.parentURL?.endsWith('/laesninger.js') && !['./coachInactive.mjs', './coachActions.mjs', './coachMorningSource.mjs'].includes(specifier)) {
      if (specifier === '../supabase.js') return { url: fake, shortCircuit: true }
      const source = readFileSync(new URL(context.parentURL), 'utf8')
      const line = source.split(/\r?\n/).filter(line => line.endsWith(`from '${specifier}'`)).join(',')
      if (!line) throw Error('Unmapped dependency ' + specifier)
      const names = [...line.matchAll(/\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(n => n.trim()))
      return { url: 'data:text/javascript,' + encodeURIComponent(names.map(n => n === 'danskDag' ? `export { activityDay as danskDag } from '${new URL('./coachInactive.mjs', import.meta.url).href}'` : `export const ${n} = () => { throw Error('Unrelated helper ${n}') }`).join('\n')), shortCircuit: true }
    }
    if (!specifier.startsWith('.') && !specifier.startsWith('node:') && !specifier.startsWith('data:') && !specifier.startsWith('file:')) throw Error('External import blocked: ' + specifier)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('/CoachActions.jsx') || url.endsWith('/laesninger.js')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    return next(url, context)
  },
})
