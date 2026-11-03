// Separately authored final-review cases: actual assembly/contracts and synthetic database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mountNutritionScreen } from './index.mjs'
import { createNutritionController } from './controller.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

test('review: strict OFF never touches host or dependencies', () => {
  for (const entropi2 of [undefined, false, 1, 'true']) {
    const host = syntheticHost(); host.textContent = 'Existing screen'
    const poison = new Proxy({}, { get() { throw Error('OFF access') } })
    mountNutritionScreen(host, { entropi2, athlete: poison, storage: poison, client: poison })()
    assert.equal(host.textContent, 'Existing screen')
  }
})

test('review: actual mounted contracts save local favorite, remount, then insert exactly one summed row', async t => {
  const id = 'synthetic-independent', date = '2026-11-03'
  let rows = [1, 2, 3].map(i => ({ id: 'id-' + i, athlete_id: id, date, meal: 'Part ' + i,
    kcal: i * 1.25, protein: i * 0.5, carb: i * 2.75, fat: i * 0.25 }))
  const inserts = [], storageWrites = [], store = new Map()
  const storage = { getItem: k => store.get(k), setItem(k, v) { storageWrites.push(k); store.set(k, v) } }
  const client = { from(table) {
    assert.equal(table, 'meal_logs')
    const q = { select() { return q }, eq() { return q }, gte() { return q }, lte() { return q },
      async order() { return { data: rows.map(r => ({ ...r })), error: null } },
      async insert(p) { inserts.push(p); rows.push({ ...p, id: 'saved-row' }); return { error: null } },
    }; return q
  } }
  const options = { entropi2: true, athlete: { id }, date, storage, client }
  const host = syntheticHost(); let cleanup = mountNutritionScreen(host, options)
  t.after(() => cleanup()); await flush()
  for (const index of [0, 2]) await host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'meal-part-' + index).fire('change')
  const input = host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Navn på eget måltid')
  input.value = '<Min egen>'; await input.fire('input')
  await host.querySelectorAll('form').find(n => n.getAttribute('aria-label') === 'Gem eget måltid').fire('submit')
  assert.equal(storageWrites.length, 1); assert.equal(inserts.length, 0)
  assert.equal(storageWrites[0], 'entropi2:nutrition:favorites:v1:' + id)
  cleanup(); cleanup = mountNutritionScreen(host, options); await flush()
  await find(host, 'button', 'Log <Min egen>').fire('click')
  assert.deepEqual(inserts, [{ athlete_id: id, date, meal: '<Min egen>', kcal: 5, protein: 2, carb: 11, fat: 1 }])
  assert.equal(rows.length, 4)
  assert.equal(host.querySelectorAll('input').some(n => n.getAttribute('data-focus') === 'meal-part-3'), true)
})

test('review: removing or editing a selected row cannot silently reuse obsolete values', async t => {
  for (const kind of ['remove', 'update']) {
    const row = i => ({ id: 'r' + i, athlete_id: 'synthetic-review', date: '2026-11-03', meal: 'Part ' + i, kcal: 1, protein: 1, carb: 1, fat: 1 })
    let writes = 0
    const c = createNutritionController({ enabled: true, athlete: { id: 'synthetic-review' }, date: '2026-11-03',
      storage: { setItem() { writes++ } }, contracts: { load: async () => [row(1), row(2)], [kind]: async () => true } })
    t.after(() => c.dispose()); await c.load(); c.toggleMealPart(0); c.toggleMealPart(1)
    if (kind === 'remove') await c.remove('r1', 'remove-part', true)
    else await c.update('r1', { ...row(1), kcal: 99 }, 'edit-part')
    assert.equal(c.saveOwnMeal('Samlet'), false); assert.equal(writes, 0)
    assert.match(c.snapshot().favoriteError, /mindst to/)
  }
})
