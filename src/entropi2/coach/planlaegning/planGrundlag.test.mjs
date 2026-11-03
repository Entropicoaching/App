import test from 'node:test'
import assert from 'node:assert/strict'
import { planGrundlag } from './planGrundlag.mjs'
import { fixture, today } from './syntheticFixture.mjs'
const model = p => planGrundlag(p, today)

for (const count of [4, 5, 6]) test(`${count} week block: real imported calculations and immutable inputs`, () => {
  const p = fixture(count), before = structuredClone(p), m = model(p)
  assert.equal(m.state, 'ready'); assert.equal(m.weeks.length, count)
  assert.equal(m.lifts[0].points[0].tonnage, 600)
  assert.ok(Math.abs(m.lifts[0].points[0].e1rm - 110) < 1e-10)
  assert.equal(m.lifts[0].points[0].rpe, 8)
  assert.equal(m.compliance.percent, 100); assert.equal(m.weight.delta, count - 1)
  assert.equal(m.notes.length, 0); assert.deepEqual(p, before)
})

test('latest ended block wins regardless of order; active and foreign blocks excluded', () => {
  const p = fixture(), b = p.blocks.rows[0]
  p.blocks.rows.unshift({ ...b, id: 'old', start_date: '2026-08-01', end_date: '2026-08-28' },
    { ...b, id: 'active', start_date: '2026-11-01', end_date: '2026-11-28' },
    { ...b, athlete_id: 'foreign', end_date: '2026-11-09' })
  assert.equal(model(p).block.id, b.id)
  p.blocks.rows.push({ ...b, id: 'tie' }); assert.equal(model(p).state, 'unknown')
})

for (const [label, mutate] of Object.entries({
  absent: p => { delete p.blocks }, incomplete: p => { p.blocks.complete = false },
  stale: p => { p.blocks.through = '2026-11-09' }, owner: p => { p.blocks.athleteId = 'foreign' },
  short: p => { p.blocks.rows[0].end_date = '2026-10-18' },
  invalidDate: p => { p.blocks.rows[0].start_date = '2026-02-30' },
})) test(`${label} catalogue never guesses a block`, () => {
  const p = fixture(); mutate(p); assert.equal(model(p).state, 'unknown')
})

test('explicit clock is required and local Copenhagen day handles DST', () => {
  assert.equal(planGrundlag(fixture()).state, 'unknown')
  const p = fixture(); p.blocks.through = '2026-10-26'
  assert.equal(planGrundlag(p, '2026-10-25T23:30:00Z').state, 'ready')
})

for (const source of ['plan', 'logs', 'weights']) test(`${source}: missing and stale receipts stay unknown`, () => {
  for (const field of ['complete', 'athleteId', 'blockId', 'from', 'through']) {
    const p = fixture(); p[source][field] = null
    const m = model(p)
    if (source === 'weights') { assert.equal(m.weight.state, 'unknown'); assert.equal(m.weight.delta, null) }
    else { assert.equal(m.logsReady, false); assert.equal(m.compliance.percent, null); assert.equal(m.painSessions, null) }
  }
})

test('known empty logs are zero volume, missing strength and zero registered completion', () => {
  const p = fixture(); p.logs.rows = []; p.weights.rows = []
  const m = model(p)
  assert.equal(m.lifts[0].points[0].tonnage, 0); assert.equal(m.lifts[0].points[0].e1rm, null)
  assert.equal(m.compliance.percent, 0); assert.equal(m.weight.points[0].value, null)
})

test('skips and optimistic sets do not count as volume, own RPE or completion', () => {
  const p = fixture(); p.logs.rows[0].skipped = true; p.logs.rows[1]._optimistic = true
  const m = model(p)
  assert.equal(m.compliance.confirmed, 6); assert.equal(m.compliance.skipped, 1)
  assert.equal(m.compliance.percent, 75); assert.equal(m.lifts[0].points[0].rpe, null)
})

test('retries deduplicate positions, conflicting positions or IDs invalidate log basis', () => {
  const p = fixture(); p.logs.rows.push({ ...p.logs.rows[0], id: 'retry' })
  assert.equal(model(p).compliance.confirmed, 8)
  p.logs.rows.at(-1).rpe_actual = 9; assert.equal(model(p).logsReady, false)
  const q = fixture(); q.logs.rows[1].id = q.logs.rows[0].id; assert.equal(model(q).logsReady, false)
})

test('foreign rows cannot influence numbers or notes', () => {
  const p = fixture(), expected = model(p)
  for (const source of ['plan', 'logs', 'weights']) p[source].rows.push({ ...p[source].rows[0], athlete_id: 'foreign', note: 'synthetic foreign pain' })
  assert.deepEqual(model(p), expected)
})

