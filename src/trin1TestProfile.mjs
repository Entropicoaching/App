// Test-only release selection. Import application modules dynamically after this call.
// Real source is evaluated; only the explicit numeric release step is substituted.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { after } from 'node:test'
const profileURL = new URL('./udgivelseTrin.mjs', import.meta.url).href
export function useTestRelease(trin) {
  if (trin !== 0 && trin !== 1) throw Error('Unknown synthetic release step')
  const hooks = registerHooks({
    load(url, context, next) {
      if (url !== profileURL) return next(url, context)
      const source = readFileSync(new URL(url), 'utf8').replace(/\r\n/g, '\n')
      const declaration = /^export const UDGIVELSE_TRIN = [01]$/gm
      if ([...source.matchAll(declaration)].length !== 1) throw Error('Expected one supported release declaration')
      return { format: 'module', source: source.replace(declaration, `export const UDGIVELSE_TRIN = ${trin}`), shortCircuit: true }
    },
  })
  after(() => hooks.deregister())
  return hooks
}
