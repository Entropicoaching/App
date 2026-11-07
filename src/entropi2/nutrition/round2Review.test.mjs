import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic-round2', date = '2026-11-04'
const meal = n => ({ meal: 'Synthetic choice ' + n, kcal: 300, protein: 20, carb: 40, fat: 7 })
const templates = host => host.querySelectorAll('details').find(n => n.getAttribute('data-focus') === 'templates')
async function fixture(t, { favorites = [], rows = [], data = new Map(), readError = false } = {}) {
  const saves = [], writes = []
  data.set('entropi2:nutrition:favorites:v1:' + id, JSON.stringify(favorites))
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    storage: {
      getItem(key) { if (readError && key.includes(':skabeloner:')) throw Error('synthetic'); return data.get(key) ?? null },
      setItem(key, value) { writes.push(key); data.set(key, value) },
    },
    contracts: { load: async () => rows, save: async value => { saves.push(value); return true } },
  })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup); await flush()
  return { host, controller, data, saves, writes }
}
const recurring = (m, day = '2026-11-02') => Array.from({ length: 3 }, (_, i) =>
  ({ ...m, id: m.meal + i, athlete_id: id, date: day }))

for (const source of ['favorite', 'recent']) test('round2: accepting template retains visible ' + source + ' action', async t => {
  const m = meal(1), f = await fixture(t, { favorites: source === 'favorite' ? [m] : [], rows: recurring(m) })
  const heading = source === 'favorite' ? 'Favoritter' : 'Seneste måltider'
  const label = (source === 'recent' ? 'Gentag dette måltid: ' : 'Log ') + m.meal
  assert.ok(find(find(f.host, 'h2', heading).parentElement, 'button', label))
  await find(f.host, 'button', 'Gem skabelon: ' + m.meal).fire('click')
  const b = find(find(f.host, 'h2', heading).parentElement, 'button', label)
  assert.ok(b)
  assert.match(templates(f.host).textContent, /Ingredienser mangler/)
  assert.equal(find(f.host, 'button', 'Log skabelon: ' + m.meal), undefined)
  assert.equal(f.host.querySelectorAll('button').filter(n => n.textContent === label).length, 1)
  await b.fire('click')
  assert.deepEqual(f.saves, [{ ...m, athlete_id: id, date }])
  assert.deepEqual(f.writes, ['entropi2:nutrition:skabeloner:v1:' + id])
})

test('round2: template matching a folded favorite retains one reachable log action', async t => {
  const favorites = Array.from({ length: 6 }, (_, i) => meal(i))
  const f = await fixture(t, { favorites, rows: recurring(favorites[5]) })
  await find(f.host, 'button', 'Gem skabelon: ' + favorites[5].meal).fire('click')
  const more = find(f.host, 'summary', 'Flere måltider').parentElement
  assert.equal(more.open, false)
  assert.match(templates(f.host).textContent, /Ingredienser mangler/)
  assert.equal(find(f.host, 'button', 'Log skabelon: ' + favorites[5].meal), undefined)
  more.open = true
  await find(more, 'button', 'Log ' + favorites[5].meal).fire('click')
  assert.deepEqual(f.saves, [{ ...favorites[5], athlete_id: id, date }])
})

test('round2: yesterday-only saved templates retain ingredient editor without duplicate log', async t => {
  const m = meal(2), f = await fixture(t, { rows: recurring(m, '2026-11-03') })
  await find(f.host, 'button', 'Gem skabelon: ' + m.meal).fire('click')
  assert.match(templates(f.host).textContent, /Ingredienser mangler/)
  assert.ok(find(f.host, 'button', 'Log igen: ' + m.meal))
  assert.doesNotMatch(f.host.textContent, /Ingen skabeloner endnu|Indkøb/)
})

test('round2: load error is visible even without templates or suggestions', async t => {
  const f = await fixture(t, { readError: true })
  assert.equal(templates(f.host), undefined)
  const alert = find(f.host, 'p', 'Skabeloner kunne ikke læses.')
  assert.equal(alert.getAttribute('role'), 'alert')
  assert.equal(alert.parentElement, find(f.host, 'h2', 'Log hurtigt').parentElement)
})
