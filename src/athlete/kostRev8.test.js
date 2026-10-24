import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./kostRev8.loader.mjs', import.meta.url)
const { lavKostHandlinger } = await import('./kostHandlinger.js')
const { summarizeKostWeek } = await import('./kostUge.mjs')
const { shiftDate } = await import('../athleteShared.js')
import { reset, state } from './kostRev8.fake.mjs'

const row = (extra = {}) => ({ meal: 'Grød', kcal: 123, protein: 5, carb: 20, fat: 2, ...extra })
function setup(extra = {}) {
  const seen = { results: [], templates: [], hidden: [], logs: [], errors: [] }
  const context = {
    athlete: { id: 'syntetisk', kcal_target: 2000, protein_target: 100 },
    logs: [], historicalMealLogs: [], weightLogs: [], customFoods: [], kostDate: '2026-10-25',
    templateNameInput: ' Test ', onReadError: () => error => seen.errors.push(error),
    setSearchQuery() {}, setSelectedFood() {}, setSearchResults: x => { seen.results = x },
    setMealTemplates: x => { seen.templates = x }, setShowTemplates: x => seen.hidden.push(x),
    setShowSaveTemplate: x => seen.hidden.push(x), setTemplateNameInput() {},
    setLogs: x => seen.logs.push(x), showFlash: (...x) => seen.errors.push(x), ...extra,
  }
  return { seen, f: lavKostHandlinger(context) }
}

test('F1: ugyldige skabeloner giver ingen skrivning eller lukning', async () => {
  for (const items of [undefined, null, {}, 'mad', [], [null], [row(), null], Array(2),
    [row({ meal: ' ' })], [row({ meal: {} })], [row({ kcal: -1 })], [row({ protein: Infinity })],
    [row({ carb: '' })], [row({ fat: null })], [row({ kcal: 'ukendt' })]]) {
    reset(); const { f, seen } = setup()
    await f.logTemplate({ items })
    assert.deepEqual(state.inserts, [])
    assert.deepEqual(seen.hidden, [])
  }
  reset(); await setup().f.logTemplate(null); assert.deepEqual(state.inserts, [])
})
test('F1: laeste skabeloner er sikre til items.length og reduce', async () => {
  reset([null, { name: 'Mangler' }, { name: 'Tom', items: [] }, { name: {}, items: [row()] },
    { id: 9, name: 'Gyldig', items: [row({ kcal: '123' }), row({ kcal: '12,5' })] }])
  const { f, seen } = setup(); await f.fetchMealTemplates('syntetisk')
  assert.equal(seen.templates.length, 1)
  assert.equal(seen.templates[0].items.length, 2)
  assert.equal(seen.templates[0].items.reduce((sum, item) => sum + item.kcal, 0), 135.5)
})
test('F1: ugyldig dagslog kan ikke gemmes som skabelon', async () => {
  reset(); const { f, seen } = setup({ logs: [row(), row({ kcal: NaN })] })
  await f.saveTemplate(); assert.deepEqual(state.inserts, []); assert.deepEqual(seen.hidden, [])
})
test('F2: skabelon logger kun maaltidsfelter paa valgt dato', async () => {
  reset(); const items = [row({ id: 'gammel', date: '2026-03-29', athlete_id: 'anden', extra: 'udelad' })]
  const before = JSON.stringify(items), { f, seen } = setup()
  await f.logTemplate({ items })
  assert.deepEqual(state.inserts, [{ table: 'meal_logs', payload: [{ ...row(), athlete_id: 'syntetisk', date: '2026-10-25' }] }])
  assert.deepEqual(seen.hidden, [false]); assert.equal(JSON.stringify(items), before)
})
test('F3: danske Unicodevarianter og ydre mellemrum giver samme soegning', () => {
  const { f, seen } = setup({ customFoods: [{ name: 'Ålepostej', mine: true }, { name: 'Ærter', mine: false }] })
  for (const [a, b] of [['ÅL', ' A\u030aL '], ['blå', 'bla\u030a'], ['ÆR', '  ær  '], ['RØD', ' rød ']]) {
    f.onSearchInput({ target: { value: a } }); const expected = seen.results
    assert.ok(expected.length > 0)
    f.onSearchInput({ target: { value: b } }); assert.deepEqual(seen.results, expected)
  }
  f.onSearchInput({ target: { value: '  a  ' } }); assert.deepEqual(seen.results, [])
})
test('F3: ugyldigt varenavn skjuler ikke gyldige soegeresultater', () => {
  const { f, seen } = setup({ customFoods: [null, { name: null }, { name: 17 }, { name: 'Ål', mine: true }] })
  f.onSearchInput({ target: { value: 'ål' } }); assert.equal(seen.results[0].name, 'Ål')
})
test('tom kostdag og tom skabelon gemmer intet', async () => {
  reset(); const { f } = setup(); assert.equal(f.totKcal, 0); assert.equal(f.totProtein, 0)
  assert.ok([f.pLen, f.cLen, f.fLen].every(Number.isFinite))
  await f.saveTemplate(); assert.deepEqual(state.inserts, [])
})
test('mange maaltider bevares i dagsvisning og skabelon', async () => {
  const logs = Array.from({ length: 10000 }, (_, n) => row({ meal: `Ret ${n}` }))
  reset(); const { f } = setup({ logs }); assert.equal(f.totKcal, 1230000)
  await f.saveTemplate(); assert.equal(state.inserts[0].payload.items.length, 10000)
  assert.equal(state.inserts[0].payload.items.at(-1).meal, 'Ret 9999')
})
test('nul og decimaler bevares i skabelonen', async () => {
  reset(); await setup().f.logTemplate({ items: [row({ kcal: 0, protein: 0.25 })] })
  assert.equal(state.inserts[0].payload[0].kcal, 0); assert.equal(state.inserts[0].payload[0].protein, 0.25)
})
test('skrivefejl lukker ikke skabelonen og genindlaeser ikke dagen', async () => {
  reset([], { message: 'syntetisk fejl' }); const { f, seen } = setup()
  await f.logTemplate({ items: [row()] }); assert.deepEqual(seen.hidden, [])
  assert.deepEqual(seen.logs, []); assert.equal(seen.errors.length, 1)
})
test('begge DST skift bevarer datoer og syv kostdage', () => {
  for (const [date, monday, sunday] of [['2026-03-29', '2026-03-23', '2026-03-29'], ['2026-10-25', '2026-10-19', '2026-10-25']]) {
    assert.equal(shiftDate(shiftDate(date, 1), -1), date)
    const logs = Array.from({ length: 10000 }, () => ({ date, kcal: 1, protein: 0.5 }))
    const s = summarizeKostWeek({ selectedDate: date, asOfDate: date, coveredDates: [date], logs, targetHistory: [] })
    assert.equal(s.startDate, monday); assert.equal(s.endDate, sunday)
    assert.equal(new Set(s.days.map(day => day.date)).size, 7)
    assert.equal(s.days[6].totals.kcal, 10000); assert.equal(s.days[6].totals.protein, 5000)
  }
})
