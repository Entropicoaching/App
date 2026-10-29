const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../src/testModuleRegistry.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { jsx } from './rel3Jsx.mjs'

// Eksplicitte offentlige moduler. Ukendte imports fejler normalt.
const paths = registryRecipe(import.meta.url, 'paths')
const rootModules = registryRecipe(import.meta.url, 'rootModules')
for (const name of rootModules) paths[name] = name
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react') return { url: new URL('./rel3Dom.mjs', import.meta.url).href, shortCircuit: true }
      const name = basename(specifier)
      if (['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'athleteShared.js'].includes(name)) {
        return { url: new URL('./rel3Stubs.mjs', import.meta.url).href, shortCircuit: true }
      }
      if (specifier.startsWith('.') && paths[name]) {
        const flat = new URL(name, import.meta.url)
        const url = existsSync(flat) ? flat : new URL('../src/' + paths[name], import.meta.url)
        return { url: url.href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/MeetDayPlanner.jsx')) return { format: 'module', shortCircuit: true,
        source: "import { createElement as __create } from 'react'; const __h = (type, props, unused, ...children) => __create(type, props, ...children);\n" + jsx(readFileSync(new URL(url), 'utf8')) }
      // Denne faktiske komponent bruger createElement og indeholder ingen JSX.
      if (url.endsWith('/CoachTemplateMessage.jsx')) return next(url, { ...context, format: 'module' })
      return next(url, context)
    },
  })
}
