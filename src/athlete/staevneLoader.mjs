import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './staevneJsx.mjs'
const root = new URL('./', import.meta.url)
const components = new Set(['StaevnedagTab.jsx', 'MeetDayPlanner.jsx'])
const modules = new Set(['staevnedagFocus.mjs', 'staevnedagPlan.mjs', 'inputValues.js', 'kostNumbers.mjs', 'athleteWriteGuard.js', 'calendarDate.js'])
const urls = new Map([...components, ...modules].map(name => {
  const flat = new URL(name, root)
  const native = ['inputValues.js', 'athleteWriteGuard.js', 'calendarDate.js'].includes(name) ? '../' + name : name
  return [name, (existsSync(flat) ? flat : new URL(native, root)).href]
}))
const localName = url => [...urls].find(([, value]) => value === url)?.[0]
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const linked = ['udgivelseTrin.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (!localName(context.parentURL)) return next(specifier, context)
      if (specifier === './staevneDom.mjs') return next(specifier, context)
      if (['react', '../supabase.js', '../athleteShared.js'].includes(specifier)) {
        return { url: new URL('./staevneDom.mjs', root).href, shortCircuit: true }
      }
      const base = specifier.split('/').at(-1)
      const name = base.includes('.') ? base : base + '.js'
      if (urls.has(name)) return { url: urls.get(name), shortCircuit: true }
      throw new Error(`Unapproved synthetic dependency ${specifier}`)
    },
    load(url, context, next) {
      if (!components.has(localName(url))) return next(url, context)
      return { format: 'module', source: `import { h as __h } from './staevneDom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
    },
  })
}
