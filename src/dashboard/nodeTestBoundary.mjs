// Test-only Node boundary: keep production imports intact and database access synthetic.
import { registerHooks } from 'node:module'
const database = new URL('../supabase.js', import.meta.url).href
const fake = new URL('./videoCoachNotes.appRev10.fake.mjs', import.meta.url).href
export function installNodeTestBoundary() {
  return registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL).href
      if (url === database || url + '.js' === database)
        return { url: fake, shortCircuit: true }
    }
    try { return next(specifier, context) } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier))
        return next(specifier + '.js', context)
      throw error
    }
  } })
}
