// Actual pinned draft SQL, actual adapter/session/controller and real ReactDOM.
// The diary table and identities below exist only in this closed synthetic DB.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPlanAdapter } from './planAdapter.mjs'
import { createKostDaySession } from './atlet/daySession.mjs'
import { createNutritionController } from '../nutrition/controller.mjs'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { storedSnapshot, uuid } from './dailyReference.fixture.mjs'

const up = readFileSync(new URL('../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const [athleteId, owner, coach, stranger, planId, versionId] = [801, 802, 803, 804, 805, 806].map(uuid)
const date = '2026-11-07'
const settle = () => new Promise(resolve => setImmediate(resolve))

async function fixture(run) {
  const db = new PGlite(), calls = []
  try {
    await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create table public.athletes(id uuid primary key,user_id uuid,coach_id uuid);
      alter table public.athletes enable row level security; grant select on public.athletes to authenticated;
      create policy fixture_athlete on public.athletes for select to authenticated using(user_id=auth.uid() or coach_id=auth.uid());
      create table public.meal_logs(id uuid primary key,athlete_id uuid,date date,meal text,kcal numeric,protein numeric,carb numeric,fat numeric,created_at timestamptz default now());
      alter table public.meal_logs enable row level security; grant select on public.meal_logs to authenticated;
      create policy fixture_diary on public.meal_logs for select to authenticated using(exists(select 1 from public.athletes a where a.id=athlete_id and (a.user_id=auth.uid() or a.coach_id=auth.uid())));`)
    await db.query('insert into public.athletes values($1,$2,$3)', [athleteId, owner, coach])
    await db.query('insert into public.meal_logs(id,athlete_id,date,meal,kcal,protein,carb,fat) values($1,$2,$3,\'Synthetic actual intake\',17,0,0,0)', [uuid(807), athleteId, date])
    await db.exec(up)
    const as = async who => {
      await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]); await db.exec('set role authenticated')
    }
    await as(coach)
    await db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [planId, athleteId, date])
    const snapshot = structuredClone(storedSnapshot(137, 0))
    snapshot.meals[0].portions[0].food.nutrientsPer100g.fatG = 0
    const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
    await db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values($1,$2,1,$3,$3,$4,'Synthetic zero content','vedligehold',0.1,$5)`, [versionId, planId, date, JSON.stringify(basis), JSON.stringify(snapshot.meals)])
    await db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [versionId])
    // Fixture administrator pins generated time, without changing the SQL contract.
    await db.exec('reset role')
    await db.query("update public.kostplan_v1_approvals set approved_at=$1,week_start='2026-11-02' where version_id=$2", [date + 'T12:00:00.000001Z', versionId])
    await as(owner)
    const client = { from(table) {
      assert.ok(['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals', 'meal_logs'].includes(table))
      const args = [], filters = [], call = { table }; calls.push(call)
      let columns, limit = 501, order = ''
      const column = k => { assert.match(k, /^[a-z_]+$/); return k }
      const filter = (k, op, value) => { args.push(value); filters.push(`${column(k)}${op}$${args.length}`); return q }
      const q = {
        select(s) { assert.match(s, /^(?:\*|[a-z_,]+)$/); columns = s; call.columns = s; return q },
        limit(n) { assert.ok(Number.isSafeInteger(n) && n >= 0 && n <= 501); limit = n; return q },
        eq: (k, v) => filter(k, '=', v), lte: (k, v) => filter(k, '<=', v), gte: (k, v) => filter(k, '>=', v),
        in(k, values) { const slots = values.map(v => { args.push(v); return '$' + args.length }); filters.push(`${column(k)} in (${slots.join(',')})`); return q },
        order(k, options) { order = ` order by ${column(k)} ${options?.ascending === false ? 'desc' : 'asc'}`; return q },
        then(ok, bad) { return (async () => {
          try {
            const where = filters.length ? ' where ' + filters.join(' and ') : ''
            const result = await db.query(`select row_to_json(selected) value from(select ${columns} from public.${table}${where}${order} limit ${limit}) selected`, args)
            return { data: result.rows.map(r => r.value), error: null }
          } catch (e) { call.error = e.code; return { data: null, error: { code: e.code } } }
        })().then(ok, bad) },
      }
      return q
    } }
    await run({ db, as, client, calls })
  } finally { await db.close() }
}

