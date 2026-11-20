// Ordre 1891: exact DRAFT SQL for kostplan_v1_seen on synthetic in-memory PostgreSQL only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createPlanSnapshot } from './planSnapshot.mjs'

const directory = new URL('../../../supabase/sql/udkast/', import.meta.url)
const read = name => readFileSync(new URL(name, directory), 'utf8')
const baseUp = read('20261104211000_kostplan_v1_DRAFT.sql')
const up = read('20261119120000_kostplan_v1_seen_DRAFT.sql')
const down = read('20261119120000_kostplan_v1_seen_DRAFT_ROLLBACK.sql')
const clean = sql => sql.replace(/--.*$/gm, '')
const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
const ids = Array.from({ length: 20 }, (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
const [owner, otherOwner, coach, otherCoach, a1, a2, p1, p2, pDraft, v1, v2, vDraft, vNew] = ids
const reject = (promise, code) => assert.rejects(promise, { code })

test('contract: only kostplan_v1_seen, RLS on, narrow grants, begin/commit, no live copy', () => {
  const sql = clean(up)
  assert.match(sql, /^\s*begin;[\s\S]*commit;\s*$/)
  assert.deepEqual([...sql.matchAll(/create\s+(table|index|policy)\s+([\w.]+)/gi)].map(m => m[2]),
    ['public.kostplan_v1_seen', 'kostplan_v1_seen_version', 'kostplan_v1_seen_read', 'kostplan_v1_seen_insert'])
  assert.match(sql, /create table public\.kostplan_v1_seen \(/)
  assert.match(sql, /primary key \(athlete_id, version_id\)/)
  assert.match(sql, /alter table public\.kostplan_v1_seen enable row level security;/)
  assert.doesNotMatch(sql, /\bdrop\b|\bto anon\b|security definer|\bupdate\b|\bdelete\b/i)
  assert.match(sql, /revoke all on table public\.kostplan_v1_seen from public, anon, authenticated;\s*grant select/)
  assert.deepEqual([...sql.matchAll(/grant ([^;]+);/g)].map(m => m[1].replace(/\s+/g, ' ')), [
    'select on table public.kostplan_v1_seen to authenticated',
    'insert (athlete_id, plan_id, version_id) on public.kostplan_v1_seen to authenticated'])
  assert.match(clean(down), /^\s*begin;[\s\S]*drop table public\.kostplan_v1_seen;\s*commit;\s*$/)
  assert.doesNotMatch(clean(down), /cascade/i)
  const migrations = new URL('../../../supabase/migrations/', import.meta.url)
  let names = []
  try { names = readdirSync(migrations) } catch (error) { if (error.code !== 'ENOENT') throw error }
  assert.ok(!names.some(n => /seen/i.test(n)), 'udkastet må ikke ligge som rigtig migration')
})

test('REQUIRED PGlite: athlete writes own seen row once, coach reads own athletes only, up/down/up', { timeout: 60000 }, async t => {
  let PGlite
  try { ({ PGlite } = await import('@electric-sql/pglite')) }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    assert.fail('REQUIRED GATE NOT RUN: @electric-sql/pglite unavailable')
  }
  async function fixture(run) {
    const db = new PGlite()
    const query = (sql, args = []) => db.query(sql, args)
    const as = async (uid, role = 'authenticated') => {
      await db.exec('reset role')
      await query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ''])
      await db.exec(`set role ${role}`)
    }
    const seen = (version = v1, plan = p1, athlete = a1) =>
      query('insert into public.kostplan_v1_seen(athlete_id,plan_id,version_id) values ($1,$2,$3) on conflict (athlete_id, version_id) do nothing',
        [athlete, plan, version])
    const count = async () => Number((await query('select count(*) n from public.kostplan_v1_seen')).rows[0].n)
    try {
      await db.exec(`create role authenticated nologin; create role anon nologin;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon;
        -- Som produktionen (prod-skema-20261108.sql:60): nye tabeller i public får alt for API-rollerne.
        alter default privileges in schema public grant all on tables to anon, authenticated;
        grant execute on function auth.uid() to authenticated, anon;
        create table public.athletes(id uuid primary key, user_id uuid, coach_id uuid);
        alter table public.athletes enable row level security;
        grant select on public.athletes to authenticated;
        create policy fixture_athletes_read on public.athletes for select to authenticated
          using (user_id = auth.uid() or coach_id = auth.uid());`)
      await query('insert into public.athletes values ($1,$2,$3),($4,$5,$6)', [a1, owner, coach, a2, otherOwner, otherCoach])
      await db.exec(baseUp)
      await db.exec(up)
      // Coach (a1) sends p1 and leaves pDraft as an unsent draft. otherCoach sends p2 for a2.
      const version = (id, plan, n = 1, date = '2026-11-23') => {
        const data = { id, plan_id: plan, version_no: n, effective_from: date, basis_as_of: '2026-11-19',
          calculation_basis: basis, rationale: 'Synthetic', ...createPlanSnapshot({ goal: 'bulk', intensity: 0.5, meals: [
            { name: 'Synthetic meal', portions: [{ grams: 150, food: { name: 'Synthetic food',
              nutrientsPer100g: { energyKcal: 200, proteinG: 10, carbohydrateG: 25, fatG: 6 },
              source: { citation: 'synthetic fixture', verification: 'synthetic' } } }] }] }) }
        const keys = Object.keys(data)
        return query(`insert into public.kostplan_v1_versions(${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
          keys.map(k => ['calculation_basis', 'meals'].includes(k) ? JSON.stringify(data[k]) : data[k]))
      }
      await as(coach)
      await query("insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values ($1,$2,'2026-11-23'),($3,$2,'2026-11-24')", [p1, a1, pDraft])
      await version(v1, p1); await version(vDraft, pDraft, 1, '2026-11-24')
      await query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,'coach')", [v1])
      await as(otherCoach)
      await query("insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values ($1,$2,'2026-11-23')", [p2, a2])
      await version(v2, p2)
      await query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,'coach')", [v2])
      await run({ db, query, as, seen, count, version })
    } finally { await db.close() }
  }

  await t.test('athlete writes one row for a sent version; repeat is no duplicate; seen_at is server time', () => fixture(async f => {
    await f.as(owner)
    await f.seen(); await f.seen()
    assert.equal(await f.count(), 1)
    await reject(f.query('insert into public.kostplan_v1_seen(athlete_id,plan_id,version_id,seen_at) values ($1,$2,$3,now())', [a1, p1, v1]), '42501')
    const row = (await f.query('select seen_at from public.kostplan_v1_seen')).rows[0]
    assert.ok(Math.abs(new Date(row.seen_at) - Date.now()) < 60000)
  }))

  await t.test('athlete cannot mark unsent, foreign or mismatched versions; nobody updates or deletes', () => fixture(async f => {
    await f.as(owner)
    await reject(f.seen(vDraft, pDraft), '42501')
    await reject(f.seen(v2, p2, a2), '42501')
    await reject(f.seen(v1, p1, a2), '42501')
    await f.as(coach)
    await reject(f.seen(), '42501')
    await f.as(otherOwner)
    await reject(f.seen(), '42501')
    await f.as(owner); await f.seen()
    await reject(f.query('update public.kostplan_v1_seen set seen_at = now()'), '42501')
    await reject(f.query('delete from public.kostplan_v1_seen'), '42501')
    await f.as(null, 'anon')
    await reject(f.query('select * from public.kostplan_v1_seen'), '42501')
  }))

  await t.test('coach reads own athletes only; athlete reads own only', () => fixture(async f => {
    await f.as(owner); await f.seen()
    await f.as(otherOwner); await f.seen(v2, p2, a2)
    await f.as(coach); assert.deepEqual((await f.query('select version_id from public.kostplan_v1_seen')).rows, [{ version_id: v1 }])
    await f.as(otherCoach); assert.deepEqual((await f.query('select version_id from public.kostplan_v1_seen')).rows, [{ version_id: v2 }])
    await f.as(owner); assert.deepEqual((await f.query('select version_id from public.kostplan_v1_seen')).rows, [{ version_id: v1 }])
  }))

  await t.test('a new sent version needs its own row; rollback removes only the seen table; up again works', () => fixture(async f => {
    await f.as(owner); await f.seen()
    await f.as(coach); await f.version(vNew, p1, 2)
    await f.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,'coach')", [vNew])
    await f.as(owner); await f.seen(vNew, p1)
    assert.equal(await f.count(), 2)
    await f.db.exec('reset role')
    await f.db.exec(down)
    assert.equal((await f.query("select to_regclass('public.kostplan_v1_seen') r")).rows[0].r, null)
    assert.equal(Number((await f.query('select count(*) n from public.kostplan_v1_approvals')).rows[0].n), 3)
    await f.db.exec(up)
    await f.as(owner); await f.seen(); assert.equal(await f.count(), 1)
  }))
})
