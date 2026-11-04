// Hermetic scalar/array children checks; this fixture is not installed React.
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: new URL('./testReactShape.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier === '../../e2e/fixtures.mjs' && context.parentURL?.endsWith('/src/volume/beregn.test.js')) {
    return { url: new URL('./testSeed.mjs', import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
} })
