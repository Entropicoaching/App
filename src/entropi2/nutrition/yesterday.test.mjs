import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic-yesterday'
const meal = { meal: 'Synthetic breakfast', kcal: 300, protein: 20, carb: 40, fat: 8 }
const row = (extra = {}) => ({ athlete_id: id, date: '2026-11-02', ...meal, ...extra })
function fixture(rows = [], { date = '2026-11-03', save = async () => true, load = async () => rows } = {}) {
  const calls = { loads: [], saves: [], storage: [] }
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    storage: { getItem() { return null }, setItem(...args) { calls.storage.push(args) } },
    contracts: {
      async load(...args) { calls.loads.push(args); return load(...args) },
      async save(value) { calls.saves.push({ ...value }); return save(value) },
    },
  })
  return { controller, calls }
}
async function mounted(t, rows, options) {
  const f = fixture(rows, options), host = syntheticHost()
  const cleanup = mountNutrition(host, f.controller)
  t.after(cleanup)
  await flush()
  return { ...f, host }
}
const repeat = host => host.querySelectorAll('button').filter(b => b.textContent.startsWith('Log igen: '))

test('yesterday: no meals hides section, including valid meals from other days', async t => {
  for (const rows of [[], [row({ date: '2026-11-03' }), row({ date: '2026-11-01' })]]) {
    const { controller, host, calls } = await mounted(t, rows)
    assert.deepEqual(controller.snapshot().yesterday, [])
    assert.equal(find(host, 'h2', 'Gentag i går'), undefined)
    assert.equal(repeat(host).length, 0)
    assert.ok(find(host, 'h2', 'Favoritter'))
    assert.equal(calls.loads.length, 1)
    assert.deepEqual(calls.saves, [])
    assert.deepEqual(calls.storage, [])
  }
})

test('yesterday: receipts, blank names and invalid nutrients never become repeat buttons', async t => {
  const invalid = [
    row({ meal: '[appData2-day-v1]receipt' }), row({ meal: '  [appData2-day-v1]receipt' }),
    row({ meal: '' }), row({ meal: '  ' }), row({ meal: null }),
    ...['kcal', 'protein', 'carb', 'fat'].flatMap(key =>
      [null, undefined, '', -1, Infinity, NaN, 'bad'].map(value => row({ [key]: value }))),
  ]
  const empty = await mounted(t, invalid)
  assert.deepEqual(empty.controller.snapshot().yesterday, [])
  assert.equal(find(empty.host, 'h2', 'Gentag i går'), undefined)
  const valid = row({ meal: 'Synthetic zero', kcal: '0', protein: '0', carb: '0', fat: '0' })
  const { controller, host } = await mounted(t, [...invalid, row(), valid])
  assert.deepEqual(controller.snapshot().yesterday, [meal, { meal: 'Synthetic zero', kcal: 0, protein: 0, carb: 0, fat: 0 }])
  assert.equal(repeat(host).length, 2)
})

test('yesterday: chronological order, normalized mealKey dedupe, unchanged existing newest-first fields', async t => {
  const rows = [
    row({ meal: 'Synthetic lunch', created_at: '2026-11-02T12:00:00Z' }),
    row({ kcal: '300', created_at: '2026-11-02T10:00:00Z' }),
    row({ created_at: '2026-11-02T08:00:00Z' }),
    row({ kcal: 301, created_at: '2026-11-02T09:00:00Z' }),
    row({ date: '2026-11-03', meal: 'Synthetic today' }),
  ]
  const original = structuredClone(rows)
  const { controller, host } = await mounted(t, rows)
  const s = controller.snapshot()
  assert.deepEqual(s.yesterday, [meal, { ...meal, kcal: 301 }, { ...meal, meal: 'Synthetic lunch' }])
  assert.equal(new Set(s.yesterday.map(mealKey)).size, 3)
  assert.deepEqual(s.historyRows.map(r => r.meal), ['Synthetic today', 'Synthetic lunch', meal.meal, meal.meal, meal.meal])
  assert.equal(s.recent[0].meal, 'Synthetic today')
  assert.deepEqual(s.logs.map(r => r.meal), ['Synthetic today'])
  assert.deepEqual(rows, original)
  const headings = host.querySelectorAll('h2').map(n => n.textContent)
  assert.equal(headings.indexOf('Gentag i går') + 1, headings.indexOf('Favoritter'))
  assert.deepEqual(repeat(host).map(n => n.textContent), s.yesterday.map(m => 'Log igen: ' + m.meal))
})

