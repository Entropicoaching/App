import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { jsx } from './contactJsx.mjs'

const fake = new URL('./contactFakes.mjs', import.meta.url).href
const fakes = new Set([
  '../athleteShared', '../supabase', '../athleteWriteGuard', '../athleteReadGuard',
  '../athleteSilentFailLog', '../videoCoachPersonalFeedback', '../videoCoachLabels',
  './videoCoachBro', './ugeHjaelp', './dinUge', './kostNumbers.mjs',
  '../messageTime.js', './videoFeedbackPlayback.mjs', './VideoFeedbackPlayback.jsx',
])
const targets = new Set(['BeskederTab.jsx', 'beskederOgVaegt.jsx', 'contactBaseBeskederTab.jsx', 'contactBaseFactory.jsx'])
const targetUrls = new Set([...targets].map(n => new URL(n, import.meta.url).href))
const clean = url => url?.split('?')[0]
registerHooks({
  resolve(specifier, context, next) {
    if (targetUrls.has(clean(context.parentURL)) && fakes.has(specifier)) return { url: fake, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (targetUrls.has(clean(url))) return {
      format: 'module', shortCircuit: true,
      source: `import { h as __h } from ${JSON.stringify(import.meta.url)};\n` + jsx(readFileSync(fileURLToPath(clean(url)), 'utf8').replace(/\r?\n/g, url.endsWith('?crlf') ? '\r\n' : '\n')),
    }
    return next(url, context)
  },
})
export function h(type, props, ignored, ...children) {
  const flat = children.flat(Infinity).filter(x => x != null && x !== false)
  return typeof type === 'function' ? type({ ...props, children: flat }) : { type, props, children: flat }
}
export function nodes(tree) {
  return tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : []
}
export function text(tree) {
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
}
export async function contactModules() {
  const [{ default: Contact }, { lavBeskederOgVaegt }] = await Promise.all([
    import('./BeskederTab.jsx'), import('./beskederOgVaegt.jsx'),
  ])
  return { Contact, lavBeskederOgVaegt }
}
