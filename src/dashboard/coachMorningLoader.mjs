import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachMorningJsx.mjs'
const base = new URL('./', import.meta.url)
export const dashboardURL = new URL(existsSync(new URL('Dashboard.jsx', base)) ? 'Dashboard.jsx' : '../Dashboard.jsx', base)
const real = new Set(['Dashboard.jsx', 'ForsideView.jsx', 'laesninger.js', 'coachMorning.mjs', 'coachMorningSource.mjs'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL?.split('/').at(-1)
      if (specifier === 'react' || /supabase\.js$/.test(specifier)) return { url: new URL('coachMorningFake.mjs', base).href, shortCircuit: true }
      if (real.has(parent) && specifier.startsWith('.')) {
        const name = specifier.split('/').at(-1)
        if (real.has(name)) return { url: (name === 'Dashboard.jsx' ? dashboardURL : new URL(name, base)).href, shortCircuit: true }
        const source = readFileSync(new URL(context.parentURL), 'utf8')
        const clause = [...source.matchAll(/import\s+([^\n]+?)\s+from\s+['"]([^'"]+)['"]/g)].filter(m => m[2] === specifier).map(m => m[1]).join(',') || ''
        const names = [...clause.matchAll(/\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(n => n.trim()).filter(Boolean))
        const values = { s: '{}', dataEnoughEnabled: '() => false', coachActionsEnabled: '() => false', summarizeCoachMessages: '() => ({unreadCounts:{},unreadByTrack:{},latestByTrack:{}})', filterDraftVideoReviews: 'rows => (rows || []).filter(v => v.status === "draft")', danskDag: 'v => v?.slice(0,10)', currentWeekNo: '() => null', beregnUgensAfvigelse: '() => ({})', ugensStemme: '() => ({})', coachInboxLine: '() => "status"' }
        const code = 'export default function Stub(){return null}\n' + names.map(n => `export const ${n} = ${values[n] || '() => null'};`).join('\n')
        return { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (real.has(url.split('/').at(-1)) && /\.(jsx|js)$/.test(url)) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: url.endsWith('.jsx') ? `import { __h } from '${new URL('coachMorningFake.mjs', base).href}';\n${jsx(source)}` : source, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
