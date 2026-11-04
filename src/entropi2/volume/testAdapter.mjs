// Hermetic test boundary only: no installed React and no supplied e2e seed.
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: new URL('./testReact.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier === '../../e2e/fixtures.mjs' && context.parentURL?.endsWith('/src/volume/beregn.test.js')) {
    return { url: new URL('./testSeed.mjs', import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
} })
