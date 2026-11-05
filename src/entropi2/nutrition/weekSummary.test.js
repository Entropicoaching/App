import test from 'node:test'
import assert from 'node:assert/strict'
import { weekSummary } from './weekSummary.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03'
const row = (values = {}) => ({ athlete_id: 'synthetic-week', date,
  meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...values })
const summary = (rows, targets) => weekSummary(rows, targets, date)

test('week: inclusive day -6, excludes day -7 and future; duplicates count once as days', () => {
  assert.deepEqual(summary([row(), row(), row({ date: '2026-10-28', kcal: 400, protein: 40 }),
    row({ date: '2026-10-27', kcal: 9999 }), row({ date: '2026-11-04', kcal: 9999 })], { protein: 30 }), {
    loggedDays: 2, averages: { kcal: 300, protein: 30 }, protein: { reached: 1, days: 2 },
  })
})

test('week: calendar windows cross year, leap day and both DST changes', () => {
  for (const [end, first, outside] of [
    ['2027-01-01', '2026-12-26', '2026-12-25'],
    ['2028-03-01', '2028-02-24', '2028-02-23'],
    ['2026-03-30', '2026-03-24', '2026-03-23'],
    ['2026-10-26', '2026-10-20', '2026-10-19'],
  ]) {
    assert.equal(weekSummary([row({ date: end }), row({ date: first }), row({ date: outside })], {}, end).loggedDays, 2)
  }
})

test('week: absent rows, invalid screen date and receipts never create logged days', () => {
  for (const rows of [undefined, null, {}, [], [null, {}, row({ date: '2026-02-30' }),
    row({ date: date + 'T00:00:00Z' }), row({ meal: '[appData2-day-v1][]', kcal: null })]]) {
    assert.deepEqual(summary(rows), { loggedDays: 0, averages: { kcal: null, protein: null }, protein: null })
  }
  for (const bad of [undefined, null, '', '2026-02-30', '2026-1-01']) {
    assert.equal(weekSummary([row()], {}, bad).loggedDays, 0)
  }
})

test('week: comma decimals, known zero, unrounded protein comparison and tolerance', () => {
  const result = summary([row({ protein: '10,1', kcal: '100,5' }),
    row({ protein: '20,2', kcal: 0 }), row({ protein: '30,3', kcal: 0 }),
    row({ date: '2026-11-02', protein: 60.6 - 2e-9, kcal: 0 })], { protein: '60,6' })
  assert.equal(result.loggedDays, 2)
  assert.equal(result.averages.kcal, 50.25)
  assert.deepEqual(result.protein, { reached: 1, days: 2 })
  assert.equal(summary([row({ protein: 150 - 5e-10 })], { protein: 150 }).protein.reached, 1)
  assert.equal(summary([row({ protein: 149.99 })], { protein: 150 }).protein.reached, 0)
  assert.deepEqual(summary([row({ kcal: 0, protein: 0 })], { protein: 1 }), {
    loggedDays: 1, averages: { kcal: 0, protein: 0 }, protein: { reached: 0, days: 1 },
  })
})

test('week: absent, invalid and kcal-only goals omit protein result', () => {
  for (const bad of [undefined, null, '', 'bad', 0, -1, NaN, Infinity, {}, [], true]) {
    assert.equal(summary([row()], { kcal: 2000, protein: bad }).protein, null)
  }
  assert.equal(summary([row()], null).protein, null)
})

test('week: invalid nutrients keep logged days but never become zeros or failed goals', () => {
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    for (const bad of [undefined, null, '', 'bad', -1, NaN, Infinity, {}, [], true]) {
      const result = summary([row({ [key]: bad }), row({ date: '2026-11-02' })], { protein: 5 })
      assert.deepEqual(result, { loggedDays: 2, averages: { kcal: null, protein: null }, protein: { reached: null, days: 2 } })
    }
  }
  const huge = row({ kcal: Number.MAX_VALUE, protein: Number.MAX_VALUE })
  assert.equal(summary([huge, { ...huge, date: '2026-11-02' }]).averages.kcal, Number.MAX_VALUE)
  assert.equal(summary([huge, huge]).averages.kcal, null)
})

test('week: frozen inputs unchanged and results independent', () => {
  const rows = Object.freeze([Object.freeze(row()), Object.freeze(row({ date: '2026-11-02' }))])
  const targets = Object.freeze({ protein: 10 })
  const before = JSON.stringify({ rows, targets })
  const first = summary(rows, targets); first.averages.kcal = 999; first.protein.reached = 999
  assert.equal(summary(rows, targets).averages.kcal, 100)
  assert.equal(summary(rows, targets).protein.reached, 2)
  assert.equal(JSON.stringify({ rows, targets }), before)
})

