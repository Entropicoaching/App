import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { mount, text } from './mob6Dom.mjs'
// New, narrowly scoped test hook: the pinned homework source is imported intact.
// No legacy loader recipe or central registry is modified.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./mobilityHomework.mjs', import.meta.url).href)
    return { url: new URL('./mob6Dom.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { createHomeExerciseDb, HOME_EXERCISE_DB_DEFAULTS } = await import('./homeExerciseDb.mjs')
const { MobilityHomeworkHome, MobilityHomeworkCoach } = await import('./mobilityHomework.mjs')
const athlete = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const coach = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const rowId = '44444444-4444-4444-8444-444444444444'
const choice = { problemId: 'squat-hip', exerciseIds: ['sq-mob-3'] }
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) } }
function fake() {
  const rows = new Map(), calls = []
  let error = null, rejection = false, override
  const client = { from(table) {
    assert.equal(table, 'home_exercise_assignments'); calls.push(['from', table])
    let operation = 'read', payload, filters = []
    const query = {
      select(cols) { assert.equal(cols, 'id,athlete_id,coach_id,exercises,created_at'); calls.push(['select', cols]); return query },
      eq(k, v) { filters.push([k, v]); calls.push(['eq', k, v]); return query },
      upsert(value, options) {
        operation = 'save'; payload = structuredClone(value)
        assert.deepEqual(options, { onConflict: 'athlete_id,coach_id' }); calls.push(['upsert', payload]); return query
      },
      delete() { operation = 'delete'; calls.push(['delete']); return query },
      single() { return run() }, maybeSingle() { return run() },
      then(resolve, reject) { return run().then(resolve, reject) },
    }
    async function run() {
      if (rejection) throw Error('transport')
      if (error) return { data: null, error }
      if (override !== undefined) return { data: override, error: null }
      if (operation === 'save') {
        const key = payload.athlete_id + payload.coach_id
        rows.set(key, { id: rowId, created_at: '2026-10-29T12:00:00Z', ...payload })
        return { data: structuredClone(rows.get(key)), error: null }
      }
      assert.deepEqual(filters.map(([key]) => key), ['athlete_id', 'coach_id'])
      const matches = [...rows.entries()].filter(([, row]) => filters.every(([k, v]) => row[k] === v))
      if (operation === 'delete') { for (const [key] of matches) rows.delete(key); return { data: null, error: null } }
      return { data: matches.length ? structuredClone(matches[0][1]) : null, error: null }
    }
    return query
  } }
  return { client, rows, calls, fail(value) { error = value }, reject(value) { rejection = value }, override(value) { override = value } }
}
const poisonStorage = { getItem() { assert.fail('ON local read') }, setItem() { assert.fail('ON local write') } }
const db = f => createHomeExerciseDb({ hjemmeoevDb: true, client: f.client, storage: poisonStorage })

test('strict default OFF delegates to actual local module; actual DOM remains unchanged', async () => {
  assert.deepEqual(HOME_EXERCISE_DB_DEFAULTS, { hjemmeoevDb: false })
  for (const hjemmeoevDb of [undefined, false, 'true', 1, {}, null]) {
    const storage = memory()
    const adapter = createHomeExerciseDb({ hjemmeoevDb, storage, client: { from() { assert.fail('OFF database call') } } })
    assert.deepEqual(await adapter.read(athlete), { value: null, error: null })
    assert.deepEqual(await adapter.save(athlete, undefined, choice), { value: choice, error: null })
    assert.deepEqual(await adapter.read(athlete), { value: choice, error: null })
    assert.equal(mount(MobilityHomeworkHome, { athleteId: athlete, storage }).render(), null)
    assert.equal(mount(MobilityHomeworkCoach, { athleteId: athlete, storage }).render(), null)
    assert.match(text(mount(MobilityHomeworkHome, { enabled: true, athleteId: athlete, storage }).render()), /90\/90/)
    assert.deepEqual(await adapter.save(athlete, undefined, null), { value: null, error: null })
  }
})

