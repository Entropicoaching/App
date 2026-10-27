import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from '../coachNoteJsx.mjs'
export function h(type, props, ignored, ...children) {
  children = children.flat(Infinity).filter(x => x != null && x !== false)
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children }
}
export function createElement(type, props, ...children) { return h(type, props, null, ...children) }
export const Fragment = Symbol('Fragment')
export const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.children || []).flatMap(nodes)]
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
const self = import.meta.url
const root = new URL('../', self).href
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(root)) {
      if (specifier === 'react') return { url: self, shortCircuit: true }
      if (/^(\.\.\/|\.\/)supabase(?:\.js)?$/.test(specifier)) return { url: 'data:text/javascript,export const supabase = new Proxy({}, {get(){throw Error("Unexpected backend access")}}); export const withRetry = f => f()', shortCircuit: true }
      if (specifier === './AnalysePakkeReview') return { url: 'data:text/javascript,export default function AnalysePakkeReview(){return null}', shortCircuit: true }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        for (const ext of ['.js', '.jsx']) {
          const url = new URL(specifier + ext, context.parentURL)
          if (existsSync(url)) return { url: url.href, shortCircuit: true }
        }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.jsx')) return { format: 'module', source: `import { h as __h } from ${JSON.stringify(self)};\n` + jsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
    return next(url, context)
  },
})
