import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachNutrition, startCoachNutritionRead, selectCoachNutrition } from './coachNutritionRead.mjs'
import { nutritionDatabase as database, nutritionMeal as meal } from './coachNutritionPagination.fixture.mjs'
import { kostMaalNutritionRead } from './kostMaalKobling.mjs'
import { nutritionBasis } from './kostMaal/nutritionWeek.mjs'
import { coachNutritionLines } from './coach/coachNutrition.mjs'

const athleteId = 'synthetic-day-athlete', otherId = 'synthetic-other-athlete', day = '2026-11-05'
const context = (ids = [athleteId, otherId]) => ({ coachId: 'synthetic-coach', day, athleteIds: [...ids] })
const flush = () => new Promise(resolve => setImmediate(resolve))
const pages = (db, table) => db.calls.filter(call => call.table === table)
function guards(batch, scope = context()) {
  const props = { enabled: true, athlete: { id: scope.athleteIds[0] }, today: scope.day,
    session: { user: { id: scope.coachId } }, readContext: scope, coachNutrition: batch,
    weightStatus: { athleteId: scope.athleteIds[0], state: 'ready', rows: [] } }
  assert.equal(kostMaalNutritionRead(props), undefined)
  assert.notEqual(nutritionBasis(props).state, 'ready')
  assert.equal(coachNutritionLines(props, scope.day, [{ id: scope.athleteIds[0] }], true).size, 0)
  assert.equal(batch.complete, false)
  assert.equal(batch.rows, undefined); assert.equal(batch.targets, undefined)
}
function everyFilter(db, scope) {
  for (const call of db.calls) {
    assert.deepEqual(call.filters, call.table === 'meal_logs'
      ? [['athlete_id', 'in', scope.athleteIds], ['date', 'gte', '2026-10-30'], ['date', 'lte', day]]
      : [['id', 'in', scope.athleteIds]])
    assert.deepEqual(call.orders, call.table === 'meal_logs' ? [['date', true], ['id', true]] : [['id', true]])
    assert.ok(call.range[1] - call.range[0] < 1000)
  }
}

test('projection fixture independently honors filters, numeric/date total order, range and smaller server cap', async () => {
  const db = database([meal(10), meal(1), meal(2), meal(0, { date: '2026-11-04' }),
    meal(3, { athlete_id: 'outside' }), meal(4, { date: '2026-11-06' })], { serverCap: 2 })
  const result = await db.client.from('meal_logs').select('id, carb').in('athlete_id', [athleteId])
    .gte('date', '2026-11-04').lte('date', day).order('date').order('id').range(1, 99)
  assert.deepEqual(result.data, [{ id: 2, carb: 50 }, { id: 3, carb: 50 }])
})

test('1001+ rows under server cap37 exhaust both tables, retaining every macro and original scope', async () => {
  const ids = Array.from({ length: 1100 }, (_, i) => `synthetic-${String(i).padStart(5, '0')}`)
  const scope = context(ids), rows = Array.from({ length: 1111 }, (_, i) => meal(i, {
    athlete_id: ids[i % ids.length], date: `2026-11-0${i % 5 + 1}`,
    carb: [0, null, undefined, '12.5'][i % 4], fat: [undefined, '0', null, 15][i % 4],
  }))
  rows.push(meal(99998, { athlete_id: 'outside' }), meal(99999, { date: '2026-10-29', athlete_id: ids[0] }),
    meal(100000, { date: '2026-11-06', athlete_id: ids[0] }))
  const goals = ids.map((id, i) => ({ id, kcal_target: i % 2 ? '0' : null, protein_target: i }))
  const before = structuredClone({ rows, goals }), db = database(rows, { goals, serverCap: 37 })
  const batch = await readCoachNutrition(db.client, scope)
  assert.equal(batch.state, 'ready'); assert.equal(batch.complete, true)
  assert.equal(batch.rows.length, 1111); assert.equal(batch.targets.length, 1100)
  assert.deepEqual(new Set(batch.rows.map(row => row.id)), new Set(rows.slice(0, 1111).map(row => String(row.id))))
  for (const row of batch.rows) {
    const original = rows.find(stored => String(stored.id) === row.id)
    assert.equal(row.athlete_id, original.athlete_id); assert.equal(row.date, original.date)
    for (const key of ['kcal', 'protein', 'carb', 'fat']) assert.ok(Object.is(row[key], original[key]))
    assert.deepEqual(Object.keys(row), ['id', 'athlete_id', 'date', 'meal', 'kcal', 'protein', 'carb', 'fat'])
  }
  assert.deepEqual(batch.targets, goals.map(row => ({ athlete_id: row.id, kcal_target: row.kcal_target, protein_target: row.protein_target })))
  for (const [table, count] of [['meal_logs', 1111], ['athletes', 1100]]) {
    const calls = pages(db, table)
    assert.equal(calls.length, Math.ceil(count / 37) + 1)
    assert.equal(calls.at(-1).range[0], count)
    assert.deepEqual(calls.slice(0, -1).map(call => call.range[0]), Array.from({ length: Math.ceil(count / 37) }, (_, i) => i * 37))
  }
  everyFilter(db, scope); assert.deepEqual({ rows, goals }, before)
})

