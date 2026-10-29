// Own synthetic filesystem/ESM test helper. No real backend, filesystem writes or host resolver.
import * as vm from 'node:vm'
const { SourceTextModule, SyntheticModule, createContext } = vm
import * as path from 'node:path'
import * as url from 'node:url'
import * as crypto from 'node:crypto'
import assert from 'node:assert/strict'
export function syntheticModules(files, root) {
  const modules = new Map(), hooks = [], registrations = [], tests = []
  const test = (name, options, callback) => { tests.push({ name, callback: typeof options === "function" ? options : callback, options: typeof options === "function" ? {} : options }) }
  const context = createContext({ URL, URLSearchParams, TextEncoder, TextDecoder, Buffer, Blob, structuredClone,
    setTimeout: () => { throw Error('Synthetic timer not approved') }, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} }, process: { env: {}, argv: [], cwd: () => url.fileURLToPath(root) } })
  const fileURL = value => {
    const result = value instanceof URL ? new URL(value) : String(value).startsWith('file:') ? new URL(String(value)) : url.pathToFileURL(String(value))
    result.search = ''; result.hash = ''; return result.href
  }
  const read = (target, encoding) => {
    const key = fileURL(target), source = files.get(key)
    if (source === undefined) throw Object.assign(Error('Synthetic ENOENT: ' + key), { code: 'ENOENT' })
    return encoding ? source : Buffer.from(source)
  }
  const exists = target => { const key = fileURL(target); return files.has(key) || [...files.keys()].some(name => name.startsWith(key.endsWith('/') ? key : key + '/')) }
  const fs = { readFileSync: read, existsSync: exists,
    readdirSync(target) { const prefix = fileURL(target).replace(/\/?$/, '/'); return [...new Set([...files.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split('/')[0]))] },
  }
  const moduleAPI = { registerHooks(spec) { hooks.push(spec); registrations.push(spec); return { deregister() { const i = hooks.indexOf(spec); if (i >= 0) hooks.splice(i, 1) } } } }
  const builtins = new Map([['node:fs', fs], ['node:path', path], ['node:url', url], ['node:crypto', crypto], ['node:module', moduleAPI], ['node:test', { default: test, test }], ['node:assert/strict', assert], ['node:child_process', { spawnSync() { throw Error('Synthetic subprocess blocked') }, execFileSync() { throw Error('Synthetic subprocess blocked') } }]])
  function native(specifier) {
    if (!builtins.has(specifier)) throw Error('Synthetic host import blocked: ' + specifier)
    const value = builtins.get(specifier), names = [...new Set([...Object.keys(value), 'default'])]
    return new SyntheticModule(names, function () { for (const name of names) this.setExport(name, name === 'default' ? (value.default || value) : value[name]) }, { context, identifier: specifier })
  }
  function resolve(specifier, parentURL) {
    const active = [...hooks]
    const next = (index, s, c) => index < 0 ? defaultResolve(s, c)
      : active[index].resolve ? active[index].resolve(s, c, (nextS, nextC = c) => next(index - 1, nextS, nextC)) : next(index - 1, s, c)
    return next(active.length - 1, specifier, { parentURL }).url
  }
  function defaultResolve(specifier, { parentURL }) {
    if (specifier.startsWith('node:')) return { url: specifier }
    if (!specifier.startsWith('.') && !specifier.startsWith('file:') && !specifier.startsWith('data:')) throw Error('Synthetic unresolved import: ' + specifier)
    return { url: new URL(specifier, parentURL || root).href }
  }
  function sourceFor(identifier) {
    const active = [...hooks]
    const fallback = (target) => target.startsWith('data:text/javascript,') ? { source: decodeURIComponent(target.slice(21)) } : { source: read(target, 'utf8') }
    const next = (index, target, c) => index < 0 ? fallback(target)
      : active[index].load ? active[index].load(target, c, (nextURL, nextC = c) => next(index - 1, nextURL, nextC)) : next(index - 1, target, c)
    return next(active.length - 1, identifier, { format: 'module' }).source
  }
  function get(identifier) {
    if (modules.has(identifier)) return modules.get(identifier)
    let mod
    if (identifier.startsWith('node:')) mod = native(identifier)
    else mod = new SourceTextModule(String(sourceFor(identifier)), { context, identifier,
      initializeImportMeta(meta) { meta.url = identifier; meta.dirname = identifier.startsWith('file:') ? url.fileURLToPath(new URL('./', identifier)) : '/synthetic' },
      importModuleDynamically: async (specifier, parent) => evaluate(resolve(specifier, parent.identifier)),
    })
    modules.set(identifier, mod)
    return mod
  }
  async function evaluate(identifier) {
    const mod = get(identifier)
    if (mod.status === 'unlinked') await mod.link((specifier, parent) => get(resolve(specifier, parent.identifier)))
    if (mod.status === 'linked') await mod.evaluate({ timeout: 10000 })
    if (mod.status === 'errored') throw mod.error
    return mod
  }
  return { async import(relative) { return (await evaluate(new URL(relative, root).href)).namespace },
    register: moduleAPI.registerHooks, registrations, tests, resolve, sourceFor, context, files, root }
}
