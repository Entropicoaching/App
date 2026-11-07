import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanAdapter } from './planAdapter.mjs'
import { historyFixture, athleteId, coachId, date, uuid } from './dailyReference.fixture.mjs'
import { tableNames } from './coach/activation.fixture.mjs'
import { buildDailyPlanNutritionReport as report } from './rapport/nutritionReport.mjs'
const load = (f, patch = {}, options = {}) => createPlanAdapter({ enabled: true, client: f.client, athleteId, date, ...patch }).loadDailyReferences({ coachId, ...options })
const seeded = options => { const f = historyFixture(options); f.plan(); f.version(); f.approve(); return f }
const log = (on, values = {}) => ({ id: on, athlete_id: athleteId, date: on, meal: 'Synthetic consumed meal', kcal: 500, protein: 40, carb: 50, fat: 15, ...values })

test('Nov1/Nov5 lead is closed with the actual adapter/report; no-version days preserve known consumption', async () => {
  const f = historyFixture(); f.plan(1, '2026-11-05'); f.version(10, uuid(1), '2026-11-05'); f.approve(10, uuid(1), '2026-11-05T12:00:00Z')
  const before = structuredClone(f.data), refs = await load(f)
  assert.equal(refs.state, 'ready'); assert.equal(refs.days[0].state, 'unknown'); assert.equal(refs.days[0].targets.kcal, null)
  const r = report({ enabled: true, athleteId, date, dailyReferences: refs, mealLogs: [log('2026-11-01'), log('2026-11-05')] })
  assert.equal(r.days[0].totals.kcal, 500); assert.equal(r.days[0].percentages.kcal, null)
  assert.equal(r.days[4].targets.kcal, 100); assert.equal(r.days[4].percentages.kcal, 500)
  assert.deepEqual(r.week.metrics.kcal, { actual: 1000, target: null, percent: null })
  assert.equal(r.week.plannedDays, 3); assert.equal(r.week.unknownReferenceDays, 4)
  assert.deepEqual(f.data, before); assert.equal(f.writes().length, 0); assert.equal(f.calls.length, 4)
  assert.ok(f.calls.every(c => c.limit === 501 && c.count === 'exact'))
  assert.doesNotMatch(f.calls.find(c => c.table === tableNames[2]).columns, /(^|,)id(,|$)/)
})

test('midweek switch, same-day corrections and exact Postgres microsecond ordering use stored snapshots', async () => {
  const f = seeded(); f.version(11, uuid(1), '2026-11-04', 2, 200); f.approve(11, uuid(1), '2026-11-04T10:00:00.000001Z')
  f.plan(2, '2026-11-04'); f.version(12, uuid(2), '2026-11-04', 1, 300, null)
  f.approve(12, uuid(2), '2026-11-04T10:00:00.000002Z')
  const refs = await load(f)
  assert.equal(refs.state, 'ready')
  assert.deepEqual(refs.days.map(d => d.targets.kcal), [100, 100, 100, 300, 300, 300, 300])
  assert.equal(refs.days[3].versionId, uuid(12)); assert.equal(refs.days[3].targets.protein, null)
  assert.equal(refs.days[3].targets.carb, 0); assert.equal(refs.days[3].targets.fat, null)
  assert.equal(f.writes().length, 0)
})

test('same-plan timestamp tie advances version_no; cross-plan timestamp tie is conflict, never UUID time', async () => {
  const f = seeded(); f.version(11, uuid(1), '2026-11-01', 2, 200); f.approve(11)
  let refs = await load(f); assert.equal(refs.days[0].versionId, uuid(11))
  f.plan(2); f.version(12, uuid(2)); f.approve(12, uuid(2))
  refs = await load(f); assert.ok(refs.days.every(d => d.state === 'conflict' && d.targets.kcal === null))
})

test('future effective/approval dates, unapproved proposals and foreign athlete plans cannot supply targets', async () => {
  const f = seeded(); f.version(11, uuid(1), '2026-11-10', 2, 999); f.approve(11, uuid(1), '2026-11-06T10:00:00Z')
  f.version(12, uuid(1), '2026-11-05', 3, 888) // unapproved
  f.plan(2, '2026-11-01', 'godkendt', 'foreign'); f.version(13, uuid(2), '2026-11-01', 1, 777); f.approve(13, uuid(2), undefined, 'foreign')
  f.plan(3); f.version(14, uuid(3), '2026-11-01', 1, 666); f.approve(14, uuid(3), '2026-11-08T10:00:00Z')
  const refs = await load(f); assert.equal(refs.state, 'ready'); assert.ok(refs.days.every(d => d.targets.kcal === 100))
  assert.doesNotMatch(JSON.stringify(refs), /foreign|777|888|999|666/)
})

