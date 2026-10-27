// Syntetisk sideadapter. Kun elementtraeer fra de rigtige komponenter.
// Login og navigation er fakes; ingen paastand om browserlayout eller auth.
import assert from 'node:assert/strict'
import { mount, createElement as h, nodes, text } from '../src/athlete/mobilityDom.mjs'
import MobilitetFokus from '../src/athlete/MobilitetFokus.jsx'
import { renderMobilityShortcut } from '../src/athlete/mobilityFocus.mjs'
import { renderAnalyseSamlet } from '../src/dashboard/analyseSamlet.mjs'
const normal = value => String(value).replace(/\s+/g, ' ').trim()
const matches = (value, expected, exact) => expected instanceof RegExp ? expected.test(value)
  : exact ? value === expected : value.includes(expected)
const roleOf = node => node.props.role || (node.type === 'button' ? 'button'
  : /^h[1-6]$/.test(node.type) ? 'heading' : node.type === 'section' && node.props['aria-label'] ? 'region' : '')

export function syntheticFeaturePage(kind, library = {}) {
  let stage = 'login', menu = false, app, lift = 'squat', selectedId = null
  const init = () => { stage = 'home'; menu = false; app = mount(MobilitetFokus, { library, warmupTemplates: [], onExit() { stage = 'home' } }) }
  const nav = (name, action) => h('button', { onClick: action }, name)
  const tree = () => {
    if (stage === 'login') return nav('Log ind', init)
    if (stage === 'mobility') return app.render()
    if (stage === 'analysis') return renderAnalyseSamlet(h, { lift, selectedId,
      chooseLift(value) { lift = value; selectedId = null }, chooseAnalysis(value) { selectedId = value } })
    if (stage === 'profile') return h('div', {}, nav('Mere', () => { menu = true }), menu ? nav('Analyse', () => { stage = 'analysis' }) : null)
    if (kind === 'analysis') return nav('Testatlet Uge 1', () => { stage = 'profile' })
    return renderMobilityShortcut(h, { enabled: true, tab: 'hjem', enkelOn: false,
      setMobilityMode() {}, setTab() { stage = 'mobility' } })
  }
  function locator(get) {
    const one = () => { const values = get(); assert.equal(values.length, 1, 'Entydig syntetisk locator'); return values[0] }
    return {
      async waitFor({ state }) { assert.equal(state, 'visible'); one() },
      async count() { return get().length },
      async click() { const node = one(); assert.notEqual(node.props.disabled, true); assert.equal(typeof node.props.onClick, 'function'); await node.props.onClick() },
      async getAttribute(name) { const value = one().props[name]; return value == null ? null : String(value) },
      async selectOption(value) { one().props.onChange({ target: { value } }) },
      first() { return locator(() => get().slice(0, 1)) },
      getByRole(role, opts) { return byRole(get, role, opts) },
      getByText(value, opts) { return byText(get, value, opts) },
      getByLabel(value, opts) { return byLabel(get, value, opts) },
    }
  }
  const descendants = get => get().flatMap(root => nodes(root, () => true))
  function byRole(get, role, { name, exact = false } = {}) {
    return locator(() => descendants(get).filter(node => roleOf(node) === role
      && (name === undefined || matches(normal(node.props['aria-label'] ?? text(node)), name, exact))))
  }
  function byText(get, value, { exact = false } = {}) {
    const hit = node => matches(normal(text(node)), value, exact)
    return locator(() => descendants(get).filter(node => hit(node)
      && !node.props.children.some(child => child && typeof child === 'object' && hit(child))))
  }
  function byLabel(get, value, { exact = false } = {}) {
    return locator(() => descendants(get).filter(node => node.type === 'label'
      && matches(normal(node.props.children.filter(child => typeof child !== 'object').join(' ')), value, exact))
      .flatMap(node => nodes(node, child => child.type === 'select')))
  }
  const root = () => [tree()]
  return {
    async goto() { stage = 'login' }, async reload() { init() },
    locator(selector) { assert.ok(['#athlete-auth-email', '#athlete-auth-password'].includes(selector)); return { async fill() {} } },
    getByRole: (role, opts) => byRole(root, role, opts),
    getByText: (value, opts) => byText(root, value, opts),
    getByLabel: (value, opts) => byLabel(root, value, opts),
  }
}
