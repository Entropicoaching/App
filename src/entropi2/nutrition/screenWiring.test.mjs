import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-04', id = 'synthetic-wiring'
const meal = { meal: 'Syntetisk <ret>', kcal: 300, protein: 20, carb: 40, fat: 7 }
const rows = Array.from({ length: 3 }, (_, i) => ({ ...meal, id: 'row-' + i, athlete_id: id, date: '2026-11-03' }))
const templateKey = athlete => 'entropi2:nutrition:skabeloner:v1:' + athlete
const favoriteKey = athlete => 'entropi2:nutrition:favorites:v1:' + athlete
function fixture(t, options = {}) {
  const data = options.data || new Map(), reads = [], writes = [], saves = []
  const storage = {
    getItem(key) { reads.push(key); if (options.readError && key.includes(':skabeloner:')) throw Error('synthetic'); return data.get(key) ?? null },
    setItem(key, value) { if (options.writeError) throw Error('synthetic'); writes.push([key, value]); data.set(key, value) },
  }
  const controller = createNutritionController({ enabled: true, athlete: { id: options.id || id }, date, storage,
    contracts: { load: async () => { if (options.loadError) throw Error('synthetic'); return options.rows ?? rows },
      save: async value => { saves.push(value); return options.save ? options.save() : true } } })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup)
  return { host, controller, data, reads, writes, saves, cleanup }
}
const details = (host, key) => host.querySelectorAll('details').find(n => n.getAttribute('data-focus') === key)
const templateSection = host => find(host, 'h3', 'Skabeloner').parentElement

test('wiring: suggestions collapsed in quick log; accept persists locally, log uses existing scoped action without duplicate quick entry', async t => {
  const f = fixture(t); await flush()
  const section = templateSection(f.host)
  assert.equal(find(f.host, 'h2', 'Log hurtigt').parentElement.querySelectorAll('section').includes(section), true)
  assert.match(section.textContent, /Ingen skabeloner endnu/)
  assert.equal(details(f.host, 'template-suggestions').open, false)
  assert.equal(details(f.host, 'shopping-list').open, false)
  await find(f.host, 'button', 'Gem skabelon: ' + meal.meal).fire('click')
  assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0][0], templateKey(id))
  assert.equal(details(f.host, 'template-suggestions'), undefined)
  assert.equal(find(f.host, 'h2', 'Gentag i går'), undefined)
  assert.equal(find(f.host, 'button', 'Log ' + meal.meal), undefined)
  assert.equal(f.saves.length, 0)
  await find(f.host, 'button', 'Log skabelon: ' + meal.meal).fire('click')
  assert.deepEqual(f.saves, [{ ...meal, athlete_id: id, date }])
  assert.match(f.host.textContent, /Måltid gemt/)
  assert.equal(f.host.querySelectorAll('img').length, 0)
  assert.ok(find(f.host, 'h2', 'Din uge'))
})

test('wiring: saved templates survive remount and remain scoped to athlete', async t => {
  const f = fixture(t); await flush()
  await find(f.host, 'button', 'Gem skabelon: ' + meal.meal).fire('click'); f.cleanup()
  const again = fixture(t, { data: f.data, rows: [] }); await flush()
  assert.ok(find(again.host, 'button', 'Log skabelon: ' + meal.meal))
  const other = fixture(t, { data: f.data, rows: [], id: 'synthetic-other' }); await flush()
  assert.match(templateSection(other.host).textContent, /Ingen skabeloner endnu/)
  assert.ok(other.reads.every(key => key.endsWith('synthetic-other')))
})

test('wiring: empty collections show honest text; shopping is last and collapsed', async t => {
  const f = fixture(t, { rows: [] }); await flush()
  assert.match(templateSection(f.host).textContent, /Ingen skabeloner endnu/)
  const shopping = details(f.host, 'shopping-list')
  assert.equal(shopping.open, false)
  assert.match(shopping.textContent, /ingen egne måltider/)
  assert.equal(shopping.parentElement.children.at(-1), shopping)
  assert.ok(find(f.host, 'summary', 'Notér et måltid'))
  assert.equal(f.writes.length + f.saves.length, 0)
})

