// Independent black-box checks: expected results are constructed without using
// the model's date, ranking, payload, validation or timer helpers as an oracle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQuickModel } from './model.mjs'
import { createQuickController } from './controller.mjs'

const athleteId = 'synthetic-review', date = '2026-11-04'
const empty = () => ({ status: 'ready', complete: true, readinessRows: [], weightRows: [], mealRows: [] })

test('review: every calendar day in a leap year uses yesterday, never an older fallback', () => {
  const first = Date.UTC(2028, 0, 1)
  for (let index = 0; index < 366; index++) {
    const day = new Date(first + index * 86400000).toISOString().slice(0, 10)
    const previous = new Date(first + (index - 1) * 86400000).toISOString().slice(0, 10)
    const older = new Date(first + (index - 2) * 86400000).toISOString().slice(0, 10)
    const input = { athleteId, date: day, ...empty(), weightRows: [
      { athlete_id: athleteId, logged_at: older, weight: 100 },
      { athlete_id: athleteId, logged_at: previous, weight: 75 }],
    }
    assert.equal(buildQuickModel(input).draft.weight, '75', day)
    input.weightRows.pop()
    assert.equal(buildQuickModel(input).draft.weight, '', day)
  }
})

test('review: deterministic frequency ranking agrees with a separately counted multiset', () => {
  const counts = [1, 7, 3, 9, 5], rows = []
  counts.forEach((count, index) => {
    for (let i = 0; i < count; i++) rows.push({ athlete_id: athleteId, date: '2026-11-03',
      meal: `Synthetic ${index}`, kcal: index + 100, protein: 10, carb: 20, fat: 2 })
  })
  const expected = ['Synthetic 3', 'Synthetic 1', 'Synthetic 4']
  for (let rotation = 0; rotation < rows.length; rotation++) {
    const shuffled = rows.slice(rotation).concat(rows.slice(0, rotation))
    const model = buildQuickModel({ athleteId, date, ...empty(), mealRows: shuffled })
    assert.deepEqual(model.meals.slice(0, 3).map(x => x.value.meal), expected)
  }
})

test('review: duplicate persistent identity with conflicting content fails closed', () => {
  const row = { athlete_id: athleteId, date, meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 20, fat: 2, id: 'synthetic-row' }
  assert.throws(() => buildQuickModel({ athleteId, date, ...empty(), mealRows: [row, { ...row, kcal: 200 }] }))
})

test('review: arbitrary event order around deadline cannot write after undo, disposal or scope change', async () => {
  for (const action of ['undo', 'dispose', 'day-change', 'early-timer', 'deadline-undo']) {
    let time = 0, callback, active = false, current = date
    const writes = []
    const clock = { now: () => time, setTimeout(fn) { callback = fn; active = true; return 1 }, clearTimeout() { active = false } }
    const c = createQuickController({ enabled: true, athleteId, date, data: empty(), clock, currentDay: () => current,
      save: { weight: async payload => { writes.push(payload); return true } } })
    try {
      c.setField('weight', 'weight', '72,5'); assert.equal(c.save('weight'), true)
      const staleCallback = callback
      if (action === 'undo') { time = 4999; assert.equal(c.undo(), true) }
      if (action === 'dispose') c.dispose()
      if (action === 'day-change') current = '2026-11-05'
      if (action === 'early-timer') { time = 4999; callback(); assert.equal(writes.length, 0) }
      time = 5000
      if (action === 'deadline-undo') assert.equal(c.undo(), false)
      staleCallback(); callback()
      for (let i = 0; i < 6; i++) await Promise.resolve()
      if (['early-timer', 'deadline-undo'].includes(action)) {
        assert.deepEqual(writes, [{ athlete_id: athleteId, logged_at: date, weight: 72.5 }])
      } else assert.deepEqual(writes, [])
      assert.equal(active, false)
    } finally { c.dispose() }
  }
})

test('review: switching OFF/disposal synchronously at saving notification prevents write', async () => {
  let callback, time = 0, writes = 0
  const clock = { now: () => time, setTimeout(fn) { callback = fn; return 1 }, clearTimeout() {} }
  const c = createQuickController({ enabled: true, athleteId, date, data: empty(), clock,
    save: { weight: async () => { writes++; return true } } })
  c.subscribe(() => { if (c.snapshot().phase === 'saving') c.dispose() })
  c.setField('weight', 'weight', '80'); c.save('weight')
  time = 5000; callback(); await Promise.resolve()
  assert.equal(writes, 0)
})

test('review: no foreign/private property reads; errors never persist drafts or invoke writes', () => {
  const foreign = new Proxy({ athlete_id: 'synthetic-foreign' }, {
    get(target, key) { if (key === 'athlete_id') return target.athlete_id; throw Error('Foreign read') },
  })
  let storageReads = 0, storageWrites = 0
  const c = createQuickController({ enabled: true, athleteId, date,
    data: { ...empty(), readinessRows: [foreign], weightRows: [foreign], mealRows: [foreign] },
    storage: { getItem() { storageReads++; return null }, setItem() { storageWrites++ } },
    save: { readiness() { throw Error('Unexpected write') } } })
  try {
    assert.equal(c.snapshot().phase, 'ready'); assert.equal(storageReads, 1)
    assert.equal(c.save('readiness'), false); assert.equal(storageWrites, 0)
  } finally { c.dispose() }
})

test('review: clock adapter exceptions never expose private exception text', () => {
  const c = createQuickController({ enabled: true, athleteId, date, data: empty(),
    currentDay() { throw new TypeError('synthetic-sensitive-error') }, save: { weight() { throw Error('Unexpected write') } } })
  try {
    c.setField('weight', 'weight', '80')
    assert.equal(c.save('weight'), false)
    assert.doesNotMatch(c.snapshot().message, /synthetic-sensitive-error/)
    assert.match(c.snapshot().message, /Dagen er skiftet/)
  } finally { c.dispose() }
})
