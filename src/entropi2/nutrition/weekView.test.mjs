import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03'
const row = (date, values = {}) => ({ athlete_id: 'synthetic-link', date,
  meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...values })
async function setup(t, rows, end = date) {
  const calls = { reads: 0, writes: 0, storage: 0 }
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-link' }, date: end,
    storage: { getItem() { return null }, setItem() { calls.storage++ } },
    contracts: {
      async load() { calls.reads++; return rows },
      async save() { calls.writes++; return true },
      async update() { calls.writes++; return true },
      async remove() { calls.writes++; return true },
    },
  })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup); await flush()
  const week = () => find(host, 'h2', 'Din uge')?.parentElement
  return { host, controller, calls, week, cleanup }
}

test('week wiring: rolling days differ from calendar weeks; duplicate days/receipts never inflate trend', async t => {
  const { week, host, calls, cleanup } = await setup(t, [
    row('2026-10-04'), // outside four calendar weeks
    row('2026-10-12'), row('2026-10-18'),
    row('2026-10-19'),
    row('2026-10-28'), row('2026-10-28'), row('2026-10-31'),
    row('2026-11-02', { meal: '[appData2-day-v1][]' }), row(date),
  ])
  assert.ok(find(week(), 'p', 'Seneste 7 dage: 3 af 7 dage logget · snit 133,3 kcal · 13,3 g protein pr. logget dag.'))
  const trend = find(week(), 'p', 'Loggede dage pr. kalenderuge: 2 → 1 → 2 → 1 · ældste først, denne uge indtil nu.')
  assert.ok(trend); assert.equal(trend.className, 'small muted space')
  assert.equal(week().querySelectorAll('p').length, 2)
  assert.equal(week().querySelectorAll('button').length, 0)
  await find(host, 'button', 'Se historik').fire('click')
  await find(host, 'button', 'Se historik').fire('click')
  cleanup.updateWeight({ weightLogs: [] })
  assert.deepEqual(calls, { reads: 1, writes: 0, storage: 0 })
})

test('week wiring: update/remove redraw from existing history without an additional read', async t => {
  const { controller, week, calls } = await setup(t, [row(date, { id: 'synthetic-edit' }), row('2026-11-02')])
  await controller.update('synthetic-edit', { meal: 'Synthetic changed', kcal: 300, protein: 30, carb: 5, fat: 2 }, 'edit')
  assert.ok(find(week(), 'p', 'Seneste 7 dage: 2 af 7 dage logget · snit 200 kcal · 20 g protein pr. logget dag.'))
  await controller.remove('synthetic-edit', 'remove', true)
  assert.ok(find(week(), 'p', 'Seneste 7 dage: 1 af 7 dage logget · for få dage til et gennemsnit.'))
  assert.ok(find(week(), 'p', 'Loggede dage pr. kalenderuge: 0 → 0 → 0 → 1 · ældste først, denne uge indtil nu.'))
  assert.deepEqual(calls, { reads: 1, writes: 2, storage: 0 })
})

test('week wiring: year boundary and Monday begin a labelled partial calendar week', async t => {
  const { week } = await setup(t, [row('2026-12-14'), row('2026-12-21'), row('2026-12-28'),
    row('2027-01-03'), row('2027-01-04')], '2027-01-04')
  assert.ok(find(week(), 'p', 'Loggede dage pr. kalenderuge: 1 → 1 → 2 → 1 · ældste først, denne uge indtil nu.'))
  assert.ok(find(week(), 'p', 'Seneste 7 dage: 2 af 7 dage logget · snit 100 kcal · 10 g protein pr. logget dag.'))
})

test('week wiring: another athlete fails closed; meal markup is absent from summary', async t => {
  const bad = await setup(t, [row(date, { athlete_id: 'synthetic-other' })])
  assert.equal(bad.week(), undefined)
  assert.equal(bad.controller.snapshot().phase, 'load-error')
  const { week } = await setup(t, [row(date, { meal: '<img src=x onerror=synthetic>' }), row('2026-11-02')])
  assert.doesNotMatch(week().textContent, /<img|Synthetic meal/)
  assert.equal(week().querySelectorAll('img').length, 0)
})
