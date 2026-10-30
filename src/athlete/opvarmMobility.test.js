import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './opvarmStigeLoader.mjs'
import { mount, nodes, text, button } from './opvarmStigeDom.mjs'

const hooks = install()
const { default: View } = await import('./WarmupLadderView.mjs')
const { sessionLadder, opvarmStigeEnabled } = await import('../opvarmStige.mjs')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const props = (name = 'Squat top', scope = 'today') => ({ enabled: true, scope,
  exercises: Object.freeze([Object.freeze({ name, recommended_weight: 100 })]) })
const checks = tree => nodes(tree, n => n.type === 'input')
const timer = tree => text(nodes(tree, n => n.props.role === 'timer')[0])
const plain = tree => tree == null || typeof tree !== 'object' ? tree : ({
  type: tree.type,
  props: Object.fromEntries(Object.entries(tree.props).filter(([k,v]) => k !== 'style' && k !== 'children' && v !== undefined)
    .map(([k,v]) => [k, typeof v === 'function' ? '[handler]' : v])),
  children: tree.props.children.map(plain),
})
function clock(t) {
  let now = 1000, id = 0
  const active = new Map()
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setInterval', fn => { active.set(++id, fn); return id })
  t.mock.method(globalThis, 'clearInterval', id => active.delete(id))
  return { active, advance(ms) { now += ms; for (const fn of [...active.values()]) fn() } }
}
function app(t, p = props()) { const a = mount(View, p); t.after(() => a.unmount()); return a }

test('core: strict default OFF has no IO or interval effects', t => {
  for (const key of ['fetch', 'localStorage', 'sessionStorage']) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('IO forbidden') } })
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key])
  }
  const c = clock(t)
  assert.equal(opvarmStigeEnabled(), false)
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    assert.equal(app(t, { ...props(), enabled }).render(), null)
  }
  assert.equal(c.active.size, 0)
})
test('core: unknown lift and missing load never invent a plan', t => {
  for (const name of ['Leg press', 'Unknown', 'Front squat']) {
    assert.equal(app(t, props(name)).render(), null)
  }
  assert.equal(app(t, { ...props(), exercises: [{ name: 'Squat top', recommended_weight: null }] }).render(), null)
})
test('core: today rows choose their first main lift and explicit topset', () => {
  const p = sessionLadder([{ name: 'Leg press', recommended_weight: 50 },
    { name: 'Bench press backoff', recommended_weight: 60 },
    { name: 'Bench press top', recommended_weight: 95 },
    { name: 'Squat top', recommended_weight: 180 }])
  assert.equal(p.lift, 'Bænkpres'); assert.equal(p.plannedWeight, 95)
})
test('core: mobility timer uses a 120 second deadline and cleans up', t => {
  const c = clock(t), a = app(t)
  button(a.render(), 'Start 2 minutters mobilitet').props.onClick()
  assert.equal(timer(a.render()), '120 sekunder')
  c.advance(17500); assert.equal(timer(a.render()), '103 sekunder')
  c.advance(200000); a.render(); assert.equal(timer(a.render()), '0 sekunder')
  assert.equal(c.active.size, 0)
})
test('core: scope and plan changes clear checks and timers', t => {
  const c = clock(t), a = app(t)
  let tree = a.render()
  checks(tree)[0].props.onChange({ target: { checked: true } })
  button(tree, 'Start 2 minutters mobilitet').props.onClick(); a.render()
  tree = a.render(props('Bench press top', 'tomorrow'))
  assert.equal(checks(tree)[0].props.checked, false)
  assert.equal(timer(tree), '0 sekunder'); assert.equal(c.active.size, 0)
  assert.match(text(tree), /Brystryg over skumrulle/)
  assert.doesNotMatch(text(tree), /Ankel-vægstræk/)
})

