import { registryHooks } from '../testModuleRegistry.mjs'
export function install() {
  return registryHooks(import.meta.url)({
    resolve(specifier, context, next) {
      if (specifier === 'react' && context.parentURL === new URL('../dashboard/analyseConclusion.mjs', import.meta.url).href)
        return { url: new URL('../registryDom.mjs', import.meta.url).href, shortCircuit: true }
      return next(specifier, context)
    },
  })
}