test('yesterday: equal or missing timestamps retain loaded relative order', async () => {
  const { controller } = fixture([row({ meal: 'Synthetic first' }), row({ meal: 'Synthetic second' }), row()])
  await controller.load()
  assert.deepEqual(controller.snapshot().yesterday.map(m => m.meal), ['Synthetic first', 'Synthetic second', meal.meal])
  controller.dispose()
})

for (const [date, previous] of [
  ['2026-12-01', '2026-11-30'], ['2027-01-01', '2026-12-31'],
  ['2028-03-01', '2028-02-29'], ['2027-03-01', '2027-02-28'],
  ['2026-03-30', '2026-03-29'],
]) {
  test('yesterday calendar boundary: ' + date, async t => {
    const { controller, host, calls } = await mounted(t, [row({ date: previous }), row({ date, meal: 'Synthetic current' })], { date })
    assert.deepEqual(controller.snapshot().yesterday, [meal])
    await repeat(host)[0].fire('click')
    await flush()
    assert.deepEqual(calls.loads, [[id, date]])
    assert.deepEqual(calls.saves, [{ athlete_id: id, date, ...meal }])
    assert.equal(controller.snapshot().logs.length, 2)
  })
}

test('yesterday: snapshots are copies and the complete day is not limited by recent twenty', async () => {
  const rows = Array.from({ length: 25 }, (_, i) => row({ meal: 'Synthetic ' + i }))
  const { controller } = fixture(rows)
  await controller.load()
  const s = controller.snapshot()
  assert.equal(s.recent.length, 20)
  assert.equal(s.yesterday.length, 25)
  s.yesterday[0].meal = 'mutated'; s.yesterday[0].kcal = 999; s.yesterday.pop()
  const next = controller.snapshot()
  assert.equal(next.yesterday.length, 25)
  assert.deepEqual(next.yesterday[0], { ...meal, meal: 'Synthetic 0' })
  assert.equal(rows[0].meal, 'Synthetic 0')
  controller.dispose()
})

test('yesterday: actual controller.log gets fresh intents; in-flight double click saves once', async t => {
  let resolve
  const gate = new Promise(r => { resolve = r })
  const { controller, host, calls } = await mounted(t, [row()], { save: () => gate })
  const log = controller.log, intents = []
  controller.log = (value, intent) => { intents.push(intent); return log(value, intent) }
  const first = repeat(host)[0]
  const clicking = first.fire('click')
  await first.fire('click') // A stale pre-render node still reaches the controller's guard.
  assert.equal(controller.snapshot().phase, 'saving')
  assert.equal(repeat(host)[0].disabled, true)
  await repeat(host)[0].fire('click')
  assert.equal(calls.saves.length, 1)
  assert.equal(controller.snapshot().logs.length, 0)
  resolve(true); await clicking; await flush()
  assert.deepEqual(calls.saves, [{ athlete_id: id, date: '2026-11-03', ...meal }])
  assert.equal(controller.snapshot().logs.length, 1)
  assert.equal(repeat(host)[0].disabled, false)
  await repeat(host)[0].fire('click'); await flush()
  assert.equal(calls.saves.length, 2)
  assert.equal(controller.snapshot().logs.length, 2)
  assert.equal(new Set(intents).size, intents.length)
  assert.equal(intents.length, 3)
  assert.equal(calls.loads.length, 1)
  assert.deepEqual(calls.storage, [])
})

test('yesterday: failed repeat keeps diary unchanged and permits deliberate retry', async t => {
  let success = false
  const { controller, host, calls } = await mounted(t, [row()], { save: async () => success })
  await repeat(host)[0].fire('click'); await flush()
  assert.equal(controller.snapshot().phase, 'save-error')
  assert.deepEqual(controller.snapshot().logs, [])
  assert.deepEqual(controller.snapshot().yesterday, [meal])
  success = true
  await repeat(host)[0].fire('click'); await flush()
  assert.equal(controller.snapshot().logs.length, 1)
  assert.equal(calls.saves.length, 2)
})

test('yesterday: failed load stays hidden and strict OFF leaves the host untouched', async t => {
  const { controller } = fixture([], { load: async () => { throw new Error('synthetic load failure') } })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup)
  await flush()
  assert.equal(controller.snapshot().phase, 'load-error')
  assert.equal(find(host, 'h2', 'Gentag i går'), undefined)
  for (const enabled of [undefined, false, 1, 'true']) {
    const off = createNutritionController({ enabled })
    assert.equal(off, null)
    const inert = syntheticHost(); inert.textContent = 'synthetic legacy'
    mountNutrition(inert, off)()
    assert.equal(inert.textContent, 'synthetic legacy')
  }
})
