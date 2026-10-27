import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './fremgangJsx.mjs'
const root = new URL('./', import.meta.url)
const nested = { 'FremgangTab.jsx': 'athlete/FremgangTab.jsx', 'EnkelFremgangTab.jsx': 'athlete/EnkelFremgangTab.jsx',
  'OversigtTab.jsx': 'dashboard/OversigtTab.jsx', 'coachLaesninger.js': 'dashboard/laesninger.js',
  'coachFourWeeks.mjs': 'dashboard/coachFourWeeks.mjs', 'rekorder.js': 'athlete/rekorder.js', 'kostNumbers.mjs': 'athlete/kostNumbers.mjs', 'ugenoegle.js': 'volume/ugenoegle.js' }
export const sourceURL = name => {
  const flat = new URL(name, root)
  return existsSync(flat) ? flat : new URL(nested[name] || name, root)
}
const url = name => sourceURL(name).href
const views = ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'OversigtTab.jsx', 'BlokFremgang.jsx',
  'input-233-230-FremgangTab.jsx', 'input-230-227-EnkelFremgangTab.jsx', 'input-421-418-OversigtTab.jsx'].map(url)
const dependency = new Set(['exerciseProgress.js', 'exerciseNames.js', 'exerciseSetView.js', 'calendarDate.js', 'inputValues.js', 'kostNumbers.mjs', 'ugenoegle.js', 'rekorder.js', 'fremgangLogs.js', 'blokFremgang.mjs', 'coachFourWeeks.mjs'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(root.href) && !specifier.startsWith('node:')) {
        if (specifier.endsWith('/fremgangSynthetic.mjs')) return { url: url('fremgangSynthetic.mjs'), shortCircuit: true }
        if (specifier === 'react' || ['../athleteShared', '../dashboardShared', '../LazyBoundary'].includes(specifier)) return { url: url('fremgangSynthetic.mjs'), shortCircuit: true }
        const name = specifier.split('/').at(-1)
        const withExtension = /\.(mjs|jsx|js)$/.test(name) ? name : name + '.js'
        if (dependency.has(withExtension)) return { url: url(withExtension), shortCircuit: true }
        if (specifier === './coachLaesninger.js') return { url: url('coachLaesninger.js'), shortCircuit: true }
        if (context.parentURL === url('coachLaesninger.js')) return { url: url('fremgangSynthetic.mjs'), shortCircuit: true }
        if (views.includes(url(name))) return { url: url(name), shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(href, context, next) {
      if (views.includes(href)) return { format: 'module', source: `import { h as __h } from './fremgangSynthetic.mjs';\n${jsx(readFileSync(new URL(href), 'utf8'))}`, shortCircuit: true }
      if (href.startsWith(root.href) && href.endsWith('.js')) return { format: 'module', source: readFileSync(new URL(href), 'utf8'), shortCircuit: true }
      return next(href, context)
    },
  })
}
