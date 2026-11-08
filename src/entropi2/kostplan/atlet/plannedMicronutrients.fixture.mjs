// Synthetic arithmetic only. These values do not describe any real food or person.
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { all, propsOf, hostFixture, tick } from '../../nutrition/diaryTemplate.fixture.mjs'
export { athleteId, date, all, propsOf, tick, act, h, StrictMode }
export const micros = { ironMg: 2, calciumMg: 100, magnesiumMg: 30, zincMg: 1,
  potassiumMg: 200, sodiumMg: 50, vitaminDUg: 0, vitaminB12Ug: 0.5, folateUg: 20 }
export const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
export function seeded(kind = 'complete', options = {}) {
  const f = fixture(options); f.approve()
  const v = structuredClone(f.plan.data[tableNames[1]][0])
  v.portion_guidance = 'Væske og timing\n<b>Coachens ord</b>'
  for (const [i, meal] of v.meals.entries()) {
    meal.portions[0].grams = i ? 25.25 : 150.5
    Object.assign(meal.portions[0].food.nutrientsPer100g, micros)
    if (kind === 'missing') for (const key of Object.keys(micros)) meal.portions[0].food.nutrientsPer100g[key] = null
    if (kind === 'zero') for (const key of Object.keys(micros)) meal.portions[0].food.nutrientsPer100g[key] = 0
    if (kind === 'partial' && i) meal.portions[0].food.nutrientsPer100g.ironMg = null
  }
  f.plan.data[tableNames[1]][0] = freeze(v)
  const future = structuredClone(v)
  future.id = '30000000-0000-4000-8000-000000000003'; future.version_no = 2; future.effective_from = '2026-11-06'
  future.meals[0].name = 'Fremtid syntetisk'
  f.plan.data[tableNames[1]].push(freeze(future))
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: future.id })
  return f
}
export const nutrientFold = host => all(host, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Mineraler og vitaminer')
export const nutrientRows = host => {
  const fold = nutrientFold(host); assert.ok(fold, 'Mounted nutrient disclosure')
  const labels = all(fold, 'dt'), amounts = all(fold, 'dd')
  return Object.fromEntries(labels.map((n, i) => [n.textContent, amounts[i].textContent]))
}
export async function mounted(t, f, overrides = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const props = { enabled: true, athlete: { id: athleteId }, date, client: f.client,
    foods: [], weightLogs: [], currentDay: () => date, ...overrides }
  const render = async () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await tick() })
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } })
  await render()
  const choose = async value => {
    const picker = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    assert.ok(picker)
    await act(async () => { propsOf(picker).onChange({ currentTarget: { value } }); await tick() })
  }
  const today = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Dagens kostplan')
  const future = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
  return { ...dom, root, props, render, choose, today, future }
}
