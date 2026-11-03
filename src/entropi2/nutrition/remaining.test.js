import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingToday, displayNumber } from './startModel.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, flush } from './synthetic-dom.mjs'

const totals = Object.freeze({ kcal: 1550, protein: 118 })
const targets = Object.freeze({ kcal: 2400, protein: 160 })
const date = '2026-11-03', id = 'synthetic-remaining'
const row = (values = {}) => ({ athlete_id: id, date, meal: 'Synthetic meal', kcal: 1550, protein: 118, carb: 100, fat: 40, ...values })
const lines = host => host.querySelectorAll('p').filter(p => p.textContent.startsWith('Tilbage i dag:'))
function mount({ goals = { kcal_target: 2400, protein_target: 160 }, rows = [row()], contracts } = {}) {
  const host = syntheticHost()
  const controller = createNutritionController({ enabled: true, athlete: { id, ...goals }, date,
    contracts: contracts ?? { async load() { return rows } } })
  const cleanup = mountNutrition(host, controller)
  return { host, controller, cleanup }
}

test('remaining: pure subtraction leaves frozen snapshot inputs unchanged', () => {
  assert.deepEqual(remainingToday(totals, targets), { kcal: 850, protein: 42 })
  assert.deepEqual(totals, { kcal: 1550, protein: 118 })
  assert.deepEqual(targets, { kcal: 2400, protein: 160 })
})

test('remaining: absent, zero and invalid goals do not invent targets; either partial goal works', () => {
  for (const value of [undefined, null, '', 'bad', 0, '0', -1, NaN, Infinity, -Infinity, {}, [], true]) {
    assert.equal(remainingToday(totals, value == null ? value : { kcal: value, protein: value }), null)
    assert.deepEqual(remainingToday(totals, { kcal: 2400, protein: value }), { kcal: 850, protein: null })
    assert.deepEqual(remainingToday(totals, { kcal: value, protein: 160 }), { kcal: null, protein: 42 })
  }
  assert.equal(remainingToday(totals, {}), null)
  assert.deepEqual(remainingToday(totals, { kcal: '2400,5' }), { kcal: 850.5, protein: null })
})

test('remaining: reached, exceeded, zero intake and large finite totals never produce negatives', () => {
  assert.deepEqual(remainingToday(targets, targets), { kcal: 0, protein: 0 })
  assert.deepEqual(remainingToday({ kcal: 2500, protein: 180 }, targets), { kcal: 0, protein: 0 })
  assert.deepEqual(remainingToday({ kcal: 0, protein: 0 }, targets), targets)
  assert.deepEqual(remainingToday({ kcal: Number.MAX_VALUE, protein: Number.MAX_VALUE }, targets), { kcal: 0, protein: 0 })
  assert.deepEqual(remainingToday({ kcal: 2500, protein: 118 }, targets), { kcal: 0, protein: 42 })
})

test('remaining: missing or invalid total hides the complete line even for partial targets', () => {
  for (const value of [undefined, null, {}, []]) assert.equal(remainingToday(value, targets), null)
  for (const key of ['kcal', 'protein']) {
    for (const bad of [undefined, null, '', '118', 'bad', NaN, Infinity, -Infinity, -1, {}, [], true]) {
      assert.equal(remainingToday({ ...totals, [key]: bad }, targets), null)
      assert.equal(remainingToday({ ...totals, [key]: bad }, { kcal: 2400 }), null)
    }
  }
})

test('remaining DOM: exact calm line follows recorded totals and uses Danish rounding', async () => {
  const { host, cleanup } = mount()
  try {
    assert.equal(lines(host).length, 0) // Not yet loaded.
    await flush()
    const line = lines(host)[0]
    assert.equal(lines(host).length, 1)
    assert.equal(line.textContent, 'Tilbage i dag: 850 kcal · 42 g protein')
    assert.equal(line.className, 'muted space')
    assert.equal(line.getAttribute('role'), null)
    assert.equal(line.parentElement.querySelectorAll('h2')[0].textContent, 'Registreret indtag')
    const children = line.parentElement.children, index = children.indexOf(line)
    assert.ok(children.slice(0, index).some(p => p.textContent.startsWith('Protein: 118 g')))
    assert.ok(children[index + 1].textContent.startsWith('Registreringer viser ikke nødvendigvis'))
  } finally { cleanup() }
  const rounded = mount({ goals: { kcal_target: '2400,5', protein_target: '160,25' }, rows: [row({ kcal: 1000.25, protein: 118 })] })
  try {
    await flush()
    assert.equal(lines(rounded.host)[0].textContent, 'Tilbage i dag: 1.400,3 kcal · 42,3 g protein')
    assert.equal(displayNumber(1400.25), '1.400,3')
  } finally { rounded.cleanup() }
})

