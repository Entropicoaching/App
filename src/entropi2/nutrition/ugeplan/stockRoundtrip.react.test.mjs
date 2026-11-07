// Actual mountNutrition -> lazy mountUgeplan -> ReactDOM, with synthetic facts/DOM.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react'
import { createNutritionController } from '../controller.mjs'
import { mountNutrition } from '../view.mjs'
import { ingredientKey } from '../indkoeb/ingredients.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'

const propsOf = node => node[Object.keys(node).find(key => key.startsWith('__reactProps$'))]
const tick = () => new Promise(resolve => setImmediate(resolve))

for (const [label, char] of [['review quotes', '"'], ['six-character escapes', '\ud800']]) {
  test(`P2 normal lazy React route: ${label} stock reopens, changes and rejects invalid input`, async t => {
    const doc = sessionReactDocument(), host = doc.createElement('div')
    doc.body.append(host)
    Object.defineProperty(Object.getPrototypeOf(host), 'options', {
      configurable: true, get() { return this.querySelectorAll('option') },
    })
    const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]))
    globalThis.window = doc.defaultView
    globalThis.document = doc
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const data = new Map(), writes = [], backend = []
    const storage = { getItem: key => data.get(key) ?? null,
      setItem(key, raw) { writes.push([key, raw]); data.set(key, raw) } }
    const athleteId = 'synthetic:stock-react', date = '2026-11-05'
    const ingredients = [{ name: 'Escaped ingredient', quantity: 10, unit: 'g',
      foodId: char.repeat(1000), preparation: char.repeat(1000),
      source: { citation: char.repeat(2000), verification: char.repeat(1000) } }]
    const rows = ['a', 'b', 'c'].map(id => ({ id, athlete_id: athleteId, date,
      meal: 'Escaped recipe', kcal: 400, protein: 20, carb: 60, fat: 10, ingredients }))
    let dispose, controller
    t.after(async () => {
      await act(async () => dispose?.())
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key]
        else globalThis[key] = value
      }
    })
    const all = tag => host.querySelectorAll(tag)
    const mount = async () => {
      controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage,
        contracts: { load: async () => rows, save: async payload => { backend.push(payload); return true } } })
      await act(async () => { dispose = mountNutrition(host, controller); await tick() })
    }
    const open = async () => {
      const fold = all('details').find(node => node.getAttribute('data-focus') === 'week-plan')
      assert.ok(fold)
      await act(async () => { fold.open = true; fold.dispatch('toggle') })
      for (let attempt = 0; attempt < 100 && !all('select').some(node => node.getAttribute('data-focus') === 'week-plan-add-0'); attempt++) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
      }
      assert.ok(all('select').some(node => node.getAttribute('data-focus') === 'week-plan-add-0'), 'actual lazy React consumer mounted')
    }
    const submit = async (name, value) => {
      const form = all('form').find(node => node.querySelectorAll('input').some(input => input.name === name))
      assert.ok(form, name)
      await act(async () => propsOf(form).onSubmit({ preventDefault() {}, currentTarget: { elements: { [name]: { value } } } }))
    }
    await mount()
    const accept = all('button').find(node => node.textContent === 'Gem skabelon: Escaped recipe')
    assert.ok(accept)
    await act(async () => accept.click())
    await open()
    const select = all('select').find(node => node.getAttribute('data-focus') === 'week-plan-add-0')
    const id = controller.weekPlanInputs().templates[0].id
    await act(async () => propsOf(select).onChange({ currentTarget: { value: id } }))
    assert.match(host.textContent, /Escaped ingredient: 10 g/)
    await submit('stock', '4')
    assert.match(host.textContent, /Bekræftet beholdning: 4 g\.\s+Nettokøb: 6 g/)
    const weekRaw = [...data].find(([key]) => key.includes(':ugeplan:v1:'))[1]
    const stockKey = JSON.parse(weekRaw).stock[0].key
    assert.equal(stockKey.length, label === 'review quotes' ? 10050 : 30050)
    const before = [...data], count = writes.length
    await act(async () => dispose())
    await mount(); await open()
    assert.doesNotMatch(host.textContent, /Ugekladden kunne ikke læses/)
    assert.match(host.textContent, /Bekræftet beholdning: 4 g\.\s+Nettokøb: 6 g/)
    assert.deepEqual([...data], before)
    assert.equal(writes.length, count)
    assert.equal(ingredientKey(controller.weekPlanInputs().templates[0].ingredients[0]), stockKey)
    await submit('stock', '25')
    assert.match(host.textContent, /Bekræftet beholdning: 25 g\.\s+Nettokøb: 0 g/)
    await submit('portions', '3')
    assert.match(host.textContent, /Escaped ingredient: 30 g/)
    assert.match(host.textContent, /Nettokøb: 5 g/)
    await submit('stock', '0')
    assert.match(host.textContent, /Bekræftet beholdning: 0 g\.\s+Nettokøb: 30 g/)
    const saved = [...data], savedCount = writes.length
    await submit('stock', '-1')
    assert.match(host.textContent, /Beholdning blev ikke gemt/)
    assert.deepEqual([...data], saved)
    assert.equal(writes.length, savedCount)
    await act(async () => dispose())
    await mount(); await open()
    assert.match(host.textContent, /Bekræftet beholdning: 0 g\.\s+Nettokøb: 30 g/)
    assert.deepEqual([...data], saved)
    assert.equal(writes.length, savedCount)
    assert.deepEqual(backend, [])
    assert.ok(writes.every(([key]) => key.includes(':skabeloner:v1:') || key.includes(':ugeplan:v1:')))
  })
}
