// Same-engine Codex self-review assertions with an independent synthetic client.
// This file does not replace the required fresh separate native review.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createKostDaySession } from './daySession.mjs'
import Frame from './KostDayFrame.mjs'

function independent() {
  const athleteId = 'independent-status', date = '2027-03-14'
  const planId = '71000000-0000-4000-8000-000000000001', versionId = '71000000-0000-4000-8000-000000000002'
  const state = { missing: true, failure: null, badProbe: false, malformed: false, approved: false, hold: null }
  const calls = [], writes = []
  const records = {
    kostplan_v1_plans: [{ id: planId, athlete_id: athleteId, valid_from: date, status: 'godkendt' }],
    kostplan_v1_versions: [{ id: versionId, plan_id: planId, version_no: 1, effective_from: date, goal: 'vedligehold', intensity: 0,
      meals: [{ name: 'Uafhængig portion', portions: [{ grams: 75, food: { id: 'independent-food', name: 'Uafhængig vare',
        source: { citation: 'synthetic independent oracle', verification: 'test' },
        nutrientsPer100g: { energyKcal: 200, proteinG: 12, carbohydrateG: 20, fatG: 4 } } }] }] }],
    kostplan_v1_approvals: [{ version_id: versionId, plan_id: planId, athlete_id: athleteId, approval_kind: 'coach', approved_at: date + 'T12:00:00Z' }],
    meal_logs: [],
  }
  const client = { from(table) {
    assert.ok(Object.hasOwn(records, table), 'only existing read tables')
    const c = { table, filters: [], columns: '', limit: Infinity }; calls.push(c)
    const q = {
      select(columns) { c.columns = columns; return q }, limit(limit) { c.limit = limit; return q }, order() { return q },
      eq(k, v) { c.filters.push(row => row[k] === v); return q },
      lte(k, v) { c.filters.push(row => row[k] <= v); return q },
      gte(k, v) { c.filters.push(row => row[k] >= v); return q },
      in(k, values) { c.filters.push(row => values.includes(row[k])); return q },
      then(resolve, reject) { return Promise.resolve().then(async () => {
        await state.hold
        if (table !== 'meal_logs' && state.missing) return { data: null, error: { code: 'PGRST205' } }
        if (state.failure) throw Error('independent synthetic network error')
        if (state.badProbe && c.limit === 0) return { data: null, error: null }
        if (state.malformed && c.limit !== 0 && table === 'kostplan_v1_plans') return { data: [null], error: null }
        const rows = state.approved || table === 'meal_logs' ? records[table] : []
        return { data: structuredClone(rows.filter(row => c.filters.every(fn => fn(row))).slice(0, c.limit)), error: null }
      }).then(resolve, reject) },
    }
    // There are deliberately no write methods. A new read-side write fails.
    return q
  } }
  const storage = { getItem: () => null, setItem: (...args) => writes.push(args) }
  const s = createKostDaySession({ enabled: true, athleteId, date, client, storage })
  const html = () => renderToStaticMarkup(h(Frame, { controller: s.controller, tracker: h('div', null, 'Independent diary') }))
  return { state, calls, writes, client, s, html, athleteId, date }
}

test('independent oracle: a shared adapter negative cache cannot block explicit current-session retries', async t => {
  const f = independent(); t.after(f.s.dispose)
  const old = createPlanAdapter({ enabled: true, athleteId: f.athleteId, date: f.date, client: f.client })
  assert.equal(await old.loadActive(), null, 'prime the original adapter negative capability cache')
  assert.equal(await f.s.controller.load(), false)
  assert.match(f.html(), /Kostplanen kunne ikke hentes/)
  assert.doesNotMatch(f.html(), /Du har ingen aktiv kostplan/)
  const queries = f.calls.length
  f.state.missing = false
  assert.equal(await f.s.controller.load(), true)
  assert.ok(f.calls.length > queries)
  assert.match(f.html(), /Du har ingen aktiv kostplan/)
  f.state.approved = true
  assert.equal(await f.s.controller.load(), true)
  const s = f.s.controller.snapshot()
  assert.equal(s.mode, 'plan')
  assert.equal(s.meals[0].foods[0].grams, 75)
  assert.deepEqual(s.meals[0].values, { kcal: 150, protein: 9, carb: 15, fat: 3 })
  assert.match(f.html(), /Spist som planlagt/)
  assert.deepEqual(f.writes, [])
})

for (const defect of ['failure', 'badProbe', 'malformed']) test(`independent oracle: ${defect} never confirms an empty plan`, async t => {
  const f = independent(); t.after(f.s.dispose); f.state.missing = false; f.state[defect] = true
  assert.equal(await f.s.controller.load(), false)
  assert.equal(f.s.controller.snapshot().phase, 'load-error')
  assert.match(f.html(), /Hent kostplan igen/)
  assert.doesNotMatch(f.html(), /Du har ingen aktiv kostplan/)
  f.state[defect] = false
  assert.equal(await f.s.controller.load(), true)
  assert.match(f.html(), /Du har ingen aktiv kostplan/)
  assert.deepEqual(f.writes, [])
})

test('independent oracle: overlapping reads publish only latest result; disposal revokes retained load', { timeout: 5000 }, async t => {
  const f = independent(); t.after(f.s.dispose)
  let release
  f.state.hold = new Promise(resolve => { release = resolve }); t.after(() => release())
  const first = f.s.controller.load()
  await new Promise(resolve => setImmediate(resolve))
  f.state.hold = null; f.state.missing = false; f.state.approved = true
  assert.equal(await f.s.controller.load(), true)
  const current = f.s.controller.snapshot()
  release(); assert.equal(await first, false)
  assert.equal(f.s.controller.snapshot(), current)
  f.s.dispose(); const before = f.calls.length
  assert.equal(await f.s.controller.load(), false)
  assert.equal(f.calls.length, before)
  assert.deepEqual(f.writes, [])
})
