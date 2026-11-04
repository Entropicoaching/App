import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/saetSkrivning.js') &&
      ['../supabase.js', '../athleteSilentFailLog.js', './ugeHjaelp.js'].includes(specifier))
      return { url: new URL('./sessionSaveBoundary.mjs', import.meta.url).href, shortCircuit: true }
    if (specifier.startsWith('.') && !/\.(?:js|mjs|jsx)$/.test(specifier)) {
      const url = new URL(specifier + '.js', context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  },
})
