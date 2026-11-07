// Actual React/ReactDOM and product screen; owned synthetic DOM and catalogue.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from '../kostplan/atlet/daySession.fixture.mjs'

const key = (host, value) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === value)
const form = host => key(host, 'log-portion').parentElement
function enter(host, name, value, event = 'input') {
  const input = key(host, name); input.value = value; input.dispatch(event, { target: input })
}

async function mounted(run) {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const foods = Array.from({ length: 1000 }, (_, i) => ({ id: 'synthetic-react-' + i,
    name: i === 897 ? 'Øllebrød, ÆBLE på skål' : 'Syntetisk mad ' + i,
    isCustom: true, unit_label: 'skål', unit_grams: 80,
    kcal100: 200, protein100: 0, carb100: 20, fat100: 0 }))
  const props = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods,
    weightLogs: [], weightStatus: { athleteId, state: 'loading' } }
  let root
  const show = () => act(async () => { root.render(h(Entropi2Kost, props)); await flush() })
  try {
    root = createRoot(host); await show()
    await run({ f, doc, host, props, show, release, root })
  } finally {
    release()
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [k, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor)
        else delete globalThis[k]
      }
    }
  }
}

test('food search real ReactDOM: async plan and weight refresh preserve non-first food, raw amount, unit and query', async () => {
  await mounted(async ({ f, doc, host, props, show, release }) => {
    key(host, 'log-form').open = true
    enter(host, 'food-search', 'øLLEBRØD, æble')
    enter(host, 'food-choice', '897', 'change')
    enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '1,5')
    await act(async () => { release(); await flush() })
    props.weightStatus = { athleteId, state: 'ready' }; await show()
    assert.equal(key(host, 'food-choice').value, '897')
    assert.equal(key(host, 'unit-choice').value, '1'); assert.equal(key(host, 'field-Mængde').value, '1,5')
    assert.equal(key(host, 'food-search').value, 'øLLEBRØD, æble')
    assert.equal(f.rows.length + f.plan.writes().length, 0)
    host.querySelectorAll('summary').find(n => n.textContent === 'Kostlog og vejning').parentElement.open = true
    const search = key(host, 'food-search'); search.focus(); search.setSelectionRange(2, 5)
    props.weightInput = '70,5'; await show()
    assert.ok(doc.activeElement === key(host, 'food-search'))
    assert.deepEqual([doc.activeElement.selectionStart, doc.activeElement.selectionEnd], [2, 5])
    enter(host, 'food-search', 'ingen match')
    await act(async () => { form(host).dispatch('submit'); await flush() })
    assert.equal(f.rows.length, 0); assert.ok(key(host, 'log-portion').disabled)
    key(host, 'clear-food-search').dispatch('click')
    assert.equal(key(host, 'food-choice').value, '897')
    await act(async () => { form(host).dispatch('submit'); await flush() })
    assert.deepEqual(f.rows, [{ id: 'synthetic-diary-1', athlete_id: athleteId, date,
      meal: 'Øllebrød, ÆBLE på skål · 1.5 skål (120 g)', kcal: 240, protein: 0, carb: 24, fat: 0 }])
    assert.equal(f.plan.writes().length, 0)
  })
})

for (const switchTo of ['date', 'athlete', 'OFF', 'unmount']) {
  test('food search real ReactDOM: retained form and fields cannot write after ' + switchTo, async () => {
    await mounted(async ({ f, host, props, show, release, root }) => {
      enter(host, 'food-search', 'øllebrød'); enter(host, 'food-choice', '897', 'change')
      enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '1,5')
      const retainedForm = form(host), retainedAmount = key(host, 'field-Mængde'), retainedSearch = key(host, 'food-search')
      if (switchTo === 'date') props.date = '2026-11-06'
      if (switchTo === 'athlete') props.athlete = { id: 'synthetic-other-athlete' }
      if (switchTo === 'OFF') props.enabled = false
      if (switchTo === 'unmount') await act(async () => root.render(null))
      else await show()
      await act(async () => {
        release(); await flush()
        retainedAmount.value = '999'; retainedAmount.dispatch('input', { target: retainedAmount })
        retainedSearch.value = ''; retainedSearch.dispatch('input', { target: retainedSearch })
        retainedForm.dispatch('submit'); await flush()
      })
      assert.equal(f.rows.length, 0)
      assert.equal(f.calls.filter(c => c.action === 'insert').length, 0)
      assert.equal(f.plan.writes().length, 0)
      if (switchTo === 'date' || switchTo === 'athlete') {
        assert.equal(key(host, 'food-search').value, '')
        assert.equal(key(host, 'food-choice').value, '0')
        assert.equal(key(host, 'field-Mængde').value, '100')
        assert.equal(key(host, 'unit-choice').value, '0')
      } else assert.equal(key(host, 'food-search'), undefined)
    })
  })
}

test('food search real ReactDOM: NodeList host supports all portion handlers and rejects detached forms', async () => {
  await mounted(async ({ f, host, release }) => {
    const tracker = host.querySelectorAll('div').find(n => n.className === 'e2-nutrition').parentElement
    assert.ok(tracker.contains(form(host)))
    const query = tracker.querySelectorAll.bind(tracker)
    // Local collection contract for the actual mounted consumer, not a shared DOM change.
    tracker.querySelectorAll = selector => {
      const items = query(selector)
      const list = { length: items.length, item: i => items[i] ?? null,
        forEach: (...args) => items.forEach(...args), [Symbol.iterator]: () => items[Symbol.iterator]() }
      items.forEach((item, i) => { list[i] = item })
      return list
    }
    const forms = tracker.querySelectorAll('form')
    assert.equal(Array.isArray(forms), false)
    assert.equal(typeof forms.includes, 'undefined')
    assert.equal(forms.item(1), form(host)); assert.equal([...forms][1], form(host))
    enter(host, 'food-search', 'øLLEBRØD, æble')
    enter(host, 'food-choice', '897', 'change')
    enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '1,25')
    const staleForm = form(host), staleAmount = key(host, 'field-Mængde')
    enter(host, 'food-search', 'ingen match')
    staleAmount.value = '999'; staleAmount.dispatch('input', { target: staleAmount })
    staleForm.dispatch('submit')
    await act(async () => { form(host).dispatch('submit'); await flush() })
    assert.equal(f.rows.length, 0); assert.ok(key(host, 'log-portion').disabled)
    key(host, 'clear-food-search').dispatch('click')
    assert.equal(key(host, 'food-search').value, '')
    assert.equal(key(host, 'food-choice').value, '897')
    assert.equal(key(host, 'field-Mængde').value, '1,25'); assert.equal(key(host, 'unit-choice').value, '1')
    key(host, 'gram-step-10').dispatch('click')
    assert.equal(key(host, 'field-Mængde').value, '110'); assert.equal(key(host, 'unit-choice').value, '0')
    enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '1,25')
    // A form can be absent from its host without a newer render or disposal.
    const detached = form(host), parent = detached.parentElement
    detached.remove(); detached.dispatch('submit')
    assert.equal(f.calls.filter(c => c.action === 'insert').length, 0)
    parent.append(detached)
    await act(async () => { release(); await flush(); form(host).dispatch('submit'); await flush() })
    assert.deepEqual(f.rows, [{ id: 'synthetic-diary-1', athlete_id: athleteId, date,
      meal: 'Øllebrød, ÆBLE på skål · 1.25 skål (100 g)', kcal: 200, protein: 0, carb: 20, fat: 0 }])
    assert.equal(f.plan.writes().length, 0)
  })
})
