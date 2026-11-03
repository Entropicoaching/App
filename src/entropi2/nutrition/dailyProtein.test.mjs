import test from 'node:test'
import assert from 'node:assert/strict'
import { mealProtein, eveningProtein } from './dailyProtein.mjs'
import { remainingToday } from './startModel.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03'
const at = (h, m = 0) => new Date(2026, 10, 3, h, m)
const row = (values = {}) => ({ athlete_id: 'synthetic-distribution', date,
  meal: 'Syntetisk måltid', kcal: 200, protein: 20, carb: 10, fat: 5, ...values })
async function mounted(t, rows = [], { hour = 18, protein = 100, kcal = 2000, contracts = {} } = {}) {
  let now = at(hour)
  const calls = { load: 0, writes: 0, storage: 0 }
  const controller = createNutritionController({ enabled: true,
    athlete: { id: 'synthetic-distribution', protein_target: protein, kcal_target: kcal }, date,
    storage: { getItem() { return null }, setItem() { calls.storage++ } },
    contracts: { async load() { calls.load++; return rows },
      async save() { calls.writes++; return true }, ...contracts },
  })
  const host = syntheticHost()
  const cleanup = mountNutrition(host, controller, { clock: () => now })
  t.after(cleanup); await flush()
  return { host, controller, calls, setTime(value) { now = value } }
}
const distribution = host => find(host, 'h3', 'Protein pr. måltid').parentElement
const evening = host => host.querySelectorAll('p').filter(p => p.textContent.startsWith('Til resten af dagen:'))

test('meal protein: zero, one and many entries, comma/decimal, zero, unknown and no mutation', () => {
  assert.deepEqual(mealProtein([]), [])
  const rows = [row({ protein: '12,5' }), row({ protein: 0 }), row({ protein: '2.25' }), row({ protein: 'bad' })]
  const before = structuredClone(rows)
  assert.deepEqual(mealProtein(rows), [
    { meal: 'Syntetisk måltid', protein: 12.5 }, { meal: 'Syntetisk måltid', protein: 0 },
    { meal: 'Syntetisk måltid', protein: 2.25 }, { meal: 'Syntetisk måltid', protein: null },
  ])
  assert.deepEqual(mealProtein([rows[0]]), [{ meal: 'Syntetisk måltid', protein: 12.5 }])
  assert.deepEqual(rows, before)
  for (const protein of [null, undefined, '', -1, Infinity, NaN]) assert.equal(mealProtein([row({ protein })])[0].protein, null)
})

test('evening: injected local time before/at/after 18 and midnight', () => {
  for (const now of [at(0), at(17, 59)]) assert.equal(eveningProtein({ protein: 12.5 }, now), null)
  for (const now of [at(18), at(18, 1), at(23, 59)]) {
    assert.equal(eveningProtein({ protein: 12.5 }, now), 'Til resten af dagen: ca. 12,5 g protein')
  }
  assert.equal(eveningProtein({ protein: 10 }, new Date('invalid')), null)
})

test('evening: same remaining calculation/rounding, missing/reached goals and invalid totals', () => {
  const remain = remainingToday({ kcal: 20, protein: 12.5 }, { protein: '100,5' })
  assert.equal(eveningProtein(remain, at(18)), 'Til resten af dagen: ca. 88 g protein')
  for (const totals of [null, {}, { kcal: null, protein: 0 }, { kcal: 0, protein: NaN },
    { kcal: Infinity, protein: 0 }, { kcal: 0, protein: -1 }, { kcal: 0, protein: '20' }]) {
    assert.equal(eveningProtein(remainingToday(totals, { protein: 100 }), at(18)), null)
  }
  for (const protein of [0, null, undefined, '', -1, 'bad']) {
    assert.equal(eveningProtein(remainingToday({ kcal: 0, protein: 0 }, { protein }), at(18)), null)
  }
  for (const protein of [100, 110, 99.99]) {
    assert.equal(eveningProtein(remainingToday({ kcal: 0, protein }, { protein: 100 }), at(18)), null)
  }
})

