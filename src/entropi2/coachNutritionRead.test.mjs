// Actual copied reader -> host receipt -> active adapter/report. Only the
// database boundary is synthetic; SELECT projects exactly the requested fields.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachNutrition, COACH_NUTRITION_CAP, startCoachNutritionRead,
  selectCoachNutrition } from './coachNutritionRead.mjs'
import { kostMaalNutritionRead } from './kostMaalKobling.mjs'
import { startActiveReport } from './kostplan/coach/activeReport.mjs'
import { fixture, athleteId, date, flush } from './kostplan/atlet/daySession.fixture.mjs'

const coachId = 'synthetic-macro-coach'
const otherId = 'synthetic-other-athlete'
const context = () => Object.freeze({ coachId, day: date, athleteIds: Object.freeze([athleteId, otherId]) })
const meal = (patch = {}) => Object.freeze({ id: 'synthetic-meal', athlete_id: athleteId,
  date, meal: 'Synthetic meal', kcal: 500, protein: 40, carb: 50, fat: 15, ...patch })

function database(rows, options = {}) {
  const calls = [], goals = options.goals ?? Object.freeze([
    Object.freeze({ id: athleteId, kcal_target: 2400, protein_target: 160 }),
    Object.freeze({ id: otherId, kcal_target: 2000, protein_target: 120 }),
  ])
  const client = { from(table) {
    assert.ok(['meal_logs', 'athletes'].includes(table))
    const call = { table, filters: [] }; calls.push(call)
    const q = {
      select(columns) { call.columns = columns.split(',').map(key => key.trim()); return q },
      in(key, values) { call.filters.push([key, 'in', [...values]]); return q },
      gte(key, value) { call.filters.push([key, 'gte', value]); return q },
      lte(key, value) { call.filters.push([key, 'lte', value]); return q },
      order(key) { call.order = key; return q },
      async limit(cap) {
        call.cap = cap
        await options.before?.()
        if (options.throwTable === table) throw Error('Synthetic transport failure')
        if (options.errorTable === table) return { error: { code: '42501' }, data: null }
        if (options.malformedTable === table) return { error: null, data: null }
        const selected = (table === 'meal_logs' ? rows : goals).filter(row => call.filters.every(([key, op, value]) =>
          op === 'in' ? value.includes(row[key]) : op === 'gte' ? row[key] >= value : row[key] <= value))
          .sort((a, b) => String(a[call.order]).localeCompare(String(b[call.order])))
          .slice(0, cap).map(row => Object.fromEntries(call.columns.map(key => [key, row[key]])))
        return { error: null, data: selected }
      },
    }
    return q
  } }
  return { client, calls, goals }
}

function hostProps(readContext, batch) {
  return { enabled: true, athlete: Object.freeze({ id: athleteId }), today: date,
    session: Object.freeze({ user: Object.freeze({ id: coachId }) }), readContext, coachNutrition: batch,
    weightStatus: Object.freeze({ athleteId, state: 'ready', rows: Object.freeze([]) }) }
}

async function reportFrom(props, planFixture = fixture()) {
  planFixture.approve()
  const receipt = kostMaalNutritionRead(props)
  assert.ok(receipt)
  const result = await new Promise(resolve => {
    const stop = startActiveReport({ enabled: true, coachId, athleteId, date,
      receipt, client: planFixture.plan.client }, resolve)
    assert.equal(typeof stop, 'function')
  })
  assert.equal(result.state, 'ready')
  assert.equal(planFixture.plan.writes().length, 0)
  return { receipt, report: result.report }
}

