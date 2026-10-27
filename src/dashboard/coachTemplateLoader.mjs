import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './coachTemplateJsx.mjs'
const dom = new URL('./coachTemplateDom.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/ForsideView.jsx') && ['./coachWeekOverview.mjs', '../coachInboxState.js', '../coachRyd.mjs', '../dataEnough.mjs'].includes(specifier)) return next(specifier, context)
    if (specifier === 'react') return { url: dom, shortCircuit: true }
    if (context.parentURL?.endsWith('/ForsideView.jsx') && !['./CoachActions.jsx', './coachActions.mjs'].includes(specifier)) {
      const source = readFileSync(new URL(context.parentURL), 'utf8')
      const line = source.split(/\r?\n/).find(line => line.endsWith(`from '${specifier}'`))
      if (!line) return next(specifier, context)
      const names = line.match(/\{([^}]+)\}/)[1].split(',').map(n => n.trim())
      return { url: 'data:text/javascript,' + encodeURIComponent(names.map(n => n === 's' ? 'export const s = {}' : `export const ${n} = () => { throw Error('Unrelated helper ${n}') }`).join('\n')), shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('/ForsideView.jsx')) return { format: 'module', source: `import { createElement as __h } from '${dom}';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
    if (url.endsWith('/CoachActions.jsx') || url.endsWith('/CoachTemplateMessage.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    return next(url, context)
  },
})
