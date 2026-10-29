const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks } from './testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
const view = new URL('./VideoRetentionPreview.mjs', import.meta.url).href
const model = new URL('./videoRetention.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === view) {
      if (specifier !== './videoRetention.mjs') throw Error('Forbidden view dependency')
      return { url: model, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === view || url === model) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    return next(url, context)
  },
})
