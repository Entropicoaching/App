// Executes only against a synthetic, in-memory PGlite schema when the repo's
// already-declared dependency is available. Never reads credentials or connects.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let PGlite
try { ({ PGlite } = await import('@electric-sql/pglite')) }
catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
}

test('PostgreSQL: owner CRUD, coach RLS, explicit grant/revoke, isolation, constraints and rollback',
  { skip: !PGlite && 'Pinned source has no node_modules; installation forbidden. Required merge gate.' }, async () => {
    const db = new PGlite()
    const directory = new URL('../../../supabase/migrations/', import.meta.url)
    const up = readFileSync(new URL('20261103210000_tracking_v1_DRAFT.sql', directory), 'utf8')
    const down = readFileSync(new URL('../sql/20261103210000_tracking_v1_DRAFT_ROLLBACK.sql', directory), 'utf8')
    const [owner, otherOwner, coach, otherCoach, replacement, a1, a2, claimant, unclaimed] = Array.from({ length: 9 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
    const query = (sql, args = []) => db.query(sql, args)
    const as = async (id, role = 'authenticated') => {
      await db.exec('reset role')
      await query("select set_config('request.jwt.claim.sub', $1, false)", [id || ''])
      await db.exec(`set role ${role}`) // role is a test constant, never user input
    }
    const count = async table => Number((await query(`select count(*) n from public.${table}`)).rows[0].n)
    try {
      await db.exec(`
        create role authenticated nologin; create role anon nologin;
        create schema auth;
        create table auth.users (id uuid primary key);
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon;
        grant execute on function auth.uid() to authenticated, anon;
        create table public.athletes (id uuid primary key, user_id uuid, coach_id uuid, name text);
        alter table public.athletes enable row level security;
        grant select, update on public.athletes to authenticated;
        create policy fixture_coach_update on public.athletes for update to authenticated
          using (coach_id = auth.uid()) with check (coach_id = auth.uid());
        create policy fixture_athletes_read on public.athletes for select to authenticated
          using (user_id = auth.uid() or coach_id = auth.uid());
        -- Deliberately permissive synthetic definer, NOT the real claim RPC.
        -- It bypasses parent RLS so the migration's trigger is the identity guard.
        create function public.fixture_claim_athlete_profile_v3(profile_id uuid)
        returns uuid language sql security definer set search_path = pg_catalog as $$
          update public.athletes set user_id = auth.uid()
          where id = profile_id and user_id is null returning id
        $$;
        revoke all on function public.fixture_claim_athlete_profile_v3(uuid) from public, anon;
        grant execute on function public.fixture_claim_athlete_profile_v3(uuid) to authenticated;
      `)
      for (const id of [owner, otherOwner, coach, otherCoach, replacement, claimant]) await query('insert into auth.users values ($1)', [id])
      await query('insert into public.athletes (id,user_id,coach_id) values ($1,$2,$3),($4,$5,$6),($7,null,$3)', [a1, owner, coach, a2, otherOwner, otherCoach, unclaimed])
      await db.exec(up)
      await as(coach)
      // Neither direct coach UPDATE nor a SECURITY DEFINER path may claim for
      // the coach, or attach the unclaimed athlete to another login.
      for (const id of [coach, claimant, otherOwner]) {
        await assert.rejects(query('update public.athletes set user_id=$1 where id=$2', [id, unclaimed]), { code: '42501' })
      }
      await assert.rejects(query('select public.fixture_claim_athlete_profile_v3($1)', [unclaimed]), { code: '42501' })
      assert.equal((await query('select user_id from public.athletes where id=$1', [unclaimed])).rows[0].user_id, null)
      // A missing JWT must not exploit SQL UNKNOWN in the first-claim exception.
      await as(null)
      await db.exec('reset role')
      await db.exec('create policy fixture_null_claim on public.athletes for all to authenticated using (true) with check (true)')
      await as(null)
      await assert.rejects(query('update public.athletes set user_id=$1 where id=$2', [claimant, unclaimed]), { code: '42501' })
      await db.exec('reset role')
      await db.exec('drop policy fixture_null_claim on public.athletes')
      // The athlete can first-claim through a definer even though parent RLS
      // has no direct UPDATE policy for that athlete. The trigger still sees JWT.
      await as(claimant)
      assert.equal((await query('select public.fixture_claim_athlete_profile_v3($1) id', [unclaimed])).rows[0].id, unclaimed)
      assert.equal((await query('select user_id from public.athletes where id=$1', [unclaimed])).rows[0].user_id, claimant)
      // Give a deliberately broad fixture policy to prove later owner edits are
      // rejected by the trigger, rather than silently filtered out by RLS.
      await db.exec('reset role')
      await db.exec('create policy fixture_owner_update on public.athletes for update to authenticated using (user_id = auth.uid()) with check (true)')
      await as(claimant)
      for (const id of [coach, otherOwner, null]) {
        await assert.rejects(query('update public.athletes set user_id=$1 where id=$2', [id, unclaimed]), { code: '42501' })
      }
      await query('update public.athletes set user_id=user_id where id=$1', [unclaimed])
      await db.exec('reset role')
      await db.exec('drop policy fixture_owner_update on public.athletes')
      await as(owner)
      await query("insert into public.tracking_cycle_v1 (athlete_id,logged_date,bleeding) values ($1,'2026-11-01','light')", [a1])
      await query("insert into public.tracking_daily_v1 (athlete_id,logged_date,sleep_quality) values ($1,'2026-11-01',3)", [a1])
      await query('update public.tracking_daily_v1 set sleep_quality=4 where athlete_id=$1', [a1])
      assert.equal((await query('select sleep_quality from public.tracking_daily_v1')).rows[0].sleep_quality, 4)
      assert.equal(await count('tracking_cycle_v1'), 1)
      await query("update public.tracking_cycle_v1 set note='owner edit' where athlete_id=$1", [a1])
      await assert.rejects(query("insert into public.tracking_cycle_v1 (athlete_id,logged_date,bleeding) values ($1,'2026-11-02','none')", [a2]))
      await assert.rejects(query("insert into public.tracking_daily_v1 (athlete_id,logged_date,pain) values ($1,'2026-11-02',7)", [a1]))
      await assert.rejects(query("insert into public.tracking_daily_v1 (athlete_id,logged_date,sleep_quality) values ($1,'2026-11-02',25)", [a1]))
      await assert.rejects(query("update public.tracking_cycle_v1 set athlete_id=$1", [a2]))
      await as(coach)
      assert.equal(await count('tracking_daily_v1'), 1)
      assert.equal(await count('tracking_cycle_v1'), 0)
      assert.equal(await count('tracking_cycle_consent_v1'), 0)
      // Worst-case parent contract: coach has table-wide UPDATE + permissive RLS.
      await query("update public.athletes set name='Synthetic edit' where id=$1", [a1])
      assert.equal((await query('select name from public.athletes where id=$1', [a1])).rows[0].name, 'Synthetic edit')
      for (const id of [coach, otherOwner, null]) {
        await assert.rejects(query('update public.athletes set user_id=$1 where id=$2', [id, a1]), { code: '42501' })
      }
      await query('update public.athletes set user_id=user_id where id=$1', [a1])
      assert.equal((await query('select user_id from public.athletes where id=$1', [a1])).rows[0].user_id, owner)
      assert.equal(await count('tracking_cycle_v1'), 0)
      // Missing JWT must not let the authenticated role bypass the trigger.
      await as(null)
      await db.exec('reset role')
      await db.exec('create policy fixture_null_jwt on public.athletes for all to authenticated using (true) with check (true)')
      await as(null)
      await assert.rejects(query('update public.athletes set user_id=$1 where id=$2', [coach, a1]), { code: '42501' })
      await db.exec('reset role')
      await db.exec('drop policy fixture_null_jwt on public.athletes')
      await as(coach)
      await assert.rejects(query("insert into public.tracking_cycle_v1 (athlete_id,logged_date,bleeding) values ($1,'2026-11-02','none')", [a1]))
      await assert.rejects(query("insert into public.tracking_daily_v1 (athlete_id,logged_date,sleep_quality) values ($1,'2026-11-02',3)", [a1]))
      await assert.rejects(query('insert into public.tracking_cycle_consent_v1 (athlete_id,coach_id,sharing_enabled) values ($1,$2,true)', [a1, coach]))
      await as(owner)
      await assert.rejects(query('insert into public.tracking_cycle_consent_v1 (athlete_id,coach_id,sharing_enabled) values ($1,$2,true)', [a1, otherCoach]))
      await query('insert into public.tracking_cycle_consent_v1 (athlete_id,coach_id) values ($1,$2)', [a1, coach])
      await as(coach)
      assert.equal(await count('tracking_cycle_consent_v1'), 0)
      assert.equal(await count('tracking_cycle_v1'), 0)
      await as(owner)
      await query('update public.tracking_cycle_consent_v1 set sharing_enabled=true where athlete_id=$1', [a1])
      await as(coach)
      assert.equal(await count('tracking_cycle_v1'), 1)
      assert.equal(await count('tracking_cycle_consent_v1'), 1)
      await query("update public.tracking_cycle_v1 set note='coach edit'")
      assert.equal((await query('select note from public.tracking_cycle_v1')).rows[0].note, 'owner edit')
      await query('delete from public.tracking_cycle_v1')
      assert.equal(await count('tracking_cycle_v1'), 1)
      await query('update public.tracking_cycle_consent_v1 set sharing_enabled=false')
      assert.equal(await count('tracking_cycle_consent_v1'), 1)
      for (const id of [otherOwner, otherCoach, replacement]) {
        await as(id)
        assert.equal(await count('tracking_cycle_v1'), 0)
        assert.equal(await count('tracking_cycle_consent_v1'), 0)
      }
      await as(owner)
      await query('update public.tracking_cycle_consent_v1 set sharing_enabled=false where athlete_id=$1', [a1])
      await as(coach)
      assert.equal(await count('tracking_cycle_v1'), 0)
      await as(owner)
      assert.equal(await count('tracking_cycle_v1'), 1)
      await query('update public.tracking_cycle_consent_v1 set sharing_enabled=true where athlete_id=$1', [a1])
      await db.exec('reset role')
      await query('update public.athletes set coach_id=$1 where id=$2', [replacement, a1])
      for (const id of [coach, replacement]) { await as(id); assert.equal(await count('tracking_cycle_v1'), 0) }
      await as(owner)
      await query('update public.tracking_cycle_consent_v1 set sharing_enabled=false where athlete_id=$1', [a1])
      await assert.rejects(query('update public.tracking_cycle_consent_v1 set sharing_enabled=true where athlete_id=$1', [a1]))
      await query('delete from public.tracking_cycle_consent_v1 where athlete_id=$1', [a1])
      await query('insert into public.tracking_cycle_consent_v1 (athlete_id,coach_id,sharing_enabled) values ($1,$2,true)', [a1, replacement])
      await as(replacement)
      assert.equal(await count('tracking_cycle_v1'), 1)
      await as(owner)
      await query('delete from public.tracking_cycle_consent_v1 where athlete_id=$1', [a1])
      await as(replacement)
      assert.equal(await count('tracking_cycle_v1'), 0)
      await as(null, 'anon')
      for (const table of ['tracking_daily_v1', 'tracking_cycle_v1', 'tracking_cycle_consent_v1']) await assert.rejects(query(`select * from public.${table}`))
      await as(owner)
      await query('delete from public.tracking_daily_v1 where athlete_id=$1', [a1])
      assert.equal(await count('tracking_daily_v1'), 0)
      await query('delete from public.tracking_cycle_v1 where athlete_id=$1', [a1])
      assert.equal(await count('tracking_cycle_v1'), 0)
      await db.exec('reset role')
      await db.exec(down)
      assert.equal((await query("select to_regclass('public.tracking_cycle_v1') obj")).rows[0].obj, null)
      assert.equal(await count('athletes'), 3)
      assert.equal(Number((await query("select count(*) n from pg_trigger where tgname='tracking_guard_athlete_identity_v1'")).rows[0].n), 0)
      await db.exec(up)
      await as(owner)
      assert.equal(await count('tracking_cycle_v1'), 0)
      await db.exec('reset role')
      await db.exec(down)
    } finally { await db.close() }
  })
