// Syntax-only bridge; actual product imports, React and ReactDOM are unchanged.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createElement as h, useState, act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { jsx } from './coachCalendarJsx.mjs'
import { createDocument, elements } from '../entropi2/onboarding/firstVisitDom.mjs'

const componentURL = new URL('./OpvarmningTab.jsx', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return next(context.parentURL === componentURL && specifier === '../dashboardShared'
      ? '../dashboardShared.js' : specifier, context)
  },
  load(url, context, next) {
    if (url !== componentURL) return next(url, context)
    return { format: 'module', shortCircuit: true, source:
      "import { createElement } from 'react'; const __h = (type, props, ignored, ...children) => createElement(type, props, ...children);\n"
      + jsx(readFileSync(new URL(url), 'utf8')) }
  },
})
const { default: OpvarmningTab } = await import('./OpvarmningTab.jsx')
export { elements, hooks }

export async function mount(extra = {}) {
  const doc = createDocument(), host = doc.createElement('div'), calls = [], deletes = []
  doc.body.append(host)
  const prior = new Map(['window', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const p = { a: { id: 'synthetic-a', name: 'Syntetisk A' }, saving: false, warmupTemplates: [], ...extra }
  let state, update
  function Harness() {
    const [editingWarmup, setEditingWarmup] = useState(null)
    const [warmupDraftSteps, setWarmupDraftSteps] = useState([])
    const [warmupNewStep, setWarmupNewStep] = useState('')
    const [, refresh] = useState(0)
    update = () => refresh(n => n + 1)
    state = { editingWarmup, warmupDraftSteps, warmupNewStep, setWarmupNewStep }
    return h(OpvarmningTab, { ...p, editingWarmup, setEditingWarmup,
      warmupDraftSteps, setWarmupDraftSteps, warmupNewStep, setWarmupNewStep,
      saveWarmupTemplate: (...args) => calls.push(args), deleteWarmupTemplate: id => deletes.push(id) })
  }
  const root = createRoot(host)
  await act(async () => root.render(h(StrictMode, null, h(Harness))))
  function dispatch(target, type, extra = {}) {
    const event = { type, target, button: 0, bubbles: true, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true }, stopPropagation() {}, ...extra }
    host.events.get(type + ':capture')?.(event)
    const bubble = host.events.get(type + ':bubble') ?? target.events.get(type + ':bubble')
    if (!bubble) throw Error('Missing real React delegated event: ' + type)
    bubble(event)
  }
  return { host, p, calls, deletes, get state() { return state },
    buttons: label => elements(host).filter(n => n.tagName === 'BUTTON' && n.textContent === label),
    async press(target) { if (!target || target.disabled || target.getAttribute('disabled') !== null) throw Error('Missing enabled button'); await act(async () => dispatch(target, 'click')) },
    async event(target, type, extra) { await act(async () => dispatch(target, type, extra)) },
    async change(extra) { Object.assign(p, extra); await act(async () => update()) },
    async text(value) {
      const input = elements(host).find(n => n.tagName === 'INPUT')
      if (!input) throw Error('Missing text input')
      // ReactDOM's input-event fallback uses native focus/value/key events.
      // The synthetic host supplies only the legacy host methods it requests.
      input.type = 'text'; input.attachEvent = () => {}; input.detachEvent = () => {}
      await act(async () => dispatch(input, 'focusin'))
      input.value = value
      await act(async () => dispatch(input, 'keyup', { key: 'x', keyCode: 88 }))
    },
    async close() {
      await act(async () => root.unmount())
      for (const [key, descriptor] of prior) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
      }
    },
  }
}
