import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './vaerd3Jsx.mjs'

// Exact allowlist: local reconstructed public modules or native integration paths.
const root = new URL('./', import.meta.url)
const components = new Set(['DinUgeKort.jsx', 'KostUge.jsx', 'MeetDayPlanner.jsx', 'StaevnedagTab.jsx'])
const modules = new Set(['dinUge.js', 'nextSet.js', 'rekorder.js', 'exerciseProgress.js', 'exerciseSetView.js', 'exerciseNames.js', 'inputValues.js', 'calendarDate.js', 'ugenoegle.js', 'athleteWriteGuard.js', 'kostUge.mjs', 'staevnedagPlan.mjs', 'staevnedagFocus.mjs', 'kostNumbers.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs'])
const athleteModules = new Set(['dinUge.js', 'rekorder.js', 'kostUge.mjs', 'staevnedagPlan.mjs', 'staevnedagFocus.mjs', 'kostNumbers.mjs'])
const urls = new Map([...components, ...modules].map(name => {
  const flat = new URL(name, root)
  const nativePath = name === 'ugenoegle.js' ? '../volume/ugenoegle.js' : athleteModules.has(name) || (components.has(name) || components.has(name.replace(/\.(?:jsx|js)$/, ''))) ? name : '../' + name
  return [name, (existsSync(flat) ? flat : new URL(nativePath, root)).href]
}))
const localName = url => [...urls].find(([, value]) => value === url)?.[0]
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const parent = localName(context.parentURL)
      if (components.has(parent) || modules.has(parent)) {
        if (specifier === './vaerd3Dom.mjs') return next(specifier, context)
        if (['react', '../athleteShared.js', '../supabase.js'].includes(specifier)) {
          return { url: new URL('./vaerd3Dom.mjs', root).href, shortCircuit: true }
        }
        const base = specifier.split('/').at(-1)
        const name = base.includes('.') ? base : base + '.js'
        if ((components.has(name) || components.has(name.replace(/\.(?:jsx|js)$/, ''))) || modules.has(name)) {
          return { url: urls.get(name), shortCircuit: true }
        }
        throw new Error(`Unapproved synthetic dependency ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (components.has(localName(url))) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: `import { h as __h } from './vaerd3Dom.mjs';\n${jsx(source)}`, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