test('ON fake client saves, overwrites, reads, isolates athlete and coach, and removes', async () => {
  const f = fake(), adapter = db(f)
  assert.deepEqual(await adapter.read(athlete, coach), { value: null, error: null })
  assert.deepEqual(await adapter.save(athlete, coach, choice), { value: choice, error: null })
  const next = { problemId: 'squat-hip', exerciseIds: ['sq-mob-1', 'sq-mob-3'] }
  assert.deepEqual(await adapter.save(athlete, coach, next), { value: next, error: null })
  assert.equal(f.rows.size, 1)
  assert.deepEqual(await adapter.read(athlete.toUpperCase(), coach.toUpperCase()), { value: next, error: null })
  assert.deepEqual(await adapter.read(athlete, coach), { value: next, error: null })
  assert.deepEqual(await adapter.read(other, coach), { value: null, error: null })
  assert.deepEqual(await adapter.read(athlete, other), { value: null, error: null })
  await adapter.save(other, coach, choice)
  assert.deepEqual(await adapter.save(athlete, coach, null), { value: null, error: null })
  assert.deepEqual(await adapter.read(athlete, coach), { value: null, error: null })
  assert.deepEqual(await adapter.read(other, coach), { value: choice, error: null })
})

test('invalid scopes and catalog payloads never reach fake client', async () => {
  const f = fake(), adapter = db(f)
  for (const [a, c] of [[undefined, coach], [athlete, 'x'], ['x', coach], [athlete, null]]) {
    assert.ok((await adapter.read(a, c)).error)
    assert.ok((await adapter.save(a, c, choice)).error)
  }
  for (const value of [{}, [], { ...choice, problemId: 'unknown' }, { ...choice, exerciseIds: [] },
    { ...choice, exerciseIds: ['sq-mob-3', 'sq-mob-3'] }, { ...choice, exerciseIds: ['bp-mob-1'] },
    { ...choice, exerciseIds: Array(5).fill('sq-mob-3') }, { ...choice, exerciseIds: ['unknown'] }]) {
    assert.ok((await adapter.save(athlete, coach, value)).error)
  }
  assert.equal(f.calls.length, 0)
})

test('database errors and thrown requests fail visibly without local fallback', async () => {
  for (const mode of ['fail', 'reject']) {
    const f = fake(), adapter = db(f)
    f[mode](mode === 'fail' ? { code: '42501', message: 'denied' } : true)
    for (const result of [await adapter.read(athlete, coach), await adapter.save(athlete, coach, choice), await adapter.save(athlete, coach, null)]) {
      assert.equal(result.value, null); assert.ok(result.error); assert.doesNotMatch(result.error, /42501|denied|transport/)
    }
    assert.equal(f.rows.size, 0)
  }
})

test('unavailable client is a visible error only when enabled', async () => {
  const adapter = createHomeExerciseDb({ hjemmeoevDb: true })
  assert.ok((await adapter.read(athlete, coach)).error)
  assert.ok((await adapter.save(athlete, coach, choice)).error)
})

test('malformed, wrong-scope and unconfirmed responses are rejected', async () => {
  const f = fake(), adapter = db(f)
  const base = { id: rowId, athlete_id: athlete, coach_id: coach, exercises: choice }
  for (const row of [{ ...base, athlete_id: other }, { ...base, coach_id: other }, { ...base, id: null },
    { ...base, exercises: {} }, { ...base, exercises: null }, {}, undefined]) {
    f.override(row === undefined ? {} : row)
    assert.ok((await adapter.read(athlete, coach)).error)
    assert.ok((await adapter.save(athlete, coach, choice)).error)
  }
  f.override({ ...base, exercises: { problemId: 'bench-shoulder', exerciseIds: ['bp-mob-1'] } })
  assert.ok((await adapter.save(athlete, coach, choice)).error)
})

const sql = readFileSync(new URL('../supabase/migrations/20261029120000_home_exercise_assignments_v1.sql', import.meta.url), 'utf8')
function policy(name) {
  const match = sql.match(new RegExp('create policy home_exercise_assignments_' + name + '\\s+([\\s\\S]*?);'))
  assert.ok(match, name); return match[1]
}

