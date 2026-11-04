import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeekPlan, weekStart } from './model.mjs'
import { createMealTemplates } from '../skabeloner/model.mjs'

const template = { id: 'own:1', name: 'Min skål', meal: { meal: 'Skål', kcal: 400, protein: 25 },
  ingredients: [{ name: 'Havre', quantity: 50, unit: 'g' }] }
function memory() {
  const data = new Map(), calls = []
  return { data, calls, getItem(key) { calls.push(['read', key]); return data.get(key) ?? null },
    setItem(key, value) { calls.push(['write', key]); data.set(key, value) } }
}
const options = storage => ({ enabled: true, athleteId: 'synthetic:a', date: '2026-11-04',
  templates: [structuredClone(template)], targets: { kcal: 2000, protein: 120 }, storage })

test('strict OFF does not read supplied inputs or storage', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true', {}]) {
    const input = { enabled, get athleteId() { throw Error('OFF read') } }
    assert.equal(createWeekPlan(input), null)
  }
})

test('calendar week is Monday to Sunday across leap day and year boundary', () => {
  assert.equal(weekStart('2026-11-08'), '2026-11-02')
  assert.equal(weekStart('2027-01-01'), '2026-12-28')
  assert.equal(weekStart('2024-02-29'), '2024-02-26')
  for (const invalid of ['2026-02-29', '2026-11-04T00:00:00Z', '0000-01-01', '9999-12-31', '', null]) assert.throws(() => weekStart(invalid))
  const plan = createWeekPlan(options(memory()))
  assert.deepEqual(plan.snapshot().days.map(day => day.date), [2, 3, 4, 5, 6, 7, 8].map(n => `2026-11-0${n}`))
})

test('empty plan has unknown totals, explicit goals, no shopping and no mount writes', () => {
  const storage = memory(), plan = createWeekPlan(options(storage)), state = plan.snapshot()
  assert.equal(storage.calls.length, 1)
  assert.equal(state.saved, false)
  assert.deepEqual(state.days[0].totals, { kcal: null, protein: null })
  assert.deepEqual(state.days[0].targets, { kcal: 2000, protein: 120 })
  assert.deepEqual(state.shopping.items, [])
  assert.equal(state.shopping.selectedCount, 0)
})

test('repeated portions sum across days through actual shopping module, remove one occurrence', () => {
  const storage = memory(), plan = createWeekPlan(options(storage))
  assert.equal(plan.add(0, template.id), true)
  plan.add(0, template.id); plan.add(6, template.id)
  let state = plan.snapshot()
  assert.deepEqual(state.days[0].totals, { kcal: 800, protein: 50 })
  assert.deepEqual(state.days[6].totals, { kcal: 400, protein: 25 })
  assert.deepEqual(state.shopping.items, [{ name: 'Havre', quantity: 150, unit: 'g' }])
  assert.equal(state.shopping.selectedCount, 3)
  assert.equal(plan.remove(0, 0), true)
  state = plan.snapshot()
  assert.equal(state.shopping.items[0].quantity, 100)
  assert.equal(state.days[0].entries.length, 1)
  assert.deepEqual(createWeekPlan(options(storage)).snapshot(), state)
})

test('draft namespace isolates athlete and week; persisted payload contains only planned IDs', () => {
  const storage = memory(), opts = options(storage), plan = createWeekPlan(opts)
  plan.add(0, template.id)
  const [key, raw] = [...storage.data][0]
  assert.equal(key, 'entropi2:nutrition:ugeplan:v1:synthetic%3Aa:2026-11-02')
  assert.deepEqual(JSON.parse(raw), { version: 1, week: '2026-11-02', days: [[template.id], [], [], [], [], [], []] })
  for (const change of [{ athleteId: 'synthetic:b' }, { date: '2026-11-09' }]) {
    assert.equal(createWeekPlan({ ...opts, ...change }).snapshot().days[0].entries.length, 0)
  }
  assert.equal(createWeekPlan({ ...opts, date: '2026-11-08' }).snapshot().days[0].entries.length, 1)
})

test('missing ingredients and removed templates stay visibly incomplete, removable and never inferred', () => {
  const storage = memory(), opts = options(storage)
  const plan = createWeekPlan({ ...opts, templates: [{ ...template, ingredients: undefined }] })
  plan.add(0, template.id)
  assert.equal(plan.snapshot().shopping.missingMeals.length, 1)
  assert.deepEqual(plan.snapshot().shopping.items, [])
  const missing = createWeekPlan({ ...opts, templates: [] })
  assert.equal(missing.snapshot().days[0].entries[0].missing, true)
  assert.equal(missing.snapshot().days[0].totals.kcal, null)
  assert.equal(missing.snapshot().shopping.unavailableCount, 1)
  assert.equal(missing.remove(0, 0), true)
})

