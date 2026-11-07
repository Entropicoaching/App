// Separate SQL-backed countertests for the exact packaged reader. This fixture
// does not reuse the producer's projection fake and always closes PGlite.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readCoachNutrition, startCoachNutritionRead } from './coachNutritionRead.mjs'
import { kostMaalNutritionRead } from './kostMaalKobling.mjs'

function sqlClient(db, { cap = 37, fail, before } = {}) {
  const calls = []
  const client = { from(table) {
    assert.ok(['meal_logs', 'athletes'].includes(table))
    const call = { table, predicates: [], order: [], values: [] }; calls.push(call)
    const parameter = value => { call.values.push(value); return `$${call.values.length}` }
    const q = {
      select(columns) {
        call.columns = columns.split(',').map(s => s.trim())
        assert.ok(call.columns.every(key => /^[a-z_]+$/.test(key)))
        return q
      },
      in(key, values) { call.predicates.push(`"${key}" = ANY(${parameter([...values])}::text[])`); return q },
      gte(key, value) { call.predicates.push(`"${key}" >= ${parameter(value)}`); return q },
      lte(key, value) { call.predicates.push(`"${key}" <= ${parameter(value)}`); return q },
      order(key, options) { assert.equal(options.ascending, true); call.order.push(`"${key}" ASC`); return q },
      async range(from, through) {
        call.from = from; call.through = through
        await before?.(call)
        if (fail?.(call)) return { data: null, error: { code: 'synthetic-sql-failure' } }
        const columns = call.columns.map(key => key === 'date' ? 'date::text AS date' : `"${key}"`).join(', ')
        const result = await db.query(`SELECT ${columns} FROM ${table} WHERE ${call.predicates.join(' AND ')}
          ORDER BY ${call.order.join(', ')} LIMIT ${Math.min(cap, through - from + 1)} OFFSET ${from}`, call.values)
        return { data: result.rows, error: null }
      },
    }
    return q
  } }
  return { client, calls }
}

test('independent SQL projection verifies exhaustive bounds, terminal failure and cancellation', async t => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE athletes(id text PRIMARY KEY, kcal_target integer, protein_target integer);
      CREATE TABLE meal_logs(id integer PRIMARY KEY, athlete_id text, date date, meal text,
        kcal double precision, protein double precision, carb double precision, fat double precision);
      INSERT INTO athletes SELECT 'sql-' || lpad(g::text, 3, '0'), 2400, 160 FROM generate_series(0,74) g;
      INSERT INTO meal_logs SELECT g, 'sql-' || lpad((g%75)::text,3,'0'), DATE '2026-10-30' + (g%7),
        'SQL synthetic meal',500,40,CASE WHEN g%3=0 THEN NULL WHEN g%3=1 THEN 0 ELSE 12.5 END,15
        FROM generate_series(1,1110) g;
      INSERT INTO meal_logs VALUES(9000,'outside','2026-11-05','foreign',9000,9000,9000,9000),
        (9001,'sql-000','2026-10-29','too old',9000,9000,9000,9000),
        (9002,'sql-000','2026-11-06','future',9000,9000,9000,9000);`)
    const context = { coachId: 'sql-coach', day: '2026-11-05',
      athleteIds: Array.from({ length: 75 }, (_, i) => `sql-${String(i).padStart(3, '0')}`) }
    await t.test('real SQL sorts date/id before offset, applies scope on every request and closes with empty pages', async () => {
      const f = sqlClient(db), result = await readCoachNutrition(f.client, context)
      assert.equal(result.state, 'ready'); assert.equal(result.complete, true)
      assert.equal(result.rows.length, 1110); assert.equal(result.targets.length, 75)
      for (const row of result.rows) {
        const n = Number(row.id)
        assert.ok(n >= 1 && n <= 1110)
        assert.equal(row.carb, n % 3 === 0 ? null : n % 3 === 1 ? 0 : 12.5)
        assert.equal(row.fat, 15)
      }
      for (const [table, count, pages] of [['meal_logs',1110,31],['athletes',75,4]]) {
        const calls = f.calls.filter(call => call.table === table)
        assert.equal(calls.length, pages); assert.equal(calls.at(-1).from, count)
        for (const call of calls) {
          assert.deepEqual(call.values[0], context.athleteIds)
          if (table === 'meal_logs') assert.deepEqual(call.values.slice(1), ['2026-10-30','2026-11-05'])
        }
      }
      assert.deepEqual((await db.query('SELECT COUNT(*)::int AS count FROM meal_logs')).rows, [{count:1113}])
    })
    await t.test('failure on the would-be empty page cannot turn partial evidence into a receipt', async () => {
      const f = sqlClient(db, { fail: call => call.table === 'meal_logs' && call.from === 1110 })
      const result = await readCoachNutrition(f.client, context)
      assert.equal(result.state, 'error'); assert.equal(result.complete, false)
      assert.equal(result.rows, undefined); assert.equal(result.targets, undefined)
      assert.equal(f.calls.filter(call => call.table === 'athletes').length, 0)
      assert.equal(kostMaalNutritionRead({ enabled: true, athlete: { id: context.athleteIds[0] },
        session: { user: { id: context.coachId } }, today: context.day, readContext: context,
        coachNutrition: result, weightStatus: { athleteId: context.athleteIds[0], state: 'ready', rows: [] } }), undefined)
    })
    await t.test('dispose while SQL page is held stops all later reads and callbacks', async () => {
      let release, reached
      const held = new Promise(resolve => { release = resolve }), waiting = new Promise(resolve => { reached = resolve })
      const f = sqlClient(db, { before: call => { if (call.from === 37) { reached(); return held } } })
      const values = [], stop = startCoachNutritionRead({ enabled: true, client: f.client, readContext: context }, value => values.push(value))
      try {
        await waiting; stop(); release()
        await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve))
        assert.equal(f.calls.length, 2); assert.deepEqual(values, [])
      } finally { stop(); release() }
    })
  } finally { await db.close() }
})
