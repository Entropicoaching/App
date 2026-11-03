import test from 'node:test'
import assert from 'node:assert/strict'
import { weekEvaluation, evaluationMarks } from './evaluationModel.mjs'
import { syntheticWeek } from './syntheticFixture.mjs'

const model = mutate => { const p = syntheticWeek(); mutate?.(p); return weekEvaluation(p) }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('completed calendar week and actual per-athlete training totals', () => {
  const m = model()
  assert.deepEqual([m.start, m.end], ['2026-10-26', '2026-11-01'])
  const t = m.training
  assert.equal(t.state, 'ready')
  assert.deepEqual([t.planned, t.done, t.plannedSets, t.sets, t.skipped], [2, 1, 4, 2, 1])
  assert.deepEqual([t.rpe, t.rpeCount], [6, 1])
  close(t.lifts[0].value, 110); close(t.lifts[1].value, 50 * (1 + 5 / 30))
  assert.deepEqual(t.lifts.slice(2).map(r => r.value), [null, null])
})

test('meals aggregate per logged day, weights per day then week', () => {
  const m = model()
  assert.deepEqual({ ...m.nutrition, protein: 125 }, { state: 'ready', days: 2, kcal: 2250, protein: 125, kcalTarget: 2400, proteinTarget: 160 })
  close(m.nutrition.protein, 125)
  close(m.weights.average, 82); close(m.weights.previous, 79); close(m.weights.delta, 3)
  assert.deepEqual([m.weights.days, m.weights.previousDays], [2, 1])
})

test('missing sources stay unknown; complete empty sources show zero counts and null means', () => {
  const missing = weekEvaluation({ athleteId: 'synthetic-athlete', today: '2026-11-03' })
  for (const k of ['training', 'nutrition', 'weights']) assert.equal(missing[k].state, 'unknown')
  const empty = model(p => { for (const key of ['training', 'nutrition', 'weights', 'messages']) p[key].rows = [] })
  assert.equal(empty.training.done, 0); assert.equal(empty.nutrition.days, 0)
  assert.equal(empty.nutrition.kcal, null); assert.equal(empty.weights.average, null)
  assert.equal(empty.weights.delta, null); assert.equal(empty.notes.messageState, 'ready')
})

for (const source of ['training', 'nutrition', 'weights', 'messages']) {
  for (const [name, change] of Object.entries({
    owner: s => { s.athleteId = 'other' }, receipt: s => { s.complete = false },
    error: s => { s.state = 'error' }, loading: s => { s.state = 'loading' },
    partial: s => { s.state = 'partial' }, start: s => { s.from = '2026-10-27' },
    end: s => { s.through = '2026-10-31' }, foreign: s => { s.rows[0].athlete_id = 'other' },
  })) test(`${source}: ${name} cannot become an authoritative empty or show foreign data`, () => {
    const m = model(p => change(p[source]))
    assert.equal(source === 'messages' ? m.notes.messageState : m[source].state, 'unknown')
    if (source === 'training') assert.equal(m.notes.trainingState, 'unknown')
  })
}

test('reject invalid, current and future weeks, accept explicitly completed program week', () => {
  for (const p of [null, {}, { athleteId: 'a', today: '2026-02-30' },
    { athleteId: 'a', today: '2026-11-03', weekStart: '2026-11-02' },
    { athleteId: 'a', today: '2026-11-01', weekStart: '2026-10-26' }]) assert.equal(weekEvaluation(p).state, 'invalid')
  assert.equal(model(p => { p.weekStart = '2026-10-20' }).start, '2026-10-20')
  assert.equal(model(p => { p.today = '2026-11-02' }).start, '2026-10-26')
  assert.equal(model(p => { p.today = '2026-11-01' }).start, '2026-10-19')
})

test('Danish date boundary and DST use calendar dates, excluding adjacent weeks', () => {
  const m = model(p => {
    p.training.rows[0].logged_at = '2026-11-01T23:30:00Z' // Monday in Denmark
    p.nutrition.rows.push({ ...p.nutrition.rows[0], id: 'outside', date: '2026-11-02' })
    p.messages.rows[0].created_at = '2026-10-25T23:30:00Z' // Monday after DST change
  })
  assert.equal(m.training.sets, 1); assert.equal(m.nutrition.days, 2)
  assert.equal(m.notes.entries.find(e => e.key === 'message-message-1').day, '2026-10-26')
})

test('exact retries count once, conflicting positions are excluded in both orders', () => {
  const base = syntheticWeek(), duplicate = structuredClone(base.training.rows[0])
  base.training.rows.push({ ...duplicate, id: 'retry' })
  assert.equal(weekEvaluation(base).training.sets, 2)
  base.training.rows.push({ ...duplicate, id: 'conflict', rpe_actual: 10 })
  const a = weekEvaluation(base).training
  base.training.rows.reverse()
  const b = weekEvaluation(base).training
  assert.equal(a.state, 'partial'); assert.equal(a.sets, 1); assert.equal(a.done, 0)
  assert.equal(a.rpe, null); assert.equal(b.sets, a.sets); assert.equal(b.rpe, a.rpe)
})

