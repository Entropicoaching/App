import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fremgangLoader.mjs'
install()
const { compareBlocks, renderBlockComparison, DEFAULT_BLOK_FREMGANG } = await import('./blokFremgang.mjs')
const { estimatedOneRepMax } = await import('./exerciseProgress.js')
const { createElement, mount, find } = await import('./fremgangSynthetic.mjs')
const { options, logs, weeks, today, log } = await import('./fremgangFixtures.mjs')
const dom = o => mount(renderBlockComparison(createElement, o))
const value = (tree, attr, key = 'squat') => find(tree, attr).find(e => e.attrs[attr] === key).textContent
const snapshot = tree => ({ tag: tree.tagName, text: tree.ownText,
  attrs: Object.fromEntries(Object.entries(tree.attrs).filter(([k, v]) => k !== 'children' && typeof v !== 'function')),
  children: tree.children.map(snapshot) })

test('default OFF and strict opt in never read program or logs', () => {
  assert.equal(DEFAULT_BLOK_FREMGANG, false)
  const poison = new Proxy({}, { get() { throw Error('Unexpected data access') } })
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(renderBlockComparison(createElement, { enabled, weeks: poison, logs: poison }), null)
  }
})

test('two blocks show all four exact main lifts side by side using existing 1RM', () => {
  const rows = Array.from({ length: 4 }, (_, k) => logs.map(l => log(Number(l.exercise_id[1]), l.logged_at.slice(0, 10), l.weight + k * 10, k))).flat()
  const o = { ...options, logs: rows }, tree = dom(o), model = compareBlocks(o)
  assert.equal(find(tree, 'data-blok-loeft').length, 4)
  for (const lift of model.lifts) {
    assert.equal(lift.now.e1rm, Math.round(estimatedOneRepMax(lift.now.weight, lift.now.reps)))
    assert.equal(value(tree, 'data-blok-nu', lift.key), `${lift.now.e1rm} kg`)
    assert.equal(value(tree, 'data-blok-foer', lift.key), `${lift.before.e1rm} kg`)
    assert.equal(value(tree, 'data-blok-forskel', lift.key), `+${lift.delta} kg`)
  }
  const table = tree.children[1].children.find(c => c.tagName === 'table')
  assert.ok(table)
  assert.equal(table.children[1].children[0].children.filter(c => c.attrs.scope === 'col').length, 4)
  assert.match(tree.textContent, /115 kg × 3/)
})

test('one current block retains its estimate and shows dashes for previous and difference', () => {
  const o = { ...options, weeks: weeks.slice(2) }, tree = dom(o), model = compareBlocks(o)
  assert.equal(model.status, 'known')
  assert.equal(model.previous, null)
  assert.equal(model.lifts[0].before, null)
  assert.equal(value(tree, 'data-blok-nu'), '127 kg')
  assert.equal(value(tree, 'data-blok-foer'), '-')
  assert.equal(value(tree, 'data-blok-forskel'), '-')
})

test('block without heavy sets never replaces missing estimate with zero', () => {
  for (const currentEmpty of [true, false]) {
    const rows = logs.map((l, i) => (i >= 2) === currentEmpty ? { ...l, reps_completed: 12 } : l)
    const tree = dom({ ...options, logs: rows })
    assert.equal(value(tree, currentEmpty ? 'data-blok-nu' : 'data-blok-foer'), '-')
    assert.equal(value(tree, currentEmpty ? 'data-blok-foer' : 'data-blok-nu'), currentEmpty ? '116 kg' : '127 kg')
    assert.equal(value(tree, 'data-blok-forskel'), '-')
    assert.doesNotMatch(tree.textContent, /NaN|Infinity|\b0 kg\b/)
  }
  const empty = dom({ ...options, logs: [] })
  assert.equal(find(empty, 'data-blok-nu').every(e => e.textContent === '-'), true)
})

test('one training day remains insufficient; difference can be negative or zero', () => {
  const tree = dom({ ...options, logs: [logs[0], logs[1], logs[2], { ...logs[2], weight: 200 }] })
  assert.equal(value(tree, 'data-blok-nu'), '-')
  assert.equal(value(tree, 'data-blok-foer'), '116 kg')
  const equal = dom({ ...options, logs: logs.map(l => ({ ...l, weight: 100 })) })
  assert.equal(value(equal, 'data-blok-forskel'), '0 kg')
  const down = dom({ ...options, logs: logs.map((l, i) => ({ ...l, weight: i < 2 ? 120 : 100 })) })
  assert.equal(value(down, 'data-blok-forskel'), '-22 kg')
})

test('actual athlete components mount the card only in the allowed strength view', async () => {
  const NativeDate = Date
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00Z'])) } }
  try {
    const props = { allWeeks: weeks, fremgangLogs: logs, currentWeek: weeks[3], exerciseLogs: [] }
    for (const file of ['FremgangTab.jsx', 'EnkelFremgangTab.jsx']) {
      const View = (await import('./' + file)).default
      const render = p => mount(createElement(View, { ...props, ...p }))
      const off = render({}), explicitOff = render({ blokFremgang: false })
      assert.deepEqual(snapshot(explicitOff), snapshot(off))
      assert.equal(find(off, 'data-blok-fremgang').length, 0)
      assert.equal(value(render({ blokFremgang: true, enkelDel: 'styrke' }), 'data-blok-nu'), '127 kg')
      assert.equal(find(render({ blokFremgang: true, fremgangLoading: true }), 'data-blok-fremgang').length, 0)
      if (file.startsWith('Enkel')) assert.equal(find(render({ blokFremgang: true, enkelDel: 'rekorder' }), 'data-blok-fremgang').length, 0)
    }
  } finally { globalThis.Date = NativeDate }
})
