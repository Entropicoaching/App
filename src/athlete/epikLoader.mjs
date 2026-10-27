import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './epikJsx.mjs'
const root = new URL('./', import.meta.url)
const card = new URL('beskederOgVaegt.jsx', root).href
const wrapper = new URL('VideoFeedbackPlayback.jsx', root).href
const model = new URL('videoFeedbackPlayback.mjs', root).href
const stub = new URL('epikDom.mjs', root).href
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if ([card, wrapper].includes(context.parentURL)) {
        if (specifier === './videoFeedbackFollowUp.mjs') return { url: new URL('videoFeedbackFollowUp.mjs', root).href, shortCircuit: true }
        if (specifier === './VideoFeedbackPlayback.jsx') return { url: wrapper, shortCircuit: true }
        if (specifier === './videoFeedbackPlayback.mjs') return { url: model, shortCircuit: true }
        return { url: stub, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === card) return { format: 'module', source: `import { h as __h } from './epikDom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      if (url === wrapper) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