test('pending, malformed and skipped RPE never inflate totals or average', () => {
  const m = model(p => {
    p.training.rows[0]._optimistic = true
    p.training.rows[1].rpe_source = 'athlete'; p.training.rows[1].rpe_actual = 10
    p.training.rows[2].rpe_source = 'athlete'; p.training.rows[2].rpe_actual = 11
  })
  assert.equal(m.training.state, 'partial'); assert.equal(m.training.done, 0)
  assert.equal(m.training.rpe, null); assert.equal(m.training.rpeCount, 0)
})

test('main lift identities, light sets, high reps, deload and missing block follow existing rules', () => {
  for (const change of [p => { p.training.week.sessions[0].exercises[0].name = 'Front squat' },
    p => { p.training.week.sessions[0].exercises[0].name = 'Squat let' },
    p => { p.training.rows[0].reps_completed = 20 },
    p => { p.training.week.block_name = 'Deload' }, p => { delete p.training.week.block_name }]) {
    assert.equal(model(change).training.lifts[0].value, null)
  }
})

test('athlete RPE marker survives reads but is hidden from note text', () => {
  const m = model(p => {
    const r = p.training.rows[0]; delete r.rpe_source
    r.note = 'Smerte\n[appData2-rpe-v1:' + JSON.stringify([r.rpe_actual, r.weight, r.reps_completed, r.logged_at]) + ']'
  })
  assert.equal(m.training.rpe, 6)
  assert.equal(m.notes.entries.some(n => n.text.includes('appData2-rpe')), false)
  assert.equal(m.notes.entries.some(n => n.marks.includes('Smerte nævnt')), true)
})

test('meal confirmations and missing targets never become zero measurements or goals', () => {
  const m = model(p => {
    p.nutrition.rows.push({ ...p.nutrition.rows[0], id: 'receipt', date: '2026-10-27', meal: ' [appData2-day-v1]metadata', kcal: 0, protein: 0 })
    delete p.nutrition.target.kcal_target
    p.nutrition.target.protein_target = 0
  })
  assert.deepEqual([m.nutrition.days, m.nutrition.kcalTarget, m.nutrition.proteinTarget], [2, null, null])
})

test('invalid nutrient fields, conflicts, and pending rows are visibly partial', () => {
  for (const change of [p => { p.nutrition.rows[0].protein = '' }, p => { p.nutrition.rows[0]._optimistic = true },
    p => { p.nutrition.rows.push({ ...p.nutrition.rows[0], kcal: 20 }) }]) assert.equal(model(change).nutrition.state, 'partial')
  assert.equal(model(p => { for (const r of p.nutrition.rows) r.kcal = 1e308 }).nutrition.state, 'unknown')
})

test('weight delta requires previous-week coverage and readings in both weeks', () => {
  const m = model(p => { p.weights.from = '2026-10-26' })
  assert.equal(m.weights.average, 82); assert.equal(m.weights.previous, null); assert.equal(m.weights.delta, null)
  assert.equal(model(p => { p.weights.rows = p.weights.rows.slice(1) }).weights.delta, null)
})

test('notes preserve content, show skip, and mark pain/stop without treating simple negation as stop', () => {
  const m = model()
  assert.equal(m.notes.entries.length, 4)
  assert.equal(m.notes.entries.some(n => n.text === 'Sprunget sæt over'), true)
  assert.deepEqual(evaluationMarks('Smerte i knæet, stoppede.'), ['Smerte nævnt', 'Stop nævnt'])
  assert.deepEqual(evaluationMarks('ikke stoppet'), [])
})

test('input snapshots remain unchanged and foreign week cannot leak comments', () => {
  const p = syntheticWeek(), before = structuredClone(p)
  weekEvaluation(p); assert.deepEqual(p, before)
  p.training.week.athlete_id = 'other'; p.training.week.sessions[0].athlete_comment = 'FOREIGN'
  const m = weekEvaluation(p)
  assert.equal(m.training.state, 'unknown'); assert.equal(JSON.stringify(m).includes('FOREIGN'), false)
})

test('invalid planned positions and row-ID collisions cannot fabricate completion', () => {
  assert.equal(model(p => { p.training.rows[0].set_number = 0 }).training.state, 'partial')
  const m = model(p => { p.training.rows[2].id = p.training.rows[0].id })
  assert.equal(m.training.state, 'partial'); assert.equal(m.training.sets, 0); assert.equal(m.training.done, 0)
})