test('approval day is Copenhagen-local; a later approval never rewrites earlier days', async () => {
  const f = seeded(); f.version(11, uuid(1), '2026-11-01', 2, 200); f.approve(11, uuid(1), '2026-11-03T23:30:00Z')
  const refs = await load(f); assert.deepEqual(refs.days.map(d => d.targets.kcal), [100,100,100,200,200,200,200])
})

test('archived plans have no archive timestamp; affected days stay unknown without reviving old references', async () => {
  const f = seeded(); f.plan(2, '2026-11-03', 'arkiveret'); f.version(11, uuid(2), '2026-11-03', 1, 200); f.approve(11, uuid(2), '2026-11-03T10:00:00Z')
  const refs = await load(f); assert.deepEqual(refs.days.map(d => d.targets.kcal), [100,100,null,null,null,null,null])
  assert.equal(refs.days[2].reason, 'archive-date-unavailable')
  f.plan(3, '2026-11-06'); f.version(12, uuid(3), '2026-11-06', 1, 300); f.approve(12, uuid(3), '2026-11-06T10:00:00Z')
  assert.deepEqual((await load(f)).days.map(d => d.targets.kcal), [100,100,null,null,null,300,300])
})

test('empty successful history differs from missing/partial/errored history; actual meals survive every unavailable state', async () => {
  const empty = await load(historyFixture()); assert.equal(empty.state, 'ready'); assert.equal(empty.days[0].reason, 'no-approved-version')
  const draft = historyFixture(); draft.plan(1, '2026-11-01', 'forslag'); draft.version()
  assert.ok((await load(draft)).days.every(d => d.state === 'unknown'))
  for (const table of tableNames) for (const mode of ['missing','error','count-missing','page','cap','duplicate','foreign']) {
    const f = seeded({ response(call, rows) {
      if (call.table !== table) return { data: rows, error: null, count: rows.length }
      if (mode === 'missing') return { data: null, error: { code: '42P01' } }
      if (mode === 'error') return { data: null, error: { code: '42501' } }
      if (mode === 'count-missing') return { data: rows, error: null }
      if (mode === 'page') return { data: [], count: 1, error: null }
      if (mode === 'cap') return { data: Array(501).fill(rows[0]), count: 501, error: null }
      if (mode === 'duplicate') return { data: [...rows,...rows], count: 2*rows.length, error: null }
      const corrupt = structuredClone(rows); if (table === tableNames[1]) corrupt[0].plan_id = uuid(999); else corrupt[0].athlete_id = 'foreign'
      return { data: corrupt, count: corrupt.length, error: null }
    } })
    const refs = await load(f); assert.equal(refs.state, 'unavailable', `${table}/${mode}`)
    assert.ok(refs.days.every(d => d.state === 'unknown' && d.targets.kcal === null))
    const r = report({ enabled: true, athleteId, date, dailyReferences: refs, mealLogs: [log(date)] })
    assert.equal(r.week.metrics.kcal.actual, 500); assert.equal(r.week.metrics.kcal.percent, null)
    assert.equal(f.writes().length, 0); assert.ok(f.calls.length <= 4)
  }
})

test('transport failure, parent archive during read and cancellation stop without publishing stale history', async () => {
  const f = seeded({ before() { throw Error('synthetic offline') } })
  assert.equal((await load(f)).reason, 'read-error')
  delete f.options.before
  let current = true
  f.options.before = call => { if (call.table === tableNames[1]) current = false }
  const refs = await load(f, {}, { isCurrent: () => current })
  assert.equal(refs.reason, 'cancelled'); assert.equal(f.calls.filter(c => c.table === tableNames[2]).length, 0)
  delete f.options.before
  f.options.before = call => { if (call.table === tableNames[2]) f.data[tableNames[0]][0].status = 'arkiveret' }
  assert.equal((await load(f)).reason, 'changed-during-read')
  delete f.options.before
  assert.equal((await load(f)).state, 'ready')
})

test('malformed/foreign/stale daily contract fails; absent history stays unknown; known zero and unknown macro survive', async () => {
  const refs = await load(seeded())
  const input = { enabled: true, athleteId, date, dailyReferences: refs, mealLogs: [log(date, { kcal: 0, carb: 0, protein: null })] }
  const r = report(input); assert.equal(r.week.metrics.kcal.actual, 0); assert.equal(r.week.metrics.kcal.percent, 0)
  assert.equal(r.week.metrics.protein.actual, null); assert.equal(r.days[6].percentages.fat, null)
  for (const patch of [{ athleteId: 'foreign' }, { date: '2026-11-06' }, { days: [] }, { state: 'unavailable' }])
    assert.throws(() => report({ ...input, dailyReferences: { ...refs, ...patch } }), /Ugyldig daglig/)
  assert.equal(report({ ...input, dailyReferences: undefined }).days[6].targets.kcal, null)
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(report({ enabled, get dailyReferences() { assert.fail('OFF') } }), null)
  assert.equal(createPlanAdapter({ enabled: false, get client() { assert.fail('OFF') } }), null)
})