for (const [cap, count] of [[37, 74], [1000, 1000], [1000, 2000], [37, 0]]) {
  test(`empty terminal required with exact multiple ${count} and server cap${cap}`, async () => {
    const db = database(Array.from({ length: count }, (_, i) => meal(i)), { goals: [], serverCap: cap })
    const result = await readCoachNutrition(db.client, context())
    assert.equal(result.state, 'ready'); assert.equal(result.rows.length, count); assert.deepEqual(result.targets, [])
    assert.equal(pages(db, 'meal_logs').length, count / cap + 1)
    assert.equal(pages(db, 'meal_logs').at(-1).range[0], count)
    everyFilter(db, context())
  })
}

test('empty roster is complete without queries; empty meals and targets retain original no-data shape', async () => {
  const db = database([], { goals: [] })
  const empty = await readCoachNutrition(db.client, context([]))
  assert.equal(db.calls.length, 0); assert.equal(empty.state, 'ready'); assert.deepEqual(empty.rows, [])
  const result = await readCoachNutrition(db.client, context())
  assert.equal(db.calls.length, 2); assert.equal(result.state, 'ready')
  assert.deepEqual(result.rows, []); assert.deepEqual(result.targets, [])
})

for (const table of ['meal_logs', 'athletes']) {
  test(`${table}: page budget includes terminal empty; low cap never silently exhausts`, async () => {
    for (const count of [99, 100]) {
      const ids = Array.from({ length: count }, (_, i) => `synthetic-${String(i).padStart(5, '0')}`)
      const scope = table === 'athletes' ? context(ids) : context()
      const db = database(table === 'meal_logs' ? ids.map((_, i) => meal(i)) : [],
        { serverCap: 1, goals: table === 'athletes' ? ids.map(id => ({ id })) : [] })
      const result = await readCoachNutrition(db.client, scope)
      assert.equal(pages(db, table).length, 100)
      if (count === 99) assert.equal(result.state, 'ready')
      else { assert.equal(result.state, 'partial'); guards(result, scope) }
    }
  })
  test(`${table}: 10000-row budget retains partial; 9999 plus terminal empty is ready`, async () => {
    for (const count of [9999, 10000]) {
      const ids = Array.from({ length: count }, (_, i) => `synthetic-${String(i).padStart(5, '0')}`)
      const scope = table === 'athletes' ? context(ids) : context()
      const db = database(table === 'meal_logs' ? ids.map((_, i) => meal(i)) : [],
        { goals: table === 'athletes' ? ids.map(id => ({ id })) : [] })
      const result = await readCoachNutrition(db.client, scope)
      assert.equal(result.state, count === 9999 ? 'ready' : 'partial')
      if (count === 10000) { guards(result, scope); assert.equal(pages(db, table).length, 10) }
    }
  })
  for (const failure of ['error', 'throw', 'malformed', 'overlap', 'reverse', 'foreign', 'oversize']) {
    test(`${table}: midstream ${failure} cannot become no-log or low-intake evidence`, async () => {
      const scope = context(), rows = [meal(0), meal(1), meal(2)]
      let previous
      const db = database(rows, { serverCap: 1, response(call, data) {
        if (call.table === table && call.range[0] === 1) {
          if (failure === 'error') return { error: { code: 'synthetic' }, data: null }
          if (failure === 'throw') throw Error('synthetic')
          if (failure === 'malformed') return { data: null }
          if (failure === 'overlap') data = previous
          if (failure === 'reverse') data = [{ ...data[0], id: table === 'meal_logs' ? 0 : 'a' }]
          if (failure === 'foreign') data = [{ ...data[0], athlete_id: 'outside', id: 'outside' }]
          if (failure === 'oversize') data = Array.from({ length: 1001 }, () => data[0])
        }
        if (call.table === table) previous = data
        return { data, error: null }
      } })
      const result = await readCoachNutrition(db.client, scope)
      assert.notEqual(result.state, 'ready'); guards(result, scope)
      assert.equal(pages(db, table).length, 2)
    })
  }
}

