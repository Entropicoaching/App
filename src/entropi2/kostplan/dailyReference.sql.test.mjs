// Actual pinned SQL and actual adapter, entirely synthetic in-memory PostgreSQL.
// No backend change, authentication service, network or optional dependency skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createPlanAdapter } from './planAdapter.mjs'
import { storedSnapshot, uuid } from './dailyReference.fixture.mjs'
const up = readFileSync(new URL('../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const [athlete, foreign, owner, coach, otherCoach] = [101,102,103,104,105].map(uuid)
const tables = ['kostplan_v1_plans','kostplan_v1_versions','kostplan_v1_approvals']

async function fixture(run) {
  const db = new PGlite()
  try {
    await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create table public.athletes(id uuid primary key, user_id uuid, coach_id uuid);
      alter table public.athletes enable row level security;
      grant select on public.athletes to authenticated;
      create policy fixture_athletes_read on public.athletes for select to authenticated using (user_id=auth.uid() or coach_id=auth.uid());`)
    await db.query('insert into public.athletes values ($1,$2,$3),($4,$5,$6)', [athlete,owner,coach,foreign,uuid(106),otherCoach])
    await db.exec(up)
    const as = async who => {
      await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [who]); await db.exec('set role authenticated')
    }
    const plan = (n, from='2026-11-01', a=athlete) => db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values ($1,$2,$3)',[uuid(n),a,from])
    const version = (n, parent, number, effective, kcal) => db.query(`insert into public.kostplan_v1_versions
      (id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values ($1,$2,$3,$4,'2026-11-01',$5,'Synthetic rationale','vedligehold',0.1,$6)`,
    [uuid(n),uuid(parent),number,effective,JSON.stringify(Object.fromEntries(['weight_trend','training_volume','training_intensity','food_log','readiness','competition_date'].map(k=>[k,null]))),JSON.stringify(storedSnapshot(kcal).meals)])
    const approve = async (n, at) => {
      await db.query('insert into public.kostplan_v1_approvals(version_id,approval_kind) values ($1,\'coach\')',[uuid(n)])
      // Test-admin only: pin actual server-generated approval rows to test dates.
      await db.exec('reset role')
      await db.query(`update public.kostplan_v1_approvals set approved_at=$2,
        week_start=date_trunc('week',$2::timestamptz at time zone 'Europe/Copenhagen')::date where version_id=$1`,[uuid(n),at])
      await as(coach)
    }
    const calls = []
    const client = { from(table) {
      assert.ok(tables.includes(table)); const filters=[],args=[],call={table}; calls.push(call)
      let columns,limit
      const q = {
        select(value, options) { assert.equal(options?.count,'exact'); assert.match(value,/^[a-z_,]+$/);columns=value;call.columns=value;return q },
        limit(n) { assert.equal(n,501);limit=n;return q },
        eq(k,v) { assert.match(k,/^[a-z_]+$/);args.push(v);filters.push(`${k}=$${args.length}`);return q },
        lte(k,v) { assert.match(k,/^[a-z_]+$/);args.push(v);filters.push(`${k}<=$${args.length}`);return q },
        in(k,vs) { assert.match(k,/^[a-z_]+$/);assert.ok(vs.length<=500);const slots=vs.map(v=>{args.push(v);return '$'+args.length});filters.push(`${k} in (${slots.join(',')})`);return q },
        then(resolve,reject) { return (async()=>{
          try {
            const where=filters.length?' where '+filters.join(' and '):''
            const count=Number((await db.query(`select count(*) n from public.${table}${where}`,args)).rows[0].n)
            // Data API JSON encoding retains SQL dates/numerics and timestamp microseconds.
            const rows=(await db.query(`select row_to_json(selected) value from (select ${columns} from public.${table}${where} limit ${limit}) selected`,args)).rows.map(r=>r.value)
            return {data:rows,count,error:null}
          } catch (error) { return {data:null,error:{code:error.code}} }
        })().then(resolve,reject) },
      };return q
    } }
    await as(coach)
    await run({db,as,plan,version,approve,client,calls})
  } finally { await db.close() }
}

test('PGlite actual SQL: daily adapter uses version_id, immutable foods, current-coach RLS and honest archive limitation', {timeout:60000}, async()=>fixture(async f=>{
  await f.plan(1); await f.version(10,1,1,'2026-11-01',100); await f.approve(10,'2026-11-01T10:00:00.000001Z')
  await f.version(11,1,2,'2026-11-04',200); await f.approve(11,'2026-11-04T10:00:00.000001Z')
  await f.plan(2,'2026-11-04');await f.version(12,2,1,'2026-11-04',300);await f.approve(12,'2026-11-04T10:00:00.000002Z')
  await f.version(13,2,2,'2026-11-10',900);await f.approve(13,'2026-11-06T10:00:00Z')
  await f.version(14,2,3,'2026-11-06',800) // unapproved snapshot
  await f.as(otherCoach);await f.plan(3,'2026-11-01',foreign);await f.version(15,3,1,'2026-11-01',700);await f.approve(15,'2026-11-01T10:00:00Z')
  const load=()=>createPlanAdapter({enabled:true,client:f.client,athleteId:athlete,date:'2026-11-07'}).loadDailyReferences({coachId:coach})
  const before=(await f.db.query('select meals from public.kostplan_v1_versions where plan_id=$1 order by version_no',[uuid(1)])).rows
  const refs=await load();assert.equal(refs.state,'ready',JSON.stringify(refs));assert.deepEqual(refs.days.map(d=>d.targets.kcal),[100,100,100,300,300,300,300])
  assert.ok(f.calls.every(c=>c.table!==tables[2]||!c.columns.split(',').includes('id')))
  assert.deepEqual((await f.db.query('select meals from public.kostplan_v1_versions where plan_id=$1 order by version_no',[uuid(1)])).rows,before)
  await f.db.query("update public.kostplan_v1_plans set status='arkiveret' where id=$1",[uuid(2)])
  const archived=await load();assert.equal(archived.state,'ready');assert.deepEqual(archived.days.map(d=>d.targets.kcal),[100,100,100,null,null,null,null])
  assert.equal(archived.days[3].reason,'archive-date-unavailable')
  // Permission error stays unavailable, never a fabricated successful empty read.
  await f.db.exec('reset role; revoke select on public.kostplan_v1_versions from authenticated; set role authenticated')
  assert.equal((await load()).state,'unavailable')
}))
