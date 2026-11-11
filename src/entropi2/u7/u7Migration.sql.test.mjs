// U7 del 1: migrationspakken B og C og tilbagerulningen, kørt mod en PGlite i hukommelsen, hvor
// kostplanen (A) allerede findes, som den har gjort live siden 8. nov. (rettet i ordre 80).
// Kun syntetiske id'er; ingen nøgler, intet net. Springer aldrig over: mangler PGlite, fejler prøven.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const directory = new URL('../../../supabase/sql/udkast/', import.meta.url)
const read = name => readFileSync(new URL(name, directory), 'utf8').replace(/\r\n/g, '\n')
const up = read('20261111000000_u7_kost_som_data_B_C_DRAFT.sql')
const down = read('20261111000000_u7_kost_som_data_B_C_DRAFT_ROLLBACK.sql')
const kostplan = read('20261104211000_kostplan_v1_DRAFT.sql')
const inner = sql => sql.slice(sql.indexOf('begin;\n') + 7, sql.lastIndexOf('commit;')).replace(/^\n+|\n+$/g, '')
const ids = Array.from({ length: 12 }, (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
const [owner, otherOwner, coach, otherCoach, a1, a2, a3, a4] = ids
const NEW_TABLES = ['tracking_daily_v1', 'nutrition_targets_v1']
const KOSTPLAN_TABLES = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
const reject = (promise, code) => assert.rejects(promise, { code })

test('U7 SQL: kostplanen (A) er live og hverken oprettes eller fjernes, ingen menstruation, ingen cascade', () => {
  const code = sql => sql.replace(/--[^\n]*/g, '')
  assert.doesNotMatch(code(up), /kostplan/i)
  assert.doesNotMatch(code(down), /kostplan/i)
  assert.ok(inner(kostplan).length > 1000)
  assert.doesNotMatch(up + down, /(create|drop) (table|policy|function|trigger)[^\n]*(cycle|menstru)/i)
  assert.doesNotMatch(down.replace(/--[^\n]*/g, ''), /\bcascade\b/i)
  assert.equal((up.match(/^begin;$/gm) || []).length, 1)
  assert.equal((down.match(/^begin;$/gm) || []).length, 1)
  // Tilbagerulningen er omvendt: C før B.
  const at = name => down.indexOf(`drop table public.${name};`)
  assert.ok(at('nutrition_targets_v1') > 0 && at('nutrition_targets_v1') < at('tracking_daily_v1'))
})

test('U7 SQL mod PGlite: RLS, grænser, første mål, op/ned/op', { timeout: 120000 }, async t => {
  let PGlite
  try { ({ PGlite } = await import('@electric-sql/pglite')) }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    assert.fail('PGlite mangler; prøven må ikke springes over.')
  }
  async function fixture(run, { migrate = true } = {}) {
    const db = new PGlite()
    const query = (sql, args = []) => db.query(sql, args)
    const as = async (uid, role = 'authenticated') => {
      await db.exec('reset role')
      await query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ''])
      await db.exec(`set role ${role}`)
    }
    const count = async table => Number((await query(`select count(*) n from public.${table}`)).rows[0].n)
    const catalog = async () => (await query(`select c.relname, c.relacl::text,
      (select count(*) from pg_policy where polrelid=c.oid)::int as policies,
      (select count(*) from pg_trigger where tgrelid=c.oid and not tgisinternal)::int as triggers,
      (select count(*) from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped)::int as columns
      from pg_class c where c.relnamespace='public'::regnamespace order by c.relname`)).rows
    try {
      await db.exec(`create role authenticated nologin; create role anon nologin;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon;
        grant execute on function auth.uid() to authenticated, anon;
        create table public.athletes(id uuid primary key, user_id uuid, coach_id uuid,
          kcal_target integer, protein_target integer);
        alter table public.athletes enable row level security;
        grant select on public.athletes to authenticated;
        create policy fixture_athletes_read on public.athletes for select to authenticated
          using (user_id = auth.uid() or coach_id = auth.uid());`)
      await query(`insert into public.athletes values
        ($1,$2,$3,2800,180), ($4,$5,$6,null,null), ($7,null,$3,0,99999), ($8,null,null,2500,150)`,
      [a1, owner, coach, a2, otherOwner, otherCoach, a3, a4])
      // Kostplanen findes allerede, som i produktionen.
      await db.exec(kostplan)
      const before = await catalog()
      if (migrate) await db.exec(up)
      await run({ db, query, as, count, catalog, before })
    } finally { await db.close() }
  }

  await t.test('første daterede mål: kun gyldige tal, kun atleter med coach, fra i dag', () => fixture(async ({ query }) => {
    const rows = (await query(`select athlete_id, kcal, protein_g, water_ml, set_by,
      effective_from = (clock_timestamp() at time zone 'Europe/Copenhagen')::date as today
      from public.nutrition_targets_v1 order by athlete_id`)).rows
    assert.deepEqual(rows, [{ athlete_id: a1, kcal: 2800, protein_g: 180, water_ml: null, set_by: coach, today: true }])
  }))

  await t.test('dagsdata: atleten skriver egne rækker, coach læser, fremmede ser intet', () => fixture(async ({ query, as, count }) => {
    await as(owner)
    await query("insert into public.tracking_daily_v1(athlete_id,logged_date,sleep_quality,pain,pain_location) values ($1,'2026-11-09',2,6,'knæ')", [a1])
    await query("insert into public.tracking_daily_v1(athlete_id,logged_date,water_ml) values ($1,'2026-11-10',1750)", [a1])
    await query("insert into public.tracking_daily_v1(athlete_id,logged_date,kost_done_at) values ($1,'2026-11-11',now())", [a1])
    await query("insert into public.tracking_daily_v1(athlete_id,logged_date,pain) values ($1,'2026-11-12',3)", [a1])
    await query("update public.tracking_daily_v1 set water_ml=2000 where athlete_id=$1 and logged_date='2026-11-10'", [a1])
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,water_ml) values ($1,'2026-11-10',1)", [a1]), '23505')
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,water_ml) values ($1,'2026-11-10',1)", [a2]), '42501')
    await reject(query("update public.tracking_daily_v1 set athlete_id=$1", [a2]), '42501')
    await reject(query("update public.tracking_daily_v1 set logged_date='2026-01-01'"), '42501')
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,water_ml,source) values ($1,'2026-11-13',1,'coach')", [a1]), '42501')
    for (const [column, value] of [['sleep_quality', 0], ['sleep_quality', 6], ['pain', -1], ['pain', 11], ['water_ml', -1], ['water_ml', 50001]]) {
      await reject(query(`insert into public.tracking_daily_v1(athlete_id,logged_date,${column}) values ($1,'2026-11-14',$2)`, [a1, value]), '23514')
    }
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,pain,pain_location) values ($1,'2026-11-14',0,'knæ')", [a1]), '23514')
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,pain,pain_location) values ($1,'2026-11-14',4,'  ')", [a1]), '23514')
    assert.equal(await count('tracking_daily_v1'), 4)
    await as(coach)
    assert.equal(await count('tracking_daily_v1'), 4)
    assert.deepEqual((await query("select water_ml from public.tracking_daily_v1 where logged_date='2026-11-10'")).rows, [{ water_ml: 2000 }])
    await reject(query("insert into public.tracking_daily_v1(athlete_id,logged_date,water_ml) values ($1,'2026-11-20',1)", [a1]), '42501')
    assert.equal((await query('update public.tracking_daily_v1 set water_ml=1 returning 1')).rows.length, 0)
    assert.equal((await query('delete from public.tracking_daily_v1 returning 1')).rows.length, 0)
    for (const uid of [otherOwner, otherCoach, a1, null]) { await as(uid); assert.equal(await count('tracking_daily_v1'), 0) }
    await as(null, 'anon')
    await reject(query('select * from public.tracking_daily_v1'), '42501')
    await as(owner)
    assert.equal((await query("delete from public.tracking_daily_v1 where logged_date='2026-11-12' returning 1")).rows.length, 1)
  }))

  await t.test('daterede mål: kun nye rækker, coach alle felter, atlet kun væskemål, aldrig bagud', () => fixture(async ({ query, as, count }) => {
    const today = "(clock_timestamp() at time zone 'Europe/Copenhagen')::date"
    await as(coach)
    await query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal,protein_g) values ($1,${today},3000,190)`, [a1])
    await query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal) values ($1,${today},3100)`, [a1])
    await query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,water_ml) values ($1,${today} + 7,3000)`, [a1])
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal) values ($1,${today} - 2,3000)`, [a1]), '42501')
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal) values ($1,${today},3000)`, [a2]), '42501')
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal,set_by) values ($1,${today},3000,$2)`, [a1, owner]), '42501')
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from) values ($1,${today})`, [a1]), '23514')
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,water_ml) values ($1,${today},100)`, [a1]), '23514')
    await reject(query('update public.nutrition_targets_v1 set kcal=1'), '42501')
    await reject(query('delete from public.nutrition_targets_v1'), '42501')
    await as(owner)
    await query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,water_ml) values ($1,${today},2500)`, [a1])
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,kcal) values ($1,${today},4000)`, [a1]), '42501')
    await reject(query(`insert into public.nutrition_targets_v1(athlete_id,effective_from,water_ml,protein_g) values ($1,${today},2500,300)`, [a1]), '42501')
    assert.equal(await count('nutrition_targets_v1'), 5)
    const own = (await query('select set_by from public.nutrition_targets_v1 where water_ml = 2500')).rows
    assert.deepEqual(own, [{ set_by: owner }])
    for (const uid of [otherOwner, otherCoach, null]) { await as(uid); assert.equal(await count('nutrition_targets_v1'), 0) }
    await as(null, 'anon')
    await reject(query('select * from public.nutrition_targets_v1'), '42501')
  }))

  await t.test('kostplanen (A), som allerede er live, virker uændret: coach laver forslag, atlet ser intet før godkendelse', () => fixture(async ({ query, as, count }) => {
    await as(coach)
    await query("insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values ($1,$2,'2026-11-02')", [ids[10], a1])
    await as(owner)
    assert.equal(await count('kostplan_v1_plans'), 0)
  }))

  await t.test('ned fjerner alt nyt og efterlader athletes som før; op igen virker', () => fixture(async ({ db, query, catalog, before }) => {
    const fns = async () => (await query("select proname from pg_proc where pronamespace='public'::regnamespace order by 1")).rows
    const kostplanFns = await fns()
    await db.exec(down)
    assert.deepEqual(await catalog(), before)
    assert.deepEqual(await fns(), kostplanFns)
    assert.equal(Number((await query('select count(*) n from public.athletes')).rows[0].n), 4)
    await db.exec(up)
    const names = (await query("select relname from pg_class where relkind='r' and relnamespace='public'::regnamespace order by 1")).rows.map(r => r.relname)
    assert.deepEqual(names, ['athletes', ...KOSTPLAN_TABLES, ...NEW_TABLES].sort())
  }))

  await t.test('en fejl midt i ned ruller hele ned tilbage (én transaktion, ingen cascade)', () => fixture(async ({ db, query }) => {
    await db.exec('create view public.fremmed_afhaengighed as select athlete_id from public.tracking_daily_v1')
    await assert.rejects(db.exec(down))
    await db.exec('rollback')
    const names = (await query("select relname from pg_class where relkind='r' and relnamespace='public'::regnamespace order by 1")).rows.map(r => r.relname)
    assert.deepEqual(names, ['athletes', ...KOSTPLAN_TABLES, ...NEW_TABLES].sort())
  }))
})
