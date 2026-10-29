const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
import { jsx } from './followUpJsx.mjs'
const base = new URL('./', import.meta.url)
// Explicit pinned parent/specifier pairs. Never infer exports from runtime source.
const dependencies = registryRecipe(import.meta.url, 'dependencies')
const real = new Set(["./coachNotes.mjs", "./ForsideView.jsx", "../Dashboard.jsx", "./followUpBaseline.jsx", "./coachFollowUp.mjs", "./afvigelse.js"].map(path => new URL(path, base).href))
const dom = new URL('./followUpDom.mjs', base).href
const pairs = new Map(dependencies.map(([parent, specifier, target]) => [
  new URL(parent, base).href + '\n' + specifier,
  target.file ? new URL(target.file, base).href : 'data:text/javascript,' + encodeURIComponent(target.stub),
]))
const protectedNames = new Set([...real].map(url => new URL(url).pathname.split('/').at(-1)))
function unapproved(value) {
  const error = new Error('Unapproved hermetic dependency: ' + value)
  error.code = 'ERR_MODULE_NOT_FOUND'
  throw error
}
export function install() {
 return registerHooks({
  resolve(specifier, context, next) {
   const parent = context.parentURL
   if (parent === new URL('./followUpReview.test.js',base).href && specifier === './Dashboard.jsx')
    return {url:new URL('../Dashboard.jsx',base).href,shortCircuit:true}
   if (real.has(parent)) {
    if (specifier === dom && parent.endsWith('.jsx')) return {url:dom,shortCircuit:true}
    const target = pairs.get(parent + '\n' + specifier)
    if (!target) return unapproved(specifier)
    return {url:target,shortCircuit:true}
   }
   const result = next(specifier,context)
   if (result.url.startsWith('file:') && protectedNames.has(new URL(result.url).pathname.split('/').at(-1)) && !real.has(result.url)) return unapproved(result.url)
   return result
  },
  load(url, context, next) {
   if (real.has(url)) {
    const source = readFileSync(new URL(url),'utf8')
    return {format:'module',source:url.endsWith('.jsx') ? `import { __h } from '${dom}';\n${jsx(source)}` : source,shortCircuit:true}
   }
   if (url.startsWith('file:') && protectedNames.has(new URL(url).pathname.split('/').at(-1))) return unapproved(url)
   return next(url,context)
  },
 })
}
