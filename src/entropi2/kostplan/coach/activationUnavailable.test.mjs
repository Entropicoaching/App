// K11 regression: real view/controller/adapter, synthetic storage and tables only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { coachPlanView } from './view.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { startPlanActivation } from './activation.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const athlete = { id: 'k11-athlete', protein_target: 130 }, date = '2026-11-07'
const walk = n => !isValidElement(n) ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(walk)]
const buttons = c => walk(coachPlanView(h, c.snapshot(), c)).filter(n => n.type === 'button')
const action = (c, label) => buttons(c).find(n => n.props.children === label)
const settle = async () => { await flush(); await flush() }
function editor(storage) {
  return openPortalPlan({ enabled: true, coachId: 'k11-coach', athlete, date, storage: () => storage,
    template: [{ id: 'k11-meal', name: 'K11 meal', items: [{ foodId: FOODS[0].id, grams: 100 }] }] }).controller
}

test('K11: unavailable schema removes the no-op action while explicit local save stays usable', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const storage = memoryStorage(), c = editor(storage), f = syntheticTables({ missing, missingCode })
    c.set('maintenanceKcal', 2400); c.set('fat', 70)
    assert.equal(c.generate(), true); assert.equal(await c.save(), true)
    const stop = startPlanActivation({ controller: c, athleteId: athlete.id, date, client: f.client })
    try {
      await settle()
      assert.equal(c.snapshot().activationState, 'unavailable')
      assert.match(c.snapshot().activationError, /tabeller mangler.*lokale kladde er bevaret/)
      assert.equal(action(c, 'Markér lokal kladde som klar'), undefined)
      assert.equal(action(c, 'Aktivér for atleten'), undefined)
      const before = c.snapshot(), bytes = [...storage.data.entries()]
      assert.equal(await c.activate(), false)
      assert.deepEqual(c.snapshot(), before); assert.deepEqual([...storage.data.entries()], bytes)
      assert.equal(c.snapshot().publishedVersion, null); assert.equal(c.snapshot().activationPending, false)
      assert.equal(f.writes().length, 0)
      assert.equal(c.editGrams(0, 0, 157), true)
      const save = action(c, 'Gem som kladde')
      assert.ok(save); assert.equal(save.props.disabled, false); assert.equal(await save.props.onClick(), true)
      assert.match(c.snapshot().message, /Lokal kladde gemt/)
      assert.notDeepEqual([...storage.data.entries()], bytes)
      const saved = c.snapshot(), savedBytes = [...storage.data.entries()]
      assert.equal(editor(storage).snapshot().meals[0].items[0].grams, 157)
      assert.equal(await c.activate(), false); assert.deepEqual(c.snapshot(), saved)
      assert.deepEqual([...storage.data.entries()], savedBytes); assert.equal(f.writes().length, 0)
      delete f.options.missing
      assert.equal(await c.checkActivation(), true)
      assert.equal(action(c, 'Aktivér for atleten').props.disabled, false)
      assert.equal(action(c, 'Markér lokal kladde som klar'), undefined)
      assert.deepEqual([...storage.data.entries()], savedBytes); assert.equal(f.writes().length, 0)
    } finally { stop() }
  }
})

test('K11: checking and read failures also offer only explicit local saving until retry confirms capability', async () => {
  const storage = memoryStorage(), c = editor(storage), f = syntheticTables({ error: '42501' })
  c.set('maintenanceKcal', 2400); c.set('fat', 70); c.generate(); await c.save()
  assert.equal(action(c, 'Markér lokal kladde som klar'), undefined)
  assert.equal(action(c, 'Aktivér for atleten'), undefined)
  const stop = startPlanActivation({ controller: c, athleteId: athlete.id, date, client: f.client })
  try {
    await settle()
    assert.equal(c.snapshot().activationState, 'error')
    assert.equal(action(c, 'Markér lokal kladde som klar'), undefined)
    assert.equal(action(c, 'Aktivér for atleten'), undefined)
    const before = c.snapshot(), bytes = [...storage.data.entries()]
    assert.equal(await c.activate(), false); assert.deepEqual(c.snapshot(), before)
    assert.deepEqual([...storage.data.entries()], bytes); assert.equal(f.writes().length, 0)
    delete f.options.error
    assert.equal(await c.checkActivation(), true)
    assert.equal(action(c, 'Aktivér for atleten').props.disabled, false)
    assert.equal(f.writes().length, 0)
  } finally { stop() }
})

// Composition controls: real mounted consumer, existing adapters and actual
// pinned SQL. All identities, transport and data are synthetic and local.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createKostDaySession } from '../atlet/daySession.mjs'
import { storedSnapshot, uuid } from '../dailyReference.fixture.mjs'

const sql = readFileSync(new URL('../../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const [sqlAthlete, sqlOwner, sqlCoach, sqlStranger] = [9101, 9102, 9103, 9104].map(uuid)
const sqlDate = '2026-11-05'
const sqlProfile = { id: sqlAthlete, age: 26, bodyweight: 80, goal: 'cut', protein_target: 175,
  training: { volume: 'high', intensity: 'moderate' } }
const sqlMeals = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `meal-${i}`, name, items: [] }))

