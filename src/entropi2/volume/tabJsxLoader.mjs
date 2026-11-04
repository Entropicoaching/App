// Test-only JSX compilation. React and ReactDOM remain the app dependencies.
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from '../../athlete/prog3Jsx.mjs'

const root = new URL('../../', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(root.href)) {
      const url = new URL(specifier, context.parentURL)
      if (!existsSync(url)) {
        for (const extension of ['.js', '.jsx']) {
          const candidate = new URL(url.href + extension)
          if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
        }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root.href) && url.endsWith('.jsx')) {
      return { format: 'module', shortCircuit: true, source:
        `import { createElement as __create, Fragment as __fragment } from 'react';
         const __h = (type, props, key, ...children) => __create(type ?? __fragment, props, ...children);
         ${jsx(readFileSync(new URL(url), 'utf8'))}` }
    }
    return next(url, context)
  },
})
