import test from 'node:test'
import assert from 'node:assert/strict'
import { createMealTemplates, recurringMeals } from './skabeloner/model.mjs'
import { createNutritionController } from './controller.mjs'

const athleteId = 'synthetic:diary', date = '2026-11-07'
const meal = { meal: 'Havre og mælk', kcal: 400, protein: 20, carb: 60, fat: 9 }
const row = { ...meal, id: 'persisted-one', athlete_id: athleteId, date }
const id = JSON.stringify([meal.meal, meal.kcal, meal.protein, meal.carb, meal.fat])
const key = 'entropi2:nutrition:skabeloner:v1:' + encodeURIComponent(athleteId)
function store() {
  const data = new Map(), writes = []
  return { data, writes, storage: { getItem: k => data.get(k) ?? null,
    setItem(k, v) { writes.push(k); data.set(k, v) } } }
}
const config = f => ({ enabled: true, athleteId, date, rows: [row], storage: f.storage })

test('pinned lead: ONE persisted meal saves explicitly into existing local template identity, without consumption', async () => {
  const f = store(), backend = []
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage: f.storage,
    contracts: { load: async () => [row], save: async v => { backend.push(v); return true } } })
  try {
    await c.load()
    assert.deepEqual(c.snapshot().mealTemplates.suggestions, [])
    assert.equal(f.writes.length, 0)
    const before = c.snapshot()
    assert.equal(c.saveMealAsTemplate(row.id), true)
    assert.deepEqual(c.weekPlanInputs().templates, [{ id, name: meal.meal, meal }])
    assert.deepEqual(c.snapshot().logs, before.logs)
    assert.deepEqual(c.snapshot().totals, before.totals)
    assert.deepEqual(backend, [])
    assert.deepEqual(f.writes, [key])
  } finally { c.dispose() }
})


test('diary source uses existing normalization/identity and remains detached; recurring suggestions unchanged', () => {
  const f = store(), input = { ...row, meal: ' Havre  og mælk ', kcal: '400,0' }
  const m = createMealTemplates({ ...config(f), rows: [input] })
  input.kcal = 999
  assert.deepEqual(m.snapshot().diaryIds, [row.id])
  assert.equal(m.saveFromDiary(row.id), 'stored')
  assert.equal(m.snapshot().templates[0].id, id)
  m.snapshot().templates[0].meal.kcal = 1
  assert.deepEqual(m.useTemplate(id), meal)
  assert.equal(m.saveFromDiary({ ...row }), false)
  const history = [row, { ...row, id: 'second' }, { ...row, id: 'third', date: '2026-10-25' }]
  assert.equal(recurringMeals(history, { athleteId, date })[0].id, id)
  const recurring = createMealTemplates({ ...config(store()), rows: history })
  assert.equal(recurring.accept(id), true)
  assert.equal(recurring.saveFromDiary(row.id), 'duplicate')
})

test('missing/invalid/unknown macros and receipt names cannot be saved; known zero is valid', () => {
  for (const metric of ['kcal', 'protein', 'carb', 'fat']) for (const value of [undefined, null, '', ' ', 'unknown', 'NaN', NaN, Infinity, -1, true, [], {}]) {
    const f = store(), m = createMealTemplates({ ...config(f), rows: [{ ...row, [metric]: value }] })
    assert.deepEqual(m.snapshot().diaryIds, [], metric + ':' + String(value))
    assert.equal(m.saveFromDiary(row.id), false); assert.equal(f.writes.length, 0)
  }
  for (const name of ['', '  ', '[appData2-day-v1]synthetic', '  [appData2-day-v1]synthetic', 'x'.repeat(1001)]) {
    const f = store(), m = createMealTemplates({ ...config(f), rows: [{ ...row, meal: name }] })
    assert.equal(m.saveFromDiary(row.id), false); assert.equal(f.writes.length, 0)
  }
  const f = store(), m = createMealTemplates({ ...config(f), rows: [{ ...row, kcal: 0, protein: '0', carb: 0, fat: '0,0' }] })
  assert.equal(m.saveFromDiary(row.id), 'stored')
  assert.equal(m.snapshot().templates[0].meal.fat, 0)
})

test('foreign/date/local/missing/conflicting identities fail closed, including invalid copies of a valid row', () => {
  for (const rows of [[], null, [{ ...row, athlete_id: 'other' }], [{ ...row, date: '2026-11-06' }],
    [{ ...row, id: 'local:unconfirmed' }], [{ ...row, id: '' }], [{ ...row, id: null }],
    [row, row], [row, { ...row, kcal: 401 }], [row, { ...row, fat: null }],
    [row, { ...row, athlete_id: 'other' }], [row, { ...row, date: '2026-11-06' }]]) {
    const f = store(), m = createMealTemplates({ ...config(f), rows })
    assert.deepEqual(m.snapshot().diaryIds, [])
    assert.equal(m.saveFromDiary(row.id), false)
    assert.equal(m.saveFromDiary('local:unconfirmed'), false)
    assert.equal(f.writes.length, 0)
  }
})

test('duplicate preserves user-renamed name and explicit ingredients, including a current external duplicate', () => {
  const f = store(), m = createMealTemplates(config(f))
  assert.equal(m.saveFromDiary(row.id), 'stored')
  assert.equal(m.rename(id, 'Min egen morgenmad'), true)
  const ingredients = [{ name: 'Havre', quantity: 75, unit: 'g', source: 'synthetic' }]
  assert.equal(m.setIngredients(id, ingredients), true)
  const earlier = f.data.get(key), count = f.writes.length
  assert.equal(m.saveFromDiary(row.id), 'duplicate')
  assert.equal(f.writes.length, count); assert.equal(f.data.get(key), earlier)
  const stale = createMealTemplates(config(f))
  const current = JSON.parse(earlier); current.templates[0].name = 'Senere navn'
  current.templates[0].ingredients[0].quantity = 90
  f.data.set(key, JSON.stringify(current))
  assert.equal(stale.saveFromDiary(row.id), 'duplicate')
  assert.deepEqual(stale.snapshot().templates, current.templates)
  assert.equal(f.writes.length, count)
})

