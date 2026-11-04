import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCoachWeek as evaluate } from './evaluate.mjs'

const day = offset => new Date(Date.UTC(2026, 10, 1 + offset)).toISOString().slice(0, 10)
const days = (n, fn) => Array.from({ length: n }, (_, i) => ({ day: day(i - n + 1), ...fn(i) }))
export function fixture() {
  return { state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: day(0),
    daily: days(7, () => ({ source: 'athlete_manual', sleepHours: 7, sleepQuality: 3, energy: 3,
      stress: 3, soreness: 0, pain: 0 })),
    loadDays: days(28, () => ({ known: true, tonnageKg: 100 })),
    strength: { exerciseId: 'synthetic-lift', variantId: 'synthetic-variant',
      sets: [-83, -82, -81, -2, -1, 0].map((offset, i) => ({ id: `set-${i}`, day: day(offset),
        exerciseId: 'synthetic-lift', variantId: 'synthetic-variant', unit: 'kg',
        kg: 100, reps: 3, confirmed: true, skipped: false, deload: false })) },
    nutritionDays: days(28, () => ({ complete: true, proteinG: 100, targetG: 100, targetVersion: 'target-v1' })),
    weightDays: days(14, () => ({ kg: 80 })),
    compliance: { complete: true, programVersion: 'program-v1', plannedIds: ['s1', 's2', 's3', 's4'],
      completedIds: ['s1', 's2', 's3'], extraIds: ['extra'] } }
}
const run = data => evaluate({ enabled: true, data })
const get = (data, id) => run(data).sections.find(s => s.id === id)
function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } return x }

