// JSX syntax and an isolated service stub. React and ReactDOM resolve normally.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../athlete/prog3Jsx.mjs'

export function installProgramReactLoader() {
  const services = new Set(['../../../supabase', '../../../supabase.js']
    .map(path => new URL(path, import.meta.url).href))
  const allowed = new Set(['ProgramTab.jsx', 'RestDays.jsx', 'IntensityExplanation.jsx', 'CountdownRing.jsx']
    .map(name => new URL('../../../athlete/' + name, import.meta.url).href))
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        && services.has(new URL(specifier, context.parentURL).href)) {
        return { url: new URL('../../../athlete/prog3Dom.mjs', import.meta.url).href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!allowed.has(url)) return next(url, context)
      return { format: 'module', shortCircuit: true, source:
        "import { createElement as __createElement, Fragment as __Fragment } from 'react';\n" +
        'const __h = (type, props, _, ...children) => __createElement(type === null ? __Fragment : type, props, ...children);\n' +
        jsx(readFileSync(new URL(url), 'utf8')) }
    },
  })
}
