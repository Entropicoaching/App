import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachMeetJsx.mjs'
const base = new URL('./', import.meta.url)
export const dashboardURL = new URL(existsSync(new URL('Dashboard.jsx', base)) ? 'Dashboard.jsx' : '../Dashboard.jsx', base)
const real = new Set(['Dashboard.jsx', 'ForsideView.jsx', 'ForsideBase.jsx', 'laesninger.js', 'coachMeetSource.mjs', 'coachMeetSoon.mjs', 'coachWeekOverview.mjs', 'calendarDate.js', 'navigation.js'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL?.split('/').at(-1)
      if (specifier === 'react' || /supabase\.js$/.test(specifier)) return { url: new URL('coachMeetFake.mjs', base).href, shortCircuit: true }
      if (real.has(parent) && specifier.startsWith('.')) {
        const name = specifier.split('/').at(-1)
        if (real.has(name)) return { url: (name === 'Dashboard.jsx' ? dashboardURL : new URL(name === 'calendarDate.js' && !existsSync(new URL(name, base)) ? '../calendarDate.js' : name, base)).href, shortCircuit: true }
        const source = readFileSync(new URL(context.parentURL), 'utf8')
        const clause = [...source.matchAll(/import\s+([^\n]+?)\s+from\s+['"]([^'"]+)['"]/g)].filter(m => m[2] === specifier).map(m => m[1]).join(',') || ''
        const names = [...clause.matchAll(/\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(n => n.trim()).filter(Boolean))
        const values = { logTegn: '() => ({})', s: '{}', dataEnoughEnabled: '() => false', coachActionsEnabled: '() => false', summarizeCoachMessages: '() => ({unreadCounts:{},unreadByTrack:{},latestByTrack:{}})', filterDraftVideoReviews: 'rows => (rows || []).filter(v => v.status === "draft")', danskDag: 'v => v?.slice(0,10)', currentWeekNo: 'weeks => weeks[0]?.week_number', beregnUgensAfvigelse: '() => ({})', ugensStemme: '() => ({})', coachInboxLine: '() => "status"' }
        const code = 'export default function Stub(){return null}\n' + names.map(n => `export const ${n} = ${values[n] || '() => null'};`).join('\n')
        return { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (real.has(url.split('/').at(-1)) && /\.(jsx|js)$/.test(url)) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: url.endsWith('.jsx') ? `import { __h } from '${new URL('coachMeetFake.mjs', base).href}';\n${jsx(source)}` : source, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
