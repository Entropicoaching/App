// Exact DRAFT SQL; synthetic in-memory PostgreSQL only. Never skips a missing gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPlanSnapshot, summarizePlanSnapshot } from './planSnapshot.mjs'

const directory = new URL('../../../supabase/sql/udkast/', import.meta.url)
const up = readFileSync(new URL('20261104211000_kostplan_v1_DRAFT.sql', directory), 'utf8')
const down = readFileSync(new URL('20261104211000_kostplan_v1_DRAFT_ROLLBACK.sql', directory), 'utf8')
const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
const ids = Array.from({ length: 40 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
const [owner, otherOwner, coach, otherCoach, replacement, a1, a2, p1, p2, alternate, v1, v2, v3, vOther, vAlternate] = ids
const tables = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
const snapshot = () => createPlanSnapshot({ goal: 'bulk', intensity: 0.5, meals: [
  { name: 'Synthetic meal', portions: [{ grams: 150, food: {
    name: 'Synthetic food', nutrientsPer100g: { energyKcal: 200, proteinG: 10, carbohydrateG: 25, fatG: 6, ironMg: 2 },
    source: { citation: 'synthetic fixture', verification: 'synthetic' },
  } }] },
] })
const reject = (promise, code) => assert.rejects(promise, { code })

test('REQUIRED PGlite: actual SQL, food snapshots, RLS, coach corrections, automatic limits, up/down/up', { timeout: 60000 }, async t => {
  let PGlite
  try { ({ PGlite } = await import('@electric-sql/pglite')) }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    assert.fail('REQUIRED GATE NOT RUN: @electric-sql/pglite unavailable; installation forbidden. Dhurva must run this exact file before merge.')
  }
  // Every subtest gets a fresh database; failures cannot contaminate later cases.
  async function fixture(run) {
    const db = new PGlite()
    const query = (sql, args = []) => db.query(sql, args)
    const as = async (uid, role = 'authenticated') => {
      assert.ok(['authenticated', 'anon'].includes(role))
      await db.exec('reset role')
      await query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ''])
      await db.exec(`set role ${role}`)
    }
    const count = async table => {
      assert.ok([...tables, 'athletes'].includes(table))
      return Number((await query(`select count(*) n from public.${table}`)).rows[0].n)
    }
    const plan = (id = p1, athlete = a1) => query(
      "insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values ($1,$2,'2026-11-02')", [id, athlete])
    const version = (id = v1, parent = p1, n = 1, date = '2026-11-02', overrides = {}) => {
      const data = { id, plan_id: parent, version_no: n, effective_from: date, basis_as_of: '2026-11-01',
        calculation_basis: basis, rationale: 'Synthetic explanation', ...snapshot(), ...overrides }
      const keys = Object.keys(data)
      assert.ok(keys.every(k => /^[a-z_]+$/.test(k)))
      return query(`insert into public.kostplan_v1_versions(${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
        keys.map(k => ['calculation_basis', 'meals'].includes(k) ? JSON.stringify(data[k]) : data[k]))
    }
    const approve = (id = v1, kind = 'coach') => query(
      'insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,$2)', [id, kind])
    // TEST ADMIN ONLY: age fixture rows without mocking the real SQL clock.
    const age = async () => {
      await db.exec('reset role')
      await query(`update public.kostplan_v1_approvals set
        approved_at=clock_timestamp()-interval '8 days',
        week_start=date_trunc('week',(clock_timestamp()-interval '8 days') at time zone 'Europe/Copenhagen')::date`)
      await as(coach)
    }
    const parentCatalog = async () => (await query(`select c.relacl::text, c.relrowsecurity,
      (select count(*) from pg_policy where polrelid=c.oid)::int as policies,
      (select count(*) from pg_attribute where attrelid=c.oid and attnum>0)::int as columns,
      (select count(*) from pg_trigger where tgrelid=c.oid and not tgisinternal)::int as triggers
      from pg_class c where c.oid='public.athletes'::regclass`)).rows
    try {
      await db.exec(`create role authenticated nologin; create role anon nologin;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon;
        grant execute on function auth.uid() to authenticated, anon;
        create table public.athletes(id uuid primary key, user_id uuid, coach_id uuid);
        alter table public.athletes enable row level security;
        grant select on public.athletes to authenticated;
        create policy fixture_athletes_read on public.athletes for select to authenticated
          using (user_id = auth.uid() or coach_id = auth.uid());`)
      await query('insert into public.athletes values ($1,$2,$3),($4,$5,$6)', [a1, owner, coach, a2, otherOwner, otherCoach])
      const beforeCatalog = await parentCatalog()
      await db.exec(up)
      await run({ db, query, as, count, plan, version, approve, age, parentCatalog, beforeCatalog })
    } finally { await db.close() }
  }

  await t.test('only current coach creates drafts; athletes and foreign coaches cannot read or write them', () => fixture(async f => {
    const { as, query, count, plan, version, approve } = f
    await as(coach); await plan(); await version()
    await reject(plan(ids[15], a2), '42501')
    await reject(query("insert into public.kostplan_v1_plans(athlete_id,valid_from,status) values ($1,'2026-11-02','godkendt')", [a1]), '42501')
    await reject(query('update public.kostplan_v1_plans set athlete_id=$1 where id=$2', [a2, p1]), '42501')
    await reject(query("update public.kostplan_v1_plans set status='godkendt' where id=$1", [p1]), '42501')
    for (const uid of [owner, otherOwner, otherCoach, replacement, a1, null]) {
      await as(uid)
      for (const table of tables) assert.equal(await count(table), 0)
      await reject(approve(), '42501')
      await reject(version(ids[16], p1, 2), '42501')
    }
    await as(owner); await reject(plan(ids[17]), '42501')
    await as(null, 'anon')
    for (const table of tables) await reject(query(`select * from public.${table}`), '42501')
    for (const fn of ['prepare', 'publish']) await reject(query(`select public.kostplan_v1_${fn}_approval()`), '42501')
  }))

  await t.test('schema rejects obsolete goals, intensity errors and malformed gram/nutrient snapshots', () => fixture(async f => {
    const { as, query, plan, version, approve } = f
    await as(coach); await plan()
    const badMeals = [null, {}, [null], [{ name: ' ', portions: [] }]]
    for (const mutate of [
      p => { p.grams = -1 }, p => { p.grams = 0 }, p => { p.grams = '150' },
      p => { p.food.basisGrams = 1 }, p => { delete p.food.id },
      p => { p.food.nutrientsPer100g.ironMg = -1 }, p => { p.food.nutrientsPer100g.ironMg = '2' },
      p => { p.food.nutrientsPer100g.ironG = 2 }, p => { p.food.source = {} },
    ]) {
      const meals = JSON.parse(JSON.stringify(snapshot().meals)); mutate(meals[0].portions[0]); badMeals.push(meals)
    }
    for (const overrides of [
      ...['opbygning', 'vaegtklasse_cut', 'restitution', ''].map(goal => ({ goal })),
      ...[-1, 1.1, 'NaN', 'Infinity', '-Infinity'].map(intensity => ({ intensity })),
      { rationale: ' \n\t' }, { calculation_basis: {} }, { calculation_basis: [] },
      { basis_as_of: '2026-11-03' }, ...badMeals.map(meals => ({ meals })),
    ]) await reject(version(v1, p1, 1, '2026-11-02', overrides), '23514')
    await reject(version(v1, p1, 1, '2026-11-01'), '42501')
    await reject(version(v1, p1, 1, 'infinity'), '23514')
    await version(v1, p1, 1, '2026-11-02', { meals: [] })
    await reject(approve(), '23514')
    await reject(query('insert into public.kostplan_v1_approvals(version_id,coach_id) values ($1,$2)', [v1, otherCoach]), '42501')
    for (const [i, goal] of ['bulk', 'vedligehold', 'cut'].entries()) {
      await version(ids[18 + i], p1, 2 + i, '2026-11-02', { goal, intensity: i / 2 })
    }
  }))

  await t.test('SQL round-trip calculates actual macros/micronutrients; only approved versions are visible', () => fixture(async f => {
    const { as, query, count, plan, version, approve } = f
    await as(coach); await plan(); await version(); await approve()
    const approval = (await query('select * from public.kostplan_v1_approvals')).rows[0]
    assert.equal(approval.coach_id, coach); assert.equal(approval.athlete_id, a1)
    assert.equal(approval.plan_id, p1); assert.equal(approval.approval_kind, 'coach')
    assert.equal((await query("select (week_start=date_trunc('week',approved_at at time zone 'Europe/Copenhagen')::date) ok from public.kostplan_v1_approvals")).rows[0].ok, true)
    await version(v2, p1, 2, '2026-11-02', { goal: 'cut', intensity: 0.25 })
    for (const statement of ["update public.kostplan_v1_versions set rationale='changed'", 'delete from public.kostplan_v1_versions',
      'update public.kostplan_v1_approvals set approved_at=now()', 'delete from public.kostplan_v1_approvals']) {
      await reject(query(statement), '42501')
    }
    await as(owner)
    assert.deepEqual((await query('select id from public.kostplan_v1_versions')).rows.map(v => v.id), [v1])
    assert.equal(await count('kostplan_v1_approvals'), 1)
    const saved = (await query('select goal,intensity::float8 as intensity,meals from public.kostplan_v1_versions')).rows[0]
    const totals = summarizePlanSnapshot(saved)
    assert.equal(totals.nutrients.energyKcal.value, 300)
    assert.equal(totals.nutrients.proteinG.value, 15)
    assert.equal(totals.nutrients.carbohydrateG.value, 37.5)
    assert.equal(totals.nutrients.fatG.value, 9)
    assert.equal(totals.nutrients.ironMg.value, 3)
    assert.equal(totals.nutrients.vitaminDUg.value, null)
    await reject(approve(v2), '42501')
    await as(otherOwner); for (const table of tables) assert.equal(await count(table), 0)
  }))

  await t.test('coach corrects the same week and same day, including through a replacement plan', () => fixture(async f => {
    const { as, query, count, plan, version, approve } = f
    await as(coach); await plan(); await version(); await approve()
    await version(v2, p1, 2, '2026-11-02', { rationale: 'Correct mistaken activation', goal: 'cut', intensity: 0.25 })
    await approve(v2)
    await plan(alternate); await version(vAlternate, alternate)
    await approve(vAlternate)
    assert.equal(await count('kostplan_v1_approvals'), 3)
    assert.equal(Number((await query('select count(distinct week_start) n from public.kostplan_v1_approvals')).rows[0].n), 1)
    await as(owner)
    assert.deepEqual((await query('select version_no from public.kostplan_v1_versions where plan_id=$1 order by version_no', [p1])).rows.map(v => v.version_no), [1, 2])
  }))

  await t.test('automatic gate spans plans, waits seven days and never restricts immediate coach corrections', () => fixture(async f => {
    const { as, query, count, plan, version, approve, age } = f
    await as(coach); await plan(); await version(); await approve(v1, 'automatic')
    await version(v2, p1, 2, '2026-11-08')
    await reject(approve(v2, 'automatic'), '23514')
    await plan(alternate); await version(vAlternate, alternate, 1, '2026-11-09')
    await reject(approve(vAlternate, 'automatic'), '23514') // Cannot evade via another plan.
    await age()
    await reject(approve(v2, 'automatic'), '23514') // Effective date advances only six days.
    await version(v3, p1, 3, '2026-11-09')
    await reject(approve(v2), '23514') // Stale even on the coach path.
    await approve(v3, 'automatic')
    await version(ids[21], p1, 4, '2026-11-16', { rationale: 'Immediate coach correction' })
    await reject(approve(ids[21], 'automatic'), '23514') // Actual clock still too soon.
    await approve(ids[21])
    assert.equal(await count('kostplan_v1_approvals'), 3)
    await as(otherCoach); await plan(p2, a2); await version(vOther, p2); await approve(vOther, 'automatic')
    await as(otherOwner); assert.equal(await count('kostplan_v1_approvals'), 1)
  }))

  await t.test('ON CONFLICT DO NOTHING cannot bypass validation or activate an ineligible replacement', () => fixture(async f => {
    const { as, query, count, plan, version, approve } = f
    await as(coach); await plan(); await version(); await approve(v1, 'automatic')
    await plan(alternate); await version(vAlternate, alternate, 1, '2026-11-09')
    await reject(query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,'automatic') on conflict do nothing", [vAlternate]), '23514')
    await reject(query('insert into public.kostplan_v1_approvals(version_id) values ($1) on conflict do nothing', [v1]), '23514')
    assert.equal((await query('select status from public.kostplan_v1_plans where id=$1', [alternate])).rows[0].status, 'forslag')
    assert.equal(await count('kostplan_v1_approvals'), 1)
  }))

  await t.test('archive hides athlete history, rejects activation and cannot be reopened; reassignment revokes old coach', () => fixture(async f => {
    const { db, as, query, count, plan, version, approve } = f
    await as(coach); await plan(); await version(); await approve()
    await version(v2, p1, 2)
    await as(owner); await query("update public.kostplan_v1_plans set status='arkiveret' where id=$1", [p1])
    assert.equal(await count('kostplan_v1_plans'), 1)
    await as(coach); await query("update public.kostplan_v1_plans set status='arkiveret' where id=$1", [p1])
    await reject(query("update public.kostplan_v1_plans set status='forslag' where id=$1", [p1]), '42501')
    await reject(version(v3, p1, 3), '42501'); await reject(approve(v2), '23514')
    await as(owner); for (const table of tables) assert.equal(await count(table), 0)
    await as(coach); await plan(alternate); await version(vAlternate, alternate)
    await db.exec('reset role'); await query('update public.athletes set coach_id=$1 where id=$2', [replacement, a1])
    await as(coach); for (const table of tables) assert.equal(await count(table), 0)
    await reject(approve(vAlternate), '42501'); await reject(version(v3, alternate, 2), '42501')
    await as(replacement); assert.equal(await count('kostplan_v1_plans'), 2)
    await approve(vAlternate)
    await as(owner); assert.equal(await count('kostplan_v1_plans'), 1)
  }))

  await t.test('up/down/up/down removes all new objects and preserves existing schema, grants and rows', () => fixture(async f => {
    const { db, query, as, count, plan, version, approve, parentCatalog, beforeCatalog } = f
    await as(coach); await plan(); await version(); await approve()
    await db.exec('reset role')
    const rows = (await query('select * from public.athletes order by id')).rows
    assert.deepEqual(await parentCatalog(), beforeCatalog)
    for (let i = 0; i < 2; i++) {
      await db.exec(down)
      for (const table of tables) assert.equal((await query('select to_regclass($1) obj', ['public.' + table])).rows[0].obj, null)
      assert.equal(Number((await query("select count(*) n from pg_proc where proname like 'kostplan_v1_%'")).rows[0].n), 0)
      assert.deepEqual(await parentCatalog(), beforeCatalog)
      assert.deepEqual((await query('select * from public.athletes order by id')).rows, rows)
      if (i === 0) {
        await db.exec(up); await as(coach)
        for (const table of tables) assert.equal(await count(table), 0)
        await db.exec('reset role')
      }
    }
  }))
})
