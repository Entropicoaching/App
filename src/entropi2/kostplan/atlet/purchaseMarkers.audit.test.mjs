// Separate case design against exact copied SQL and mounted product; same-engine
// producer audit only. This does not claim a fresh independent paired K review.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import { withDatabase, athleteId, owner } from '../coach/generatorSql.fixture.mjs'
import { all, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

test('same-engine audit: exact original SQL/RLS + mounted decimal items, local reopen and all-item copy; zero database mutations', { timeout: 60000 },
  async () => withDatabase(async f => {
    const { today, dates } = f.calendar
    const plan = '10000000-0000-4000-8000-000000009001', version = '10000000-0000-4000-8000-000000009002'
    const ingredient = { id: 'audit:grain', name: '<script>neverExecute()</script>', preparation: 'rå', basisGrams: 100,
      nutrientsPer100g: { energyKcal: null, proteinG: 0, carbohydrateG: null, fatG: 0 },
      source: { citation: 'audit-local', verification: 'synthetic' } }
    const meals = [{ name: 'Syntetisk aften', portions: [{ grams: .1, food: ingredient }, { grams: .2, food: ingredient },
      { grams: 1.125, food: { ...ingredient, preparation: 'kogt' } }] }]
    const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
    await f.db.exec('reset role')
    await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [plan, athleteId, today])
    await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values($1,$2,1,$3,$4,$5,'Syntetisk audit','vedligehold',0,$6)`, [version, plan, dates[0], today, JSON.stringify(basis), JSON.stringify(meals)])
    await f.db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [version])
    await f.login(owner)
    const before = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v')).rows
    const dom = hostFixture(), values = new Map([['other-app', 'untouched']]), writes = [], copies = [], warnings = []
    const storage = () => ({ getItem: k => values.get(k) ?? null, setItem(k, v) { writes.push(k); values.set(k, v) } })
    const previousError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
    let root = createRoot(dom.host), alive = true
    const marked = () => all(dom.host, 'button').filter(n => n.getAttribute('role') === 'checkbox')
    const render = async () => {
      await act(async () => { root.render(h(StrictMode, null, h(ApprovedPlanShopping, { enabled: true, athleteId, today, client: f.client,
        storage, clipboard: { writeText: text => copies.push(text) } }))); await tick() })
      for (let i = 0; i < 300 && marked().length !== 2; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) })
      assert.equal(marked().length, 2)
    }
    try {
      await render()
      assert.match(dom.host.textContent, /0,9 g/); assert.match(dom.host.textContent, /3,375 g/)
      assert.equal(all(dom.host, 'script').length, 0)
      assert.equal(writes.length, 0)
      await act(async () => { propsOf(marked()[0]).onClick(); await tick() })
      assert.equal(propsOf(marked()[0])['aria-checked'], true)
      assert.match(dom.host.textContent, /Mangler at købe: 1 af 2/)
      await act(async () => { await propsOf(button(dom.host, 'Kopiér indkøbsliste')).onClick(); await tick() })
      assert.match(copies[0], /0,9 g/); assert.match(copies[0], /3,375 g/)
      for (const date of dates) assert.ok(copies[0].includes(date))
      await act(async () => { root.unmount(); alive = false; await tick() })
      root = createRoot(dom.host); alive = true; await render()
      assert.equal(propsOf(marked()[0])['aria-checked'], true)
      assert.equal(values.get('other-app'), 'untouched'); assert.equal(writes.length, 1)
      assert.equal(f.calls.filter(call => call.payload).length, 0)
      assert.deepEqual((await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v')).rows, before)
      assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
    } finally {
      try { if (alive) await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) }
      finally { console.error = previousError; dom.restore() }
    }
  }))
