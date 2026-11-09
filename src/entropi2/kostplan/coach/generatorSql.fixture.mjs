// Synthetic SQL transport and DOM host adapted from the pinned independent
// control. Original SQL/product/React execute unchanged; no service or browser.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { PGlite } from '@electric-sql/pglite'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { uuid } from '../dailyReference.fixture.mjs'
import { sqlCalendarFixture } from '../../../testCalendar.fixture.mjs'
export const date = '2026-11-07', coachId = uuid(80001), athleteId = uuid(80002), owner = uuid(80003), stranger = uuid(80004)
export const profile = { id: athleteId, age: 33, bodyweight: 80, goal: 'cut', training: { volume: 'high', intensity: 'moderate' } }
export const names = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
export const scope = { coachId, athleteId, date }
const sql = readFileSync(new URL('../../../../supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql', import.meta.url), 'utf8')
const settle = async () => { for (let i = 0; i < 120; i++) await Promise.resolve() }
// A restricted query translator only; authorization, checks, triggers and plan
// selection run in actual SQL/product modules. No business logic is replicated.
export async function withDatabase(body, options = {}) {
  const db = new PGlite(), calls = []
  let identity, lost = options.lost
  const login = async id => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
    await db.exec('set role authenticated')
    identity = id
  }
  try {
    await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create table public.athletes(id uuid primary key, user_id uuid, coach_id uuid);
      alter table public.athletes enable row level security;
      grant select on public.athletes to authenticated;
      create policy independent_athletes on public.athletes for select to authenticated using(user_id=auth.uid() or coach_id=auth.uid());
      create table public.meal_logs(id uuid primary key,athlete_id uuid,date date,meal text,kcal numeric,protein numeric,carb numeric,fat numeric,created_at timestamptz default now());
      alter table public.meal_logs enable row level security;
      grant select on public.meal_logs to authenticated;
      create policy independent_meals on public.meal_logs for select to authenticated using(exists(select 1 from public.athletes a where a.id=athlete_id and (a.user_id=auth.uid() or a.coach_id=auth.uid())));`)
    await db.query('insert into public.athletes values($1,$2,$3)', [athleteId, owner, coachId])
    await db.exec(sql)
    await login(coachId)
    const key = s => { assert.match(s, /^[a-z_]+$/); return s }
    const client = { from(table) {
      assert.ok([...names, 'meal_logs'].includes(table), table)
      const call = { table, identity }, filters = [], params = []
      calls.push(call)
      let cols = '*', cap = 501, payload, counted = false, order = ''
      const compare = (k, op, v) => { params.push(v); filters.push(`${key(k)} ${op} $${params.length}`); return q }
      const q = {
        select(value, opts) { assert.match(value, /^(\*|[a-z_,]+)$/); cols = value; call.columns = value; counted = opts?.count === 'exact'; return q },
        limit(n) { assert.ok(Number.isInteger(n) && n >= 0 && n <= 501); cap = n; return q },
        eq: (k, v) => compare(k, '=', v), lte: (k, v) => compare(k, '<=', v), gte: (k, v) => compare(k, '>=', v),
        in(k, values) { assert.ok(values.length); filters.push(`${key(k)} in (${values.map(v => { params.push(v); return '$' + params.length }).join(',')})`); return q },
        order(k, opts) { order = ` order by ${key(k)} ${opts?.ascending === false ? 'desc' : 'asc'}`; return q },
        insert(value) { assert.ok(names.includes(table)); payload = structuredClone(value); call.payload = payload; return q },
        then(resolve, reject) { return (async () => {
          try {
            if (payload) {
              const keys = Object.keys(payload).map(key)
              const values = Object.values(payload).map(v => v !== null && typeof v === 'object' ? JSON.stringify(v) : v)
              const result = await db.query(`with r as(insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *) select row_to_json(r) value from r`, values)
              if (lost === table) { lost = null; throw Error('Synthetic committed response lost') }
              return { data: result.rows.map(r => r.value), error: null }
            }
            const where = filters.length ? ' where ' + filters.join(' and ') : ''
            const result = await db.query(`select row_to_json(r) value from(select ${cols} from public.${table}${where}${order} limit ${cap}) r`, params)
            const count = counted ? Number((await db.query(`select count(*) n from public.${table}${where}`, params)).rows[0].n) : undefined
            return { data: result.rows.map(r => r.value), error: null, ...(counted ? { count } : {}) }
          } catch (e) {
            call.error = { code: e.code ?? 'SYNTHETIC_LOST_REPLY', message: e.message }
            return { data: null, error: call.error }
          }
        })().then(resolve, reject) },
      }
      return q
    } }
    const calendar = await sqlCalendarFixture(db)
    await body({ db, login, client, calls, calendar })
  } finally { await db.close() }
}

export async function mounted(client, storage, body, props = {}) {
  const today = props.today ?? date
  const document = sessionReactDocument(), host = document.createElement('div')
  document.body.append(host)
  const make = document.createElement
  document.createElement = tag => {
    const n = make(tag)
    if (tag === 'select') Object.defineProperty(n, 'options', { get: () => n.querySelectorAll('option') })
    if (tag === 'option') Object.defineProperty(n, 'value', { get: () => n.getAttribute('value') ?? n.textContent, set: value => { n.setAttribute('value', value) } })
    return n
  }
  const replacements = { window: document.defaultView, localStorage: storage, IS_REACT_ACT_ENVIRONMENT: true, __independentClient: client }
  const original = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const activationURL = new URL('./activation.mjs', import.meta.url).href
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === activationURL && specifier === '../../../supabase.js')
      return { shortCircuit: true, url: 'data:text/javascript,export const supabase={from:(...args)=>globalThis.__independentClient.from(...args)}' }
    assert.ok(!specifier.endsWith('supabase.js'), 'No live client import')
    return next(specifier, context)
  } })
  const root = createRoot(host)
  const wait = async predicate => {
    for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await settle() })
    assert.ok(predicate(), host.textContent.slice(0, 500))
  }
  try {
    await act(async () => {
      root.render(h(CoachKostMaal, { enabled: true, athlete: profile, today,
        session: { user: { id: coachId } }, weightStatus: { athleteId, state: 'ready', rows: [] },
        nutritionRead: { ...scope, date: today, state: 'ready', complete: true, mealLogs: [], weightLogs: [] }, ...props }))
      await settle()
    })
    await body({ host, wait, submit: async () => {
      const form = host.querySelectorAll('form').find(n => n.textContent.includes('Vælg måltider til forslaget'))
      assert.ok(form, 'Actual mounted generator form')
      await act(async () => { host.dispatch('submit', { target: form, bubbles: true }); await settle() })
    }, open: async () => {
      const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
      assert.ok(details)
      await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
    }, click: async label => {
      const button = host.querySelectorAll('button').find(n => n.textContent === label)
      assert.ok(button, label); assert.equal(button.getAttribute('disabled'), null)
      await act(async () => { host.dispatch('click', { target: button, button: 0, bubbles: true }); await settle() })
    } })
  } finally {
    try { await act(async () => root.unmount()) } finally {
      hook.deregister()
      for (const [k, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor)
        else delete globalThis[k]
      }
    }
  }
}
