// Test infrastructure only. Legacy hooks retain their JSX and fake-object recipes.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { jsx } from './coachRyd2Jsx.mjs'
const repository = new URL('../', import.meta.url)
const defaultData = JSON.parse(readFileSync(new URL('./testModuleRegistry.json', import.meta.url), 'utf8'))
const modulePath = /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|mjs|jsx)$/
const importerPath = /^(?:src|scripts|e2e)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|mjs|jsx)$/
const cleanRelative = /^(?:\.\/|(?:\.\.\/)+)(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|mjs|jsx)$/
const closed = specifier => { throw Error('Closed registry import: ' + specifier) }

// Validate once per registry instance; injected registries and readers support synthetic FS tests.
export function createRegistry(data = defaultData, root = repository) {
  if (data.schema !== 'test-module-registry/v1' || data.version !== 1 || !Array.isArray(data.modules)) throw Error('Invalid test registry version')
  const entries = new Map()
  for (const entry of data.modules) {
    if (!entry || !modulePath.test(entry.path) || entry.module !== posix.basename(entry.path)
      || !Array.isArray(entry.allowedImporters) || !entry.allowedImporters.every(name => importerPath.test(name))
      || (entry.allowedLoaders && (!Array.isArray(entry.allowedLoaders) || !entry.allowedLoaders.every(name => Object.hasOwn(data.loaders, name))))
      || (entry.runtime && !modulePath.test(entry.runtime))
      || entries.has(entry.path)) throw Error('Invalid or duplicate test registry module')
    entries.set(entry.path, Object.freeze({ ...entry, allowedImporters: Object.freeze([...entry.allowedImporters]) }))
  }
  const loaderNames = Object.keys(data.loaders)
  for (const entry of entries.values()) {
    for (const [parent, group] of Object.entries(entry.legacyImporters || {})) {
      if (!importerPath.test(parent) || !Number.isInteger(group) || !Array.isArray(data.legacyLoaderGroups?.[group])
        || !data.legacyLoaderGroups[group].every(index => Number.isInteger(index) && loaderNames[index])) throw Error('Invalid legacy importer group')
    }
    for (const [specifier, target] of Object.entries(entry.imports || {})) {
      if (target === '@runtime' ? specifier !== 'react' : !cleanRelative.test(specifier) || !entries.has(target)) throw Error('Invalid explicit registry dependency')
    }
  }
  const runtimeFor = entry => new URL(entry.runtime || 'src/registryDom.mjs', root).href
  function logical(url, loader) {
    if (typeof url !== 'string' || /[%?#\\]/.test(url)) return null
    if (url.startsWith(root.href)) {
      const path = url.slice(root.href.length)
      return importerPath.test(path) ? path : null
    }
    const virtual = data.loaders[loader]?.virtual
    if (!virtual) return null
    let parsed
    try { parsed = new URL(url) } catch { return null }
    const protocol = virtual.protocol.replace('number', '[1-9][0-9]*')
    if (!new RegExp('^' + protocol + '$').test(parsed.protocol) || parsed.username || parsed.password || parsed.port) return null
    if (virtual.host === 'number' ? !/^[1-9][0-9]*$/.test(parsed.hostname) : parsed.hostname !== virtual.host) return null
    const path = parsed.pathname.slice(1)
    if (virtual.mode === 'path') return importerPath.test(path) ? path : null
    // Basename protocols are legacy harness identities, never filesystem discovery.
    if (path.includes('/')) return null
    const matches = [...new Set([...entries.values()].flatMap(entry => entry.allowedImporters))].filter(name => posix.basename(name) === path)
    return matches.length === 1 ? matches[0] : null
  }
  return Object.freeze({
    data,
    runtimeFor(url) { return runtimeFor(entries.get(url.slice(root.href.length))) },
    loaderId(url) {
      const id = url.startsWith(root.href) ? url.slice(root.href.length) : ''
      if (!Object.hasOwn(data.loaders, id)) throw Error('Unregistered test loader: ' + id)
      return id
    },
    lookup(loader, specifier, parentURL) {
      if (!Object.hasOwn(data.loaders, loader)) return null
      const parent = logical(parentURL, loader)
      if (!parent) return null
      const owner = entries.get(parent)
      if (owner && !owner.legacyImporters && specifier === runtimeFor(owner)) return { url: runtimeFor(owner), shortCircuit: true, legacy: true }
      if (owner?.imports?.[specifier] === '@runtime') return { url: runtimeFor(owner), shortCircuit: true, legacy: true }
      if (!cleanRelative.test(specifier)) return null
      const target = posix.normalize(posix.join(posix.dirname(parent), specifier))
      const entry = entries.get(target)
      // Compare the exact canonical relative spelling, including case and extension.
      const relative = posix.relative(posix.dirname(parent), target)
      const canonical = relative.startsWith('.') ? relative : './' + relative
      if (!entry || canonical !== specifier) return null
      const explicit = entry.allowedImporters.includes(parent) && (!entry.allowedLoaders || entry.allowedLoaders.includes(loader))
      const outgoing = owner && !owner.legacyImporters && owner.imports?.[specifier] === target
      // Historical topology never overrides a legacy fake or a mutated closed recipe.
      if (!explicit && !outgoing) return null
      return { url: new URL(entry.path, root).href, shortCircuit: true, legacy: Boolean(entry.legacyImporters) }
    },
  })
}
const registry = createRegistry()

export function wrapRegistryHooks(loaderURL, hooks, options = {}) {
  const rules = options.registry || registry
  const loader = rules.loaderId(loaderURL)
  const managed = new Set()
  return {
    ...hooks,
    resolve(specifier, context, next) {
      const match = rules.lookup(loader, specifier, context.parentURL)
      if (match) { if (!match.legacy) managed.add(match.url); return { url: match.url, shortCircuit: true } }
      // A newly admitted module never acquires host fallback or dynamic discovery.
      if (managed.has(context.parentURL)) return closed(specifier)
      return hooks.resolve ? hooks.resolve(specifier, context, next) : next(specifier, context)
    },
    load(url, context, next) {
      if (!managed.has(url)) return hooks.load ? hooks.load(url, context, next) : next(url, context)
      // Registered additions use one explicit renderer; existing module loads stay in their legacy hook.
      let source = (options.readSource || (target => readFileSync(new URL(target), 'utf8')))(url)
      if (url.endsWith('.jsx')) {
        source = `import * as __registryRuntime from ${JSON.stringify(rules.runtimeFor(url))};\nconst __h = __registryRuntime.h || ((t,p,_,...c) => __registryRuntime.createElement(t,p,...c));\n` + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  }
}
export const registryHooks = loaderURL => hooks => registerHooks(wrapRegistryHooks(loaderURL, hooks))
export function registryRecipe(loaderURL, name) {
  const resource = loaderURL.startsWith(repository.href) ? loaderURL.slice(repository.href.length) : loaderURL
  const key = resource + '#' + name
  if (!Object.hasOwn(defaultData.recipes, key)) throw Error('Unknown registry recipe: ' + key)
  // Consumers historically add scenario-specific flags; never mutate the shared record.
  return structuredClone(defaultData.recipes[key])
}
