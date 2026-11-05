import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic-goals', date = '2026-11-05'
const meal = i => ({ meal: 'Syntetisk måltid ' + i, kcal: 100 + i, protein: 10, carb: 12, fat: 3 })
const row = (i, day = '2026-11-04') => ({ ...meal(i), athlete_id: id, date: day })
const focus = (host, key) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === key)
const logButtons = host => host.querySelectorAll('button').filter(b => /^(Log igen: |Log Syntetisk|Gentag dette måltid: )/.test(b.textContent))
async function mount(t, { rows = [], favorites = [], targets = {}, save = async () => true, view = {} } = {}) {
  const saves = [], writes = []
  const controller = createNutritionController({ enabled: true, athlete: { id, ...targets }, date,
    storage: { getItem: () => JSON.stringify(favorites), setItem: (...args) => writes.push(args) },
    contracts: { load: async () => rows, remove: async () => true,
      saveWithIdentity: async value => { saves.push(value); return { ok: await save(value), id: 'synthetic-new-meal' } } } })
  const host = syntheticHost()
  const cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00'), ...view })
  t.after(cleanup); await flush()
  return { host, cleanup, controller, saves, writes }
}

for (const count of [0, 1, 3, 4, 25]) test(`goals first: ${count} meals; goals precede optional log and overflow stays closed`, async t => {
  const f = await mount(t, { rows: Array.from({ length: count }, (_, i) => row(i)),
    targets: { kcal_target: 2100, protein_target: 130 },
    view: { weightStatus: 'empty', weightInput: '', onWeightInput() {}, logWeight() {} } })
  const main = f.host.querySelectorAll('main')[0]
  assert.deepEqual(main.children.slice(0, 4).map(n => n.getAttribute('data-kost-del')), ['intro', 'vaegt', 'maal', 'hurtig'])
  assert.ok(find(main.children[2], 'p', 'Energi: 2.100 kcal'))
  const all = logButtons(f.host), more = focus(f.host, 'more-meals')
  assert.equal(all.length, count)
  if (count > 3) {
    assert.equal(more.open, false)
    assert.equal(more.children[0].textContent, 'Flere måltider')
    assert.equal(logButtons(more).length, count - 3)
    assert.equal(all.filter(b => !logButtons(more).includes(b)).length, 3)
    more.open = true; await more.fire('toggle')
    f.cleanup.updateWeight({})
    assert.equal(focus(f.host, 'more-meals').open, true)
  } else assert.equal(more, undefined)
  assert.deepEqual(f.saves, []); assert.deepEqual(f.writes, [])
})

test('goals first: full identities deduplicate across all sources, retaining same-name nutrient variants', async t => {
  const variant = { ...meal(0), kcal: 999 }
  const f = await mount(t, { rows: [row(0), row(1), row(0), row(2, '2026-11-03'), row(3, '2026-11-03')],
    favorites: [meal(0), meal(2), variant] })
  const all = logButtons(f.host)
  assert.deepEqual(all.map(b => b.textContent), [
    'Log igen: Syntetisk måltid 0', 'Log igen: Syntetisk måltid 1', 'Log Syntetisk måltid 2',
    'Log Syntetisk måltid 0', 'Gentag dette måltid: Syntetisk måltid 3',
  ])
  assert.equal(new Set([meal(0), meal(1), meal(2), variant, meal(3)].map(mealKey)).size, all.length)
  assert.ok(find(f.host, 'p', 'Aftal dine kostmål med din coach.'))
  assert.equal(find(f.host, 'p', 'Energi: 0 kcal'), undefined)
  assert.deepEqual(f.saves, []); assert.deepEqual(f.writes, [])
})

test('goals first: overflow actions preserve focus, pending lock, external errors and undo', async t => {
  let resolve, success = false
  const gate = new Promise(done => { resolve = done })
  const f = await mount(t, { rows: [0, 1, 2, 3, 4].map(i => row(i)), save: async () => { await gate; return success } })
  const more = focus(f.host, 'more-meals'); more.open = true
  const button = find(more, 'button', 'Log igen: Syntetisk måltid 4'); button.focus()
  const clicking = button.fire('click')
  assert.equal(f.saves.length, 1)
  assert.ok(logButtons(f.host).every(b => b.disabled))
  assert.equal(focus(f.host, 'more-meals').open, true)
  resolve(); await clicking; await flush()
  const current = find(f.host, 'button', button.textContent)
  assert.equal(f.host.ownerDocument.activeElement, current)
  focus(f.host, 'more-meals').open = false; f.cleanup.updateWeight({})
  const alert = find(f.host, 'p', 'Måltidet blev ikke gemt. Prøv igen.')
  assert.equal(alert.getAttribute('role'), 'alert')
  assert.equal(alert.parentElement.tagName, 'MAIN')
  success = true
  focus(f.host, 'more-meals').open = true
  await find(f.host, 'button', button.textContent).fire('click'); await flush()
  assert.deepEqual(f.saves[1], { athlete_id: id, date, ...meal(4) })
  focus(f.host, 'more-meals').open = false; f.cleanup.updateWeight({})
  const undo = find(f.host, 'button', 'Fortryd')
  assert.ok(undo)
  assert.equal(undo.parentElement.parentElement.className, 'e2-nutrition')
  assert.deepEqual(f.writes, [])
})
