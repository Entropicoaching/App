import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const row = (values = {}) => ({ athlete_id: 'synthetic-history', date: '2026-11-02',
  meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...values })
async function mounted(t, rows, date = '2026-11-03') {
  const calls = { load: 0, save: 0, storage: 0 }
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-history', kcal_target: 2000, protein_target: 150 }, date,
    storage: { getItem() { return null }, setItem() { calls.storage++ } },
    contracts: { async load() { calls.load++; return rows }, async save() { calls.save++; return true } },
  })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup)
  await flush()
  assert.equal(find(host, 'h2', 'Historik · seneste 30 dage'), undefined)
  await find(host, 'button', 'Se historik').fire('click')
  const history = find(host, 'h2', 'Historik · seneste 30 dage').parentElement
  assert.deepEqual(calls, { load: 1, save: 0, storage: 0 })
  return { host, history, controller, calls }
}
const groups = history => history.querySelectorAll('section')
const label = group => group.querySelectorAll('time')[0]

test('history view: empty history and receipt-only history show the existing empty message', async t => {
  for (const rows of [[], [row({ meal: '[appData2-day-v1][]', kcal: null })]]) {
    const { history } = await mounted(t, rows)
    assert.ok(find(history, 'p', 'Ingen registreringer i perioden.'))
    assert.equal(groups(history).length, 0)
  }
})

test('history view: Danish calendar label, daily sums and meals including duplicates', async t => {
  const { history } = await mounted(t, [row(), row({ meal: 'Synthetic second', kcal: '20,5', protein: '2,5' }), row()])
  const [day] = groups(history)
  assert.equal(groups(history).length, 1)
  assert.equal(label(day).textContent, 'man. 2. nov.')
  assert.equal(label(day).getAttribute('datetime'), '2026-11-02')
  assert.ok(find(day, 'p', '220,5 kcal · 22,5 g protein'))
  assert.equal(day.querySelectorAll('li').length, 3)
  assert.deepEqual(day.querySelectorAll('li').map(n => n.textContent), ['Synthetic meal', 'Synthetic second', 'Synthetic meal'])
})

test('history view: days newest first, invalid day unknown, other days and receipts isolated', async t => {
  const { history } = await mounted(t, [row({ date: '2026-11-01' }), row({ meal: 'Synthetic invalid', fat: null }), row(),
    row({ date: '2026-11-03', meal: '[appData2-day-v1][]', kcal: null })])
  const days = groups(history)
  assert.deepEqual(days.map(g => label(g).getAttribute('datetime')), ['2026-11-02', '2026-11-01'])
  assert.ok(find(days[0], 'p', 'Næringsdata skal kontrolleres'))
  assert.equal(days[0].querySelectorAll('p').some(n => n.textContent.includes('0 kcal')), false)
  assert.equal(days[0].querySelectorAll('li').length, 2)
  assert.ok(find(days[1], 'p', '100 kcal · 10 g protein'))
  assert.equal(history.textContent.includes('[appData2-day-v1]'), false)
})

for (const [date, previous, firstLabel, previousLabel] of [
  ['2027-01-01', '2026-12-31', 'fre. 1. jan.', 'tors. 31. dec.'],
  ['2026-03-30', '2026-03-29', 'man. 30. mar.', 'søn. 29. mar.'],
  ['2026-10-26', '2026-10-25', 'man. 26. okt.', 'søn. 25. okt.'],
]) {
  test('history view: calendar midnight/DST ' + date, async t => {
    const { history } = await mounted(t, [
      row({ date: previous, created_at: date + 'T00:30:00+01:00' }),
      row({ date, created_at: previous + 'T23:30:00Z' }),
    ], date)
    const days = groups(history)
    assert.deepEqual(days.map(g => label(g).getAttribute('datetime')), [date, previous])
    assert.deepEqual(days.map(g => label(g).textContent), [firstLabel, previousLabel])
    for (const day of days) assert.ok(find(day, 'p', '100 kcal · 10 g protein'))
  })
}

test('history view: closing/reopening and redraw preserve controls without new I/O', async t => {
  const { host, controller, calls } = await mounted(t, [row(), row({ date: '2026-11-03' })])
  const buttons = host.querySelectorAll('button').map(n => n.textContent)
  for (const heading of ['Log hurtigt', 'Gentag i går', 'Dagens mål', 'Din vægt']) assert.ok(find(host, 'h2', heading))
  assert.equal(find(host, 'h2', 'Seneste måltider'), undefined) // Both rows repeat the same yesterday meal.
  assert.ok(host.textContent.includes('Tilbage i dag:'))
  await find(host, 'button', 'Se historik').fire('click')
  assert.equal(find(host, 'h2', 'Historik · seneste 30 dage'), undefined)
  await find(host, 'button', 'Se historik').fire('click')
  assert.deepEqual(host.querySelectorAll('button').map(n => n.textContent), buttons)
  assert.equal(find(host, 'button', 'Se historik').getAttribute('aria-expanded'), 'true')
  assert.equal(controller.snapshot().historyRows.length, 2)
  assert.deepEqual(calls, { load: 1, save: 0, storage: 0 })
})

test('history view: unknown meal labels and HTML-like text stay inert text', async t => {
  const { history } = await mounted(t, [row({ meal: null }), row({ meal: '<img src=x onerror=synthetic()>' })])
  assert.ok(find(history, 'li', 'Ugyldigt måltid'))
  assert.ok(find(history, 'li', '<img src=x onerror=synthetic()>'))
  assert.equal(history.querySelectorAll('img').length, 0)
  assert.ok(find(history, 'p', 'Næringsdata skal kontrolleres'))
})

test('history view: known zero remains a valid displayed sum', async t => {
  const { history } = await mounted(t, [row({ kcal: 0, protein: 0, carb: 0, fat: 0 })])
  assert.ok(find(history, 'p', '0 kcal · 0 g protein'))
  assert.equal(history.textContent.includes('Næringsdata skal kontrolleres'), false)
})