async function actualSql(run) {
  const db = new PGlite(), calls = [], options = { loseApproval: false }
  let identity = sqlCoach
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
    await db.query('insert into public.athletes values($1,$2,$3)', [sqlAthlete, sqlOwner, sqlCoach])
    await db.exec(sql)
    const login = async who => {
      await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]); await db.exec('set role authenticated')
      identity = who
    }
    await login(sqlCoach)
    const client = { from(table) {
      assert.ok([...tableNames, 'meal_logs'].includes(table)); const filters = [], args = [], call = { table, identity }; calls.push(call)
      let columns = '*', limit = 501, payload = null, exact = false, order = ''
      const column = key => { assert.match(key, /^[a-z_]+$/); return key }
      const filter = (key, operator, value) => { args.push(value); filters.push(`${column(key)}${operator}$${args.length}`); return q }
      const q = {
        select(value, opts) { assert.match(value, /^(?:\*|[a-z_,]+)$/); columns = value; exact = opts?.count === 'exact'; call.columns = value; return q },
        limit(n) { assert.ok(Number.isSafeInteger(n) && n >= 0 && n <= 501); limit = n; return q },
        eq: (key, v) => filter(key, '=', v), lte: (key, v) => filter(key, '<=', v), gte: (key, v) => filter(key, '>=', v),
        order(key, opts) { order = ` order by ${column(key)} ${opts?.ascending === false ? 'desc' : 'asc'}`; return q },
        in(key, values) { const slots = values.map(v => { args.push(v); return '$' + args.length }); filters.push(`${column(key)} in (${slots.join(',')})`); return q },
        insert(value) { assert.notEqual(table, 'meal_logs'); payload = structuredClone(value); call.payload = payload; return q },
        then(ok, bad) { return (async () => {
          try {
            if (payload) {
              const keys = Object.keys(payload).map(column), values = Object.values(payload).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v)
              const inserted = await db.query(`with inserted as (insert into public.${table}(${keys.join(',')}) values(${keys.map((_,i) => '$'+(i+1)).join(',')}) returning *) select row_to_json(inserted) value from inserted`, values)
              if (table === tableNames[2]) {
                // Fixture admin pins server-generated time; no fabricated approval id.
                const who = identity
                await db.exec('reset role')
                await db.query("update public.kostplan_v1_approvals set approved_at=$1,week_start='2026-11-02' where version_id=$2", [sqlDate + 'T10:00:00.000001Z', payload.version_id])
                await login(who)
                if (options.loseApproval) { options.loseApproval = false; return { data: null, error: { code: 'SYNTHETIC_LOST_RESPONSE' } } }
              }
              return { data: inserted.rows.map(r => r.value), error: null }
            }
            const where = filters.length ? ' where ' + filters.join(' and ') : ''
            const count = exact ? Number((await db.query(`select count(*) n from public.${table}${where}`, args)).rows[0].n) : undefined
            const selected = await db.query(`select row_to_json(selected) value from(select ${columns} from public.${table}${where}${order} limit ${limit}) selected`, args)
            return { data: selected.rows.map(r => r.value), error: null, ...(exact ? { count } : {}) }
          } catch (e) { call.error = { code: e.code, message: e.message }; return { data: null, error: { code: e.code } } }
        })().then(ok, bad) },
      }; return q
    } }
    await run({ db, login, client, calls, options, writes: () => calls.filter(c => c.payload) })
  } finally { await db.close() }
}

function sqlEditor(storage, profile = sqlProfile) {
  return openPortalPlan({ enabled: true, coachId: sqlCoach, athlete: profile, date: sqlDate,
    template: sqlMeals, storage: () => storage }).controller
}
async function sqlSaved(storage) {
  const c = sqlEditor(storage)
  c.set('maintenanceKcal', '1600'); c.set('intensity', 15)
  assert.equal(c.generate(sqlMeals), true); assert.equal(await c.save(), true)
  return c
}
async function mountedSql(f, storage, profile, run, mealLogs = []) {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const create = doc.createElement
  doc.createElement = tag => {
    const n = create(tag)
    if (tag === 'select') Object.defineProperty(n, 'options', { get: () => n.querySelectorAll('option') })
    if (tag === 'option') Object.defineProperty(n, 'value', { get: () => n.getAttribute('value') ?? n.textContent, set: value => { n.setAttribute('value', value) } })
    return n
  }
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: storage,
    __compositionSqlClient: f.client }
  const previous = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const activationURL = new URL('./activation.mjs', import.meta.url).href
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === activationURL && specifier === '../../../supabase.js')
      return { shortCircuit: true, url: 'data:text/javascript,export const supabase={from:(...args)=>globalThis.__compositionSqlClient.from(...args)}' }
    assert.ok(!/supabase\.js$/.test(specifier), 'Only synthetic client allowed')
    return next(specifier, context)
  } })
  const root = createRoot(host)
  const waitFor = async predicate => {
    for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await settle() })
    assert.ok(predicate(), host.textContent.slice(0, 500))
  }
  try {
    await act(async () => {
      root.render(h(CoachKostMaal, { enabled: true, athlete: profile, today: sqlDate,
        session: { user: { id: sqlCoach } }, weightStatus: { athleteId: sqlAthlete, state: 'ready', rows: [] },
        nutritionRead: { coachId: sqlCoach, athleteId: sqlAthlete, date: sqlDate, state: 'ready', complete: true, mealLogs, weightLogs: [] } }))
      await settle()
    })
    const open = async () => {
      const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
      assert.ok(details)
      await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
    }
    await run({ host, open, waitFor, click: async label => {
      const node = host.querySelectorAll('button').find(n => n.textContent === label)
      assert.ok(node, label)
      await act(async () => { host.dispatch('click', { target: node, button: 0, bubbles: true }); await settle() })
    } })
  } finally {
    try { await act(async () => root.unmount()) } finally {
      hooks.deregister()
      for (const [k, d] of previous) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k] }
    }
  }
}