test('actual SQL/RLS: existing approval key, immutable saved zero-fat plan and real day session remain scoped', { timeout: 60000 }, async () => fixture(async f => {
  await assert.rejects(f.db.query('select id from public.kostplan_v1_approvals limit 0'), e => e.code === '42703')
  const initial = (await f.db.query('select meals from public.kostplan_v1_versions where id=$1', [versionId])).rows
  const active = await createPlanAdapter({ enabled: true, athleteId, date, client: f.client }).loadActive()
  assert.deepEqual(active.targets, { kcal: 137, protein: 0, carb: 0, fat: 0 })
  const session = createKostDaySession({ enabled: true, athleteId, date, client: f.client })
  const tracker = createNutritionController({ enabled: true, athlete: { id: athleteId, kcal_target: 2701, protein_target: 171 }, date, contracts: session.contracts })
  try {
    assert.equal(await session.controller.load(), true); assert.equal(await tracker.load(), true)
    assert.deepEqual(session.controller.snapshot().targets, active.targets)
    assert.deepEqual(tracker.snapshot().targets, { kcal: 137, protein: 0 })
    assert.deepEqual(tracker.snapshot().totals, { kcal: 17, protein: 0, carb: 0, fat: 0 })
    assert.deepEqual(session.controller.snapshot().remaining, { kcal: 120, protein: null, carb: null, fat: null })
    await assert.rejects(f.db.query("update public.kostplan_v1_versions set rationale='owner attempt' where id=$1", [versionId]))
    await f.as(stranger)
    for (const table of ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']) assert.equal((await f.db.query(`select * from public.${table}`)).rows.length, 0)
    assert.equal(await createPlanAdapter({ enabled: true, athleteId, date, client: f.client }).loadActive(), null)
    await f.as(coach)
    assert.deepEqual((await f.db.query('select meals from public.kostplan_v1_versions where id=$1', [versionId])).rows, initial)
    await f.db.query('update public.athletes set coach_id=$1 where id=$2', [stranger, athleteId]).then(() => assert.fail('coach cannot change owner'), e => assert.equal(e.code, '42501'))
    await f.db.exec('reset role'); await f.db.query('update public.athletes set coach_id=$1 where id=$2', [stranger, athleteId]); await f.as(coach)
    assert.equal(await createPlanAdapter({ enabled: true, athleteId, date, client: f.client }).loadActive(), null)
    assert.ok(f.calls.every(c => c.table !== 'kostplan_v1_approvals' || !c.columns.split(',').includes('id')))
  } finally { tracker.dispose(); session.dispose() }
}))

test('real mounted Entropi2Kost against actual SQL: displays known zero content with no zero progress or fabricated intake', { timeout: 60000 }, async () => fixture(async f => {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  let root
  try {
    root = createRoot(host)
    await act(async () => {
      root.render(h(Entropi2Kost, { enabled: true, athlete: { id: athleteId, kcal_target: 2701, protein_target: 171 }, date, client: f.client, foods: [], weightLogs: [] }))
      await settle()
    })
    // PGlite queries are asynchronous; wait for a visible confirmed reference.
    for (let i = 0; i < 50 && !host.textContent.includes('Aktiv plans indhold'); i++) await act(async () => { await settle() })
    const hero = host.querySelector('[data-kost-del="maal"]')
    assert.match(hero.textContent, /Aktiv plans indhold.*Energi: 137 kcal.*Protein: 0 g/)
    assert.doesNotMatch(hero.textContent, /Aftal dine kostmål|2.701|171 g/)
    const status = host.querySelectorAll('section').find(n => n.getAttribute('aria-label') === 'Dagens status')
    assert.match(status.textContent, /Protein: 0 g \/ 0 g/)
    assert.match(status.textContent, /Fedt: 0 g \/ 0 g/)
    assert.doesNotMatch(host.textContent, /Infinity|NaN|100%/)
    const progress = host.querySelectorAll('progress')
    assert.ok(progress.length > 0)
    for (const n of progress) { assert.equal(Number(n.max ?? n.getAttribute('max')), 137); assert.equal(Number(n.value ?? n.getAttribute('value')), 17) }
    assert.equal((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n, 1)
  } finally {
    try { if (root) await act(async () => root.unmount()) }
    finally { for (const [k, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k] } }
  }
}))