test('remaining DOM: either partial target, zero intake and independently reached goals', async () => {
  const cases = [
    [{ kcal_target: 2400 }, [row()], 'Tilbage i dag: 850 kcal'],
    [{ protein_target: 160 }, [row()], 'Tilbage i dag: 42 g protein'],
    [{ kcal_target: 2400, protein_target: 160 }, [], 'Tilbage i dag: 2.400 kcal · 160 g protein'],
    [{ kcal_target: 2400, protein_target: 160 }, [row({ kcal: 2400 })], 'Tilbage i dag: Energi nået · 42 g protein'],
    [{ kcal_target: 2400, protein_target: 160 }, [row({ protein: 180 })], 'Tilbage i dag: 850 kcal · Protein nået'],
    [{ kcal_target: 2400, protein_target: 160 }, [row({ kcal: 2500, protein: 160 })], 'Tilbage i dag: Energi nået · Protein nået'],
    [{ kcal_target: 2400, protein_target: 160 }, [row({ kcal: 0, protein: 0 })], 'Tilbage i dag: 2.400 kcal · 160 g protein'],
  ]
  for (const [goals, rows, expected] of cases) {
    const fixture = mount({ goals, rows })
    try {
      await flush()
      assert.equal(lines(fixture.host).length, 1)
      assert.equal(lines(fixture.host)[0].textContent, expected)
    } finally { fixture.cleanup() }
  }
})

test('remaining DOM: absent/zero goals and invalid rows stay hidden; existing messages survive', async () => {
  for (const goals of [{}, { kcal_target: 0, protein_target: 0 }, { kcal_target: NaN, protein_target: -1 }]) {
    const fixture = mount({ goals })
    try {
      await flush()
      assert.equal(lines(fixture.host).length, 0)
      assert.match(fixture.host.textContent, /Ingen mål endnu/)
    } finally { fixture.cleanup() }
  }
  for (const bad of [NaN, Infinity, -1, 'bad', null, '']) {
    const fixture = mount({ rows: [row({ kcal: bad })] })
    try {
      await flush()
      assert.equal(lines(fixture.host).length, 0)
      assert.match(fixture.host.textContent, /Næringsdata skal kontrolleres/)
    } finally { fixture.cleanup() }
  }
})

test('remaining DOM: failed load is hidden and failed save leaves remaining unchanged', async () => {
  const failed = mount({ contracts: { async load() { throw Error('synthetic read') } } })
  try {
    await flush()
    assert.equal(lines(failed.host).length, 0)
    assert.match(failed.host.textContent, /Kostloggen kunne ikke hentes/)
  } finally { failed.cleanup() }
  let succeed = false, saves = 0
  const fixture = mount({ contracts: {
    async load() { return [row()] },
    async save() { saves++; return succeed },
  } })
  try {
    await flush()
    const meal = { meal: 'Synthetic addition', kcal: 100, protein: 10, carb: 10, fat: 2 }
    assert.equal(await fixture.controller.log(meal, 'failed'), false)
    assert.equal(lines(fixture.host)[0].textContent, 'Tilbage i dag: 850 kcal · 42 g protein')
    succeed = true
    assert.equal(await fixture.controller.log(meal, 'success'), true)
    assert.equal(lines(fixture.host)[0].textContent, 'Tilbage i dag: 750 kcal · 32 g protein')
    assert.equal(saves, 2)
    fixture.cleanup()
    assert.equal(fixture.host.textContent, '')
  } finally { fixture.cleanup() }
})