test('unknown macros, zero macros and missing/zero goals are distinct; overflow is not a total', () => {
  const opts = options(memory())
  const plan = createWeekPlan({ ...opts, targets: { kcal: 0 }, templates: [
    { ...template, meal: { meal: 'Skål', kcal: 0, protein: '' } },
  ] })
  plan.add(1, template.id)
  assert.deepEqual(plan.snapshot().days[1].totals, { kcal: 0, protein: null })
  assert.deepEqual(plan.snapshot().days[1].targets, { kcal: null, protein: null })
  const huge = createWeekPlan({ ...options(memory()), templates: [{ ...template,
    meal: { meal: 'Skål', kcal: Number.MAX_VALUE, protein: 1 } }] })
  huge.add(0, template.id); huge.add(0, template.id)
  assert.equal(huge.snapshot().days[0].totals.kcal, null)
})

test('failed writes retain last saved plan and support retry', () => {
  const storage = memory(), original = storage.setItem.bind(storage), plan = createWeekPlan(options(storage))
  plan.add(0, template.id)
  storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(plan.add(1, template.id), false)
  assert.equal(plan.remove(0, 0), false)
  assert.equal(plan.snapshot().days[0].entries.length, 1)
  assert.equal(plan.snapshot().days[1].entries.length, 0)
  assert.match(plan.snapshot().error, /ikke gemt/)
  storage.setItem = original
  assert.equal(plan.add(1, template.id), true)
  assert.equal(plan.snapshot().error, '')
})

test('unreadable and malformed storage is never silently overwritten', () => {
  for (const raw of ['{', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1,
    week: '2026-11-02', days: [[], [], [], [], [], [], ['']] }), 'x'.repeat(250001)]) {
    const storage = memory(), key = 'entropi2:nutrition:ugeplan:v1:synthetic%3Aa:2026-11-02'
    storage.data.set(key, raw)
    const plan = createWeekPlan(options(storage))
    assert.equal(plan.snapshot().readFailed, true)
    assert.equal(plan.add(0, template.id), false)
    assert.equal(storage.data.get(key), raw)
    assert.equal(storage.calls.filter(([op]) => op === 'write').length, 0)
  }
  const plan = createWeekPlan({ ...options(undefined) })
  assert.match(plan.snapshot().error, /ikke læses/)
})

test('invalid selections do not write; daily cap is 20; malformed ingredient errors do not invent lists', () => {
  const storage = memory(), plan = createWeekPlan(options(storage))
  for (const day of [-1, 7, 0.5, '0', null]) assert.equal(plan.add(day, template.id), false)
  assert.equal(plan.add(0, 'foreign'), false)
  assert.equal(plan.remove(0, 0), false)
  assert.equal(storage.data.size, 0)
  for (let i = 0; i < 20; i++) assert.equal(plan.add(0, template.id), true)
  assert.equal(plan.add(0, template.id), false)
  const bad = createWeekPlan({ ...options(memory()), templates: [{ ...template,
    ingredients: [{ name: 'Havre', quantity: -1, unit: 'g' }] }] })
  bad.add(0, template.id)
  assert.match(bad.snapshot().shopping.error, /ikke beregnes/)
  assert.deepEqual(bad.snapshot().shopping.items, [])
})

test('inputs and snapshots are detached; invalid template catalog fails closed', () => {
  const opts = options(memory()), plan = createWeekPlan(opts)
  opts.templates[0].meal.kcal = 900
  opts.templates[0].ingredients[0].quantity = 500
  opts.targets.kcal = 900
  plan.add(0, template.id)
  const state = plan.snapshot()
  state.days[0].entries.pop(); state.templates.pop(); state.shopping.items[0].quantity = 1
  assert.equal(plan.snapshot().days[0].totals.kcal, 400)
  assert.equal(plan.snapshot().days[0].targets.kcal, 2000)
  assert.equal(plan.snapshot().shopping.items[0].quantity, 50)
  for (const templates of [null, [template, template], [{ ...template, id: '' }], [{ ...template, meal: {} }]]) {
    assert.throws(() => createWeekPlan({ ...options(memory()), templates }), /Skabeloner/)
  }
})

test('actual saved own-template snapshot works without invented ingredients', () => {
  const storage = memory(), athleteId = 'synthetic:templates', date = '2026-11-04'
  const rows = ['a', 'b', 'c'].map(id => ({ id: `synthetic:${id}`, athlete_id: athleteId, date,
    meal: 'Min skål', kcal: 400, protein: 25, carb: 50, fat: 10 }))
  const library = createMealTemplates({ enabled: true, athleteId, date, rows, storage })
  const id = library.snapshot().suggestions[0].id
  assert.equal(library.accept(id), true)
  const plan = createWeekPlan({ enabled: true, athleteId, date, storage, templates: library.snapshot().templates })
  assert.equal(plan.add(0, id), true)
  assert.deepEqual(plan.snapshot().days[0].totals, { kcal: 400, protein: 25 })
  assert.equal(plan.snapshot().shopping.missingMeals.length, 1)
  assert.deepEqual(plan.snapshot().shopping.items, [])
})