test('migration text enables RLS, restricts grants, includes all CRUD policies and immutable scope', () => {
  assert.match(sql, /^--[^\n]*\nbegin;/)
  assert.match(sql, /commit;\n$/)
  assert.match(sql, /alter table public.home_exercise_assignments enable row level security;/)
  assert.match(sql, /revoke all on table public.home_exercise_assignments from public, anon, authenticated;/)
  assert.match(sql, /unique \(athlete_id, coach_id\)/)
  assert.match(sql, /references public.athletes\(id\)/)
  assert.match(sql, /references auth.users\(id\)/)
  assert.match(sql, /grant update \(athlete_id, coach_id, exercises\)/)
  assert.match(sql, /jsonb_array_length\(exercises->'exerciseIds'\) between 1 and 4/)
  assert.match(sql, /before update on public.home_exercise_assignments/)
  for (const field of ['id', 'athlete_id', 'coach_id', 'created_at'])
    assert.ok(sql.includes(`new.${field} is distinct from old.${field}`))
  assert.match(sql, /security invoker set search_path = ''/)
  assert.doesNotMatch(sql, /security definer|grant[^;]*\bto anon|alter table public\.athletes|create or replace/i)
  for (const op of ['select', 'insert', 'update', 'delete']) {
    const p = policy(op)
    assert.ok(p.includes(`for ${op} to authenticated`))
    assert.ok(p.includes('a.id = home_exercise_assignments.athlete_id'))
    assert.ok(p.includes('a.coach_id = home_exercise_assignments.coach_id'))
  }
  assert.match(policy('select'), /a.user_id = \(select auth.uid\(\)\)/)
  for (const op of ['insert', 'update', 'delete']) assert.match(policy(op), /coach_id = \(select auth.uid\(\)\)/)
  assert.match(policy('update'), /using \([\s\S]*with check \(/)
})

// Restricted evaluator of the ACTUAL policy expression text, with synthetic rows.
// This probes predicates; it does not execute SQL, grants, triggers or PostgreSQL RLS.
function evaluate(expression, row, athletes, uid) {
  const predicate = (source, a = {}) => {
    let code = source.trim().replace(/\(select auth.uid\(\)\)/g, 'UID')
      .replace(/home_exercise_assignments\.(athlete_id|coach_id)/g, (_, k) => JSON.stringify(row[k]))
      .replace(/a\.(id|user_id|coach_id)/g, (_, k) => JSON.stringify(a[k]))
      .replace(/\bcoach_id\b/g, JSON.stringify(row.coach_id))
      .replace(/UID/g, JSON.stringify(uid)).replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/ = /g, ' === ')
    assert.match(code, /^[\s\w"'().,:=<>!&|\-]+$/)
    return Function('return (' + code + ')')() === true
  }
  // Parse EXISTS separately so its closing parenthesis is never rewritten.
  const exists = expression.match(/exists \(\s*select 1 from public.athletes a\s*where ([\s\S]*)\)\s*\)$/)
  assert.ok(exists)
  const inner = exists[1]
  const allowed = uid !== null && athletes.some(a => predicate(inner, a))
  const before = expression.slice(0, exists.index).replace(/^\(/, '').trim()
  return allowed && (!before || predicate(before.replace(/and\s*$/, '')))
}
function clauses(op) {
  const p = policy(op)
  return [...p.matchAll(/(?:using|with check) (\([\s\S]*?\)\))(?=\s*with check|$)/g)].map(m => m[1])
}

test('own counterprobes evaluate actual policy predicates: outsider, spoof, former coach and row moves', () => {
  const row = { athlete_id: athlete, coach_id: coach }
  const athletes = [{ id: athlete, user_id: other, coach_id: coach }]
  for (const op of ['select', 'insert', 'update', 'delete']) {
    const expressions = clauses(op)
    assert.equal(expressions.length, op === 'update' ? 2 : 1)
    for (const expression of expressions) {
      assert.equal(evaluate(expression, row, athletes, coach), true)
      assert.equal(evaluate(expression, row, athletes, other), op === 'select')
      assert.equal(evaluate(expression, row, athletes, rowId), false)
      assert.equal(evaluate(expression, row, athletes, null), false)
      assert.equal(evaluate(expression, { ...row, coach_id: rowId }, athletes, coach), false)
      assert.equal(evaluate(expression, { ...row, athlete_id: rowId }, athletes, coach), false)
      assert.equal(evaluate(expression, row, [{ ...athletes[0], coach_id: rowId }], coach), false)
    }
  }
})