test('duplicate within a page, ignored ranges and decreasing unique order are ambiguous', async () => {
  for (const mode of ['duplicate', 'ignore', 'backwards']) {
    const db = database([meal(0), meal(1), meal(2)], { serverCap: 2, response(call, data) {
      if (call.table === 'meal_logs') {
        if (mode === 'duplicate' && !call.range[0]) data = [data[0], data[0]]
        if (mode === 'ignore' && call.range[0]) data = [meal(0), meal(1)]
        if (mode === 'backwards' && !call.range[0]) data = data.reverse()
      }
      return { data, error: null }
    } })
    const result = await readCoachNutrition(db.client, context())
    assert.equal(result.state, 'partial'); guards(result)
    assert.ok(pages(db, 'meal_logs').length <= 2)
  }
})

test('date/id total order rejects backward date and duplicate ids across dates; wrong-date response is error', async () => {
  for (const change of [{ date: '2026-11-04' }, { id: 1, date: day }, { date: '2026-10-29' }]) {
    const db = database([meal(0), meal(1)], { serverCap: 1, response(call, data) {
      return { error: null, data: call.table === 'meal_logs' && call.range[0] === 1 ? [{ ...data[0], ...change }] : data }
    } })
    guards(await readCoachNutrition(db.client, context()))
  }
})

test('direct read snapshots a mutable roster/owner/day; every later page keeps original filters', async () => {
  const scope = context(), original = structuredClone(scope)
  const db = database(Array.from({ length: 80 }, (_, i) => meal(i)), { serverCap: 37, before(call) {
    if (call.table === 'meal_logs' && call.range[0] === 0) {
      scope.athleteIds.push('outside'); scope.coachId = 'another-owner'; scope.day = '2026-11-06'
    }
  } })
  const result = await readCoachNutrition(db.client, scope)
  assert.equal(result.state, 'ready'); everyFilter(db, original)
  assert.deepEqual(result.athleteIds, original.athleteIds); assert.equal(result.coachId, original.coachId)
  assert.equal(result.day, original.day)
  assert.equal(selectCoachNutrition({ context: scope, batch: result }, true, scope), undefined)
})

for (const table of ['meal_logs', 'athletes']) for (const mode of ['dispose', 'roster', 'owner', 'day']) {
  test(`${table}: ${mode} during a pending page stops subsequent requests and delivery`, async () => {
    let release, reached
    const held = new Promise(resolve => { release = resolve }), waiting = new Promise(resolve => { reached = resolve })
    const scope = context(), results = []
    const db = database(Array.from({ length: 80 }, (_, i) => meal(i)), { serverCap: 1, before(call) {
      if (call.table === table && call.range[0] === 1) { reached(); return held }
    } })
    const stop = startCoachNutritionRead({ enabled: true, client: db.client, readContext: scope }, result => results.push(result))
    try {
      await waiting
      if (mode === 'dispose') stop()
      if (mode === 'roster') scope.athleteIds.push('outside')
      if (mode === 'owner') scope.coachId = 'another-owner'
      if (mode === 'day') scope.day = '2026-11-06'
      const count = db.calls.length
      release(); await flush(); await flush()
      assert.equal(db.calls.length, count); assert.deepEqual(results, [])
    } finally { stop(); release() }
  })
}

test('OFF, invalid roster and missing client start no effect or queries', () => {
  const db = database()
  for (const readContext of [undefined, context([athleteId, athleteId]), context([null])])
    assert.equal(startCoachNutritionRead({ enabled: true, client: db.client, readContext }, assert.fail), undefined)
  assert.equal(startCoachNutritionRead({ enabled: false, client: db.client, readContext: context() }, assert.fail), undefined)
  assert.equal(startCoachNutritionRead({ enabled: true, readContext: context() }, assert.fail), undefined)
  assert.equal(db.calls.length, 0)
})
