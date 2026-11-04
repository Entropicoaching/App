import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeeklyLetter as create } from './weeklyLetterModel.mjs'
import { letterFixture, emptyFixture } from './letterFixture.mjs'
const run = data => create({ enabled: true, data })
function freeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) }
  return x
}
test('OFF requires literal true and never reads data', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) assert.deepEqual(
    create({ enabled, get data() { throw Error('OFF read') } }), { state: 'off', requiresCoachEdit: true })
})
test('actual evaluator gives pain priority, one focus and one question with dated evidence', () => {
  const d = letterFixture(); d.daily[0].pain = 8; d.daily[0].painLocation = 'syntetisk knæ'
  d.daily.forEach(r => { r.sleepHours = 5; r.stress = 4 })
  const m = run(d)
  assert.equal(m.state, 'ready'); assert.equal(m.requiresCoachEdit, true)
  assert.equal(m.evidence.id, 'pain'); assert.equal(m.evidence.value, 8)
  assert.equal(m.evidence.sampleCount, 7); assert.equal(m.evidence.from, '2026-10-26')
  assert.equal(m.evidence.to, '2026-11-01'); assert.equal(m.otherFlags, 3)
  assert.match(m.focus, /afklare/); assert.equal((m.text.match(/\?/g) || []).length, 1)
  assert.equal(m.text.split('\n\n').length, 3); assert.match(m.praise, /1 af 2 planlagte pas/)
  assert.doesNotMatch(m.text, /stress|søvn|diagnose|knæ/i)
})
test('weekly nutrition counts seven days while nutrition flag carries 28-day basis', () => {
  const d = letterFixture(); d.compliance = null; d.nutritionDays.forEach(r => { r.proteinG = 50 })
  const m = run(d)
  assert.equal(m.nutritionDays, 7); assert.match(m.praise, /7 af ugens 7 dage/)
  assert.equal(m.evidence.id, 'nutrition'); assert.equal(m.evidence.sampleCount, 28)
  assert.equal(m.evidence.from, '2026-10-05')
})
test('no invented completions or missing-day zeroes', () => {
  const d = letterFixture(); d.compliance.completedIds = []; d.nutritionDays = []
  const m = run(d); assert.doesNotMatch(m.praise, /gennemført/)
  assert.equal(m.training.completed, 0); assert.equal(m.nutritionDays, 0)
  d.nutritionDays = undefined; assert.equal(run(d).nutritionDays, null)
  d.compliance.completedIds = ['unknown']; assert.equal(run(d).training, null)
})
test('empty, loading, partial and errors never produce a stale draft', () => {
  assert.equal(run(emptyFixture()).state, 'empty'); assert.equal(run({ state: 'loading' }).state, 'loading')
  for (const d of [undefined, { state: 'error' }, { ...letterFixture(), complete: false },
    { ...letterFixture(), asOf: '2026-02-30' }, { ...letterFixture(), athleteId: '' }]) {
    const m = run(d); assert.equal(m.state, 'error'); assert.equal(m.text, undefined)
  }
})
test('no flags proposes a neutral focus and retains incomplete basis warning', () => {
  const d = letterFixture(); d.compliance.completedIds = ['s1','s2']
  const m = run(d); assert.equal(m.evidence, null); assert.equal(m.incomplete, true)
  assert.match(m.focus, /vælge ét realistisk fokus/); assert.match(m.question, /Hvad vil du helst/)
})
test('missing nutrition, duplicate days and invalid numbers cannot supply nutrition praise', () => {
  for (const mutate of [d => { d.nutritionDays = undefined }, d => d.nutritionDays.push(d.nutritionDays[0]),
    d => { d.nutritionDays[0].proteinG = NaN }, d => { d.nutritionDays[0].targetG = 0 },
    d => { d.nutritionDays[0].complete = false }]) {
    const d = letterFixture(); d.compliance = null; mutate(d)
    const m = run(d); assert.equal(m.nutritionDays, null); assert.doesNotMatch(m.praise, /kostregistreringer/)
  }
})
test('input immutable; private cycle metadata never accessed or returned', () => {
  const d = letterFixture()
  Object.defineProperty(d, 'cycle', { get() { throw Error('private access') } })
  for (const row of d.daily) Object.defineProperty(row, 'cycle', { get() { throw Error('private access') } })
  const before = JSON.stringify(d), m = run(freeze(d)); assert.equal(JSON.stringify(d), before)
  assert.doesNotMatch(JSON.stringify(m), /synthetic-athlete|targetVersion|programVersion|cycle/)
})
test('zero planned sessions stays known without compliance flag or false praise', () => {
  const d = emptyFixture()
  d.compliance = { complete: true, programVersion: 'synthetic', plannedIds: [], completedIds: [], extraIds: [] }
  const m = run(d); assert.equal(m.state, 'ready')
  assert.deepEqual(m.training, { planned: 0, completed: 0, extra: 0 }); assert.equal(m.evidence, null)
  assert.doesNotMatch(m.praise, /gennemført/)
})