async function mounted(t, rows, goals = {}) {
  const calls = { load: 0, save: 0, storage: 0 }
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-week', ...goals }, date,
    storage: { getItem() { return null }, setItem() { calls.storage++ } },
    contracts: { async load() { calls.load++; return rows }, async save() { calls.save++; return true } },
  })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00') })
  t.after(cleanup); await flush()
  return { host, controller, calls, week: find(host, 'h2', 'Din uge')?.parentElement }
}

test('week view: zero or one logged date shows count and insufficient-days text', async t => {
  for (const rows of [[], [row(), row()], [row({ meal: '[appData2-day-v1][]' })]]) {
    const { week } = await mounted(t, rows, { protein_target: 5 })
    if (!rows.length || rows[0].meal.startsWith('[appData2-day-v1]')) { assert.equal(week, undefined); continue }
    assert.match(week.textContent, /Seneste 7 dage: 1 af 7 dage logget · for få dage til et gennemsnit\./)
    assert.doesNotMatch(week.textContent, /snit [0-9]|Protein nået/)
  }
})

test('week view: compact rounding/count and trend replace goal lines; toggles/save do not read again', async t => {
  const { host, week, controller, calls } = await mounted(t, [row({ kcal: '100,5', protein: 10 }),
    row({ date: '2026-11-02', kcal: 200, protein: 20 })], { protein_target: 15, kcal_target: 2000 })
  assert.ok(find(week, 'p', 'Seneste 7 dage: 2 af 7 dage logget · snit 150,3 kcal · 15 g protein pr. logget dag.'))
  assert.ok(find(week, 'p', 'Loggede dage pr. kalenderuge: 0 → 0 → 0 → 2 · ældste først, denne uge indtil nu.'))
  assert.equal(week.querySelectorAll('p').length, 2)
  assert.equal(week.querySelectorAll('button').length, 0)
  assert.equal(week.querySelectorAll('progress').length, 0)
  assert.equal(week.querySelectorAll('p').some(p => p.getAttribute('role') === 'alert'), false)
  for (const heading of ['Gentag i går']) assert.ok(find(host, 'h2', heading))
  assert.ok(host.textContent.includes('Tilbage i dag:'))
  await find(host, 'button', 'Se historik').fire('click')
  await find(host, 'button', 'Se historik').fire('click')
  assert.deepEqual(calls, { load: 1, save: 0, storage: 0 })
  await controller.log(row({ protein: 10 }), 'synthetic-week-add')
  const updated = find(host, 'h2', 'Din uge').parentElement
  assert.ok(find(updated, 'p', 'Seneste 7 dage: 2 af 7 dage logget · snit 200,3 kcal · 20 g protein pr. logget dag.'))
  assert.ok(find(updated, 'p', 'Loggede dage pr. kalenderuge: 0 → 0 → 0 → 2 · ældste først, denne uge indtil nu.'))
  assert.deepEqual(calls, { load: 1, save: 1, storage: 0 })
})

test('week view: no duplicate goal line; invalid day shows unknown', async t => {
  const rows = [row(), row({ date: '2026-11-02' })]
  for (const goals of [{}, { kcal_target: 2000 }, { protein_target: 'bad' }]) {
    const { week } = await mounted(t, rows, goals)
    assert.doesNotMatch(week.textContent, /Protein nået/)
  }
  const { week } = await mounted(t, [row({ protein: null }), rows[1]], { protein_target: 10 })
  assert.ok(find(week, 'p', 'Seneste 7 dage: 2 af 7 dage logget · gennemsnit ukendt.'))
  assert.doesNotMatch(week.textContent, /Protein nået/)
})

test('week view: loading/failure hides summary; strict OFF never touches host', async t => {
  let reject
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-week' }, date,
    contracts: { load() { return new Promise((_, fail) => { reject = fail }) } } })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00') }); t.after(cleanup)
  assert.equal(find(host, 'h2', 'Din uge'), undefined)
  reject(new Error('Synthetic failure')); await flush()
  assert.equal(find(host, 'h2', 'Din uge'), undefined)
  const poison = new Proxy({}, { get() { throw Error('OFF accessed host') } })
  mountNutrition(poison, null)()
})
