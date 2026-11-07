// Second-pass same-engine Codex review checks. This is not a fresh native K review.
// Independently chosen synthetic cases exercise the exact copied product modules.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react'
import { createMealTemplates } from './skabeloner/model.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { hostFixture, all, tick, button } from './diaryTemplate.fixture.mjs'

const athleteId = 'review:local-only', date = '2026-11-07'
const source = { id: 'review-row', athlete_id: athleteId, date,
  meal: 'Review ris', kcal: '123,5', protein: 0, carb: 30, fat: 0 }
const ownKey = 'entropi2:nutrition:skabeloner:v1:review%3Alocal-only'

test('review: full store permits a duplicate without write but rejects the 101st distinct template', () => {
  const templates = Array.from({ length: 100 }, (_, i) => {
    const meal = { meal: 'Review ' + i, kcal: 0, protein: 0, carb: 0, fat: 0 }
    return { id: JSON.stringify([meal.meal, 0, 0, 0, 0]), name: 'User name ' + i, meal,
      ingredients: [{ name: 'Known ingredient ' + i, quantity: i + 1, unit: 'g' }] }
  })
  const raw = JSON.stringify({ version: 1, templates }); let writes = 0
  const storage = { getItem: key => { assert.equal(key, ownKey); return raw }, setItem() { writes++ } }
  const rows = [source, { ...source, id: 'duplicate', ...templates[17].meal }]
  const m = createMealTemplates({ enabled: true, athleteId, date, rows, storage })
  assert.equal(m.saveFromDiary('duplicate'), 'duplicate')
  assert.deepEqual(m.snapshot().templates, templates)
  assert.equal(m.saveFromDiary(source.id), false)
  assert.match(m.snapshot().error, /100 skabeloner/)
  assert.deepEqual(m.snapshot().templates, templates); assert.equal(writes, 0)
})

test('review: current source controls all values despite a forged extra payload; failed clock never stores', async () => {
  const values = new Map(), writes = []; let brokenClock = false
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    storage: { getItem: k => values.get(k) ?? null, setItem(k, v) { values.set(k, v); writes.push(k) } },
    currentDay() { if (brokenClock) throw Error('synthetic unavailable clock'); return date },
    contracts: { load: async () => [source], save() { throw Error('forbidden consumption write') } } })
  try {
    await c.load(); brokenClock = true
    assert.equal(c.saveMealAsTemplate(source.id), false)
    assert.equal(c.snapshot().templateSave.status, 'error'); assert.equal(writes.length, 0)
    brokenClock = false
    assert.equal(c.saveMealAsTemplate(source.id, { meal: 'Forged', kcal: 999 }), true)
    const entry = JSON.parse(values.get(ownKey)).templates[0]
    assert.equal(entry.id, '["Review ris",123.5,0,30,0]')
    assert.deepEqual(entry.meal, { meal: 'Review ris', kcal: 123.5, protein: 0, carb: 30, fat: 0 })
    assert.equal(entry.ingredients, undefined); assert.equal(c.snapshot().logs.length, 1)
    assert.deepEqual(writes, [ownKey])
  } finally { c.dispose() }
})

test('review: mounted NodeList host exposes only eligible identity, and a newly replaced source needs its new button', async t => {
  const dom = hostFixture(); let rows = [source], writes = 0
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    storage: { getItem: () => null, setItem() { writes++ } }, contracts: { load: async () => rows } })
  let dispose
  t.after(async () => { try { await act(async () => dispose?.()) } finally { dom.restore() } })
  await act(async () => { dispose = mountNutrition(dom.host, c); await tick() })
  const old = button(dom.host, 'Gem som skabelon: Review ris'); assert.ok(old)
  rows = [{ ...source, meal: 'Changed current meal', kcal: 456 }]
  await act(async () => { await c.load(); old.dispatch('click') })
  assert.equal(writes, 0)
  await act(async () => button(dom.host, 'Gem som skabelon: Changed current meal').click())
  assert.equal(writes, 1); assert.equal(c.weekPlanInputs().templates[0].meal.kcal, 456)
  rows = [{ ...source, fat: null }, { ...source, id: 'local:pending' },
    { ...source, id: 'receipt', meal: ' [appData2-day-v1]synthetic' },
    source, { ...source, protein: 2 }]
  await act(async () => { await c.load() })
  assert.equal(all(dom.host, 'button').filter(n => n.textContent.startsWith('Gem som skabelon:')).length, 0)
  assert.equal(c.saveMealAsTemplate(source.id), false); assert.equal(writes, 1)
})

test('review: unmounted delayed first load cannot create an action or make a local write', async () => {
  const dom = hostFixture(); let finish, writes = 0
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    storage: { getItem: () => null, setItem() { writes++ } },
    contracts: { load: () => new Promise(resolve => { finish = resolve }) } })
  try {
    let dispose
    await act(async () => { dispose = mountNutrition(dom.host, c); await tick() })
    await act(async () => dispose())
    await act(async () => { finish([source]); await tick() })
    assert.equal(dom.host.textContent, ''); assert.equal(c.saveMealAsTemplate(source.id), false)
    assert.equal(writes, 0)
  } finally { dom.restore() }
})
