import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { offJsx } from './coachInactiveOffJsx.mjs'
const base = new URL('./', import.meta.url)
const dom = new URL('./coachInactiveOffDom.mjs', base).href
const real = new Set(['CoachActions.jsx', 'coachActions.mjs', 'coachInactiveFilter.mjs', 'coachInactive.mjs', 'ForsideView.jsx'])
const stubs = {
  s: '{}', currentWeekNo: '() => null', initials: 'name => name.slice(0, 1)',
  beregnUgensAfvigelse: '() => ({harPlan:false})', ugensStemme: '() => null',
  dataEnoughEnabled: '() => false', roligLinje: '() => null', roligeAtleter: '() => []',
  coachInboxLine: '() => ""', selectOverviewWeek: '() => null', renderWeekOverview: '() => null',
  holidayInfo: '() => null', videoCoachMeasurementSummary: '() => null',
}
const blocked = name => `() => { throw Error(${JSON.stringify('Unexpected unrelated dependency: ' + name)}) }`
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(base.href) && real.has(new URL(context.parentURL).pathname.split('/').at(-1))) {
      if (specifier === dom) return { url: dom, shortCircuit: true }
      if (specifier === 'react') return { url: dom, shortCircuit: true }
      const target = new URL(specifier, context.parentURL)
      if (specifier.startsWith('.') && real.has(target.pathname.split('/').at(-1))) return { url: target.href, shortCircuit: true }
      // Every unrelated import becomes an inert, explicit named stub. Nothing
      // from Supabase, storage, other app components or JSX helpers is executed.
      const source = readFileSync(new URL(context.parentURL), 'utf8')
      const line = source.split(/\r?\n/).find(s => s.startsWith('import ') && s.includes(`from '${specifier}'`))
      if (!line) throw Error('Unapproved import ' + specifier)
      const named = line.match(/import \{([^}]+)\}/)?.[1]
      const code = named
        ? named.split(',').map(value => { const name = value.trim(); return `export const ${name} = ${stubs[name] || blocked(name)}` }).join('\n')
        : 'export default ' + blocked(specifier)
      return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === new URL('CoachActions.jsx', base).href) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    if (url === new URL('ForsideView.jsx', base).href) return {
      format: 'module', source: `import {createElement as __offH} from ${JSON.stringify(dom)};\n` + offJsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true,
    }
    return next(url, context)
  },
})
