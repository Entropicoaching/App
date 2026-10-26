import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { KOST_I_DAG_FLAG, kostIDagEnabled, kostDage, harKostGrundlag } from './kostVisning.js'
import { parseInputNumber, nutritionValues } from './kostNumbers.mjs'

register('./kostRev8.loader.mjs', import.meta.url)
const { lavKostHandlinger } = await import('./kostHandlinger.js')
const { reset } = await import('./kostRev8.fake.mjs')
const date = '2026-10-26'
const days = count => Array.from({ length: count }, (_, i) => ({ date: `2026-10-${String(20 + i).padStart(2, '0')}`, kcal: 1000 }))

test('dagsvisningen kræver et eksplicit true, også ved utilgængelig storage', () => {
  for (const value of [null, '', 'false', '1', 'TRUE', true]) {
    assert.equal(kostIDagEnabled({ getItem: () => value }), false)
  }
  assert.equal(kostIDagEnabled({ getItem: key => key === KOST_I_DAG_FLAG ? 'true' : null }), true)
  assert.equal(kostIDagEnabled({ getItem() { throw new Error('Blokeret') } }), false)
  assert.equal(kostIDagEnabled(), false)
})

test('syv forskellige logdatoer kræves, mange rækker samme dag tæller som én', () => {
  assert.equal(harKostGrundlag([], date), false)
  assert.equal(harKostGrundlag(days(6), date), false)
  assert.equal(harKostGrundlag(days(7), date), true)
  assert.equal(harKostGrundlag(Array(100).fill(days(1)[0]), date), false)
  assert.equal(harKostGrundlag([...days(6), { date: '2026-10-27', kcal: 1200 }], date), false)
})

test('rå historik summerer komma og punktum, holder ukendt adskilt fra nul og afviser ugyldige datoer', () => {
  const logs = [{ date, kcal: '12,5' }, { date, kcal: '1.5' },
    { date: '2026-10-25', kcal: 0 }, { date: '2026-10-24', kcal: '' },
    { date: '2026-10-24', kcal: 10 }, { date: '2026-02-30', kcal: 100 },
    { date: '2026-10-23', kcal: -1 }, { date: '2026-10-22', kcal: Number.MAX_VALUE },
    { date: '2026-10-22', kcal: Number.MAX_VALUE }]
  const before = JSON.stringify(logs)
  assert.deepEqual(kostDage(logs, date), [
    { date, kcal: 14 }, { date: '2026-10-25', kcal: 0 }, { date: '2026-10-24', kcal: null },
    { date: '2026-10-23', kcal: null }, { date: '2026-10-22', kcal: null },
  ])
  assert.equal(JSON.stringify(logs), before)
  assert.equal(harKostGrundlag([...days(6), { date, kcal: null }], date), false)
  assert.deepEqual(kostDage(logs, 'ugyldig'), [])
})

test('samme decimalfunktion giver samme portionsberegning med komma og punktum', () => {
  const food = { kcal: 200, protein: 10, carb: 20, fat: 5 }
  assert.deepEqual(nutritionValues(food, parseInputNumber('125,5') / 100), nutritionValues(food, parseInputNumber('125.5') / 100))
})

function setup() {
  let snapshot
  const handler = lavKostHandlinger({
    logs: [], historicalMealLogs: [], weightLogs: [], kostDate: date,
    onReadError: () => () => {}, setLogs() {},
    setKostLogState: update => { snapshot = typeof update === 'function' ? update(snapshot) : update },
  })
  return { handler, snapshot: () => snapshot }
}

test('en tom læsning er kendt nul, mens læsefejl bliver en fejltilstand', async () => {
  const { handler, snapshot } = setup()
  reset([])
  const read = handler.fetchLogs('atlet')
  assert.equal(snapshot().loading, true)
  await read
  assert.deepEqual(snapshot(), { athleteId: 'atlet', date, loading: false, error: false, logs: [] })
  reset([], { message: 'Syntetisk fejl' })
  await handler.fetchLogs('atlet')
  assert.equal(snapshot().error, true)
  assert.equal(snapshot().loading, false)
})

test('overlappende læsninger kan ikke erstatte den nyeste dags daterede snapshot', async () => {
  const { handler, snapshot } = setup()
  reset([{ date, kcal: 123 }])
  const oldRead = handler.fetchLogs('atlet', '2026-10-25')
  const newRead = handler.fetchLogs('atlet', date)
  await Promise.all([oldRead, newRead])
  assert.equal(snapshot().date, date)
  assert.equal(snapshot().loading, false)
  assert.equal(snapshot().logs[0].kcal, 123)
})