test('COMPOSITION actual SQL/mounted host: current generated draft activates through the original SQL', { timeout: 60000 }, async () => actualSql(async f => {
  const storage = memoryStorage()
  const controller = await sqlSaved(storage)
  const expected = controller.snapshot().meals.map(meal => ({ name: meal.name,
    portions: meal.items.map(item => ({ grams: item.grams, food: Object.fromEntries(
      Object.entries(item.food.nutrition).filter(([key]) => !['prioritet', 'prioritetBegrundelse'].includes(key))) })) }))
  await mountedSql(f, storage, sqlProfile, async t => {
    await t.open()
    await t.waitFor(() => t.host.querySelectorAll('button').some(n => n.textContent === 'Aktivér for atleten' && n.getAttribute('disabled') === null))
    await t.click('Aktivér for atleten')
    await t.waitFor(() => t.host.textContent.includes('Den gemte kladde svarer til atletens bekræftede aktive plan'))
    assert.equal(f.calls.some(call => call.error), false)
    assert.equal(f.writes().length, 3)
    const versions = (await f.db.query('select meals from public.kostplan_v1_versions')).rows
    assert.equal(versions.length, 1)
    assert.deepEqual(versions[0].meals, expected)
    const count = (await f.db.query('select count(*) n from public.kostplan_v1_approvals')).rows[0].n
    assert.equal(count, 1)
    const local = JSON.parse([...storage.data.values()][0])
    assert.equal(local.activationPending, false)
    assert.equal(local.plan.status, 'draft')
    assert.doesNotMatch(t.host.textContent, /kcal registreret|% af planindhold/)
  })
}))

test('COMBINED actual SQL: original version_id ledger, historical eligibility, approved0 and separate athlete login stay honest', { timeout: 60000 }, async () => actualSql(async f => {
  const zero = structuredClone(storedSnapshot(137, 0)); zero.meals[0].portions[0].food.nutrientsPer100g.fatG = 0
  const parent = uuid(9191), version = uuid(9192)
  const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
  await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [parent, sqlAthlete, sqlDate])
  await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
    values($1,$2,1,$3,$3,$4,'Synthetic zero','vedligehold',0.1,$5)`, [version, parent, sqlDate, JSON.stringify(basis), JSON.stringify(zero.meals)])
  await f.db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [version])
  await f.db.exec('reset role')
  await f.db.query("update public.kostplan_v1_approvals set approved_at=$1 where version_id=$2", [sqlDate + 'T11:00:00.000001Z', version])
  await f.login(sqlCoach)
  const refs = await createPlanAdapter({ enabled: true, client: f.client, athleteId: sqlAthlete, date: sqlDate }).loadDailyReferences({ coachId: sqlCoach })
  assert.equal(refs.state, 'ready'); assert.deepEqual(refs.days.map(d => d.targets.kcal), [null, null, null, null, null, null, 137])
  await f.login(sqlOwner)
  const approved0 = await createPlanAdapter({ enabled: true, client: f.client, athleteId: sqlAthlete, date: sqlDate }).loadActive()
  assert.deepEqual(approved0.targets, { kcal: 137, protein: 0, carb: 0, fat: 0 })
  const session = createKostDaySession({ enabled: true, athleteId: sqlAthlete, date: sqlDate, client: f.client })
  try { assert.equal(await session.controller.load(), true); assert.deepEqual(session.controller.snapshot().targets, approved0.targets) }
  finally { session.dispose() }
  await f.login(sqlStranger)
  assert.equal(await createPlanAdapter({ enabled: true, client: f.client, athleteId: sqlAthlete, date: sqlDate }).loadActive(), null)
  assert.ok(f.calls.every(call => call.table !== tableNames[2] || !call.columns?.split(',').includes('id')))
}))