test('DOM: empty diary and one meal have neutral protein distribution and one evening line', async t => {
  const empty = await mounted(t)
  // Marc 3. nov.: tom dag viser kun dagbogens tomme linje, ikke en tom fordeling oveni.
  assert.equal(find(empty.host, 'h3', 'Protein pr. måltid'), undefined)
  assert.equal(evening(empty.host)[0].textContent, 'Til resten af dagen: ca. 100 g protein')
  const f = await mounted(t, [row({ protein: '12,5' })])
  assert.deepEqual(distribution(f.host).querySelectorAll('li').map(n => n.textContent), ['Syntetisk måltid: 12,5 g protein'])
  assert.equal(evening(f.host).length, 1)
  assert.equal(evening(f.host)[0].textContent, 'Til resten af dagen: ca. 87,5 g protein')
  assert.deepEqual(f.calls, { load: 1, writes: 0, storage: 0 })
})

test('DOM: many/duplicate meals stay separate; yesterday and receipts excluded; labels are text', async t => {
  const f = await mounted(t, [row({ meal: '<b>Mad</b>', protein: '2.25' }), row(), row(),
    row({ date: '2026-11-02', protein: 999 }), row({ meal: '[appData2-day-v1]synthetic', protein: 999 })])
  assert.deepEqual(distribution(f.host).querySelectorAll('li').map(n => n.textContent), [
    '<b>Mad</b>: 2,3 g protein', 'Syntetisk måltid: 20 g protein', 'Syntetisk måltid: 20 g protein',
  ])
  assert.equal(distribution(f.host).querySelectorAll('b').length, 0)
  assert.equal(distribution(f.host).querySelectorAll('li').some(n => n.textContent.includes('999 g')), false)
})

test('DOM: evening absent before 18, reached/missing goal, unknown totals and rounded zero', async t => {
  for (const options of [{ hour: 17 }, { protein: null }, { protein: 20 }, { protein: 10 }, { protein: 20.01 }]) {
    const f = await mounted(t, [row()], options)
    assert.equal(evening(f.host).length, 0)
  }
  const f = await mounted(t, [row({ protein: 'bad' })])
  assert.equal(f.controller.snapshot().totals, null)
  assert.equal(evening(f.host).length, 0)
  assert.equal(distribution(f.host).querySelectorAll('li')[0].textContent, 'Syntetisk måltid: ukendt protein')
})

test('DOM: redraw uses current injected time; log/update/remove refresh distribution and remainder', async t => {
  const f = await mounted(t, [row({ id: 'meal-1' })], { hour: 17,
    contracts: { async update() { return true }, async remove() { return true } } })
  assert.equal(evening(f.host).length, 0)
  f.setTime(at(18)); f.controller.toggleHistory()
  assert.equal(evening(f.host)[0].textContent, 'Til resten af dagen: ca. 80 g protein')
  await f.controller.update('meal-1', row({ protein: 40 }), 'change')
  assert.equal(distribution(f.host).querySelectorAll('li')[0].textContent, 'Syntetisk måltid: 40 g protein')
  assert.equal(evening(f.host)[0].textContent, 'Til resten af dagen: ca. 60 g protein')
  await f.controller.remove('meal-1', 'remove', true)
  // Marc 3. nov.: uden maaltider vises fordelingen ikke (dagbogen siger det tomme).
  assert.equal(find(f.host, 'h3', 'Protein pr. måltid'), undefined)
  assert.equal(evening(f.host)[0].textContent, 'Til resten af dagen: ca. 100 g protein')
  await f.controller.log(row({ meal: 'Nyt måltid', protein: 15 }), 'new-meal')
  assert.deepEqual(distribution(f.host).querySelectorAll('li').map(n => n.textContent), ['Nyt måltid: 15 g protein'])
  assert.equal(evening(f.host)[0].textContent, 'Til resten af dagen: ca. 85 g protein')
})

test('OFF: assembly and null controller never read host or clock', () => {
  const host = new Proxy({}, { get() { throw new Error('OFF host read') } })
  const clock = () => { throw new Error('OFF clock read') }
  mountNutrition(host, null, { clock })()
  mountNutritionScreen(host, { entropi2: false, clock })()
})