test('write error and read error retry on same model without claiming success or overwriting unread data', () => {
  const f = store(), originalSet = f.storage.setItem, originalGet = f.storage.getItem
  const m = createMealTemplates(config(f))
  f.storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(m.saveFromDiary(row.id), false)
  assert.deepEqual(m.snapshot().templates, []); assert.match(m.snapshot().error, /ikke gemt/)
  f.storage.setItem = originalSet
  assert.equal(m.saveFromDiary(row.id), 'stored')
  const raw = f.data.get(key), count = f.writes.length
  f.storage.getItem = () => { throw Error('synthetic denied read') }
  assert.equal(m.saveFromDiary(row.id), false)
  assert.match(m.snapshot().error, /ikke læses/); assert.equal(f.data.get(key), raw)
  f.storage.getItem = originalGet
  assert.equal(m.saveFromDiary(row.id), 'duplicate'); assert.equal(m.snapshot().error, '')
  assert.equal(f.writes.length, count)
  for (const bad of ['{', JSON.stringify({ version: 2, templates: [] }), 'x'.repeat(250001)]) {
    f.data.set(key, bad); assert.equal(m.saveFromDiary(row.id), false)
    assert.equal(f.data.get(key), bad); assert.equal(f.writes.length, count)
  }
  f.data.set(key, raw); assert.equal(m.saveFromDiary(row.id), 'duplicate')
  const inaccessible = createMealTemplates({ ...config(f), storage: { get getItem() { throw Error('denied') } } })
  assert.equal(inaccessible.saveFromDiary(row.id), false)
})

test('initial denied read recovers through same explicit action; missing storage never passes', () => {
  const f = store(), originalGet = f.storage.getItem
  f.storage.getItem = () => { throw Error('initial denied') }
  const m = createMealTemplates(config(f))
  assert.equal(m.saveFromDiary(row.id), false)
  f.storage.getItem = originalGet
  assert.equal(m.saveFromDiary(row.id), 'stored')
  for (const storage of [undefined, {}, { getItem: () => null }, { getItem: () => null, get setItem() { throw Error('denied') } }]) {
    const model = createMealTemplates({ ...config(f), storage })
    assert.equal(model.saveFromDiary(row.id), false); assert.equal(model.snapshot().templates.length, 0)
  }
})

test('controller revalidates loaded source and blocks arbitrary data, load failure, foreign results, midnight and disposal', async () => {
  const f = store(); let loaded = [row], day = date
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage: f.storage,
    currentDay: () => day, contracts: { load: async () => loaded } })
  assert.equal(c.saveMealAsTemplate(row.id), false)
  await c.load()
  assert.equal(c.saveMealAsTemplate({ ...row }), false)
  assert.equal(c.saveMealAsTemplate('foreign'), false)
  day = '2026-11-08'; assert.equal(c.saveMealAsTemplate(row.id), false); day = date
  loaded = [row, { ...row, protein: null }]; await c.load()
  assert.equal(c.saveMealAsTemplate(row.id), false)
  loaded = [{ ...row, athlete_id: 'other' }]; assert.equal(await c.load(), false)
  assert.equal(c.saveMealAsTemplate(row.id), false); assert.equal(f.writes.length, 0)
  loaded = [{ ...row, kcal: 500 }]; await c.load()
  assert.equal(c.saveMealAsTemplate(row.id), true)
  assert.equal(c.weekPlanInputs().templates[0].meal.kcal, 500)
  assert.equal(c.snapshot().templateSave.status, 'stored')
  c.dispose(); assert.equal(c.saveMealAsTemplate(row.id), false)
})

test('loading and pending server work cannot save templates; late response after disposal stays inert', async () => {
  const f = store(); let finishLoad, finishSave
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage: f.storage,
    contracts: { load: () => new Promise(resolve => { finishLoad = resolve }), save: () => new Promise(resolve => { finishSave = resolve }) } })
  const loading = c.load(); assert.equal(c.saveMealAsTemplate(row.id), false)
  finishLoad([row]); await loading
  const saving = c.log(meal, 'only-test-pending')
  assert.equal(c.saveMealAsTemplate(row.id), false); assert.equal(f.writes.length, 0)
  finishSave(false); await saving
  assert.equal(c.saveMealAsTemplate(row.id), true)
  const loadingAgain = c.load(); c.dispose(); finishLoad([row]); assert.equal(await loadingAgain, false)
  assert.equal(c.saveMealAsTemplate(row.id), false); assert.equal(f.writes.length, 1)
})

test('strict OFF and empty diary never read/write for action; no automatic storage on snapshots', async () => {
  const poison = new Proxy({}, { get() { throw Error('OFF touched dependency') } })
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(createMealTemplates({ enabled, storage: poison }), null)
    assert.equal(createNutritionController({ enabled, storage: poison, contracts: poison }), null)
  }
  const f = store(), c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    storage: f.storage, contracts: { load: async () => [] } })
  try {
    await c.load(); for (let i = 0; i < 3; i++) { c.snapshot(); c.weekPlanInputs() }
    assert.equal(c.saveMealAsTemplate(row.id), false); assert.equal(f.writes.length, 0)
  } finally { c.dispose() }
})
