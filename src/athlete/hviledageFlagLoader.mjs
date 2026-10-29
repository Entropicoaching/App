import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './hvileJsx.mjs'
const root = new URL('../../', import.meta.url)
const runtime = new URL('./hviledageFlagDom.mjs', import.meta.url).href
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(root.href) && (specifier === 'react' || specifier === 'react-dom' || /\/supabase(?:\.js)?$/.test(specifier))) return { url: runtime, shortCircuit: true }
      if (context.parentURL?.startsWith(root.href) && specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
        for (const ext of ['.js', '.jsx', '.mjs']) {
          const url = new URL(specifier + ext, context.parentURL)
          try { readFileSync(url); return { url: url.href, shortCircuit: true } } catch {}
        }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.startsWith(root.href) && url.endsWith('.css')) return { format:'module', source:'export default {}', shortCircuit:true }
      if (url.startsWith(root.href) && (url.endsWith('.jsx') || /hviledage(?:Main|Before)\w+\.txt$/.test(url))) return { format: 'module', shortCircuit: true,
        source: `import { h as __h } from '${runtime}';\n` + jsx(readFileSync(new URL(url), 'utf8')) }
      return next(url, context)
    },
  })
}
