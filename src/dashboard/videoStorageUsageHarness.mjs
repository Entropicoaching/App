import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './lagerJsx.mjs'

// Syntetisk DOM. Kun de to faktiske produktmoduler kan indlaeses.
const prefix = 'lager-component:///'
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true }
    if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
    if (specifier !== './videoStorageUsage.mjs') throw Error(`Uventet import: ${specifier}`)
    return { url: prefix + 'videoStorageUsage.mjs', shortCircuit: true }
  },
  load(url, context, next) {
    if (!url.startsWith(prefix)) return next(url, context)
    const name = url.slice(prefix.length)
    if (!['VideoStorageUsage.jsx', 'videoStorageUsage.mjs'].includes(name)) throw Error('Uventet modul')
    let source = readFileSync(new URL(name, import.meta.url), 'utf8')
    if (name.endsWith('.jsx')) source = 'const __h = (type, props, ignored, ...children) => ({type, props, children});\n' + jsx(source)
    return { format: 'module', source, shortCircuit: true }
  },
})
export const Component = (await import(prefix + 'VideoStorageUsage.jsx')).default