test('wiring: corrupt/read-denied templates and failed acceptance show alerts without writes', async t => {
  for (const options of [{ readError: true }, { data: new Map([[templateKey(id), '{broken']]) }, { writeError: true }]) {
    const f = fixture(t, options); await flush()
    if (options.writeError) await find(f.host, 'button', 'Gem skabelon: ' + meal.meal).fire('click')
    const section = templateSection(f.host)
    assert.ok(section.querySelectorAll('p').some(p => p.getAttribute('role') === 'alert'))
    assert.match(section.textContent, options.writeError ? /blev ikke gemt/ : /kunne ikke læses/)
    assert.equal(f.writes.length + f.saves.length, 0)
    assert.ok(find(f.host, 'button', 'Gem skabelon: ' + meal.meal))
  }
})

test('wiring: failed/pending template log shares controller guards, diary unchanged, retry works', async t => {
  let resolve
  const gate = new Promise(r => { resolve = r })
  let first = true
  const f = fixture(t, { save: () => { if (first) { first = false; return gate } return true } }); await flush()
  await find(f.host, 'button', 'Gem skabelon: ' + meal.meal).fire('click')
  const b = find(f.host, 'button', 'Log skabelon: ' + meal.meal)
  const pending = b.fire('click'); await b.fire('click')
  assert.equal(find(f.host, 'button', b.textContent).disabled, true)
  assert.equal(f.saves.length, 1)
  resolve(false); await pending
  assert.equal(f.controller.snapshot().logs.length, 0)
  assert.match(f.host.textContent, /Måltidet blev ikke gemt/)
  await find(f.host, 'button', b.textContent).fire('click')
  assert.equal(f.controller.snapshot().logs.length, 1)
})

test('wiring: real favorite data feeds shopping; missing ingredients explicit, choices and fold persist over redraw; cleanup removes handlers', async t => {
  const data = new Map([[favoriteKey(id), JSON.stringify([meal])]])
  const f = fixture(t, { data, rows: [] }); await flush()
  const shopping = details(f.host, 'shopping-list'); shopping.open = true
  const input = shopping.querySelectorAll('input')[0]
  input.checked = true; await input.fire('change')
  assert.match(shopping.textContent, /Listen er ufuldstændig.*Syntetisk <ret>/)
  assert.equal(shopping.querySelectorAll('li').length, 0)
  f.controller.toggleHistory()
  assert.equal(details(f.host, 'shopping-list').open, true)
  assert.equal(details(f.host, 'shopping-list').querySelectorAll('input')[0], input)
  assert.equal(input.checked, true)
  assert.equal(f.writes.length + f.saves.length, 0)
  f.controller.toggleFavorite(meal)
  assert.equal(input.events.change.length, 0)
  assert.match(details(f.host, 'shopping-list').textContent, /ingen egne måltider/)
  assert.equal(f.writes[0][0], favoriteKey(id))
})

test('wiring: failed load has retry, no template/shopping claims; OFF never reads poison objects', async t => {
  const f = fixture(t, { loadError: true }); await flush()
  assert.equal(find(f.host, 'h3', 'Skabeloner'), undefined)
  assert.equal(details(f.host, 'shopping-list'), undefined)
  assert.ok(find(f.host, 'button', 'Hent kostloggen igen'))
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  for (const entropi2 of [false, undefined, 'true', 1]) mountNutritionScreen(poison, { entropi2, athlete: poison, client: poison, storage: poison })()
})

test('wiring: template deduplication precedes five-slot favorite limit', async t => {
  const favorites = [meal, ...Array.from({ length: 5 }, (_, i) => ({ ...meal, meal: 'Synthetic favorite ' + i }))]
  const data = new Map([[favoriteKey(id), JSON.stringify(favorites)]])
  const f = fixture(t, { data }); await flush()
  await find(f.host, 'button', 'Gem skabelon: ' + meal.meal).fire('click')
  const quick = find(f.host, 'h2', 'Favoritter').parentElement
  assert.deepEqual(quick.querySelectorAll('button').map(n => n.textContent),
    favorites.slice(1).map(m => 'Log ' + m.meal))
})