for (const [label, mutate] of Object.entries({
  position: p => { p.logs.rows[0].set_number = 3 }, exercise: p => { p.logs.rows[0].exercise_id = 'unknown' },
  date: p => { p.logs.rows[0].logged_at = '2026-02-30' },
  week: p => { p.logs.rows[0].logged_at = '2026-10-06' },
  reps: p => { p.logs.rows[0].reps_completed = 2.5 },
  weight: p => { p.logs.rows[0].weight = Infinity },
  duplicatePlan: p => { p.plan.rows[1].sessions[0].exercises[0].id = 'e0' },
  missingWeek: p => { p.plan.rows.pop() },
})) test(`${label}: invalid plan or logs cannot manufacture compliance`, () => {
  const p = fixture(); mutate(p); assert.equal(model(p).compliance.percent, null)
})

test('variants are separate; backoff and deload add volume but not e1RM', () => {
  const p = fixture(); p.plan.rows[0].sessions[0].exercises[0].name = 'Front squat'
  p.plan.rows[1].sessions[0].exercises[0].name = 'Squat backoff'
  p.plan.rows[2].block_name = 'Deload'
  const m = model(p)
  assert.equal(m.lifts[0].points[0].sets, 0); assert.equal(m.lifts[0].points[1].sets, 2)
  assert.equal(m.lifts[0].points[1].e1rm, null); assert.equal(m.lifts[0].points[2].e1rm, null)
})

test('e1RM comparisons require same endpoint rep zone; unknown RPE is excluded', () => {
  const p = fixture(); p.logs.rows.slice(-2).forEach(r => { r.reps_completed = 5 })
  delete p.logs.rows[0].rpe_source; p.logs.rows[1].rpe_actual = 20
  const m = model(p)
  assert.equal(m.lifts[0].comparison, null); assert.equal(m.lifts[0].points[0].rpe, null)
  assert.equal(m.observations.some(o => o.includes('e1RM')), false)
})

test('weight trend uses distinct endpoint days; duplicates count once and conflict is unknown', () => {
  const p = fixture(); p.weights.rows.push({ ...p.weights.rows[0] })
  assert.equal(model(p).weight.points[0].days, 3)
  p.weights.rows.at(-1).weight = 90; assert.equal(model(p).weight.state, 'unknown')
  const q = fixture(); q.weights.rows.shift(); assert.equal(model(q).weight.delta, null)
})

test('pain and stop notes retain literal text, strip RPE proof and count distinct sessions', () => {
  const p = fixture()
  p.logs.rows[0].note = 'Smerte i knæ. Stoppet.\n[appData2-rpe-v1:[]]'
  p.logs.rows[1].note = 'Smerte i knæ igen'
  p.plan.rows[0].sessions[0].athlete_comment = '<b>Syntetisk kommentar</b>'
  const m = model(p)
  assert.equal(m.painSessions, 1); assert.equal(m.stopSessions, 1); assert.equal(m.notes.length, 3)
  assert.doesNotMatch(m.notes[0].text, /appData2/)
  assert.ok(m.notes.some(n => n.text === '<b>Syntetisk kommentar</b>'))
})

test('each main lift stays separate from the other three and numeric strings parse consistently', () => {
  const p = fixture()
  for (const [i, name] of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].entries()) {
    p.plan.rows[i].sessions[0].exercises[0].name = name
    p.logs.rows[i * 2].weight = '100,5'
  }
  const m = model(p)
  for (const [i, lift] of m.lifts.entries()) {
    assert.equal(lift.points[i].sets, 2)
    assert.equal(lift.points[(i + 1) % 4].sets, 0)
  }
  assert.equal(m.lifts[0].points[0].tonnage, 601.5)
})

test('outside-block logs do not enter volume and exact day boundaries are included', () => {
  const p = fixture()
  p.logs.rows.push({ ...p.logs.rows[0], id: 'out', logged_at: '2026-09-27' })
  p.logs.rows.at(-2).logged_at = '2026-10-25T22:59:59Z'
  assert.equal(model(p).compliance.confirmed, 8)
  p.logs.rows.at(-2).logged_at = '2026-10-25T23:00:00Z'
  assert.equal(model(p).compliance.confirmed, 7)
})

test('zero load is valid volume but missing/overflowing load cannot create a zero e1RM', () => {
  const p = fixture()
  p.logs.rows[0].weight = 0; p.logs.rows[1].weight = 0
  assert.equal(model(p).lifts[0].points[0].tonnage, 0)
  assert.equal(model(p).lifts[0].points[0].e1rm, null)
  p.logs.rows[0].weight = null; assert.equal(model(p).logsReady, false)
  const q = fixture()
  for (const r of q.logs.rows) { r.weight = Number.MAX_VALUE; r.reps_completed = 1 }
  assert.equal(model(q).lifts[0].points[0].e1rm, null)
})
