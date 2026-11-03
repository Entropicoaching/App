import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03', id = 'synthetic-quick'
const meal = i => ({ meal: 'Synthetic meal ' + i, kcal: 100 + i, protein: 10, carb: 12, fat: 3 })
const row = (i, day = date) => ({ ...meal(i), athlete_id: id, date: day })
async function mounted(t, { rows = [], favorites = [], save = async () => true } = {}) {
  const saves = [], writes = [], intents = []
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    storage: { getItem: () => JSON.stringify(favorites), setItem: (...args) => writes.push(args) },
    contracts: { load: async () => rows, save: value => { saves.push(value); return save(value) } } })
  const log = controller.log
  controller.log = (value, intent) => { intents.push(intent); return log(value, intent) }
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup); await flush()
  return { host, controller, saves, writes, intents }
}
const block = host => find(host, 'h2', 'Log hurtigt').parentElement
const quickButtons = host => block(host).querySelectorAll('button').filter(b => b.textContent.startsWith('Log '))

test('quick: first block orders yesterday, five favorites, five non-favorite recents; library keeps single controls', async t => {
  const favorites = Array.from({ length: 7 }, (_, i) => meal(i))
  const rows = Array.from({ length: 16 }, (_, i) => row(i)).concat(row(30, '2026-11-02'))
  const { host, controller, writes } = await mounted(t, { rows, favorites })
  // Marc 3. nov.: overskriften og vejningen staar over Log hurtigt; blokken er den foerste handling efter dem.
  const order = host.querySelectorAll('main')[0].children.map(n => n.getAttribute('data-kost-del'))
  assert.deepEqual(order.slice(0, 3), ['intro', 'vaegt', 'hurtig'])
  assert.equal(host.querySelectorAll('main')[0].children[2], block(host))
  assert.deepEqual(block(host).querySelectorAll('h2').map(n => n.textContent), ['Log hurtigt', 'Gentag i går', 'Favoritter', 'Seneste måltider'])
  const buttons = quickButtons(host)
  assert.deepEqual(buttons.map(n => n.textContent), ['Log igen: Synthetic meal 30', ...[0, 1, 2, 3, 4, 7, 8, 9, 10, 11].map(i => 'Log Synthetic meal ' + i)])
  assert.equal(host.querySelectorAll('button').filter(b => b.textContent.startsWith('Log ')).length, buttons.length)
  const library = host.querySelectorAll('button').filter(b => /^(Gem|Fjern) favorit:/.test(b.textContent))
  assert.equal(new Set(library.map(b => b.textContent)).size, library.length)
  assert.equal(find(host, 'h2', 'Dine favoritter').parentElement.querySelectorAll('button').length, 7)
  assert.ok(find(host, 'h2', 'Måltidsbibliotek'))
  assert.equal(controller.snapshot().favorites.length, 7)
  assert.deepEqual(writes, [])
})

test('quick: empty lists hidden; first block offers only manual meal entry', async t => {
  const { host, saves } = await mounted(t)
  assert.deepEqual(block(host).querySelectorAll('h2').map(n => n.textContent), ['Log hurtigt'])
  assert.equal(quickButtons(host).length, 0)
  assert.ok(find(block(host), 'summary', 'Notér et måltid'))
  for (const heading of ['Dine favoritter', 'Måltidsbibliotek', 'Favoritter', 'Seneste måltider', 'Gentag i går']) assert.equal(find(host, 'h2', heading), undefined)
  assert.deepEqual(saves, [])
})

for (const source of ['favorite', 'recent']) {
  const options = source === 'favorite' ? { favorites: [meal(1)] } : { rows: [row(1, '2026-11-01')] }
  test('quick ' + source + ': one tap, pending double tap, deliberate repeat use actual log and fresh intents', async t => {
    let resolve
    const gate = new Promise(r => { resolve = r })
    const { host, controller, saves, intents, writes } = await mounted(t, { ...options, save: () => gate })
    const original = find(host, 'button', 'Log Synthetic meal 1')
    const first = original.fire('click')
    await original.fire('click')
    assert.equal(saves.length, 1)
    assert.equal(controller.snapshot().logs.length, 0)
    assert.ok(quickButtons(host).every(b => b.disabled))
    resolve(true); await first; await flush()
    assert.deepEqual(saves[0], { athlete_id: id, date, ...meal(1) })
    assert.equal(controller.snapshot().logs.length, 1)
    await find(host, 'button', 'Log Synthetic meal 1').fire('click')
    assert.equal(saves.length, 2)
    assert.equal(controller.snapshot().logs.length, 2)
    assert.equal(new Set(intents).size, intents.length)
    assert.deepEqual(writes, [])
  })
  for (const failure of ['false', 'throw']) test('quick ' + source + ': ' + failure + ' preserves totals and displays existing save error', async t => {
    const { host, controller, saves } = await mounted(t, { ...options, rows: [...(options.rows || []), row(9)],
      save: async () => { if (failure === 'throw') throw Error('synthetic'); return false } })
    const before = controller.snapshot()
    await find(host, 'button', 'Log Synthetic meal 1').fire('click'); await flush()
    assert.equal(saves.length, 1)
    assert.deepEqual(controller.snapshot().totals, before.totals)
    assert.deepEqual(controller.snapshot().logs, before.logs)
    assert.equal(find(host, 'p', 'Måltidet blev ikke gemt. Prøv igen.').getAttribute('role'), 'alert')
    assert.equal(find(host, 'button', 'Log Synthetic meal 1').disabled, false)
  })
}

test('quick: favorite changes move the single log button between groups without duplicates', async t => {
  const { host, controller } = await mounted(t, { rows: [row(2)] })
  await find(host, 'button', 'Gem favorit: Synthetic meal 2').fire('click')
  assert.deepEqual(controller.snapshot().favoriteKeys, [mealKey(meal(2))])
  assert.ok(find(host, 'h2', 'Favoritter'))
  assert.equal(find(host, 'h2', 'Seneste måltider'), undefined)
  assert.equal(quickButtons(host).length, 1)
  await find(host, 'button', 'Fjern favorit: Synthetic meal 2').fire('click')
  assert.equal(find(host, 'h2', 'Favoritter'), undefined)
  assert.ok(find(host, 'h2', 'Seneste måltider'))
  assert.equal(quickButtons(host).length, 1)
})

test('quick: strict OFF leaves an empty host and accesses no dependencies', () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    const host = syntheticHost()
    const controller = createNutritionController({ enabled })
    mountNutrition(host, controller)()
    assert.equal(host.children.length, 0)
  }
})
