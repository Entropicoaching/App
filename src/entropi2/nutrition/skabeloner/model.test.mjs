import test from 'node:test'
import assert from 'node:assert/strict'
import { recurringMeals, createMealTemplates } from './model.mjs'
import { createNutritionController } from '../controller.mjs'

const athleteId = 'synthetic-a', date = '2026-11-03'
const meal = { meal: 'Havre og mælk', kcal: 400, protein: 20, carb: 60, fat: 9 }
const row = (id, day = date, extra = {}) => ({ ...meal, id, athlete_id: athleteId, date: day, ...extra })
const rows = () => [row('a'), row('b', '2026-10-30'), row('c', '2026-10-21')]
const options = { athleteId, date }
function fixture(extra = {}) {
  const data = new Map(), writes = [], reads = []
  const storage = {
    getItem(key) { reads.push(key); return data.get(key) ?? null },
    setItem(key, value) { writes.push([key, value]); data.set(key, value) },
  }
  const config = { enabled: true, ...options, rows: rows(), storage, ...extra }
  return { data, writes, reads, storage, config, model: createMealTemplates(config) }
}

test('three occurrences in 14 inclusive dates qualify; two do not', () => {
  assert.equal(recurringMeals(rows().slice(0, 2), options).length, 0)
  const result = recurringMeals(rows(), options)
  assert.equal(result.length, 1)
  assert.equal(result[0].count, 3)
  assert.equal(result[0].lastDate, date)
  assert.deepEqual(result[0].meal, meal)
})

test('old, future, impossible dates and other athletes cannot qualify', () => {
  for (const extra of [
    { date: '2026-10-20' }, { date: '2026-11-04' }, { date: '2026-02-30' },
    { date: null }, { athlete_id: 'synthetic-b' }, { athlete_id: undefined },
  ]) assert.deepEqual(recurringMeals([row('a'), row('b'), row('c', date, extra)], options), [])
  assert.deepEqual(recurringMeals(rows(), { athleteId, date: '2026-02-30' }), [])
  assert.deepEqual(recurringMeals(null, options), [])
})

test('calendar range crosses year and leap-day boundaries', () => {
  for (const [end, start] of [['2027-01-03', '2026-12-21'], ['2024-03-01', '2024-02-17']]) {
    assert.equal(recurringMeals([row('a', end), row('b', start), row('c', start)], { athleteId, date: end })[0].count, 3)
  }
})

test('same content includes every nutrient; numeric formatting and whitespace normalize', () => {
  assert.equal(recurringMeals([row('a'), row('b'), row('c', date, { meal: ' Havre  og mælk ', kcal: '400,0' })], options).length, 1)
  for (const key of ['meal', 'kcal', 'protein', 'carb', 'fat']) {
    assert.equal(recurringMeals([row('a'), row('b'), row('c', date, { [key]: key === 'meal' ? 'Andet' : 1 })], options).length, 0)
  }
})

test('invalid meals and receipt rows never become suggestions', () => {
  for (const extra of [{ meal: '   ' }, { meal: ' [appData2-day-v1]synthetic' },
    { kcal: -1 }, { protein: null }, { carb: Infinity }, { fat: 'NaN' }, { meal: 'x'.repeat(1001) }]) {
    assert.deepEqual(recurringMeals(['a', 'b', 'c'].map(id => row(id, date, extra)), options), [])
  }
  assert.equal(recurringMeals(['a', 'b', 'c'].map(id => row(id, date, { kcal: 0, protein: 0, carb: 0, fat: 0 })), options).length, 1)
})

test('duplicate identities and optimistic local rows do not inflate frequency', () => {
  assert.deepEqual(recurringMeals([row('a'), row('a'), row('b'), row('local:c'), row('')], options), [])
  const data = [...rows(), row('a', date, { kcal: 401 })]
  assert.deepEqual(recurringMeals(data, options), [])
  assert.deepEqual(recurringMeals(data.reverse(), options), [])
})

test('suggestion order is deterministic and caller data stays detached', () => {
  const data = [...rows(), ...rows().map(r => ({ ...r, id: 'other-' + r.id, meal: 'Ris' }))]
  const original = structuredClone(data), a = recurringMeals(data, options)
  assert.deepEqual(a, recurringMeals([...data].reverse(), options))
  a[0].meal.meal = 'Changed'
  assert.deepEqual(data, original)
})

test('OFF is strict and has no storage access, even with invalid scope', () => {
  const storage = new Proxy({}, { get() { throw Error('must not access') } })
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(createMealTemplates({ enabled, storage }), null)
  }
  assert.throws(() => createMealTemplates({ enabled: true }), TypeError)
})

test('one-tap accept, rename, reuse and remove survive a scoped reload', () => {
  const f = fixture(), id = f.model.snapshot().suggestions[0].id
  assert.equal(f.writes.length, 0)
  assert.equal(f.model.accept(id), true)
  assert.equal(f.model.accept(id), true)
  assert.equal(f.writes.length, 1)
  assert.equal(f.model.snapshot().suggestions.length, 0)
  assert.equal(f.model.rename(id, ' Min morgenmad '), true)
  const reloaded = createMealTemplates({ ...f.config, rows: [] })
  assert.equal(reloaded.snapshot().templates[0].name, 'Min morgenmad')
  const payload = reloaded.useTemplate(id)
  assert.deepEqual(payload, meal)
  payload.kcal = 1
  const snapshot = reloaded.snapshot(); snapshot.templates[0].meal.meal = 'Changed'
  assert.deepEqual(reloaded.useTemplate(id), meal)
  assert.equal(reloaded.remove(id), true)
  assert.deepEqual(createMealTemplates(f.config).snapshot().templates, [])
  assert.ok(f.writes.every(([key]) => key === 'entropi2:nutrition:skabeloner:v1:synthetic-a'))
})

