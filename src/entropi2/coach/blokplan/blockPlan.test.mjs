import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestBlock, editBlockPlan } from './blockPlan.mjs'
import { fixture, today } from '../planlaegning/syntheticFixture.mjs'

function volumeFixture(count = 4) {
  const p = fixture(count)
  p.plan.rows.forEach(w => { w.sessions[0].exercises[0].sets = 10 })
  p.logs.rows = p.plan.rows.flatMap((w, i) => Array.from({ length: 10 }, (_, j) => ({
    ...fixture(count).logs.rows[i * 2], id: `synthetic-${i}-${j}`, set_number: j + 1 })))
  return p
}
for (const count of [4, 5, 6]) test(`${count} weeks: actual basis imports, reference volume, RPE and final deload`, () => {
  const p = volumeFixture(count), before = structuredClone(p), m = suggestBlock(p, today)
  assert.equal(m.state, 'ready'); assert.equal(m.weeks.length, count)
  assert.deepEqual(m.weeks.map(w => w.lifts[0].sets), [9, ...Array(count - 2).fill(10), 6])
  assert.deepEqual(m.weeks.map(w => w.lifts[0].targetRpe), [6, ...Array(count - 2).fill(7), 5])
  assert.equal(m.weeks.filter(w => w.deload).length, 1)
  assert.equal(m.cautious, false); assert.deepEqual(p, before)
  assert.deepEqual(m.omittedLifts, ['Bænkpres', 'Dødløft', 'Sumo dødløft'])
})
for (const reason of ['pain', 'stop', 'compliance']) test(`${reason} reduces work weeks`, () => {
  const p = volumeFixture()
  if (reason === 'pain') p.logs.rows[0].note = 'Syntetisk smerte i knæ'
  if (reason === 'stop') p.logs.rows[0].note = 'Stoppet'
  if (reason === 'compliance') p.logs.rows.splice(0, 10)
  const m = suggestBlock(p, today)
  assert.equal(m.cautious, true); assert.equal(m.weeks[0].lifts[0].sets, 7)
  assert.equal(m.weeks[0].lifts[0].targetRpe, 6)
})
for (const reason of ['catalogue', 'plan', 'logs', 'empty', 'variants', 'clock']) test(`${reason} cannot invent a plan`, () => {
  const p = fixture()
  if (reason === 'catalogue') p.blocks.complete = false
  if (reason === 'plan') p.plan.complete = false
  if (reason === 'logs') p.logs.complete = false
  if (reason === 'empty') p.logs.rows = []
  if (reason === 'variants') p.plan.rows.forEach(w => { w.sessions[0].exercises[0].name = 'Front squat' })
  const m = suggestBlock(p, reason === 'clock' ? undefined : today)
  assert.equal(m.state, 'unknown'); assert.deepEqual(m.weeks, [])
})
test('separate lifts, foreign rows and weights do not leak into prescriptions', () => {
  const p = volumeFixture(), expected = suggestBlock(p, today)
  delete p.weights
  p.logs.rows.push({ athlete_id: 'synthetic-foreign', note: 'smerte', weight: 9999 })
  assert.deepEqual(suggestBlock(p, today), expected)
  p.plan.rows[1].sessions[0].exercises[0].name = 'Bænkpres'
  const m = suggestBlock(p, today)
  assert.deepEqual(m.references, [{ lift: 'Squat', sets: 10 }, { lift: 'Bænkpres', sets: 10 }])
})
test('coach controls week count, individual fields, zero volume and deload without mutation', () => {
  const edits = { 1: { deload: true, lifts: { Squat: { sets: 0, targetRpe: 8.5 } } } }
  const before = structuredClone(edits), p = volumeFixture()
  const m = suggestBlock(p, today, { weekCount: 6, edits })
  assert.equal(m.state, 'ready'); assert.equal(m.weeks.length, 6)
  assert.deepEqual(m.weeks[0], { week: 1, deload: true, lifts: [{ lift: 'Squat', sets: 0, targetRpe: 8.5 }] })
  assert.equal(m.weeks[1].lifts[0].sets, 10); assert.deepEqual(edits, before)
  const next = editBlockPlan(edits, { week: 2, lift: 'Squat', field: 'sets', value: 12 })
  assert.equal(next[2].lifts.Squat.sets, 12); assert.deepEqual(edits, before)
})
for (const edits of [[], { 0: {} }, { 7: {} }, { '01': {} }, { 1: { extra: true } },
  { 1: { deload: 'yes' } }, { 1: { lifts: { Unknown: {} } } },
  ...[-1, 101, 1.1, NaN, Infinity, '', '3', null].map(sets => ({ 1: { lifts: { Squat: { sets } } } })),
  ...[0, 10, Infinity, '7'].map(targetRpe => ({ 1: { lifts: { Squat: { targetRpe } } } }))])
  test(`invalid edits rejected: ${JSON.stringify(edits)}`, () => {
    const m = suggestBlock(volumeFixture(), today, { edits })
    assert.equal(m.state, 'invalid'); assert.ok(m.errors.length)
  })
test('invalid lengths rejected; small positive reference rounds to at least one set', () => {
  for (const weekCount of [0, 7, '4', NaN]) assert.equal(suggestBlock(fixture(), today, { weekCount }).state, 'unknown')
  assert.equal(suggestBlock(fixture(), today).weeks.at(-1).lifts[0].sets, 1)
})