test('selected macro columns reach the scoped report through the actual host and active plan adapter', async () => {
  const rows = Object.freeze([
    meal({ id: 7, date: '2026-10-30' }),
    meal({ id: 'second', carb: '12.5', fat: '0' }),
    meal({ id: 'other', athlete_id: otherId, carb: 9000, fat: 8000 }),
    meal({ id: 'foreign', athlete_id: 'outside-read', carb: 7000 }),
    meal({ id: 'old', date: '2026-10-29', carb: 6000 }),
    meal({ id: 'future', date: '2026-11-06', carb: 5000 }),
  ])
  const before = structuredClone(rows), readContext = context(), db = database(rows)
  const batch = await readCoachNutrition(db.client, readContext)
  assert.equal(batch.state, 'ready'); assert.equal(batch.complete, true)
  assert.deepEqual(db.calls, [
    { table: 'meal_logs', columns: ['id', 'athlete_id', 'date', 'meal', 'kcal', 'protein', 'carb', 'fat'],
      filters: [['athlete_id', 'in', [athleteId, otherId]], ['date', 'gte', '2026-10-30'], ['date', 'lte', date]],
      order: 'date', cap: COACH_NUTRITION_CAP },
    { table: 'athletes', columns: ['id', 'kcal_target', 'protein_target'],
      filters: [['id', 'in', [athleteId, otherId]]], order: 'id', cap: COACH_NUTRITION_CAP },
  ])
  const snapshot = structuredClone(batch)
  const { receipt, report } = await reportFrom(hostProps(readContext, batch))
  assert.deepEqual(receipt.mealLogs.map(row => row.id), ['7', 'second'])
  assert.equal(receipt.mealLogs[0], batch.rows[0])
  assert.equal(receipt.planHistory, 'unavailable')
  assert.equal(Object.hasOwn(receipt, 'plans'), false)
  assert.equal(report.athleteId, athleteId); assert.equal(report.date, date)
  assert.equal(report.days[0].totals.carb, 50); assert.equal(report.days[0].totals.fat, 15)
  assert.equal(report.days[6].totals.carb, 12.5); assert.equal(report.days[6].totals.fat, 0)
  assert.equal(report.week.metrics.carb.actual, 62.5); assert.equal(report.week.metrics.fat.actual, 15)
  assert.equal(report.week.loggedDays, 2); assert.equal(report.week.missingDays, 5)
  assert.equal(report.days[1].totals.carb, null)
  // The approved fixture starts today; earlier intake stays known but its
  // historical reference is unknown, rather than today's plan applied backwards.
  assert.equal(report.comparison, 'daily-approved-plan')
  assert.equal(report.days[0].targets.carb, null)
  assert.equal(report.days[0].percentages.carb, null)
  assert.equal(report.days[6].targets.carb, 60)
  assert.equal(report.week.metrics.carb.target, null)
  assert.equal(db.calls.length, 2)
  assert.deepEqual(rows, before); assert.deepEqual(batch, snapshot)
})

const cases = [
  ['known', { carb: 50, fat: 15 }, 50, 15],
  ['null', { carb: null, fat: null }, null, null],
  ['absent', { carb: undefined, fat: undefined }, null, null],
  ['zero', { carb: 0, fat: 0 }, 0, 0],
  ['numeric strings', { carb: '0', fat: '15,5' }, 0, 15.5],
  ['NaN', { carb: NaN, fat: 15 }, null, 15],
  ['infinity', { carb: 50, fat: Infinity }, 50, null],
  ['negative infinity', { carb: -Infinity, fat: 0 }, null, 0],
  ['invalid strings', { carb: 'NaN', fat: 'Infinity' }, null, null],
  ['blank', { carb: '', fat: ' ' }, null, null],
  ['negative', { carb: -1, fat: -2 }, null, null],
]
for (const [name, amounts, carb, fat] of cases) test(`projection to report preserves ${name} macro semantics`, async () => {
  const stored = meal(amounts), rows = Object.freeze([stored]), before = structuredClone(rows)
  const readContext = context(), db = database(rows), batch = await readCoachNutrition(db.client, readContext)
  // No normalization or substitution at the transport layer.
  for (const key of ['carb', 'fat']) assert.ok(Object.is(batch.rows[0][key], stored[key]), key)
  const { report } = await reportFrom(hostProps(readContext, batch))
  for (const [key, value] of [['carb', carb], ['fat', fat]]) {
    assert.equal(report.days[6].totals[key], value)
    assert.equal(report.week.metrics[key].actual, value)
  }
  assert.equal(report.week.unknownDays, carb === null || fat === null ? 1 : 0)
  assert.deepEqual(rows, before)
})

