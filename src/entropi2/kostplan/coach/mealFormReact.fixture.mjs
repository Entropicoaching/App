// Actual ReactDOM with a lexical host window; no host-global/prototype changes.
// Product ES modules execute in an isolated realm initialized with synthetic storage.
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { compileFunction, createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const clone = value => JSON.parse(JSON.stringify(value))
export { clone }
export async function mountFormPortal(storage, props, body, entry = './PortalPlan.mjs') {
  const document = sessionReactDocument(), host = document.createElement('div')
  document.body.append(host)
  // Host select API required by ReactDOM, never an assertion/text/query override.
  const Base = document.defaultView.HTMLElement
  class Select extends Base { constructor() { super('select') } get options() { return this.querySelectorAll('option') } }
  class Option extends Base { constructor() { super('option') } get value() { return this.getAttribute('value') ?? this.textContent } set value(v) { this.setAttribute('value', v) } }
  const make = document.createElement
  const doc = { ...document, createElement: tag => tag === 'select' ? new Select() : tag === 'option' ? new Option() : make(tag) }
  // Base nodes retain the same ownerDocument; only element construction differs.
  const window = { ...document.defaultView, event: undefined }
  const domModule = { exports: {} }
  const filename = require.resolve('react-dom/client').replace(/index\.js$|client\.js$/, 'cjs/react-dom-client.development.js')
  compileFunction(readFileSync(filename, 'utf8'), ['module', 'exports', 'require', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'], { filename })(domModule, domModule.exports, createRequire(filename), window, doc, true)
  const context = createContext({ crypto: webcrypto, localStorage: storage, structuredClone, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder })
  const modules = new Map()
  const sourceRoot = new URL('../../../', import.meta.url).href
  const reactModule = new SyntheticModule(Object.keys(React), function () { for (const [k, v] of Object.entries(React)) this.setExport(k, v) }, { context })
  const get = url => {
    if (url === 'react') return reactModule
    assert.ok(url.startsWith(sourceRoot) && !url.endsWith('/supabase.js'), 'Only copied public product modules')
    if (!modules.has(url)) modules.set(url, new SourceTextModule(readFileSync(fileURLToPath(url), 'utf8'), { context, identifier: url, initializeImportMeta: meta => { meta.url = url } }))
    return modules.get(url)
  }
  const component = get(new URL(entry, import.meta.url).href)
  await component.link((s, ref) => get(s === 'react' ? s : new URL(s, ref.identifier).href))
  await component.evaluate()
  const root = domModule.exports.createRoot(host)
  const render = next => React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(component.namespace.default, next))); await settle() })
  const settle = async () => { for (let i = 0; i < 120; i++) await Promise.resolve() }
  const find = (tag, text) => host.querySelectorAll(tag).find(n => n.textContent === text)
  const handler = (node, key) => {
    const propKey = Object.keys(node).find(k => k.startsWith('__reactProps$'))
    assert.ok(propKey, 'Real ReactDOM mounted props')
    return node[propKey][key]
  }
  const invoke = async (node, key, event = {}) => { assert.ok(node); await React.act(async () => { await handler(node, key)({ preventDefault() {}, currentTarget: node, ...event }); await settle() }) }
  const ui = { host, render, handler, find, invoke, act: fn => React.act(async () => { await fn(); await settle() }),
    open: async () => { const d = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan'); d.open = true; await invoke(d, 'onToggle') },
    click: async text => { const b = find('button', text); assert.ok(b, text); assert.equal(b.getAttribute('disabled'), null, text); await invoke(b, 'onClick') },
    input: async (name, value) => { const n = host.querySelectorAll('textarea,input,select').find(n => n.getAttribute('name') === name); await invoke(n, 'onChange', { currentTarget: { value } }) },
    submit: async text => { const f = host.querySelectorAll('form').find(n => n.textContent.includes(text)); await invoke(f, 'onSubmit') },
    wait: async predicate => { for (let i = 0; i < 500 && !predicate(); i++) await React.act(async () => { await new Promise(r => setImmediate(r)); await settle() }); assert.ok(predicate(), host.textContent.slice(-1000)) },
    unmount: () => React.act(async () => { root.unmount(); await settle() }),
  }
  // Each node's ownerDocument is the original document. Its createElement must
  // support select/option at construction, supplied through a local document facade.
  host.ownerDocument = doc
  try { await render(props); await body(ui) } finally { await ui.unmount() }
}