test('OFF is literal, returns no data and never reads a throwing data getter', () => {
  for (const enabled of [undefined, false, 1, 'true', null]) {
    assert.deepEqual(evaluate({ enabled, get data() { throw Error('read') } }), { state: 'off', automaticChanges: false })
  }
})
test('loading and partial/error snapshots cannot produce observations or flags', () => {
  assert.equal(run({ state: 'loading' }).state, 'loading')
  for (const data of [null, { ...fixture(), complete: false }, { ...fixture(), state: 'error' },
    { ...fixture(), athleteId: '' }, { ...fixture(), asOf: '2026-02-30' }]) {
    const m = run(data); assert.equal(m.state, 'error'); assert.deepEqual(m.sections, []); assert.deepEqual(m.flags, [])
  }
})
test('complete sufficient neutral snapshot has no flags, 11 areas, no input mutation', () => {
  const input = freeze(fixture()), before = JSON.stringify(input), m = run(input)
  assert.equal(m.state, 'noFlags'); assert.equal(m.sections.length, 11)
  assert.equal(m.automaticChanges, false); assert.equal(JSON.stringify(input), before)
  assert.equal(m.sections.find(s => s.id === 'compliance').value, 75)
})
test('empty differs from zero pain and zero planned sessions', () => {
  const data = { ...fixture(), daily: [], loadDays: [], strength: null, nutritionDays: [], weightDays: [], compliance: null }
  assert.equal(run(data).state, 'empty')
  data.daily = [{ day: day(0), source: 'athlete_manual', pain: 0 }]
  assert.equal(get(data, 'pain').value, 0); assert.equal(run(data).state, 'insufficient')
  data.compliance = { complete: true, programVersion: 'v', plannedIds: [], completedIds: [], extraIds: [] }
  assert.equal(get(data, 'compliance').state, 'notPlanned'); assert.equal(get(data, 'compliance').value, null)
})
test('pain 7 triggers one priority before all other flags; all evidence has period and values', () => {
  const data = fixture()
  data.daily[0].pain = 7; data.daily[0].painLocation = 'syntetisk knæ'
  data.daily.forEach(r => { r.sleepHours = 5; r.stress = 4 })
  data.nutritionDays.forEach(r => { r.proteinG = 80 })
  const m = run(data)
  assert.deepEqual(m.flags.map(s => s.id), ['pain', 'nutrition', 'sleepHours', 'stress'])
  assert.match(m.flags[0].dataBasis.summary, /2026-10-26 · syntetisk knæ/)
  for (const s of m.flags) {
    assert.ok(s.dataBasis.sufficient); assert.ok(s.dataBasis.sampleCount >= s.dataBasis.minimumSampleCount)
    assert.ok(s.dataBasis.observations.length); assert.ok(s.dataBasis.rule); assert.ok(s.dataBasis.formula)
    assert.equal(s.dataBasis.to, day(0))
  }
})
test('single pain remains visible alongside missing trends; pain 6 gives no priority', () => {
  const data = fixture(); data.loadDays = null
  data.daily = [{ day: day(0), source: 'athlete_manual', pain: 8, painLocation: 'teststed' }]
  assert.deepEqual(run(data).flags.map(s => s.id), ['pain']); assert.equal(run(data).insufficient, true)
  data.daily[0].pain = 6; assert.equal(run(data).flags.length, 0)
})
test('field-specific counts, 3/4 day minimum, missing never zero; boundaries are exact', () => {
  const data = fixture(); data.daily = data.daily.slice(0, 4)
  data.daily.forEach(r => { r.sleepHours = 6; r.stress = 4; r.energy = 2; r.sleepQuality = 2 })
  delete data.daily[0].sleepHours
  assert.equal(get(data, 'sleepHours').state, 'insufficient'); assert.equal(get(data, 'sleepHours').dataBasis.sampleCount, 3)
  data.daily[0].sleepHours = 6
  assert.equal(get(data, 'sleepHours').flagged, false)
  for (const id of ['stress', 'energy', 'sleepQuality']) assert.equal(get(data, id).flagged, true)
  data.daily.forEach(r => { r.soreness = 7; r.sorenessLocation = 'testmuskel' })
  assert.equal(get(data, 'soreness').flagged, true)
})
test('daily duplicate dates, numeric strings, invalid scales and missing locations fail closed', () => {
  for (const change of [d => d.daily.push({ ...d.daily[0] }), d => { d.daily[0].sleepHours = '5' },
    d => { d.daily[0].stress = 6 }, d => { d.daily[0].pain = 8 }, d => { d.daily[0].soreness = 8 },
    d => { d.daily[0].source = 'inferred' }, d => { d.daily[0].day = '2026-02-30' }]) {
    const data = fixture(); change(data); assert.equal(get(data, 'sleepHours').state, 'insufficient')
    assert.equal(get(data, 'pain').state, 'insufficient')
  }
})
test('load requires all 28 known days, explicit rest and positive chronic basis', () => {
  const data = fixture(); data.loadDays[0].tonnageKg = 0
  assert.equal(get(data, 'load').state, 'insufficient')
  data.loadDays[0].restConfirmed = true
  assert.equal(get(data, 'load').state, 'ready')
  data.loadDays.pop(); assert.equal(get(data, 'load').state, 'insufficient')
  data.loadDays = days(28, () => ({ known: true, tonnageKg: 0, restConfirmed: true }))
  assert.equal(get(data, 'load').value, null)
})
test('load uses included acute window, strict >1.5 and exact 28/7 calendar boundaries', () => {
  const data = fixture()
  data.loadDays.forEach((r, i) => { r.tonnageKg = i < 21 ? 5 : 9 })
  assert.equal(get(data, 'load').value, 1.5); assert.equal(get(data, 'load').flagged, false)
  data.loadDays[27].tonnageKg = 10
  assert.equal(get(data, 'load').flagged, true)
  data.loadDays.push({ day: day(-28), known: true, tonnageKg: 1e9 })
  assert.equal(get(data, 'load').dataBasis.sampleCount, 28)
})
test('strength uses daily best, endpoint medians, variant and qualifying actual reps', () => {
  const data = fixture()
  data.strength.sets.slice(3).forEach(r => { r.kg = 90 })
  assert.ok(Math.abs(get(data, 'strength').value + 10) < 1e-10)
  assert.equal(get(data, 'strength').flagged, true)
  data.strength.sets.push({ ...data.strength.sets[0], id: 'same-day-low', kg: 1 })
  assert.equal(get(data, 'strength').dataBasis.sampleCount, 6)
  data.strength.sets[3].deload = true
  assert.equal(get(data, 'strength').state, 'insufficient')
  data.strength.sets[3].deload = false; data.strength.sets[0].variantId = 'other'
  assert.equal(get(data, 'strength').state, 'insufficient')
})
test('strength split coverage and strict -2 threshold; middle days cannot replace endpoints', () => {
  const data = fixture(); data.strength.sets.slice(3).forEach(r => { r.kg = 98 })
  assert.equal(get(data, 'strength').flagged, false)
  data.strength.sets[3].kg = 97; data.strength.sets[4].kg = 97
  assert.equal(get(data, 'strength').flagged, true)
  data.strength.sets[0].day = day(-40)
  assert.equal(get(data, 'strength').state, 'insufficient')
  assert.match(get(data, 'strength').dataBasis.summary, /delvinduer/)
})
test('protein uses mean dated daily percentages, 21/28 complete minimum and strict 90', () => {
  const data = fixture(); data.nutritionDays = data.nutritionDays.slice(0, 21)
  data.nutritionDays.forEach(r => { r.proteinG = 90 })
  assert.equal(get(data, 'nutrition').flagged, false)
  data.nutritionDays[0].proteinG = 89
  assert.equal(get(data, 'nutrition').flagged, true)
  data.nutritionDays[0].complete = false
  assert.equal(get(data, 'nutrition').state, 'insufficient')
  data.nutritionDays[0].complete = true; delete data.nutritionDays[0].targetVersion
  assert.equal(get(data, 'nutrition').state, 'insufficient')
  data.nutritionDays = data.nutritionDays.slice(0, 20)
  assert.equal(get(data, 'nutrition').value, null)
})
test('weight requires 4+4 split, not total eight; exactly ±1% is not a flag', () => {
  const data = fixture(); data.weightDays.forEach((r, i) => { r.kg = i < 7 ? 100 : 101 })
  assert.equal(get(data, 'weight').flagged, false)
  data.weightDays.slice(7).forEach(r => { r.kg = 99 })
  assert.equal(get(data, 'weight').flagged, false)
  data.weightDays.slice(7).forEach(r => { r.kg = 98.9 })
  assert.equal(get(data, 'weight').flagged, true)
  data.weightDays = data.weightDays.slice(0, 10)
  assert.equal(get(data, 'weight').state, 'insufficient')
})
test('compliance excludes extras, validates subset, duplicates and complete program', () => {
  const data = fixture(); data.compliance.completedIds.pop()
  assert.equal(get(data, 'compliance').value, 50); assert.equal(get(data, 'compliance').flagged, true)
  data.compliance.completedIds.push('extra'); assert.equal(get(data, 'compliance').state, 'insufficient')
  data.compliance = { ...fixture().compliance, complete: false }
  assert.equal(get(data, 'compliance').state, 'insufficient')
  data.compliance = fixture().compliance; data.compliance.plannedIds.push('s1')
  assert.equal(get(data, 'compliance').state, 'insufficient')
})
test('calendar boundaries cross DST/month correctly and future daily observations do not leak', () => {
  const data = fixture(); data.daily.push({ day: day(1), source: 'athlete_manual', pain: 10, painLocation: 'future' })
  const m = run(data)
  assert.equal(m.from, '2026-10-26'); assert.equal(get(data, 'strength').dataBasis.from, '2026-08-10')
  assert.equal(get(data, 'load').dataBasis.from, '2026-10-05'); assert.equal(m.flags.length, 0)
})
test('output whitelists fields, does not expose private metadata and is permutation independent', () => {
  const data = fixture(); data.cycle = 'PRIVATE-SENTINEL'; data.daily[0].note = 'PRIVATE-SENTINEL'
  const output = run(data)
  assert.equal(JSON.stringify(output).includes('PRIVATE-SENTINEL'), false)
  data.daily.reverse(); data.loadDays.reverse(); data.strength.sets.reverse(); data.weightDays.reverse(); data.nutritionDays.reverse()
  assert.deepEqual(run(data), output)
})
test('numeric overflow never emits nonfinite output or a flag', () => {
  const data = fixture(); data.loadDays.forEach(r => { r.tonnageKg = Number.MAX_VALUE })
  data.nutritionDays.forEach(r => { r.proteinG = Number.MAX_VALUE; r.targetG = Number.MIN_VALUE })
  assert.equal(get(data, 'load').state, 'insufficient'); assert.equal(get(data, 'nutrition').state, 'insufficient')
  const visit = x => { if (typeof x === 'number') assert.ok(Number.isFinite(x)); else if (x && typeof x === 'object') Object.values(x).forEach(visit) }
  visit(run(data))
})
test('overflow in chronic alone cannot become a ready zero ratio; sparse arrays fail closed', () => {
  const data = fixture()
  data.loadDays.slice(0, 21).forEach(r => { r.tonnageKg = Number.MAX_VALUE })
  assert.equal(get(data, 'load').state, 'insufficient')
  assert.doesNotMatch(get(data, 'load').dataBasis.summary, /Infinity|NaN/)
  data.strength.sets = Array(1)
  assert.equal(get(data, 'strength').state, 'insufficient')
  data.compliance.plannedIds = Array(1)
  assert.equal(get(data, 'compliance').state, 'insufficient')
})
