import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { withDatabase, athleteId, owner, stranger, names } from '../coach/generatorSql.fixture.mjs'
import { all, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { snapshot, uuid, mealNames } from './approvedShopping.fixture.mjs'

const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
async function seed(f, repeated = false) {
  const { today, dates } = f.calendar
  await f.db.exec('reset role')
  await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [uuid(81000), athleteId, today])
  for (const i of repeated ? [0, 2] : [0, 1, 2]) {
    const s = snapshot(i + 1)
    await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values($1,$2,$3,$4,$5,$6,'Syntetisk testplan',$7,$8,$9)`,
    [uuid(81010 + i), uuid(81000), i + 1, dates[i], today, JSON.stringify(basis), s.goal, s.intensity, JSON.stringify(s.meals)])
    await f.db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [uuid(81010 + i)])
  }
  await f.login(owner)
}

test('original SQL/PGlite RLS + mounted actual StrictMode athlete route: three approved dates, six named meals, independent arithmetic and readonly copy', { timeout: 60000 },
  async () => withDatabase(async f => {
    const { today, dates } = f.calendar
    await seed(f)
    const before = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows
    const c = createApprovedShopping({ enabled: true, client: f.client, athleteId, today })
    try {
      assert.equal(await c.load(), true)
      assert.deepEqual(c.snapshot().result.items.map(i => i.grams), ['450', '900', '42', '66', '78'])
      assert.deepEqual(c.snapshot().result.days.map(d => d.mealNames), [mealNames, mealNames, mealNames])
      assert.deepEqual(c.snapshot().result.days.map(d => d.versionId), [uuid(81010), uuid(81011), uuid(81012)])
    } finally { c.dispose() }
    const dom = hostFixture(), root = createRoot(dom.host), copied = [], localWrites = [], warnings = []
    const oldError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
    dom.globals({ localStorage: { getItem: () => null, setItem: (...args) => localWrites.push(args) },
      navigator: { clipboard: { writeText: text => { copied.push(text) } } } })
    const shop = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Indkøb fra kostplanen')
    const wait = async predicate => {
      for (let i = 0; i < 300 && !predicate(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) })
      assert.ok(predicate(), dom.host.textContent.slice(0, 300))
    }
    try {
      await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, {
        enabled: true, athlete: { id: athleteId }, date: today, client: f.client, foods: [], weightLogs: [], currentDay: () => today,
      }))); await tick() })
      await wait(() => Boolean(button(shop(), 'Kopiér indkøbsliste')))
      assert.equal(all(shop(), 'input').length, 4); assert.equal(copied.length, 0)
      assert.match(shop().textContent, /Linser: 450 g/); assert.match(shop().textContent, /Ris: 900 g/)
      for (const meal of mealNames) assert.ok(shop().textContent.includes(meal))
      assert.equal(all(shop(), 'form').length, 0, 'no diary/stock writes exposed in shopping')
      assert.ok(all(dom.host, '[data-entropi2-kost]')[0], 'today tracker stays mounted')
      await act(async () => { await propsOf(button(shop(), 'Kopiér indkøbsliste')).onClick(); await tick() })
      assert.equal(copied.length, 1); assert.match(shop().textContent, /Kopieret\./)
      for (const date of dates) assert.ok(copied[0].includes(date))
      assert.deepEqual(localWrites, [])
    } finally {
      try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) }
      finally { console.error = oldError; dom.restore() }
    }
    assert.equal(f.calls.filter(call => call.payload).length, 0)
    assert.ok(f.calls.every(call => [...names, 'meal_logs'].includes(call.table)))
    assert.deepEqual((await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows, before)
    assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
    await assert.rejects(f.db.query('update public.kostplan_v1_versions set meals=$1 where id=$2', [JSON.stringify([]), uuid(81010)]))
  }))

test('original SQL effective version repeated on two selected days counts twice; stranger cannot shop; invalid gram/unit rows rejected', { timeout: 60000 },
  async () => withDatabase(async f => {
    const { today, dates } = f.calendar
    await seed(f, true)
    const c = createApprovedShopping({ enabled: true, athleteId, today, client: f.client })
    try {
      assert.equal(await c.load(), true)
      assert.deepEqual(c.snapshot().result.days.map(d => d.versionId), [uuid(81010), uuid(81010), uuid(81012)])
      assert.equal(c.snapshot().result.days[1].effectiveFrom, dates[0])
      assert.deepEqual(c.snapshot().result.items.map(i => i.grams), ['375', '750', '35', '55', '65'])
    } finally { c.dispose() }
    await f.login(stranger)
    const denied = createApprovedShopping({ enabled: true, athleteId, today, client: f.client })
    try {
      assert.equal(await denied.load(), false); assert.equal(denied.snapshot().complete, false)
      assert.deepEqual(denied.snapshot().affected.map(d => d.date), dates)
      assert.equal(denied.snapshot().result, null)
    } finally { denied.dispose() }
    assert.equal(f.calls.filter(call => call.payload).length, 0)
    await f.db.exec('reset role')
    for (const invalid of ['zero', 'unit']) {
      const s = structuredClone(snapshot(1))
      if (invalid === 'zero') s.meals[0].portions[0].grams = 0
      else s.meals[0].portions[0].unit = 'ml'
      const valid = (await f.db.query('select public.kostplan_v1_valid_meals($1::jsonb) value', [JSON.stringify(s.meals)])).rows[0].value
      assert.equal(valid, false)
    }
  }))
