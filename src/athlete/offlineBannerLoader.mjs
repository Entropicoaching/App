// Test-only JSX adapter. Real React is the default; no dependency fallback.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './prog3Jsx.mjs'

export function installOfflineBannerLoader({ synthetic = false } = {}) {
  const component = new URL('./IngenForbindelse.jsx', import.meta.url).href
  return registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === component) {
        if (specifier === '../offlineSession')
          return { shortCircuit: true, url: new URL('../offlineSession.js', import.meta.url).href }
        if (synthetic && specifier === 'react')
          return { shortCircuit: true, url: new URL('./trainingFullscreenFake.mjs', import.meta.url).href }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url !== component) return next(url, context)
      return { format: 'module', shortCircuit: true, source:
        "import { createElement as __createElement } from 'react';\n" +
        'const __h = (type, props, _, ...children) => __createElement(type, props, ...children);\n' +
        jsx(readFileSync(new URL(url), 'utf8')) }
    },
  })
}
