import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, basename, posix } from 'node:path'
const root = new URL('./', import.meta.url)
const paths = JSON.parse(readFileSync(new URL('source-map.json', root), 'utf8'))
const modules = new Map(Object.entries(paths).map(([name, logical]) => [logical,
  (existsSync(new URL(name, root)) ? new URL(name, root) : new URL(logical.slice(4), root)).href]))
const logicalByUrl = new Map([...modules].map(([logical, url]) => [url, logical]))
const runtime = new URL('syntheticRuntime.mjs', root).href
export function resolve(specifier, context, next) {
  const parent = logicalByUrl.get(context.parentURL)
  if (!parent) return next(specifier, context)
  if (specifier === 'react') return { url: runtime, shortCircuit: true }
  if (!specifier.startsWith('.')) return next(specifier, context)
  let logical = posix.normalize(posix.join(posix.dirname(parent), specifier))
  if (!posix.extname(logical)) {
    logical = ['.js', '.jsx', '.mjs'].map(ext => logical + ext).find(path => modules.has(path) || path === 'src/supabase.js') || logical
  }
  if (logical === 'src/supabase.js') return { url: runtime, shortCircuit: true }
  // Only the pinned test entry points intentionally import dashboard helpers from src.
  if (parent === 'src/vcForenkl4.test.js' && specifier === './videoSaveApproveShare.mjs') logical = 'src/dashboard/videoSaveApproveShare.mjs'
  if (parent === 'src/vcForenkl4Bridge.test.js' && specifier === './useVideoCoachBro.js') logical = 'src/dashboard/useVideoCoachBro.js'
  if (modules.has(logical)) return { url: modules.get(logical), shortCircuit: true }
  // Exact directory entries reject accidental Windows case folding.
  const target = new URL(specifier, context.parentURL)
  const file = fileURLToPath(target)
  let present = false
  try {
    const anchor = fileURLToPath(root)
    if (file.startsWith(anchor)) {
      let directory = anchor
      const parts = file.slice(anchor.length).split(/[\\/]/)
      present = parts.every(part => {
        if (!readdirSync(directory).includes(part)) return false
        directory += part + '/'
        return true
      })
    }
  } catch {}
  if (!present) throw Object.assign(new Error(`Unpinned import: ${specifier}`), { code: 'ERR_MODULE_NOT_FOUND' })
  return next(specifier, context)
}
export function load(url, context, next) {
  if (logicalByUrl.has(url) && url.endsWith('.js')) return next(url, { ...context, format: 'module' })
  return next(url, context)
}
