import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createIntakeEvidenceReader } from './intakeEvidenceReader.mjs'
import { createIntakeEvidenceRequest } from './intakeEvidence.mjs'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const athleteId = id(101), foreignAthlete = id(102), ownerId = id(201), foreignOwner = id(202)
const coach = id(301), foreignCoach = id(302), date = '2026-11-09'
const source = readFileSync(new URL('./intakeEvidence.sql.test.mjs', import.meta.url), 'utf8')
// Reuse the EXACT original public auth/RLS fixture, including the legacy email
// OR coach policy. No replacement policy or amended grants are invented here.
const fixtureStart = source.indexOf('await db.exec(`create role anon') + 'await db.exec(`'.length
const fixtureEnd = source.indexOf('`)', fixtureStart)
assert.ok(fixtureStart > 20 && fixtureEnd > fixtureStart)
const fixtureSQL = source.slice(fixtureStart, fixtureEnd)
assert.ok(fixtureSQL.startsWith('create role anon') && !fixtureSQL.includes('${') && !fixtureSQL.includes('\\'))
const oldSQL = readFileSync(new URL('../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const draftSQL = readFileSync(new URL('../../../supabase/sql/udkast/meal_intake_evidence_v1_DRAFT.sql', import.meta.url), 'utf8')
const food = createFood({ id: 'synthetic:sql-reader', name: 'Synthetic SQL reference', preparation: 'raw',
  nutrientsPer100g: { energyKcal: 123.4, proteinG: 10, carbohydrateG: 12, fatG: 0, ironMg: 2, calciumMg: 0 },
  source: { citation: 'Synthetic fixture only', verification: 'unverified user reference' } })

test('one finally-closed SQL fixture: normal authenticated RPC, JSON projection, actual RLS, edit and delete', { timeout: 45000 }, async t => {
  const db = new PGlite(), readers = [], calls = []
  const login = async (uid, email) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [uid, JSON.stringify({ sub: uid, email })])
    await db.exec('set role authenticated')
    const row = (await db.query(`select current_user name, r.rolsuper, r.rolbypassrls,
      pg_get_userbyid(c.relowner) table_owner from pg_roles r,pg_class c
      where r.rolname=current_user and c.oid='public.meal_logs'::regclass`)).rows[0]
    assert.equal(row.name, 'authenticated'); assert.equal(row.rolsuper, false); assert.equal(row.rolbypassrls, false)
    assert.notEqual(row.table_owner, 'authenticated')
  }
  const request = (athlete, n) => createIntakeEvidenceRequest({ athleteId: athlete, date, requestId: id(n), grams: 60,
    meal: 'Synthetic canonical portion', food })
  const rpc = async r => (await db.query('select public.record_meal_intake_evidence_v1($1::jsonb) pair', [JSON.stringify(r)])).rows[0].pair
  // Only mechanical query translation, with the original filters/projection and
  // range executed by SQL. to_jsonb provides actual Data API-like JSON scalar
  // types; typed PGlite DATE/NUMERIC output never reaches the product reader.
  const client = { from(table) {
    assert.ok(['meal_logs', 'meal_intake_evidence_v1'].includes(table))
    const q = { table, filters: [] }
    const api = {
      select(columns, options) { q.columns = columns; assert.deepEqual(options, { count: 'exact' }); return api },
      eq(key, value) { q.filters.push([key, value]); return api },
      order(key, options) { q.order = key; assert.deepEqual(options, { ascending: true }); return api },
      async range(start, end) {
        assert.deepEqual(q.filters, [['athlete_id', athleteId], ['date', date]])
        const allowed = table === 'meal_logs' ? 'id,athlete_id,date,meal,kcal,protein,carb,fat'
          : 'meal_log_id,request_id,athlete_id,date,version,food,grams,meal,kcal,protein,carb,fat,created_at'
        assert.equal(q.columns, allowed); assert.equal(q.order, table === 'meal_logs' ? 'id' : 'meal_log_id')
        assert.ok(end - start < 500 && start >= 0 && end <= 1000)
        calls.push({ ...q, start, end })
        const filters = q.filters.map(([, value]) => value)
        const count = (await db.query(`select count(*)::int count from public.${table} where athlete_id=$1::uuid and date=$2::date`, filters)).rows[0].count
        const rows = (await db.query(`select to_jsonb(r) row from (select ${q.columns} from public.${table}
          where athlete_id=$1::uuid and date=$2::date order by ${q.order} asc limit $3 offset $4) r`,
        [...filters, end - start + 1, start])).rows.map(row => row.row)
        for (const row of rows) assert.deepEqual(Object.keys(row).sort(), q.columns.split(',').sort())
        return { data: rows, count, error: null }
      },
    }
    return api
  } }
  const reader = identity => {
    const current = { enabled: true, client, ownerId: identity, athleteId, date, generation: readers.length }
    const r = createIntakeEvidenceReader({ ...current, getCurrentScope: () => current }); readers.push(r); return r
  }
  try {
    await db.exec(fixtureSQL)
    for (const row of [[athleteId, ownerId, coach, 'owner@synthetic.invalid'],
      [foreignAthlete, foreignOwner, foreignCoach, 'foreign@synthetic.invalid']])
      await db.query('insert into public.athletes(id,user_id,coach_id,email) values($1,$2,$3,$4)', row)
    await db.exec(oldSQL)
    await db.exec(draftSQL)
    let canonical, ownReader
    await t.test('normal nonowner authenticated RPC creates one canonical pair with real zero/null JSON', async () => {
      await login(coach, 'coach@synthetic.invalid')
      canonical = await rpc(request(athleteId, 401))
      assert.equal(canonical.evidence.food.nutrientsPer100g.calciumMg, 0)
      assert.equal(canonical.evidence.food.nutrientsPer100g.magnesiumMg, null)
      ownReader = reader(coach)
      const result = await ownReader.load()
      assert.equal(result.status, 'ready'); assert.equal(result.summary.recordedRows, 1)
      assert.equal(result.summary.nutrients.ironMg.total, 1.2)
      assert.equal(result.summary.nutrients.calciumMg.total, 0)
      assert.equal(result.summary.nutrients.magnesiumMg.total, null)
      assert.equal(typeof result.evidenceRows[0].grams, 'number')
      assert.equal(typeof result.evidenceRows[0].created_at, 'string')
      assert.deepEqual(result.evidenceRows[0], canonical.evidence)
      assert.equal(result.entries[0].referenceKind, 'user-reported-reference')
      assert.deepEqual(result.entries[0].food.source, food.source)
      assert.equal(calls.length, 3)
    })
    await t.test('actual old manual write remains unknown; no food inferred from meal name', async () => {
      await db.query('insert into public.meal_logs(id,athlete_id,date,meal,kcal,protein,carb,fat) values($1,$2,$3,$4,74,6,7,0)',
        [id(402), athleteId, date, food.name])
      const result = await ownReader.load()
      assert.equal(result.status, 'ready'); assert.equal(result.summary.recordedRows, 2)
      assert.equal(result.summary.nutrients.ironMg.total, null)
      assert.equal(result.summary.nutrients.ironMg.knownSubtotal, 1.2)
      assert.equal(result.summary.nutrients.ironMg.unknownRows, 1)
    })
    await t.test('normal legacy parent edit invalidates fresh evidence, actual DELETE removes reference', async () => {
      assert.equal((await db.query('update public.meal_logs set kcal=kcal+1 where id=$1 returning id', [id(401)])).rows.length, 1)
      const edited = await ownReader.load()
      assert.equal(edited.status, 'ready'); assert.equal(edited.entries[0], null)
      assert.equal(edited.summary.nutrients.ironMg.knownRows, 0)
      assert.equal(edited.summary.nutrients.calciumMg.total, null)
      assert.equal((await db.query('delete from public.meal_logs where id=$1 returning id', [id(401)])).rows.length, 1)
      const deleted = await ownReader.load()
      assert.equal(deleted.status, 'ready'); assert.equal(deleted.summary.recordedRows, 1)
      assert.equal(deleted.evidenceRows.length, 0)
      assert.ok(deleted.mealLogs.every(row => row.id !== canonical.mealLog.id))
      assert.equal(deleted.summary.nutrients.ironMg.knownSubtotal, null)
      await db.query('delete from public.meal_logs where id=$1', [id(402)])
      const empty = await ownReader.load()
      assert.equal(empty.summary.nutrients.calciumMg.total, null)
      assert.equal(empty.summary.nutrients.ironMg.state, 'no-recorded-food')
    })
    await t.test('foreign coach rows exist but real RLS and exact scope never leak them', async () => {
      await login(foreignCoach, 'foreign-coach@synthetic.invalid')
      await rpc(request(foreignAthlete, 403))
      assert.equal((await db.query('select count(*)::int n from public.meal_intake_evidence_v1')).rows[0].n, 1)
      const foreignReader = reader(foreignCoach), inaccessible = await foreignReader.load()
      assert.equal(inaccessible.status, 'ready'); assert.equal(inaccessible.mealLogs.length, 0)
      assert.equal(inaccessible.evidenceRows.length, 0)
      await login(coach, 'coach@synthetic.invalid')
      assert.equal((await db.query('select count(*)::int n from public.meal_intake_evidence_v1')).rows[0].n, 0)
      const result = await ownReader.load()
      assert.equal(result.status, 'ready'); assert.equal(result.evidenceRows.length, 0)
      assert.equal(result.summary.nutrients.ironMg.total, null)
    })
  } finally {
    for (const r of readers) r.dispose()
    await db.close()
  }
})
