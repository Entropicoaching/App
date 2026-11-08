import test from 'node:test'
import assert from 'node:assert/strict'
import { withDatabase, athleteId, coachId, owner, stranger, names } from '../coach/generatorSql.fixture.mjs'
import { uuid } from '../dailyReference.fixture.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { createFood } from '../foedevarer/catalog.mjs'
import { micros, nutrientRows, nutrientFold } from './plannedMicronutrients.fixture.mjs'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { all, propsOf, hostFixture, tick, button } from '../../nutrition/diaryTemplate.fixture.mjs'

const today = '2026-11-07', future = '2026-11-08'
const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))

test('original SQL-approved immutable nutrient snapshots through athlete RLS and actual mounted Today/Future, including correction/zero/unknown and readonly display', { timeout: 60000 }, async t => withDatabase(async f => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(today + 'T12:00:00+01:00') })
  await f.db.exec('reset role')
  await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [uuid(950), athleteId, today])
  const seed = async (no, date, kind) => {
    // The unchanged SQL trigger owns approved_at; give each approval a distinct synthetic clock.
    t.mock.timers.setTime(new Date(today + 'T10:00:0' + no + 'Z').getTime())
    await f.db.exec('reset role')
    const snapshot = supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [150.5, 25.25].map((grams, i) => ({
      name: 'SQL syntetisk ' + i, portions: [{ grams, food: createFood({
        id: 'sql-synthetic-' + i, name: 'SQL syntetisk mad ' + i, preparation: 'synthetic',
        source: { citation: 'Synthetic SQL arithmetic only', verification: 'synthetic' },
        nutrientsPer100g: { energyKcal: 100, proteinG: 10, carbohydrateG: 12, fatG: 2,
          ...Object.fromEntries(Object.entries(micros).map(([k, v]) => [k, kind === 'missing' ? null : kind === 'zero' ? 0 : kind === 'partial' && i && k === 'ironMg' ? null : v])) },
      }) }],
    })) })
    await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals,portion_guidance)
      values($1,$2,$3,$4,$5,$6,'Synthetic SQL fixture',$7,$8,$9,$10)`,
      [uuid(950 + no), uuid(950), no, date, today, JSON.stringify(basis), snapshot.goal, snapshot.intensity, JSON.stringify(snapshot.meals), 'Væske/timing SQL <b>bogstaveligt</b>'])
    await f.login(coachId)
    await f.db.exec('reset role')
    await f.db.query(`insert into public.kostplan_v1_approvals(version_id,approval_kind,approved_at) values($1,'coach',$2)`, [uuid(950 + no), today + 'T10:00:0' + no + 'Z'])
    await f.login(owner)
  }
  await seed(1, today, 'complete'); await seed(2, future, 'partial')
  const before = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows
  const dom = hostFixture(), root = createRoot(dom.host), storageWrites = [], values = new Map()
  dom.globals({ localStorage: { getItem: k => values.get(k) ?? null, setItem(k, v) { storageWrites.push(k); values.set(k, v) } } })
  const props = { enabled: true, athlete: { id: athleteId }, date: today, client: f.client, foods: [], weightLogs: [], currentDay: () => today }
  const wait = async predicate => {
    for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    assert.ok(predicate(), dom.host.textContent.slice(0, 600))
  }
  const scope = label => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === label)
  const retry = async () => {
    await act(async () => { void propsOf(button(scope('Kommende kostplan'), 'Hent planen igen')).onClick(); await tick() })
    await wait(() => nutrientFold(scope('Kommende kostplan')))
  }
  try {
    await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await tick() })
    await wait(() => nutrientFold(scope('Dagens kostplan') ?? dom.host))
    assert.equal(nutrientRows(scope('Dagens kostplan')).Jern, '3,51 mg')
    assert.equal(nutrientRows(scope('Dagens kostplan'))['D-vitamin'], '0 µg')
    const choose = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    await act(async () => { propsOf(choose).onChange({ currentTarget: { value: future } }); await tick() })
    await wait(() => nutrientFold(scope('Kommende kostplan') ?? dom.host))
    assert.equal(nutrientRows(scope('Kommende kostplan')).Jern, 'Ukendt – mangler data')
    assert.equal(nutrientRows(scope('Kommende kostplan')).Calcium, '176 mg')
    assert.match(scope('Kommende kostplan').textContent, /Kendte summer for 8 af 9 stoffer/)
    assert.equal(all(scope('Kommende kostplan'), 'input,form').length, 0)
    assert.match(scope('Kommende kostplan').textContent, /Væske\/timing SQL <b>bogstaveligt<\/b>/)
    assert.equal(all(scope('Kommende kostplan'), 'b').length, 0)
    const reads = f.calls.length, fold = nutrientFold(scope('Kommende kostplan'))
    await act(async () => { fold.open = true; fold.dispatch('toggle'); await tick() })
    assert.equal(f.calls.length, reads)
    await seed(3, future, 'zero'); await retry()
    assert.equal(Object.keys(nutrientRows(scope('Kommende kostplan'))).length, 9)
    assert.equal(nutrientRows(scope('Kommende kostplan')).Jern, '0 mg')
    assert.equal(nutrientRows(scope('Kommende kostplan'))['D-vitamin'], '0 µg')
    await seed(4, future, 'missing'); await retry()
    assert.deepEqual(nutrientRows(scope('Kommende kostplan')), Object.fromEntries(
      ['Jern', 'Calcium', 'Magnesium', 'Zink', 'Kalium', 'Natrium', 'D-vitamin', 'B12', 'Folat'].map(label => [label, 'Ukendt – mangler data'])))
    assert.match(scope('Kommende kostplan').textContent, /Ingen mineral- eller vitaminsummer/)
    assert.equal(f.calls.filter(c => c.payload).length, 0)
    assert.equal(storageWrites.length, 0)
    await f.login(stranger)
    props.client = { from: (...args) => f.client.from(...args) }
    await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await tick() })
    await wait(() => dom.host.textContent.includes('ingen aktiv kostplan'))
    assert.equal(nutrientFold(dom.host), undefined)
  } finally { try { await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } }
  await f.login(owner)
  await assert.rejects(f.db.query('update public.kostplan_v1_versions set meals=$1 where id=$2', ['[]', uuid(951)]))
  const after = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v where version_no <= 2 order by version_no')).rows
  assert.deepEqual(after, before)
  assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
  assert.ok(f.calls.every(c => [...names, 'meal_logs'].includes(c.table)))
}))
