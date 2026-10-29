const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
const root = new URL('./', import.meta.url)
import { existsSync } from 'node:fs'
const locations = registryRecipe(import.meta.url, 'locations')
const url = name => {
 const flat = new URL(name,root)
 return (existsSync(flat) ? flat : new URL(locations[name] || name,root)).href
}
// Exact parent/specifier pairs from the pinned public handlers.
const stubs = registryRecipe(import.meta.url, 'stubs')
const real = registryRecipe(import.meta.url, 'real')
export function resolve(specifier, context, next) {
  const parent = Object.keys({...stubs,...real}).find(name => url(name) === context.parentURL)
  if (parent) {
    const target = real[parent]?.[specifier]
    if (target) return {url:url(target),shortCircuit:true}
    const names = stubs[parent]?.[specifier]
    if (!names) throw Error('Unpinned dependency: '+parent+' -> '+specifier)
    const source = names.map(name => {
      if (name === 'supabase') return 'export const supabase = { from: (...args) => globalThis.coachWeekFake.from(...args) }'
      if (name === 'dataEnoughEnabled') return 'export const dataEnoughEnabled = () => false'
      return `export const ${name} = () => { throw Error('Unexpected dependency: ${name}') }`
    }).join('\n')
    return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true}
  }
  return next(specifier, context)
}
registerHooks({resolve})
