import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './coachRyd2Jsx.mjs'
const runtime = new URL('./programOverblikRuntime.mjs', import.meta.url).href
const root = new URL('../', import.meta.url)
const actual = new Set(['src/Dashboard.jsx', 'src/dashboard/Sidebar.jsx', 'src/dashboard/ProgramOverblikView.mjs', 'src/programOverblik.mjs', 'src/rel1030.mjs', 'src/coachRyd.mjs'])

// Stub only immediate, unrelated dependencies of the two full imported components.
// No backend module, storage implementation or application effect is executed.
export function programOverblikHarness() {
  const stubs = new Map()
  for (const path of ['src/Dashboard.jsx', 'src/dashboard/Sidebar.jsx']) {
    const source = readFileSync(new URL(path, root), 'utf8')
    for (const match of source.matchAll(/import\s+([^\n]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
      const [, binding, specifier] = match
      if (specifier === 'react') continue
      const target = new URL(specifier, new URL(path, root)).href
      if ([...actual].some(path => new URL(path, root).href === target)) continue
      const names = binding.includes('{') ? binding.split('{')[1].split('}')[0].split(',').map(x => x.trim()).filter(Boolean) : []
      const special = {
        s: 'r.styles', initials: '(name => name.slice(0, 2))', holidayInfo: '(() => null)',
        coachInboxEntryIntent: '(() => ({view:"list"}))',
        lavNavigation: '(() => new Proxy({openProfile:r.openProfile},{get:(o,k)=>o[k] || r.noOp}))',
        useCoachPrioritet: 'r.priority', calendarDay: '(() => "2026-10-29")',
      }
      let code = `import * as r from ${JSON.stringify(runtime)};\nexport default function Stub(){return null}\n`
      for (const name of names) {
        if (!/^\w+$/.test(name)) throw Error('Unsupported test binding ' + name)
        const value = special[name] || (/^(?:DEFAULT_|COACH_)/.test(name) ? 'false' : /^(?:lav|create|use)/.test(name) ? 'r.emptyFactory' : /(?:Enabled|Flag)$/.test(name) ? '(() => false)' : 'r.noOp')
        code += `export const ${name} = ${value};\n`
      }
      const prior = stubs.get(target)
      if (prior) {
        for (const line of code.split('\n').filter(line => line.startsWith('export const '))) {
          const name = line.split(' ')[2]
          if (!prior.includes(`export const ${name} =`)) stubs.set(target, (stubs.get(target) || prior) + line + '\n')
        }
      } else stubs.set(target, code)
    }
  }
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react') return { url: runtime, shortCircuit: true }
      if (context.parentURL?.startsWith(root.href) && specifier.startsWith('.')) {
        const target = new URL(specifier, context.parentURL).href
        if (stubs.has(target)) return { url: target, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (stubs.has(url)) return { format: 'module', source: stubs.get(url), shortCircuit: true }
      if (url.endsWith('.jsx') && actual.has(url.slice(root.href.length))) {
        return { format: 'module', source: `import {h as __h} from ${JSON.stringify(runtime)};\n` + jsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