test('feature: squat, bench, conventional and sumo copy names, descriptions AND labels', t => {
  const cases = [
    ['Squat top', 'Squat', ['sq-mob-2', 'sq-mob-3']],
    ['Bench press top', 'Bænkpres', ['bp-mob-1', 'bp-mob-2']],
    ['Deadlift top', 'Dødløft — Konventionel', ['dk-mob-1', 'dk-mob-3']],
    ['Sumo deadlift top', 'Dødløft — Sumo', ['ds-mob-1', 'ds-mob-2']],
  ]
  for (const [name, key, ids] of cases) {
    const tree = app(t, props(name)).render()
    const catalog = WARMUP_BASE[key].flatMap(s => s.options)
    for (const id of ids) {
      const ex = catalog.find(e => e.id === id)
      assert.ok(text(tree).includes(ex.name)); assert.ok(text(tree).includes(ex.desc))
      assert.ok(text(tree).includes(`${ex.name} · ${ex.label}`))
    }
    const sections = nodes(tree, n => n.props['aria-label'] === 'Mobilitet før opvarmningsstigen')
    assert.equal(sections.length, 1)
    assert.ok(tree.props.children.indexOf(sections[0]) < tree.props.children.indexOf(nodes(tree, n => n.type === 'ol').at(-1)))
  }
})
test('feature: skip before start keeps every ladder row and checkbox state', t => {
  const a = app(t), before = a.render()
  checks(before)[0].props.onChange({ target: { checked: true } })
  button(before, 'Spring mobilitet over').props.onClick()
  const after = a.render()
  assert.equal(checks(after).length, checks(before).length)
  assert.equal(checks(after)[0].props.checked, true)
  assert.doesNotMatch(text(after), /Ankel-vægstræk|Start 2 minutters mobilitet/)
  assert.equal(timer(after), '0 sekunder')
})
test('feature: skip cancels mobility interval and resets on a new session', t => {
  const c = clock(t), a = app(t)
  button(a.render(), 'Start 2 minutters mobilitet').props.onClick(); a.render()
  c.advance(10000)
  button(a.render(), 'Spring mobilitet over').props.onClick()
  assert.equal(timer(a.render()), '0 sekunder'); assert.equal(c.active.size, 0)
  c.advance(130000); assert.equal(timer(a.render()), '0 sekunder')
  assert.ok(button(a.render(props('Squat top', 'new-day')), 'Spring mobilitet over'))
})
test('feature: skip does not cancel an unrelated rest timer or another athlete', t => {
  const c = clock(t), left = app(t), right = app(t, props('Deadlift top', 'other-athlete'))
  button(left.render(), 'Start 60 sekunders pause').props.onClick(); left.render()
  button(right.render(), 'Start 2 minutters mobilitet').props.onClick(); right.render()
  button(left.render(), 'Spring mobilitet over').props.onClick()
  assert.equal(timer(left.render()), '60 sekunder')
  c.advance(10000)
  assert.equal(timer(left.render()), '50 sekunder'); assert.equal(timer(right.render()), '110 sekunder')
  assert.ok(button(right.render(), 'Spring mobilitet over'))
  left.unmount(); right.unmount(); assert.equal(c.active.size, 0)
})
test('feature: documented ON snapshot and unchanged OFF cases match normalized DOM', t => {
  const expected = JSON.parse(readFileSync(new URL('../design1Baseline.json', import.meta.url), 'utf8'))
  assert.deepEqual([true, false, undefined].map(enabled => plain(app(t, { ...props(), enabled }).render())), expected.slice(6))
})
test('feature: actual closed registry permits this test only', async () => {
  const { createRegistry } = await import('../testModuleRegistry.mjs')
  const data = JSON.parse(readFileSync(new URL('../testModuleRegistry.json', import.meta.url), 'utf8'))
  const root = new URL('../../', import.meta.url), registry = createRegistry(data, root)
  assert.ok(registry.lookup('src/athlete/opvarmStigeLoader.mjs', './WarmupLadderView.mjs', import.meta.url))
  assert.equal(registry.lookup('src/athlete/opvarmStigeLoader.mjs', './WarmupLadderView.mjs', new URL('src/athlete/Unlisted.test.js', root).href), null)
})
test('review: skip is local, does no IO, and leaves the frozen prescription intact', t => {
  for (const key of ['fetch', 'localStorage', 'sessionStorage']) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('IO forbidden') } })
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key])
  }
  const p = props(), saved = JSON.stringify(p.exercises), a = app(t, p)
  button(a.render(), 'Spring mobilitet over').props.onClick(); a.render()
  assert.equal(JSON.stringify(p.exercises), saved)
  for (const next of [{ ...p, enabled: false }, { ...p, exercises: [] }]) {
    assert.equal(a.render(next), null)
    assert.ok(button(a.render(p), 'Spring mobilitet over'))
    button(a.render(), 'Spring mobilitet over').props.onClick(); a.render()
  }
  const changed = { ...p, exercises: [{ name: 'Squat top', recommended_weight: 140 }] }
  assert.ok(button(a.render(changed), 'Spring mobilitet over'))
})
test('review: skip after rest replaces mobility deadline without cancelling rest', t => {
  const c = clock(t), a = app(t)
  button(a.render(), 'Start 2 minutters mobilitet').props.onClick(); a.render()
  c.advance(25000)
  button(a.render(), 'Start 60 sekunders pause').props.onClick(); a.render()
  button(a.render(), 'Spring mobilitet over').props.onClick()
  assert.equal(timer(a.render()), '60 sekunder')
  assert.equal(c.active.size, 1)
  c.advance(61000); a.render()
  assert.equal(timer(a.render()), '0 sekunder'); assert.equal(c.active.size, 0)
})
test.after(() => hooks.deregister())
