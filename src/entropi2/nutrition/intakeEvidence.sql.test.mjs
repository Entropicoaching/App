import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'
import { createIntakeEvidenceRequest, readIntakeEvidence, summarizeIntakeEvidence } from './intakeEvidence.mjs'
import { foodPortion } from './controller.mjs'

const draft = readFileSync(new URL('../../../supabase/sql/udkast/meal_intake_evidence_v1_DRAFT.sql', import.meta.url), 'utf8')
const oldDraft = readFileSync(new URL('../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const athlete = id(101), second = id(102), unlinked = id(103), self = id(104), mismatch = id(105)
const owner = id(201), owner2 = id(202), mismatchOwner = id(203), coach = id(301), otherCoach = id(302), selfUid = id(401)
const date = '2026-11-09', scope = { athleteId: athlete, date }
const syntheticFood = createFood({ id: 'synthetic:raw:v1', name: 'Syntetisk mad', preparation: 'raw',
  nutrientsPer100g: { energyKcal: 123.4, proteinG: 10, carbohydrateG: 12, fatG: 0,
    ironMg: 2, calciumMg: 0, vitaminDUg: 0.8, fibreG: 3 },
  source: { citation: 'Synthetic source v1, never an actual food measurement', verification: 'unverified user reference' } })

// ONE shared in-memory database, no server or parallel instances. This fixture
// reproduces pinned column types + policies (including legacy email access).
// Existing plan SQL and candidate SQL are loaded from their actual files.
test('local DRAFT: actual SQL with pinned legacy policies, invoker ACL and pure product model', { timeout: 45000 }, async t => {
  const db = new PGlite()
  let serial = 1000, identity = { uid: coach, email: 'coach@synthetic.invalid', role: 'authenticated' }
  const login = async (uid, email = '', role = 'authenticated') => {
    identity = { uid, email, role }
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [uid ?? '', JSON.stringify({ ...(uid ? { sub: uid } : {}), email })])
    assert.ok(['authenticated', 'anon'].includes(role))
    await db.exec('set role ' + role)
  }
  const restore = async () => { const { uid, email, role } = identity; await login(uid, email, role) }
  const admin = async run => { await db.exec('reset role'); try { return await run() } finally { await restore() } }
  const counts = () => admin(async () => (await db.query(`select
    (select count(*)::int from public.meal_logs) meals,
    (select count(*)::int from public.meal_intake_evidence_v1) evidence,
    (select count(*)::int from public.meal_intake_requests_v1) requests`)).rows[0])
  const request = (overrides = {}) => createIntakeEvidenceRequest({ athleteId: athlete, date,
    requestId: id(++serial), grams: 125.25, meal: 'Syntetisk portion · 125 g', food: syntheticFood, ...overrides })
  const rpc = async r => (await db.query('select public.record_meal_intake_evidence_v1($1::jsonb) pair', [JSON.stringify(r)])).rows[0].pair
  const fails = async (r, codes = ['22023', '22008', '22007', '22P02']) => {
    const before = await counts()
    await assert.rejects(rpc(r), e => codes.includes(e.code), JSON.stringify(r).slice(0, 180))
    assert.deepEqual(await counts(), before, 'failed RPC must leave parent, evidence AND request ledger unchanged')
  }
  const insertEvidence = e => db.query(`insert into public.meal_intake_evidence_v1
    select * from jsonb_populate_record(null::public.meal_intake_evidence_v1,$1::jsonb)`, [JSON.stringify(e)])
  const oldMetadata = () => db.query(`select c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,
    (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) policies,
    (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) columns
    from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname in ('athletes','meal_logs','kostplan_v1_plans','kostplan_v1_versions','kostplan_v1_approvals') order by c.relname`)
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
      create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),auth.jwt()->>'sub')::uuid$$;
      create function auth.email() returns text language sql stable as $$select auth.jwt()->>'email'$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt(),auth.email() to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
      create table public.athletes(id uuid primary key default gen_random_uuid(),user_id uuid,coach_id uuid,email text);
      create table public.meal_logs(id uuid primary key default gen_random_uuid(),athlete_id uuid,
        date date not null default current_date,meal text not null,kcal integer default 0,
        protein integer default 0,carb integer default 0,fat integer default 0,created_at timestamptz default now());
      alter table public.athletes enable row level security;
      alter table public.meal_logs enable row level security;
      revoke all on public.athletes from anon,authenticated;
      grant select,insert,update,delete,maintain on public.athletes to anon,authenticated;
      create policy athletes_select on public.athletes for select to public using
        ((coach_id=(select auth.uid())) or (email=((select auth.jwt())->>'email')) or (user_id=(select auth.uid())));
      create policy athletes_insert on public.athletes for insert to public with check(coach_id=(select auth.uid()));
      create policy athletes_update on public.athletes for update to public using(coach_id=(select auth.uid())) with check(coach_id=(select auth.uid()));
      create policy athletes_delete on public.athletes for delete to public using(coach_id=(select auth.uid()));
      create policy meal_logs_all on public.meal_logs for all to public using
        ((athlete_id in(select athletes.id from public.athletes where athletes.email=(select auth.email())))
          or (athlete_id in(select athletes.id from public.athletes where athletes.coach_id=(select auth.uid()))))
        with check
        ((athlete_id in(select athletes.id from public.athletes where athletes.email=(select auth.email())))
          or (athlete_id in(select athletes.id from public.athletes where athletes.coach_id=(select auth.uid()))));`)
    for (const row of [[athlete, owner, coach, 'owner@synthetic.invalid'], [second, owner2, otherCoach, 'other@synthetic.invalid'],
      [unlinked, null, coach, 'unlinked@synthetic.invalid'], [self, selfUid, selfUid, 'self@synthetic.invalid'],
      [mismatch, mismatchOwner, coach, 'old@synthetic.invalid']])
      await db.query('insert into public.athletes(id,user_id,coach_id,email) values($1,$2,$3,$4)', row)
    await db.exec(oldDraft)
    const before = (await oldMetadata()).rows
    await db.exec(draft)
    assert.deepEqual((await oldMetadata()).rows, before, 'old types, grants and policies remain unchanged')

    await t.test('least per-object ACL defeats broad defaults; functions are invoker; anon/PUBLIC no access', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
          const allowed = (await db.query("select has_table_privilege($1,'public.meal_intake_evidence_v1',$2) allowed", [role, privilege])).rows[0].allowed
          assert.equal(allowed, role === 'authenticated' && ['SELECT', 'INSERT'].includes(privilege), role + ':' + privilege)
        }
        for (const fn of ['record_meal_intake_evidence_v1', 'meal_intake_evidence_v1_macros']) {
          const allowed = (await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, 'public.' + fn + '(jsonb)'])).rows[0].allowed
          assert.equal(allowed, role === 'authenticated')
        }
      }
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
          const allowed = (await db.query("select has_table_privilege($1,'public.meal_intake_requests_v1',$2) allowed", [role, privilege])).rows[0].allowed
          assert.equal(allowed, role === 'authenticated' && ['SELECT', 'INSERT'].includes(privilege), 'ledger:' + role + ':' + privilege)
        }
        assert.equal((await db.query("select has_function_privilege($1,'public.meal_intake_evidence_v1_create_parent()','EXECUTE') allowed", [role])).rows[0].allowed, false)
      }
      assert.equal((await db.query(`select 1 from pg_proc p where p.oid='public.meal_intake_evidence_v1_create_parent()'::regprocedure
        and (p.prosecdef or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0))`)).rows.length, 0)
      assert.equal((await db.query("select 1 from pg_class c, lateral aclexplode(c.relacl) a where c.oid='public.meal_intake_requests_v1'::regclass and a.grantee=0")).rows.length, 0)
      assert.deepEqual((await db.query(`select attname from pg_attribute where attrelid='public.meal_intake_requests_v1'::regclass
        and attnum>0 and not attisdropped order by attnum`)).rows.map(r => r.attname), ['request_id','athlete_id'])
      assert.deepEqual((await db.query(`select c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid
        where t.tgfoid='public.meal_intake_evidence_v1_create_parent()'::regprocedure`)).rows.map(r => r.relname), ['meal_intake_evidence_v1'])
      const publicAcl = await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in('record_meal_intake_evidence_v1','meal_intake_evidence_v1_macros')
        and (p.prosecdef or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0))`)
      assert.equal(publicAcl.rows.length, 0)
      assert.equal((await db.query("select 1 from pg_class c, lateral aclexplode(c.relacl) a where c.oid='public.meal_intake_evidence_v1'::regclass and a.grantee=0")).rows.length, 0)
      await login(null, '', 'anon')
      await assert.rejects(rpc(request()), e => e.code === '42501')
      await assert.rejects(db.query('select * from public.meal_intake_evidence_v1'), e => e.code === '42501')
      await login(coach)
    })

    await t.test('one atomic pair; exact lost-response retry returns same identities/content/timestamp', async () => {
      const r = request(), old = await counts(), a = await rpc(r), b = await rpc(structuredClone(r))
      assert.deepEqual(a, b)
      assert.equal(a.mealLog.id, r.requestId)
      assert.equal(a.evidence.meal_log_id, r.requestId)
      assert.equal(a.evidence.grams, 125.25)
      assert.equal(a.evidence.food.nutrientsPer100g.magnesiumMg, null)
      assert.equal(a.evidence.food.nutrientsPer100g.calciumMg, 0)
      const expected = foodPortion({ name: syntheticFood.name, kcal100: 123.4, protein100: 10, carb100: 12, fat100: 0 }, r.grams)
      for (const k of ['kcal','protein','carb','fat']) assert.equal(a.mealLog[k], expected[k])
      assert.equal(readIntakeEvidence(a.mealLog, a.evidence, scope).nutrients.ironMg, 2.505)
      assert.deepEqual(await counts(), { meals: old.meals + 1, evidence: old.evidence + 1, requests: old.requests + 1 })
      for (const patch of [{ grams: 125.26 }, { meal: 'Changed name' }, { date: '2026-11-10' }, { athleteId: mismatch },
        { food: { ...r.food, id: 'synthetic:different' } }, { food: { ...r.food, preparation: 'cooked' } },
        { food: { ...r.food, source: { ...r.food.source, citation: 'Changed source' } } }])
        await fails({ ...r, ...patch }, ['23505'])
      assert.deepEqual(await rpc(r), a)
    })

    await t.test('full input validation precedes writes, including retries; numeric/JSON/date/text/size bounds', async () => {
      const r = request()
      for (const bad of [null, [], 4, {}, { ...r, extra: true }, { ...r, version: '1' }, { ...r, requestId: 'x' },
        { ...r, athleteId: null }, { ...r, date: '2026-02-30' }, { ...r, date: '09/11/2026' },
        { ...r, date: 'infinity' }, { ...r, date: '1899-01-01' }, { ...r, date: '10000-01-01' },
        ...[null, '125.25', 0, -1, 100001, 0.0000001].map(grams => ({ ...r, grams })),
        { ...r, meal: null }, { ...r, meal: ' ' }, { ...r, meal: 'x'.repeat(513) },
        { ...r, meal: '\nfood' }, { ...r, meal: '[appData2-day-v1]not food' }]) await fails(bad)
      for (const change of [f => { f.extra = true }, f => { f.source.extra = true }, f => { delete f.source.citation },
        f => { f.source.verification = null }, f => { f.source.citation = 'x'.repeat(2049) },
        f => { f.source.citation = 'x'.repeat(21000) }, f => { f.preparation = '' }, f => { f.id = 'x'.repeat(129) },
        f => { f.nutrientsPer100g.energyKcal = null }, f => { delete f.nutrientsPer100g.ironMg },
        f => { f.nutrientsPer100g.ironMg = 'NaN' }, f => { f.nutrientsPer100g.ironMg = '2' },
        f => { f.nutrientsPer100g.ironMg = -1 }, f => { f.nutrientsPer100g.ironMg = 1e12+1 },
        f => { f.nutrientsPer100g.energyKcal = 1e12 }, f => { f.nutrientsPer100g.extra = 0 },
        f => { f.nutrientsPer100g = [] }, f => { f.basisGrams = '100' }]) {
        const food = structuredClone(r.food); change(food); await fails({ ...r, food })
      }
      const before = await counts()
      await assert.rejects(db.query('select public.record_meal_intake_evidence_v1($1::jsonb)', ['{"grams":NaN}']), e => e.code === '22P02')
      assert.deepEqual(await counts(), before)
    })

    await t.test('rollback after second insert fails; unrelated legacy UUID collision is never attached', async () => {
      await admin(() => db.exec("alter table public.meal_intake_evidence_v1 add constraint synthetic_failure check(meal <> 'force-failure')"))
      await fails(request({ meal: 'force-failure' }), ['23514'])
      await admin(() => db.exec('alter table public.meal_intake_evidence_v1 drop constraint synthetic_failure'))
      const r = request()
      await db.query('insert into public.meal_logs(id,athlete_id,date,meal) values($1,$2,$3,\'Legacy no evidence\')', [r.requestId, athlete, date])
      await fails(r, ['23505'])
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1 where meal_log_id=$1', [r.requestId])).rows.length, 0)
    })

    await t.test('UID vs athlete ID, current coach, self coach, null UID/unlinked, email collision and legacy mismatch', async () => {
      await login(owner, 'owner@synthetic.invalid')
      const own = await rpc(request())
      await login(athlete, 'owner@synthetic.invalid')
      // Email still allows the ORIGINAL legacy path, never the new evidence.
      await db.query('insert into public.meal_logs(athlete_id,date,meal) values($1,$2,\'email-only legacy\')', [athlete, date])
      await fails(request(), ['42501'])
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1')).rows.length, 0)
      await login(owner2, 'owner@synthetic.invalid')
      await fails(request(), ['42501'])
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1 where meal_log_id=$1', [own.mealLog.id])).rows.length, 0)
      await login(null, 'owner@synthetic.invalid')
      await fails(request(), ['42501'])
      await login(coach)
      await fails(request({ athleteId: unlinked }), ['42501'])
      await login(otherCoach)
      await fails(request(), ['42501'])
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1')).rows.length, 0)
      await login(selfUid)
      assert.equal((await rpc(request({ athleteId: self }))).mealLog.athlete_id, self)
      await login(mismatchOwner, 'new@synthetic.invalid')
      // Exact UID passes the new check; unchanged legacy email RLS still denies.
      await fails(request({ athleteId: mismatch }), ['42501'])
      await login(coach)
      assert.equal((await rpc(request({ athleteId: mismatch }))).mealLog.athlete_id, mismatch)
      await admin(() => db.query('update public.athletes set coach_id=$1 where id=$2', [otherCoach, athlete]))
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1 where athlete_id=$1', [athlete])).rows.length, 0)
      await fails(request(), ['42501'])
      await login(otherCoach)
      assert.ok((await db.query('select * from public.meal_intake_evidence_v1 where athlete_id=$1', [athlete])).rows.length > 0)
      await admin(() => db.query('update public.athletes set coach_id=$1 where id=$2', [coach, athlete]))
      await login(coach)
    })

    await t.test('direct read/write RLS matches current parent athlete/date; immutable evidence ACL', async () => {
      const pair = await rpc(request()), evidence = pair.evidence
      for (const patch of [{ date: '2026-11-10' }, { athlete_id: second }]) {
        const rid = id(++serial)
        await db.query('insert into public.meal_logs(id,athlete_id,date,meal,kcal,protein,carb,fat) values($1,$2,$3,$4,$5,$6,$7,$8)',
          [rid, athlete, date, evidence.meal, evidence.kcal, evidence.protein, evidence.carb, evidence.fat])
        const before = await counts()
        const parent = (await db.query('select * from public.meal_logs where id=$1', [rid])).rows
        // SOURCE1 wrong-day oracle was 42501. Mandatory NEW parent creation now
        // hits original PK first (23505); cross-owner is still denied by UID.
        await assert.rejects(insertEvidence({ ...evidence, meal_log_id: rid, request_id: rid, ...patch }),
          e => e.code === (patch.date ? '23505' : '42501'))
        assert.deepEqual(await counts(), before)
        assert.deepEqual((await db.query('select * from public.meal_logs where id=$1', [rid])).rows, parent)
      }
      await assert.rejects(db.query('update public.meal_intake_evidence_v1 set grams=1'), e => e.code === '42501')
      await assert.rejects(db.query('delete from public.meal_intake_evidence_v1'), e => e.code === '42501')
      await login(otherCoach)
      await assert.rejects(insertEvidence({ ...evidence, meal_log_id: id(++serial), request_id: id(serial) }), e => e.code === '42501')
      await assert.rejects(db.query('update public.meal_intake_evidence_v1 set meal=\'other\''), e => e.code === '42501')
      await login(coach)
      await db.query('update public.meal_logs set date=$1 where id=$2', ['2026-11-10', pair.mealLog.id])
      assert.equal((await db.query('select * from public.meal_intake_evidence_v1 where meal_log_id=$1', [pair.mealLog.id])).rows.length, 0)
    })

    await t.test('zero/null, decimal and BF98 rounding tolerance; raw/cooked snapshots never merged', async () => {
      const roundedFood = createFood({ ...syntheticFood,
        nutrientsPer100g: { ...syntheticFood.nutrientsPer100g, energyKcal: 14.4999999999999, proteinG: 0.5, carbohydrateG: 0, fatG: 0 } })
      const r = request({ grams: 100, food: roundedFood }), p = await rpc(r)
      assert.equal(p.mealLog.kcal, 15)
      assert.equal(p.mealLog.protein, 1)
      assert.equal(p.mealLog.fat, 0)
      for (const [energy, grams] of [[0,100],[0.499999999999,100],[0.5,100],[1.25,40],
        [133,125.25],[123.4,0.1],[2147483647,100],[1e12,0.000001]]) {
        const food = createFood({ ...syntheticFood, nutrientsPer100g: { ...syntheticFood.nutrientsPer100g, energyKcal: energy } })
        const pair = await rpc(request({ food, grams }))
        const original = foodPortion({ name: food.name, kcal100: energy, protein100: 10, carb100: 12, fat100: 0 }, grams)
        for (const key of ['kcal','protein','carb','fat']) assert.equal(pair.mealLog[key], original[key], energy + ':' + grams + ':' + key)
      }
      const unknown = summarizeIntakeEvidence({ ...scope, mealLogs: [p.mealLog], evidenceRows: [p.evidence] })
      assert.equal(unknown.nutrients.calciumMg.total, 0)
      assert.equal(unknown.nutrients.magnesiumMg.total, null)
      const cooked = createFood({ ...syntheticFood, id: 'synthetic:cooked:v2', preparation: 'cooked',
        nutrientsPer100g: { ...syntheticFood.nutrientsPer100g, ironMg: 1 },
        source: { citation: 'Synthetic cooked v2', verification: 'unverified' } })
      const c = await rpc(request({ food: cooked }))
      assert.equal(c.evidence.food.preparation, 'cooked')
      assert.equal(c.evidence.food.id, cooked.id)
      assert.deepEqual(c.evidence.food.source, cooked.source)
      assert.equal(readIntakeEvidence(c.mealLog, c.evidence, scope).nutrients.ironMg, 1.2525)
      assert.equal((await rpc(request({ grams: 0.000001 }))).evidence.grams, 0.000001)
      const max = await rpc(request({ grams: 100000 }))
      assert.equal(max.evidence.grams, 100000)
    })

    await t.test('parent edits invalidate model/retry; old delete cascades; mixed legacy subtotal stays incomplete', async () => {
      for (const [key, value] of [['meal','Edited'],['kcal',0],['protein',0],['carb',0],['fat',1],['date','2026-11-10'],['athlete_id',mismatch]]) {
        const r = request(), pair = await rpc(r)
        assert.match(key, /^[a-z_]+$/)
        await db.query(`update public.meal_logs set ${key}=$1 where id=$2`, [value, pair.mealLog.id])
        const current = (await db.query('select row_to_json(m) p from public.meal_logs m where id=$1', [pair.mealLog.id])).rows[0].p
        assert.equal(readIntakeEvidence(current, pair.evidence, scope), null, key)
        await fails(r, ['23505'])
        await db.query('delete from public.meal_logs where id=$1', [pair.mealLog.id])
        assert.equal(await admin(async () => (await db.query('select count(*)::int n from public.meal_intake_evidence_v1 where meal_log_id=$1', [pair.mealLog.id])).rows[0].n), 0)
      }
      const good = await rpc(request()), legacyId = id(++serial)
      await db.query('insert into public.meal_logs(id,athlete_id,date,meal) values($1,$2,$3,\'Manual legacy\')', [legacyId, athlete, date])
      const legacy = (await db.query('select row_to_json(m) p from public.meal_logs m where id=$1', [legacyId])).rows[0].p
      const sum = summarizeIntakeEvidence({ ...scope, mealLogs: [good.mealLog, legacy], evidenceRows: [good.evidence] })
      assert.equal(sum.nutrients.ironMg.knownSubtotal, 2.505)
      assert.equal(sum.nutrients.ironMg.knownRows, 1)
      assert.equal(sum.nutrients.ironMg.unknownRows, 1)
      assert.equal(sum.nutrients.ironMg.complete, false)
      assert.equal(sum.nutrients.ironMg.total, null)
    })
    await t.test('ECMAScript trimmed text and trimStart receipts reject Unicode before ANY writes; literal Unicode preserved', async () => {
      // Representative independent classes plus all ECMAScript trim characters.
      const whitespace = ['\u00a0','\ufeff','\u2028','\u2029','\u3000','\u1680','\u2007','\u202f','\u205f',
        '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff']
      for (const ws of whitespace) {
        const r = request()
        for (const key of ['id','name','preparation','citation','verification']) {
          const food = structuredClone(r.food)
          if (['citation','verification'].includes(key)) food.source[key] = ws
          else food[key] = ws
          assert.throws(() => createIntakeEvidenceRequest({ athleteId: athlete, date, requestId: r.requestId, grams: r.grams, meal: r.meal, food }), TypeError)
          await fails({ ...r, food })
        }
        for (const meal of [ws, ws + '[appData2-day-v1]synthetic-confirmation']) {
          assert.throws(() => request({ meal }), TypeError)
          await fails({ ...r, meal })
        }
      }
      for (const name of ['Æble · rå (ø/å) 🍎', '\u00a0Dansk mad\u3000', '\u200b', '\u180e']) {
        const food = createFood({ ...syntheticFood, name, source: { ...syntheticFood.source, citation: name } })
        const pair = await rpc(request({ meal: name, food }))
        assert.equal(pair.evidence.food.name, name)
        assert.equal(pair.evidence.food.source.citation, name)
        assert.equal(pair.mealLog.meal, name)
        assert.ok(readIntakeEvidence(pair.mealLog, pair.evidence, scope))
      }
    })

    await t.test('direct evidence creates its own NEW parent; legacy attachment/no-op UPDATE/RPC retry never adopts', async () => {
      const sample = await rpc(request())
      for (const noop of [false, true]) {
        const r = request({ meal: 'Identical manual legacy · æøå' })
        const v = foodPortion({ name: syntheticFood.name, kcal100: 123.4, protein100: 10, carb100: 12, fat100: 0 }, r.grams)
        await db.query('insert into public.meal_logs(id,athlete_id,date,meal,kcal,protein,carb,fat) values($1,$2,$3,$4,$5,$6,$7,$8)',
          [r.requestId, athlete, date, r.meal, v.kcal, v.protein, v.carb, v.fat])
        if (noop) await db.query('update public.meal_logs set meal=meal where id=$1', [r.requestId])
        const before = await counts(), parent = (await db.query('select * from public.meal_logs where id=$1', [r.requestId])).rows[0]
        const e = { ...sample.evidence, meal_log_id: r.requestId, request_id: r.requestId, meal: r.meal }
        await fails(r, ['23505'])
        await assert.rejects(insertEvidence(e), err => err.code === '23505')
        await fails(structuredClone(r), ['23505'])
        assert.deepEqual(await counts(), before)
        assert.deepEqual((await db.query('select * from public.meal_logs where id=$1', [r.requestId])).rows[0], parent)
        assert.equal(readIntakeEvidence(parent, null, scope), null)
        assert.equal((await db.query('select * from public.meal_intake_requests_v1 where request_id=$1', [r.requestId])).rows.length, 0)
      }
      const r = request(), before = await counts()
      const e = { ...sample.evidence, request_id: r.requestId, meal_log_id: r.requestId, created_at: '2000-01-01T00:00:00Z' }
      await insertEvidence(e)
      assert.deepEqual(await counts(), { meals: before.meals + 1, evidence: before.evidence + 1, requests: before.requests + 1 })
      const p = await rpc(r)
      assert.equal(p.evidence.request_id, r.requestId)
      assert.notEqual(p.evidence.created_at, e.created_at, 'timestamp is captured by the database')
      assert.ok(readIntakeEvidence(p.mealLog, p.evidence, scope))
      assert.deepEqual(await rpc(r), p)
      // Validated direct path is also bound to current UID; all three writes roll back.
      await login(owner2, 'owner@synthetic.invalid')
      const denied = id(++serial), snapshot = await counts()
      await assert.rejects(insertEvidence({ ...e, request_id: denied, meal_log_id: denied }), err => err.code === '42501')
      assert.deepEqual(await counts(), snapshot)
      await login(coach)
    })

    await t.test('deleted immutable intent stays retired: exact/changed/direct retries fail; NEW UUID succeeds', async () => {
      await login(owner, 'owner@synthetic.invalid')
      const r = request({ requestId: id(9001) }), p = await rpc(r)
      assert.deepEqual(await rpc(structuredClone(r)), p)
      const before = await counts()
      await db.query('delete from public.meal_logs where id=$1 and athlete_id=$2', [r.requestId, athlete])
      const deleted = await counts()
      assert.deepEqual(deleted, { meals: before.meals - 1, evidence: before.evidence - 1, requests: before.requests })
      const retained = (await db.query('select * from public.meal_intake_requests_v1 where request_id=$1', [r.requestId])).rows
      assert.deepEqual(retained, [{ request_id: r.requestId, athlete_id: athlete }])
      for (const patch of [{}, { grams: 150 }, { date: '2026-11-10' }, { food: { ...r.food, name: 'Changed' } }])
        await fails({ ...r, ...patch }, ['23505'])
      await assert.rejects(insertEvidence(p.evidence), e => e.code === '23505')
      assert.deepEqual(await counts(), deleted)
      await login(otherCoach)
      await fails({ ...r, athleteId: second }, ['23505'])
      assert.equal((await db.query('select * from public.meal_intake_requests_v1 where request_id=$1', [r.requestId])).rows.length, 0)
      await login(owner, 'owner@synthetic.invalid')
      const fresh = await rpc(request({ requestId: id(9002) }))
      assert.equal(fresh.mealLog.id, id(9002))
      assert.deepEqual(await counts(), { meals: deleted.meals + 1, evidence: deleted.evidence + 1, requests: deleted.requests + 1 })
      t.diagnostic('DELETE_RETRY: original pair deleted, same UUID returns 23505 with no resurrection; NEW UUID creates one pair.')
      await login(coach)
    })

    await t.test('ledger UID/current-coach RLS, immutable ACL, bare reservations never authorize adoption, athlete cleanup', async () => {
      const r = request()
      const reserve = (rid, aid) => db.query('insert into public.meal_intake_requests_v1(request_id,athlete_id) values($1,$2)', [rid, aid])
      for (const [uid, email] of [[athlete,'owner@synthetic.invalid'],[null,'owner@synthetic.invalid'],[owner2,'owner@synthetic.invalid']]) {
        await login(uid, email)
        const before = await counts()
        await assert.rejects(reserve(r.requestId, athlete), e => e.code === '42501')
        assert.deepEqual(await counts(), before)
        assert.equal((await db.query('select * from public.meal_intake_requests_v1 where athlete_id=$1', [athlete])).rows.length, 0)
      }
      await login(coach)
      await assert.rejects(reserve(r.requestId, unlinked), e => e.code === '42501')
      await reserve(r.requestId, athlete)
      await fails(r, ['23505'])
      await assert.rejects(db.query('update public.meal_intake_requests_v1 set athlete_id=athlete_id'), e => e.code === '42501')
      await assert.rejects(db.query('delete from public.meal_intake_requests_v1'), e => e.code === '42501')
      await assert.rejects(db.query('select public.meal_intake_evidence_v1_create_parent()'), e => e.code === '42501')
      await assert.rejects(db.exec('alter table public.meal_intake_evidence_v1 disable trigger meal_intake_evidence_v1_create_parent'), e => e.code === '42501')
      await admin(() => db.query('update public.athletes set coach_id=$1 where id=$2', [otherCoach, athlete]))
      assert.equal((await db.query('select * from public.meal_intake_requests_v1 where athlete_id=$1', [athlete])).rows.length, 0)
      await login(otherCoach)
      assert.ok((await db.query('select * from public.meal_intake_requests_v1 where athlete_id=$1', [athlete])).rows.length > 0)
      await admin(() => db.query('update public.athletes set coach_id=$1 where id=$2', [coach, athlete]))
      await login(coach)
      const cleanup = id(777), retired = id(778)
      await db.query('insert into public.athletes(id,user_id,coach_id,email) values($1,$2,$3,$4)', [cleanup, owner, coach, 'cleanup@synthetic.invalid'])
      const c = request({ athleteId: cleanup, requestId: retired }), pair = await rpc(c)
      await db.query('delete from public.meal_logs where id=$1', [pair.mealLog.id])
      assert.equal((await db.query('select * from public.meal_intake_requests_v1 where request_id=$1', [retired])).rows.length, 1)
      await db.query('delete from public.athletes where id=$1', [cleanup])
      assert.equal(await admin(async () => (await db.query('select * from public.meal_intake_requests_v1 where request_id=$1', [retired])).rows.length), 0)
    })

    await admin(async () => assert.deepEqual((await oldMetadata()).rows, before, 'old objects remain unchanged after behavioral tests'))
    t.diagnostic('One PGlite session only: uniqueness, atomic rollback and sequential retry tested; multi-connection races NOT stress-tested.')
  } finally { await db.close() }
})
