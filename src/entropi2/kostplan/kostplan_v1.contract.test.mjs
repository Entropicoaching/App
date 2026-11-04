// Static checks supplement the REQUIRED PostgreSQL execution test beside this file.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { findShadowedFolderNameArgs } from '../../storagePolicySql.js'

const directory = new URL('../../../supabase/sql/udkast/', import.meta.url)
const upName = '20261104211000_kostplan_v1_DRAFT.sql'
const downName = '20261104211000_kostplan_v1_DRAFT_ROLLBACK.sql'
const up = readFileSync(new URL(upName, directory), 'utf8')
const down = readFileSync(new URL(downName, directory), 'utf8')
const clean = sql => sql.replace(/--[^\n]*/g, '')
const tables = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']

test('only new namespace objects are written; existing schema and OFF entry points stay untouched', () => {
  const sql = clean(up)
  assert.deepEqual([...sql.matchAll(/create table public\.(\w+)/g)].map(m => m[1]), tables)
  for (const expression of [/(?:alter table|update|insert into|delete from) public\.(\w+)/g,
    /(?:create function|create index|create unique index) (?:public\.)?(\w+)/g]) {
    for (const match of sql.matchAll(expression)) assert.ok(match[1].startsWith('kostplan_v1_'), match[0])
  }
  assert.doesNotMatch(sql, /create or replace|create extension|drop\s|truncate|alter default privileges|grant[^;]*\bto\s+(?:public|anon)\b/i)
  assert.match(sql, /^\s*begin;[\s\S]*commit;\s*$/)
  assert.deepEqual(findShadowedFolderNameArgs(up), [])
})

test('both DRAFT files are outside automatic migrations; src tests match npm test discovery', () => {
  for (const name of [upName, downName]) {
    assert.equal(existsSync(new URL('../../../supabase/migrations/' + name, import.meta.url)), false)
  }
  const runner = readFileSync(new URL('../../../scripts/test.mjs', import.meta.url), 'utf8')
  assert.match(runner, /tests\(join\(root, 'src'\)\)/)
  assert.match(runner, /\\\.test\\\.\(\?:js\|mjs\)\$/)
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts.test, 'node scripts/test.mjs')
})

test('all Data API tables retain RLS and least-privilege grants with immutable histories', () => {
  const sql = clean(up)
  for (const table of tables) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`))
    assert.match(sql, new RegExp(`create policy ${table}_read on public\\.${table} for select to authenticated`))
  }
  assert.match(sql, /revoke all on table[\s\S]*?from public, anon, authenticated;/)
  assert.deepEqual([...sql.matchAll(/grant update[^;]*;/g)].map(m => m[0]),
    ['grant update (status) on public.kostplan_v1_plans to authenticated;'])
  assert.doesNotMatch(sql, /grant (?:all|delete|truncate|references|trigger)\b/i)
  assert.match(sql, /grant insert \(version_id, approval_kind\) on public\.kostplan_v1_approvals to authenticated;/)
  assert.doesNotMatch(sql, /grant insert \([^;]*(?:approved_at|coach_id|week_start|created_at)[^;]*;/)
  assert.equal((sql.match(/security definer set search_path = ''/g) || []).length, 2)
  assert.match(sql, /revoke all on function public\.kostplan_v1_prepare_approval\(\),[\s\S]*?from public, anon, authenticated;/)
})

test('athlete visibility still requires approval and the CURRENT coach relation', () => {
  const read = up.split('create policy kostplan_v1_versions_read')[1].split('create policy ')[0]
  assert.match(read, /a\.user_id = \(select auth.uid\(\)\) and p\.status = 'godkendt' and exists/)
  assert.match(read, /ap\.version_id = kostplan_v1_versions\.id/)
  for (const table of tables) {
    const policy = up.split(`create policy ${table}_read`)[1].split('create policy ')[0]
    assert.match(policy, /a\.coach_id = \(select auth.uid\(\)\)/)
    assert.match(policy, /a\.user_id = \(select auth.uid\(\)\)/)
  }
  assert.match(up, /with check \(status = 'arkiveret'/)
})

test('coach corrections bypass only the weekly automatic gate, with server-derived metadata', () => {
  assert.doesNotMatch(up, /unique \(athlete_id, week_start\)/)
  assert.match(up, /create unique index kostplan_v1_automatic_week[\s\S]*?where approval_kind = 'automatic'/)
  assert.match(up, /if new\.approval_kind = 'automatic' then[\s\S]*?target\.effective_from < last_effective \+ 7/)
  assert.match(up, /clock_timestamp\(\) < last_approved \+ interval '7 days'/)
  assert.match(up, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('kostplan_v1:'/)
  assert.match(up, /new\.approved_at := clock_timestamp\(\)/)
  assert.match(up, /new\.week_start := date_trunc\('week', new\.approved_at at time zone 'Europe\/Copenhagen'\)::date/)
  assert.match(up, /if auth\.uid\(\) is null then/)
  assert.match(up, /a\.coach_id = auth\.uid\(\)/)
  assert.match(up, /kostplan_v1_publish_approval after insert/)
  const before = up.split('create function public.kostplan_v1_prepare_approval()')[1].split('create function ')[0]
  assert.doesNotMatch(clean(before), /(?:update|insert into|delete from) public\./)
})

test('rollback drops EVERY cross-table policy first and only reverses the new namespace', () => {
  const sql = clean(down)
  const policies = [...clean(up).matchAll(/create policy (\w+) on public\.(\w+)/g)].map(m => `${m[1]} on public.${m[2]}`)
  const drops = [...sql.matchAll(/drop policy ([^;]+);/g)].map(m => m[1])
  assert.deepEqual(drops.sort(), policies.sort())
  assert.ok(sql.lastIndexOf('drop policy ') < sql.indexOf('drop table '))
  assert.deepEqual([...sql.matchAll(/drop table public\.(\w+);/g)].map(m => m[1]), [...tables].reverse())
  assert.deepEqual([...sql.matchAll(/drop function public\.(\w+\([^)]*\));/g)].map(m => m[1]).sort(),
    [...clean(up).matchAll(/create function public\.(\w+\([^)]*\))/g)].map(m => m[1].replace('(meals jsonb)', '(jsonb)')).sort())
  assert.ok(sql.indexOf('drop function public.kostplan_v1_valid_meals') > sql.indexOf('drop table public.kostplan_v1_versions'))
  assert.doesNotMatch(sql, /cascade|if exists|public\.athletes|auth\./i)
  assert.match(sql, /^\s*begin;[\s\S]*commit;\s*$/)
})
