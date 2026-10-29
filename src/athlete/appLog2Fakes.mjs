const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
// Hermetisk grænse. Ingen rigtig klient indlæses.
import { registryHooks } from '../testModuleRegistry.mjs'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const self = import.meta.url
export const backendCalls = []
export const supabase = { from(table) { backendCalls.push(table); throw Error('Backend forbidden') } }
export const queueWrite = fn => fn()
export const recordSilentFail = () => {}
export const logFrontendError = () => {}
export const parsePlannedRpe = () => null
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/saetSkrivning.js') &&
      ['../supabase.js', '../athleteSilentFailLog.js', './ugeHjaelp.js'].includes(specifier)) {
      return { url: self, shortCircuit: true }
    }
    if (specifier.startsWith('.') && !/\.(?:js|mjs|jsx)$/.test(specifier)) {
      const url = new URL(specifier + '.js', context.parentURL)
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
    }
    return nextResolve(specifier, context)
  },
})
export function memoryStorage() {
  const map = new Map()
  return { getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }
}
export function syntheticElement(tag, props, ...children) {
  return { tagName: tag.toUpperCase(), props, textContent: children.join(''),
    click() { return props.onClick() } }
}
