import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WaterDayLog from './WaterDayLog.mjs'
import { readWaterGoal, saveWaterGoal, waterGoalKey, waterGoalValue, waterProgress } from './waterGoalModel.mjs'
import { athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const memory = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)) } }

test('væskemål: kun gyldige hele ml inden for de tekniske grænser, og kun for samme atlet', () => {
  assert.equal(waterGoalValue('2500'), 2500)
  assert.equal(waterGoalValue('2.500'), 2500)
  for (const bad of ['', '0', '200', '9000', '2,5', 'to liter', null]) assert.equal(waterGoalValue(bad), null, String(bad))
  const s = memory()
  assert.equal(readWaterGoal(s, athleteId), null)
  assert.equal(saveWaterGoal(s, athleteId, '3000'), 3000)
  assert.equal(readWaterGoal(s, athleteId), 3000)
  assert.equal(readWaterGoal(s, 'anden-atlet'), null)
  s.values.set(waterGoalKey('anden-atlet'), s.values.get(waterGoalKey(athleteId)))
  assert.equal(readWaterGoal(s, 'anden-atlet'), null)
  assert.equal(saveWaterGoal({ getItem: () => null, setItem() {} }, athleteId, '3000'), null)
  assert.deepEqual(waterProgress(1500, 3000), { total: 1500, goal: 3000, fraction: 0.5, reached: false, missing: 1500 })
  assert.equal(waterProgress(3600, 3000).fraction, 1)
  assert.equal(waterProgress(3600, 3000).reached, true)
})

test('glasset fyldes op mod målet, og over målet står "Mål nået", ikke en løbende tæller', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const dom = hostFixture(), root = createRoot(dom.host), storage = memory()
  dom.globals({ localStorage: storage })
  t.after(async () => { await act(async () => { root.unmount(); await tick() }); dom.restore() })
  const props = { enabled: true, athleteId, date, client: {}, currentDay: () => date, storage }
  await act(async () => { root.render(h(StrictMode, null, h(WaterDayLog, props))); await tick() })
  const goal = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Væskemål')
  const fill = () => Number(all(dom.host, 'svg')[0].getAttribute('data-water-fill'))
  const click = async text => act(async () => { const n = button(dom.host, text); assert.ok(n, text); propsOf(n).onClick(); await tick() })
  assert.match(goal().textContent, /Sæt et dagligt mål/)
  assert.match(goal().textContent, /Aftal tallet med din coach/)
  assert.equal(fill(), 0)
  await act(async () => { propsOf(all(goal(), 'input')[0]).onChange({ currentTarget: { value: '2000' } }); await tick() })
  await act(async () => { propsOf(all(goal(), 'form')[0]).onSubmit({ preventDefault() {} }); await tick() })
  assert.equal(readWaterGoal(storage, athleteId), 2000)
  assert.match(goal().textContent, /0 af 2\.000 ml\. 2\.000 ml tilbage/)
  await click('+ 500 ml')
  assert.equal(fill(), 25)
  assert.match(goal().textContent, /500 af 2\.000 ml/)
  await click('+ 500 ml'); await click('+ 500 ml'); await click('+ 500 ml'); await click('+ 250 ml')
  assert.equal(fill(), 100)
  assert.match(goal().textContent, /Mål nået \(2\.000 ml\)\./)
  assert.doesNotMatch(goal().textContent, /2\.250/)
  assert.doesNotMatch(goal().textContent, /tilbage/)
  // Den detaljerede log er uændret og ser de samme poster.
  const log = all(dom.host, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Væske i dag')
  assert.match(log.textContent, /Registreret vand i dag: 2250 ml/)
})
