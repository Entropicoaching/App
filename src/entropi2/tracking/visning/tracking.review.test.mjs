// Separate focused review checks; imports the final implementation directly.
import test from 'node:test'
import assert from 'node:assert/strict'
import { trackingViewModel, chartGeometry } from './trackingContract.mjs'

const date = n => new Date(Date.UTC(2026, 9, n)).toISOString().slice(0, 10)
const envelope = load => ({ version: 1, asOf: date(28), load })
const load = days => ({ state: 'ready', unit: 'enheder', days })

test('review: 28-day boundaries and all internal missing positions preserve gaps', () => {
  const days = Array.from({ length: 28 }, (_, i) => ({ day: date(i + 1), acute: i, chronic: i + 10 }))
  assert.equal(trackingViewModel(envelope(load(days))).load.state, 'ready')
  assert.equal(trackingViewModel(envelope(load([{ day: date(0), acute: 1, chronic: 2 }]))).load.state, 'invalid')
  assert.equal(trackingViewModel(envelope(load([...days, { day: date(29), acute: 1, chronic: 1 }]))).load.state, 'invalid')
  for (let gap = 1; gap < 27; gap++) {
    const rows = days.map((d, i) => ({ ...d, acute: i === gap ? null : d.acute }))
    const graph = chartGeometry(rows, ['acute', 'chronic'])
    assert.equal((graph.paths[0].match(/M/g) || []).length, 2)
    assert.equal((graph.paths[1].match(/M/g) || []).length, 1)
    for (const line of graph.points) for (const point of line) if (point) {
      assert.ok(point.x >= 16 && point.x <= 304)
      assert.ok(point.y >= 16 && point.y <= 80)
    }
  }
})

test('review: sparse arrays and wrong structural types never produce ready results or throw', () => {
  for (const days of [Array(1), [null], [undefined], {}, 'rows', null]) {
    assert.equal(trackingViewModel(envelope(load(days))).load.state, 'invalid')
  }
  for (const exercises of [Array(1), [null], [undefined], {}, null]) {
    const model = trackingViewModel({ ...envelope(null), strength: { state: 'ready', exercises } })
    assert.equal(model.strength.state, 'invalid')
  }
})

test('review: valid zero is retained; unknown observations stay null, with no derived signal', () => {
  const card = load([{ day: date(28), acute: 0, chronic: null }])
  const model = trackingViewModel(envelope(card))
  assert.equal(model.load.days[0].acute, 0)
  assert.equal(model.load.days[0].chronic, null)
  assert.equal(model.load.signal, undefined)
  assert.equal(model.weight.state, 'missing')
  const graph = chartGeometry(card.days, ['acute', 'chronic'])
  assert.equal(graph.paths[0], 'M160.00,48.00')
  assert.equal(graph.paths[1], '')
})

test('review: missing nutrition and weight coverage cannot carry numerical claims', () => {
  const base = envelope(null)
  const week = { day: date(28), loggedDays: 0, proteinG: null, proteinGoalG: null, kcal: null, kcalGoal: null }
  const weight = { day: date(28), samples7: 0, kg: null, mean7Kg: null }
  assert.equal(trackingViewModel({ ...base, nutrition: { state: 'ready', weeks: [week] } }).nutrition.state, 'ready')
  for (const field of ['proteinG', 'proteinGoalG', 'kcal', 'kcalGoal']) {
    assert.equal(trackingViewModel({ ...base, nutrition: { state: 'ready', weeks: [{ ...week, [field]: 0 }] } }).nutrition.state, 'invalid')
  }
  for (const field of ['kg', 'mean7Kg']) {
    assert.equal(trackingViewModel({ ...base, weight: { state: 'ready', days: [{ ...weight, [field]: 0 }] } }).weight.state, 'invalid')
  }
})