test('unknown mixed meals remain unknown per macro; confirmation metadata is not intake', async () => {
  const readContext = context(), db = database(Object.freeze([
    meal(), meal({ id: 'unknown-carb', carb: null, fat: 0 }),
    meal({ id: 'confirmation', meal: '  [appData2-day-v1][]', carb: 900, fat: 900 }),
  ]))
  const batch = await readCoachNutrition(db.client, readContext)
  const { report } = await reportFrom(hostProps(readContext, batch))
  assert.equal(report.days[6].mealCount, 2)
  assert.equal(report.week.metrics.carb.actual, null)
  assert.equal(report.week.metrics.fat.actual, 15)
})

test('owner, athlete, day, unfinished weight and incomplete receipt guards survive the expanded read', async () => {
  const readContext = context(), db = database([meal()]), batch = await readCoachNutrition(db.client, readContext)
  const props = hostProps(readContext, batch)
  for (const change of [
    { enabled: false }, { loading: true }, { loadError: true },
    { session: { user: { id: 'other-coach' } } }, { athlete: { id: 'outside-read' } },
    { today: '2026-11-06' }, { readContext: { ...readContext, athleteIds: [athleteId] } },
    { weightStatus: { athleteId, state: 'error' } },
    ...['partial', 'error', 'loading'].map(state => ({ coachNutrition: { ...batch, state } })),
    { coachNutrition: { ...batch, complete: false } },
  ]) assert.equal(kostMaalNutritionRead({ ...props, ...change }), undefined)
  assert.equal(selectCoachNutrition({ context: readContext, batch }, true, { ...readContext }), undefined)
  assert.equal(db.calls.length, 2)
})

test('both table caps remain incomplete; an under-cap read remains complete with the same two queries', async () => {
  for (const table of ['meal_logs', 'athletes']) for (const count of [COACH_NUTRITION_CAP - 1, COACH_NUTRITION_CAP]) {
    const ids = Array.from({ length: count }, (_, i) => `synthetic-cap-${i}`)
    const readContext = { coachId, day: date, athleteIds: table === 'athletes' ? ids : [athleteId] }
    const db = database(table === 'meal_logs' ? ids.map(id => meal({ id })) : [meal()],
      table === 'athletes' ? { goals: ids.map(id => ({ id })) } : {})
    const batch = await readCoachNutrition(db.client, readContext)
    assert.equal(batch.state, count === COACH_NUTRITION_CAP ? 'partial' : 'ready')
    assert.equal(batch.complete, count < COACH_NUTRITION_CAP)
    if (!batch.complete) {
      assert.equal(Object.hasOwn(batch, 'rows'), false)
      assert.equal(kostMaalNutritionRead(hostProps(readContext, batch)), undefined)
    }
    assert.equal(db.calls.length, 2)
    assert.ok(db.calls.every(call => call.cap === COACH_NUTRITION_CAP))
  }
})

test('query errors, thrown transport and malformed responses remain error rather than empty evidence', async () => {
  for (const table of ['meal_logs', 'athletes']) for (const failure of ['throwTable', 'errorTable', 'malformedTable']) {
    const readContext = context(), db = database([meal()], { [failure]: table })
    const batch = await readCoachNutrition(db.client, readContext)
    assert.equal(batch.state, 'error'); assert.equal(batch.complete, false)
    assert.equal(Object.hasOwn(batch, 'rows'), false)
    assert.equal(kostMaalNutritionRead(hostProps(readContext, batch)), undefined)
  }
})

test('OFF performs no reads and cancellation suppresses a late projected result', async () => {
  const db = database([meal()]), readContext = context()
  assert.equal(startCoachNutritionRead({ enabled: false, client: db.client, readContext }, assert.fail), undefined)
  assert.equal(db.calls.length, 0)
  let release
  const held = new Promise(resolve => { release = resolve })
  const delayed = database([meal()], { before: () => held }), results = []
  const stop = startCoachNutritionRead({ enabled: true, client: delayed.client, readContext }, value => results.push(value))
  stop(); release(); await flush()
  assert.deepEqual(results, [])
})
