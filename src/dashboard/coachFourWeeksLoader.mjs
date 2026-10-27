import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './coachFourWeeksJsx.mjs'
const base = new URL('./', import.meta.url)
const flat = existsSync(new URL('Dashboard.jsx', base))
const targets = {
  'coachKonstanter.js': './coachKonstanter.js',
  'Dashboard.jsx': '../Dashboard.jsx', 'laesninger.js': './laesninger.js',
  'useDashboardEffekter.js': './useDashboardEffekter.js', 'CoachFourWeeks.jsx': './CoachFourWeeks.jsx',
  'coachFourWeeks.mjs': './coachFourWeeks.mjs', 'calendarDate.js': '../calendarDate.js',
  'kostNumbers.mjs': '../athlete/kostNumbers.mjs',
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' || /supabase(?:\.js)?$/.test(specifier)) return { url: new URL('coachFourWeeksFake.mjs', base).href, shortCircuit: true }
      const parent = context.parentURL?.split('/').at(-1)
      if (Object.hasOwn(targets, parent) && specifier.startsWith('.')) {
        let name = specifier.split('/').at(-1)
        if (name === 'coachKonstanter') name = 'coachKonstanter.js'
        if (Object.hasOwn(targets, name)) return { url: new URL(flat ? name : targets[name], base).href, shortCircuit: true }
        // External app modules are inert doubles. Derive only their export names;
        // no source outside the candidate is resolved, evaluated or requested.
        const source = readFileSync(new URL(context.parentURL), 'utf8')
        const imports = [...source.matchAll(/import\s+([^\n]+?)\s+from\s+['"]([^'"]+)['"]/g)]
        const clause = imports.find(m => m[2] === specifier)?.[1] || ''
        const names = clause.match(/\{([^}]+)\}/)?.[1].split(',').map(n => n.trim()).filter(Boolean) || []
        const exports = names.map(n => `export const ${n} = (...args) => ({});`).join('\n')
        const special = "export default function Stub(){ return null }"
        return { url: `data:text/javascript,${encodeURIComponent(special + '\n' + exports)}`, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/CoachFourWeeks.jsx') || url.endsWith('/Dashboard.jsx')) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: url.endsWith('/Dashboard.jsx')
          ? `import { h as __h } from '${new URL('coachFourWeeksDom.mjs', base).href}';\n${jsx(source)}` : source, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
