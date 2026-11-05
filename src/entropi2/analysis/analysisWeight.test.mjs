import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisWeightProps, latestAnalysisWeightDate, readInitialAnalysisWeight } from './analysisWeight.mjs'
import { analysisMineData } from './analysisMineData.mjs'
import { weeklyReportModel } from './ugerapport/weeklyReportModel.mjs'

const now = new Date('2026-11-05T12:00:00Z')
const id = 'synthetic-analysis-weight'
const rows = [3, 4].map((day, i) => ({ athlete_id: id, logged_at: `2026-11-0${day}`, weight: 81.25 + i * 1.5 }))
const props = extra => ({ athlete: { id }, weightLogs: rows, weightStatus: { athleteId: id, state: 'ready' },
  fremgangLogs: [], historicalMealLogs: [], ...extra })
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }

test('initial reader scopes deduplication to the current athlete and leaves OFF reads unchanged', () => {
  const requested = { current: null }, calls = [], read = id => { calls.push(id); return Promise.resolve() }
  readInitialAnalysisWeight(true, id, requested, read)
  readInitialAnalysisWeight(true, id, requested, read)
  readInitialAnalysisWeight(true, 'synthetic-other', requested, read)
  readInitialAnalysisWeight(true, id, requested, read)
  assert.deepEqual(calls, [id, 'synthetic-other', id])
  assert.equal(readInitialAnalysisWeight(true, null, requested, read), undefined)
  const off = { get current() { throw Error('OFF ref read') } }
  readInitialAnalysisWeight(false, id, off, read)
  readInitialAnalysisWeight(false, id, off, read)
  assert.deepEqual(calls, [id, 'synthetic-other', id, id, id])
})

test('host read state defeats retained weights and secondary snapshots on every non-ready path', () => {
  for (const status of [null, undefined, { athleteId: id, state: 'error' }, { athleteId: id, state: 'loading' },
    { athleteId: 'synthetic-other', state: 'ready' }, { athleteId: 'synthetic-other', state: 'error' },
    { athleteId: id, state: 'unknown' }]) {
    const p = freeze(props({ weightStatus: status, weightLoading: false, weightError: false,
      mineData: { weights: { state: 'ready', rows: [{ athlete_id: id, date: '2026-11-04', kg: 999 }] } } }))
    const before = JSON.stringify(p), normalized = analysisWeightProps(p)
    const mine = analysisMineData(normalized, now)
    assert.equal(normalized.weightLogs, undefined)
    assert.notEqual(mine.weights.state, 'ready')
    assert.deepEqual(mine.weights.rows, [])
    assert.equal(weeklyReportModel(normalized, now).weight.delta, null)
    assert.equal(JSON.stringify(p), before)
  }
})

test('ready array and successful empty are different from missing, and legacy flags keep their contract', () => {
  const normalized = analysisWeightProps(props({ weightLoading: true, weightError: true }))
  assert.equal(normalized.weightLogs, rows)
  assert.equal(normalized.weightLoading, false); assert.equal(normalized.weightError, false)
  assert.equal(weeklyReportModel(normalized, now).weight.delta, 1.5)
  assert.deepEqual(analysisMineData(analysisWeightProps(props({ weightLogs: [] })), now).weights, { state: 'ready', rows: [] })
  assert.equal(analysisMineData(analysisWeightProps(props({ weightLogs: undefined })), now).weights.state, 'unavailable')
  for (const legacy of [{ weightLogs: rows }, { weightLogs: rows, weightError: true }, { weightLoading: true }])
    assert.equal(analysisWeightProps(legacy), legacy)
})

test('measurement date is owned, confirmed, valid, in the displayed period and unambiguous', () => {
  const read = extra => latestAnalysisWeightDate({ state: 'ready', rows: extra }, id, '2026-11-05', '2026-10-09')
  const row = extra => ({ athlete_id: id, date: '2026-11-04', kg: 82.75, ...extra })
  assert.equal(read([row(), row(), row({ date: '2026-11-05', kg: 83 }), row({ date: '2026-11-05', kg: 84 })]), '2026-11-04')
  for (const extra of [{ athlete_id: 'synthetic-other' }, { pending: true }, { _optimistic: true },
    { kg: 0 }, { kg: NaN }, { kg: Infinity }, { kg: '83' }, { date: '2026-11-06' },
    { date: '2026-10-08' }, { date: '2026-10-99' }, { date: '2026-11-04T10:00:00Z' }])
    assert.equal(read([row(extra)]), null)
  assert.equal(latestAnalysisWeightDate({ state: 'error', rows: [row()] }, id, '2026-11-05', '2026-10-09'), null)
  assert.equal(latestAnalysisWeightDate({ state: 'ready', rows: [row()] }, id, null, null), null)
})