test('athlete storage keys cannot cross scope, including delimiter characters', () => {
  const f = fixture({ athleteId: 'synthetic:a/b' })
  assert.equal(f.reads[0], 'entropi2:nutrition:skabeloner:v1:synthetic%3Aa%2Fb')
  const a = fixture(), id = a.model.snapshot().suggestions[0].id
  a.model.accept(id)
  const b = createMealTemplates({ ...a.config, athleteId: 'synthetic-b' })
  assert.deepEqual(b.snapshot().templates, [])
  assert.deepEqual(b.snapshot().suggestions, [])
})

test('denied writes roll back accept, rename and remove and support retry', () => {
  const f = fixture(), id = f.model.snapshot().suggestions[0].id
  const save = f.storage.setItem
  f.storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(f.model.accept(id), false)
  assert.equal(f.model.snapshot().templates.length, 0)
  assert.ok(f.model.snapshot().error)
  f.storage.setItem = save
  assert.equal(f.model.accept(id), true)
  f.storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(f.model.rename(id, 'Changed'), false)
  assert.equal(f.model.remove(id), false)
  assert.equal(f.model.snapshot().templates[0].name, meal.meal)
  f.storage.setItem = save
  assert.equal(f.model.remove(id), true)
  assert.equal(f.model.snapshot().error, '')
})

test('missing storage, throwing getters and corrupt JSON are caught', () => {
  for (const storage of [undefined, {}, { get getItem() { throw Error('denied') } },
    { getItem() { throw Error('denied') } }, { getItem() { return '{' } }]) {
    const f = fixture({ storage }), id = f.model.snapshot().suggestions[0].id
    assert.ok(f.model.snapshot().error)
    assert.equal(f.model.accept(id), false)
    assert.deepEqual(f.model.snapshot().templates, [])
  }
})

test('invalid or oversized persisted data is rejected atomically', () => {
  const f = fixture(), id = f.model.snapshot().suggestions[0].id
  f.model.accept(id)
  const entry = f.model.snapshot().templates[0]
  for (const data of [[], { version: 2, templates: [] }, { version: 1, templates: [entry, entry] },
    { version: 1, templates: [entry, { ...entry, id: 'forged' }] },
    { version: 1, templates: [{ ...entry, name: ' ' }] },
    { version: 1, templates: Array(101).fill(entry) }]) {
    const model = createMealTemplates({ ...f.config, storage: { getItem: () => JSON.stringify(data) } })
    assert.deepEqual(model.snapshot().templates, [])
    assert.ok(model.snapshot().error)
  }
  assert.ok(createMealTemplates({ ...f.config, storage: { getItem: () => ' '.repeat(250001) } }).snapshot().error)
})

test('unknown ids, invalid names and snapshot mutations cannot write', () => {
  const f = fixture(), id = f.model.snapshot().suggestions[0].id
  assert.equal(f.model.accept('unknown'), false)
  assert.equal(f.model.rename(id, 'Name'), false)
  assert.equal(f.model.remove(id), false)
  assert.equal(f.model.useTemplate(id), null)
  f.model.snapshot().suggestions[0].meal.kcal = 1
  f.model.accept(id)
  for (const name of ['', ' ', 'x'.repeat(81), null, 3]) assert.equal(f.model.rename(id, name), false)
  assert.deepEqual(f.model.useTemplate(id), meal)
  assert.equal(f.writes.length, 1)
})

test('one reused payload works with the actual copied nutrition log action', async () => {
  const f = fixture(), id = f.model.snapshot().suggestions[0].id, saved = []
  f.model.accept(id)
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    storage: { getItem: () => null },
    contracts: { load: async () => [], save: async payload => { saved.push(payload); return true } } })
  await controller.load()
  assert.equal(await controller.log(f.model.useTemplate(id), 'synthetic-intent'), true)
  assert.deepEqual(saved, [{ ...meal, athlete_id: athleteId, date }])
  assert.equal(controller.snapshot().logs.length, 1)
  assert.equal(f.writes.length, 1)
})

test('100-template bound rejects another acceptance without writing', () => {
  const history = Array.from({ length: 101 }, (_, i) => ['a', 'b', 'c'].map(suffix =>
    row(`${i}-${suffix}`, date, { meal: `Synthetic ${i}` }))).flat()
  const f = fixture({ rows: history }), candidates = f.model.snapshot().suggestions
  for (const item of candidates.slice(0, 100)) assert.equal(f.model.accept(item.id), true)
  assert.equal(f.model.accept(candidates[100].id), false)
  assert.equal(f.writes.length, 100)
  assert.equal(createMealTemplates(f.config).snapshot().templates.length, 100)
})

test('throwing setItem property access is caught without a state change', () => {
  const f = fixture({ storage: { getItem: () => null, get setItem() { throw Error('denied') } } })
  assert.equal(f.model.accept(f.model.snapshot().suggestions[0].id), false)
  assert.equal(f.model.snapshot().templates.length, 0)
  assert.ok(f.model.snapshot().error)
})
