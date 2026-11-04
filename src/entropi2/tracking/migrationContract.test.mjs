// Static checks supplement, never replace, the synthetic PostgreSQL test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const root = new URL('../../../', import.meta.url)
const up = readFileSync(new URL('supabase/migrations/20261103210000_tracking_v1_DRAFT.sql', root), 'utf8').replace(/--[^\n]*/g, '')
const down = readFileSync(new URL('supabase/sql/20261103210000_tracking_v1_DRAFT_ROLLBACK.sql', root), 'utf8')
const tables = ['tracking_daily_v1', 'tracking_cycle_consent_v1', 'tracking_cycle_v1']

test('only new tracking tables, bounded extras, explicit grants and forced RLS', () => {
  assert.deepEqual([...up.matchAll(/create table public\.(\w+)/g)].map(m => m[1]), tables)
  for (const table of tables) {
    assert.ok(up.includes(`alter table public.${table} enable row level security;`))
    assert.ok(up.includes(`alter table public.${table} force row level security;`))
    for (const op of ['select', 'insert', 'update', 'delete']) assert.match(up, new RegExp(`create policy ${table}_\\w+ on public\\.${table} for ${op} to authenticated`))
  }
  const daily = up.split('create table public.tracking_daily_v1')[1].split('create table public.tracking_cycle_consent_v1')[0]
  assert.doesNotMatch(daily, /sleep_hours|energy|stress|soreness|bleeding|cycle_day/)
  assert.match(daily, /sleep_quality between 1 and 5/)
  assert.match(daily, /pain between 0 and 10/)
  assert.match(daily, /num_nonnulls\(sleep_quality, pain\) > 0/)
  assert.match(up, /revoke all on table .* from public, anon, authenticated;/)
  const updates = [...up.matchAll(/grant update \(([^)]+)\)/g)]
  assert.equal(updates.length, 3)
  assert.ok(updates.every(m => !/athlete_id|coach_id|logged_date|source/.test(m[1])))
  assert.doesNotMatch(up, /security\s+definer|grant\s+.*\s+to\s+(?:anon|public)\s*;/i)
})

test('identity guard permits only first non-coach self-claim, fails closed for missing JWT, invoker only', () => {
  assert.match(up, /new\.user_id is distinct from old\.user_id/)
  assert.match(up, /auth\.uid\(\) is not null or current_user in \('authenticated', 'anon'\)/)
  assert.match(up, /and \(old\.user_id is null\s+and new\.user_id = auth\.uid\(\)\s+and auth\.uid\(\) is distinct from old\.coach_id\) is not true then/)
  assert.match(up, /security invoker set search_path = pg_catalog/)
  assert.match(up, /errcode = '42501'/)
  assert.match(up, /before update on public\.athletes/)
  assert.match(up, /revoke all on function public\.tracking_guard_athlete_identity_v1\(\) from public, anon, authenticated/)
})

test('cycle read requires current coach AND recipient-specific explicit consent; all writes owner-only', () => {
  const policy = up.split('create policy tracking_cycle_v1_read')[1].split('create policy tracking_cycle_v1_insert')[0]
  assert.match(policy, /a\.user_id = \(select auth\.uid\(\)\) or \(/)
  assert.match(policy, /a\.coach_id = \(select auth\.uid\(\)\) and exists/)
  assert.match(policy, /c\.athlete_id = tracking_cycle_v1\.athlete_id and c\.coach_id = \(select auth\.uid\(\)\) and c\.sharing_enabled/)
  assert.match(up, /sharing_enabled boolean not null default false/)
  for (const table of tables) for (const op of ['insert', 'update', 'delete']) {
    const policy = up.split(`create policy ${table}_${op}`)[1].split('create policy ')[0]
    assert.ok(policy.includes('a.user_id = (select auth.uid())'))
  }
})

test('rollback lives outside discovery, removes own objects and guard only, with no cascade', () => {
  assert.equal(existsSync(new URL('supabase/migrations/20261103210000_tracking_v1_DRAFT_ROLLBACK.sql', root)), false)
  assert.deepEqual([...down.matchAll(/drop table public\.(\w+);/g)].map(m => m[1]), [...tables].reverse())
  assert.match(down, /drop trigger tracking_guard_athlete_identity_v1 on public\.athletes/)
  assert.match(down, /drop function public\.tracking_guard_athlete_identity_v1\(\)/)
  assert.doesNotMatch(down, /cascade|drop table public\.athletes/i)
})
