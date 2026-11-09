const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from './testModuleRegistry.mjs'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { jsx } from './vcSvarJsx.mjs'
const root = new URL('./', import.meta.url)
const actual = new Set(registryRecipe(import.meta.url, 'actual'))
const locations = registryRecipe(import.meta.url, 'locations')
const moduleUrl = name => {
  const flat = new URL(name, root)
  return existsSync(flat) ? flat.href : new URL((name.endsWith('BeskederTab.jsx') ? locations[name] : (locations[name] || '') + name), root).href
}
const athlete = new Set(registryRecipe(import.meta.url, 'athlete'))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL?.split('/').at(-1)
      const name = specifier.split('/').at(-1)
      if (specifier === './vcSvarDom.mjs') return {url: new URL('vcSvarDom.mjs',root).href, shortCircuit:true}
      if (parent === 'VideoStorageUsage.jsx' && specifier !== './videoStorageUsage.mjs'
        || parent === 'videoStorageUsage.mjs') throw Error('Unapproved storage dependency: ' + specifier)
      if (specifier === 'react') return {url: new URL('vcSvarDom.mjs',root).href, shortCircuit:true}
      // U2: beskedfilens dobbelttryk-værn er rent og ufarligt; det rigtige modul bruges.
      if (specifier === '../sendOnce.mjs' && athlete.has(parent)) return {url: new URL('sendOnce.mjs',root).href, shortCircuit:true}
      if (specifier.startsWith('.') && actual.has(name)) return {url: moduleUrl(name),shortCircuit:true}
      if (athlete.has(parent) || parent?.endsWith('BeskederTab.jsx')) return {url:new URL('vcSvarDom.mjs',root).href,shortCircuit:true}
      if (['VideoReviewModal.jsx','IndbakkeView.jsx'].includes(parent)) return {url:new URL('vcSvarCoachStubs.mjs',root).href,shortCircuit:true}
      return next(specifier,context)
    },
    load(url, context, next) {
      const name = url.split('/').at(-1)
      if ((actual.has(name) || name === 'BeskederTab.jsx') && name.endsWith('.jsx')) {
        const source=readFileSync(new URL(url),'utf8')
        return {format:'module',source:`import { h as __h } from './vcSvarDom.mjs';\n${jsx(source)}`,shortCircuit:true}
      }
      return next(url,context)
    },
  })
}
