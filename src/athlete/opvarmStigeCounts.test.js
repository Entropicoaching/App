import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './opvarmStigeLoader.mjs'
import { mount, nodes, text, button } from './opvarmStigeDom.mjs'

const hooks = install()
const { default: Ladder, timerSeconds } = await import('./WarmupLadderView.mjs')
const { plateLoad, warmupLadder, opvarmStigeEnabled } = await import('../opvarmStige.mjs')
const props = (weight = 100) => ({ enabled: true, scope: 'synthetic', exercises: [{ name: 'Squat top', recommended_weight: weight }] })
const clean = tree => tree == null || typeof tree !== 'object' ? tree : {
  type: tree.type,
  props: Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && key !== 'style' && value !== undefined).map(([key, value]) => [key, typeof value === 'function' ? '[handler]' : value])),
  children: tree.props.children.map(clean),
}
const timer = app => text(nodes(app.render(), node => node.props.role === 'timer')[0])
function clock(t) {
  let now = 1000, id = 0
  const active = new Map()
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setInterval', fn => { active.set(++id, fn); return id })
  t.mock.method(globalThis, 'clearInterval', key => active.delete(key))
  return { active, advance(ms) { now += ms; for (const fn of [...active.values()]) fn() } }
}

test('exact ladder snapshot includes all text, structure, non-style props and OFF states', () => {
  const expected = JSON.parse(readFileSync(new URL('../design1Baseline.json', import.meta.url), 'utf8'))
  const actual = []
  for (const enabled of [true, false, undefined]) {
    const app = mount(Ladder, { ...props(), enabled })
    try { actual.push(clean(app.render())) } finally { app.unmount() }
  }
  assert.deepEqual(actual, expected.slice(6))
})

test('strict OFF rejects truthy non-booleans and performs no storage or fetch access', t => {
  for (const key of ['localStorage', 'sessionStorage', 'fetch']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('IO trap: ' + key) } })
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key])
  }
  assert.equal(opvarmStigeEnabled(), false)
  assert.equal(opvarmStigeEnabled(false, '?opvarmStige=1'), true)
  assert.equal(opvarmStigeEnabled(false, '?opvarmStige=1&opvarmStige=0'), false)
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const app = mount(Ladder, { ...props(), enabled })
    assert.equal(app.render(), null); app.unmount()
  }
  const c = clock(t), app = mount(Ladder, props())
  try {
    button(app.render(), 'Start 60 sekunders pause').props.onClick()
    assert.equal(timer(app), '60 sekunder')
    button(app.render(), 'Stop timer').props.onClick()
    assert.equal(timer(app), '0 sekunder'); assert.equal(c.active.size, 0)
  } finally { app.unmount() }
})

test('20 kg bar, symmetric loads and repeated plate multiplicities use the actual calculation', () => {
  assert.deepEqual(plateLoad(20), { weight: 20, plates: [] })
  assert.deepEqual(plateLoad(120), { weight: 120, plates: [{ kg: 25, count: 2 }] })
  assert.deepEqual(plateLoad('102,5').plates, [{ kg: 25, count: 1 }, { kg: 15, count: 1 }, { kg: 1.25, count: 1 }])
  for (let weight = 20; weight < 400; weight += 0.37) {
    const load = plateLoad(weight)
    assert.equal(load.weight, 20 + 2 * load.plates.reduce((sum, p) => sum + p.kg * p.count, 0))
    assert.ok(Math.abs(load.weight - weight) <= 1.250000001)
    assert.ok(load.plates.every(p => Number.isInteger(p.count) && p.count > 0))
  }
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']) {
    assert.deepEqual(warmupLadder(lift, 140).steps.map(s => s.weight), [20, 55, 85, 112.5, 125])
  }
})

test('invalid or missing prescriptions do not produce a ladder', () => {
  for (const weight of [null, undefined, '', '100 kg', '80-100', '80%', '1e2', {}, [], true, -5, 0, 19, NaN, Infinity]) {
    assert.equal(plateLoad(weight), null)
    const app = mount(Ladder, props(weight))
    // props(undefined) has a default parameter; explicitly replace the row.
    try { assert.equal(app.render({ ...props(), exercises: [{ name: 'Squat top', recommended_weight: weight }] }), null) }
    finally { app.unmount() }
  }
})

