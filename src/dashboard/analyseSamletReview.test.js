import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './analyseSamletLoader.mjs'
import { mount, nodes, text, one } from './analyseSamletDom.mjs'
install()
const { default: Prototype } = await import('./AnalyseSamletPrototype.jsx')
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const props = { athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all', selectedAthlete: { id: 'synthetic-foreign', name: 'FOREIGN_SENTINEL' } }
const clean = value => {
  if (typeof value === 'function') return '[handler]'
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.filter(item => item?.props?.['aria-label'] !== 'Samlet analyseprototype').map(clean)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]))
}

test('counterexample: default and explicit OFF render the same legacy tree as ON without prototype', () => {
  const previous = globalThis.window
  try {
    globalThis.window = { location: { search: '' } }
    const off = clean(mount(AnalyseTab, props).render())
    globalThis.window.location.search = '?analyseSamlet=0'
    assert.deepEqual(clean(mount(AnalyseTab, props).render()), off)
    globalThis.window.location.search = '?analyseSamlet=1'
    const on = mount(AnalyseTab, props).render()
    assert.deepEqual(clean(on), off)
    const demo = one(on, n => n.props['aria-label'] === 'Samlet analyseprototype')
    assert.doesNotMatch(text(demo), /FOREIGN_SENTINEL|synthetic-foreign/)
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
})
test('counterexample: all prototype handlers work while storage and network are forbidden', () => {
  const names = ['fetch', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket']
  const descriptors = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { throw Error('Forbidden IO: ' + name) } })
    const app = mount(Prototype)
    const tree = app.render()
    for (const button of nodes(tree, n => n.type === 'button')) { button.props.onClick(); app.render() }
    for (const lift of ['bench', 'deadlift', 'squat']) {
      one(app.render(), n => n.type === 'select').props.onChange({ target: { value: lift } })
      app.render()
    }
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
test('counterexample: a new mount resets previous lift and history choice', () => {
  const first = mount(Prototype)
  one(first.render(), n => n.type === 'select').props.onChange({ target: { value: 'bench' } })
  assert.match(text(first.render()), /demo-bench-1/)
  assert.match(text(mount(Prototype).render()), /demo-squat-2/)
})
test('counterexample: history buttons remain native, labeled and large enough in style contract', () => {
  const tree = mount(Prototype).render()
  for (const button of nodes(tree, n => n.type === 'button')) {
    assert.equal(button.props.type, 'button')
    assert.equal(typeof button.props['aria-pressed'], 'boolean')
    assert.ok(button.props.style.minHeight >= 44)
    assert.ok(text(button).trim().length > 0)
  }
  assert.equal(nodes(tree, n => n.type === 'label' && nodes(n, child => child.type === 'select').length === 1).length, 1)
  assert.equal(nodes(tree, n => n.props.role === 'status' && n.props['aria-live'] === 'polite').length, 1)
})
test('exact source boundary: reversing only the declared insertions recovers the pinned base', () => {
  const final = readFileSync(new URL('./AnalyseTab.jsx', import.meta.url), 'utf8')
  const eol = final.includes('\r\n') ? '\r\n' : '\n'
  const imports = ["import AnalyseSamletPrototype from './AnalyseSamletPrototype'", "import { analyseSamletEnabled } from './analyseSamlet.mjs'", '', ''].join(eol)
  const block = ["                  {analyseSamletEnabled(typeof window === 'undefined' ? '' : window.location.search) && (", '                    <AnalyseSamletPrototype />', '                  )}', '', ''].join(eol)
  assert.equal(final.split(imports).length, 2)
  assert.equal(final.split(block).length, 2)
  const recovered = final.replace(imports, '').replace(block, '')
  // Normalize only line endings so this application test also works in an LF checkout.
  assert.equal(createHash('sha256').update(recovered.replace(/\r\n/g, '\n')).digest('hex'), '6d196a95737b85139943704d7639527fbd35b84630a14d919ad2341383b51306')
})