test('pause and mobility clicks replace deadlines, survive clock drift and stop cleanly', t => {
  const c = clock(t), app = mount(Ladder, props())
  t.after(() => app.unmount())
  button(app.render(), 'Start 60 sekunders pause').props.onClick()
  assert.equal(timer(app), '60 sekunder'); assert.equal(c.active.size, 1)
  c.advance(17500); assert.equal(timer(app), '43 sekunder')
  button(app.render(), 'Start 2 minutters mobilitet').props.onClick()
  assert.equal(timer(app), '120 sekunder'); assert.equal(c.active.size, 1)
  c.advance(130000); assert.equal(timer(app), '0 sekunder'); assert.equal(c.active.size, 0)
  button(app.render(), 'Start 60 sekunders pause').props.onClick(); app.render()
  button(app.render(), 'Stop timer').props.onClick()
  assert.equal(timer(app), '0 sekunder'); assert.equal(c.active.size, 0)
  assert.equal(timerSeconds(2000, 1001), 1); assert.equal(timerSeconds(2000, 3000), 0)
})

test('scope, plan, OFF, invalid plan and unmount release intervals and checkbox state', t => {
  const c = clock(t)
  for (const next of [{ ...props(), scope: 'new-session' }, props(180), { ...props(), enabled: false }, { ...props(), exercises: [] }, null]) {
    const app = mount(Ladder, props())
    const tree = app.render()
    nodes(tree, node => node.type === 'input')[0].props.onChange({ target: { checked: true } })
    button(tree, 'Start 60 sekunders pause').props.onClick(); app.render()
    assert.equal(c.active.size, 1)
    if (next) {
      const after = app.render(next)
      assert.ok(nodes(after, node => node.type === 'input').every(node => node.props.checked === false))
    } else app.unmount()
    assert.equal(c.active.size, 0)
    app.unmount()
  }
})

test('two mounts keep their timers and checks independent', t => {
  const c = clock(t), left = mount(Ladder, props()), right = mount(Ladder, props())
  t.after(() => { left.unmount(); right.unmount() })
  const tree = left.render(); right.render()
  nodes(tree, node => node.type === 'input')[0].props.onChange({ target: { checked: true } })
  button(tree, 'Start 60 sekunders pause').props.onClick()
  assert.equal(timer(left), '60 sekunder'); assert.equal(timer(right), '0 sekunder')
  assert.equal(nodes(right.render(), node => node.type === 'input')[0].props.checked, false)
  left.unmount(); assert.equal(c.active.size, 0)
})

test('closed registry permits this test while refusing an unlisted importer', async () => {
  const { createRegistry } = await import('../testModuleRegistry.mjs')
  const data = JSON.parse(readFileSync(new URL('../testModuleRegistry.json', import.meta.url), 'utf8'))
  const root = new URL('../../', import.meta.url), registry = createRegistry(data, root)
  for (const [specifier, target] of [['./WarmupLadderView.mjs', 'src/athlete/WarmupLadderView.mjs'], ['../opvarmStige.mjs', 'src/opvarmStige.mjs']]) {
    assert.equal(registry.lookup('src/athlete/opvarmStigeLoader.mjs', specifier, import.meta.url)?.url, new URL(target, root).href)
    assert.equal(registry.lookup('src/athlete/opvarmStigeLoader.mjs', specifier, new URL('src/athlete/Unlisted.test.js', root).href), null)
  }
})

test('new totals count physical plates for all lifts, empty bars and decimal loads', () => {
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']) {
    const app = mount(Ladder, { ...props(200), exercises: [{ name: lift + ' top', recommended_weight: 200 }] })
    try {
      const tree = app.render()
      assert.deepEqual(nodes(tree, n => n.type === 'div' && text(n).startsWith('I alt pr. side:')).map(text), [
        'I alt pr. side: 0 kg · antal skiver: 0',
        'I alt pr. side: 30 kg · antal skiver: 2',
        'I alt pr. side: 50 kg · antal skiver: 2',
        'I alt pr. side: 70 kg · antal skiver: 3',
        'I alt pr. side: 80 kg · antal skiver: 4',
      ])
      assert.ok(text(app.render(props(140))).includes('I alt pr. side: 46,25 kg · antal skiver: 3'))
    } finally { app.unmount() }
  }
})

test.after(() => hooks.deregister())
